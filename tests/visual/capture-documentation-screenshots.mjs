import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const outputDir = 'docs/screenshots'
const desktopViewport = { width: 1440, height: 900 }
const mobileViewport = { width: 390, height: 700 }

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function openVisualPage(page, { ui, view, theme = 'light', selector }) {
  await page.goto(`${baseUrl}?view=${view}&theme=${theme}&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  const readySelector = view === 'editor'
    ? `html[data-ui='${ui}'][data-modal-scroll-ready='true']`
    : `html[data-ui='${ui}'][data-visual-ready='true']`
  await page.locator(readySelector).waitFor({ state: 'attached', timeout: 45000 })
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 15000 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(250)
}

async function capturePage({ ui, view, theme = 'light', selector, path, viewport = desktopViewport }) {
  const page = await browser.newPage({ viewport })
  try {
    await openVisualPage(page, { ui, view, theme, selector })
    await page.screenshot({ path: `${outputDir}/${path}`, fullPage: false })
  } finally {
    await page.close()
  }
}

async function openJournalLibrary(page, ui) {
  await openVisualPage(page, {
    ui,
    view: 'preparation',
    selector: '.preparation-workspace:visible',
  })

  if (ui === 'luminous-x') {
    const proxyButton = page.locator(".lx-status-bar[data-page='preparation'] .lx-page-proxy-controls").getByRole('button', { name: /期刊库/ }).first()
    if (await proxyButton.isVisible()) {
      await proxyButton.click({ force: true })
    } else {
      await page.locator(".preparation-workspace:visible .prep-nav button[data-tone='journal']:visible").first().click({ force: true })
    }
  } else {
    await page.locator(".preparation-workspace:visible .prep-nav button[data-tone='journal']:visible").first().click({ force: true })
  }

  await page.locator('.preparation-workspace[data-section="journals"]:visible .journal-grid:visible').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
}

async function captureJournalLibrary(ui, path) {
  const page = await browser.newPage({ viewport: desktopViewport })
  try {
    await openJournalLibrary(page, ui)
    await page.screenshot({ path: `${outputDir}/${path}`, fullPage: false })
  } finally {
    await page.close()
  }
}

async function captureReviewLookup() {
  const page = await browser.newPage({ viewport: desktopViewport })
  const journalUrl = 'https://www.sciencedirect.com/journal/journal-of-rock-mechanics-and-geotechnical-engineering'
  try {
    await page.route('https://r.jina.ai/**', async route => {
      const requestUrl = decodeURIComponent(route.request().url())
      const isInsights = requestUrl.includes('/journal/journal-of-rock-mechanics-and-geotechnical-engineering/about/insights')
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: isInsights
          ? '# Journal Insights\n\nPublishing timeline\n\n2 days\n\nSubmission to first decision\n\n49 days\n\nSubmission to decision after review\n\n174 days\n\nSubmission to acceptance\n\nAcceptance rate\n\n16%\n\nAcceptance Rate'
          : '# Journal homepage\n\nView all insights\n\nNo timeline values are exposed on this summary page.',
      })
    })

    await openJournalLibrary(page, 'luminous-x')
    await page.locator('.preparation-workspace[data-section="journals"]:visible .prep-journal-card-main').first().click()
    const modal = page.locator('.journal-form-modal:visible').first()
    await modal.waitFor({ state: 'visible', timeout: 15000 })

    await modal.locator('.prep-field', { hasText: '期刊官网' }).locator('input').first().fill(journalUrl)
    await modal.locator('.prep-field', { hasText: '审稿周期来源' }).locator('input').first().fill('')
    await modal.getByRole('button', { name: '获取审稿周期' }).click()

    await page.waitForFunction(() => {
      const modalElement = document.querySelector('.journal-form-modal')
      if (!modalElement) return false
      const fieldValue = label => Array.from(modalElement.querySelectorAll('.prep-field'))
        .find(field => field.querySelector(':scope > span')?.textContent?.trim().includes(label))
        ?.querySelector('input')?.value || ''
      return fieldValue('首轮决定') === '2' && fieldValue('总审稿周期') === '174' && fieldValue('接收率') === '16'
    }, undefined, { timeout: 15000 })

    await page.screenshot({ path: `${outputDir}/luminous-x-review-lookup.png`, fullPage: false })
  } finally {
    await page.close()
  }
}

try {
  await capturePage({ ui: 'luminous', view: 'dashboard', selector: '.paper-card-v3', path: 'luminous-dashboard.png' })
  await capturePage({ ui: 'luminous', view: 'preparation', selector: '.preparation-workspace', path: 'luminous-preparation.png' })
  await captureJournalLibrary('luminous', 'luminous-journals.png')
  await capturePage({ ui: 'luminous', view: 'stats', selector: '.stats-panel', path: 'luminous-statistics.png' })

  await capturePage({ ui: 'luminous-x', view: 'dashboard', selector: '.paper-card-v3', path: 'luminous-x-dashboard.png' })
  await capturePage({ ui: 'luminous-x', view: 'preparation', selector: '.preparation-workspace', path: 'luminous-x-preparation.png' })
  await captureJournalLibrary('luminous-x', 'luminous-x-journals.png')
  await capturePage({ ui: 'luminous-x', view: 'stats', selector: '.stats-panel', path: 'luminous-x-statistics.png' })

  await capturePage({ ui: 'luminous-x', view: 'dashboard', theme: 'dark', selector: '.paper-card-v3', path: 'luminous-x-dark.png' })
  await capturePage({ ui: 'luminous-x', view: 'dashboard', selector: '.paper-card-v3', path: 'luminous-x-mobile.png', viewport: mobileViewport })
  await capturePage({ ui: 'luminous-x', view: 'editor', selector: '.compact-form-footer', path: 'luminous-x-editor.png' })
  await captureReviewLookup()
} finally {
  await browser.close()
}
