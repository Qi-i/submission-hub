import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []

async function openJournalCenter(page, ui = 'luminous') {
  await page.goto(`${baseUrl}?view=preparation&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
  const entry = page.locator("button[data-main-nav-key='journals']:visible").first()
  await entry.waitFor({ state: 'visible', timeout: 15000 })
  await entry.click()
  await page.locator('.journal-center-workspace:visible .journal-center-card:visible').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(250)
}

try {
  for (const ui of ['luminous', 'luminous-x']) {
    const page = await browser.newPage({ viewport: { width: 2048, height: 1085 } })
    try {
      await openJournalCenter(page, ui)
      const result = await page.evaluate(() => {
        const failures = []
        const cards = Array.from(document.querySelectorAll('.journal-center-workspace .journal-center-card'))
        cards.forEach((card, index) => {
          const oa = card.querySelector('.journal-catalog-card__oa')
          const oaLabel = card.querySelector('.journal-catalog-card__oa-label')
          if (!oa || !oaLabel) failures.push(`journal ${index + 1}: OA mode is not rendered as a dedicated readable label`)
          else {
            const oaRect = oa.getBoundingClientRect()
            if (oaRect.width < 68) failures.push(`journal ${index + 1}: OA badge is visibly collapsed (${oaRect.width.toFixed(1)}px)`)
            if (oa.scrollWidth > oa.clientWidth + 1 || oaLabel.scrollWidth > oaLabel.clientWidth + 1) failures.push(`journal ${index + 1}: OA mode is clipped`)
          }

          const metrics = card.querySelector('.journal-catalog-card__metrics')
          const metricCards = metrics ? Array.from(metrics.children).filter(node => node instanceof HTMLElement && getComputedStyle(node).display !== 'none') : []
          if (metrics && metricCards.length) {
            if (getComputedStyle(metrics).display !== 'grid') failures.push(`journal ${index + 1}: metric rail still inherits flexible full-width stretching`)
            metricCards.forEach((metric, metricIndex) => {
              const rect = metric.getBoundingClientRect()
              if (rect.width > 190) failures.push(`journal ${index + 1}: metric ${metricIndex + 1} stretches too wide (${rect.width.toFixed(1)}px)`)
              if (metric.scrollWidth > metric.clientWidth + 1 || metric.scrollHeight > metric.clientHeight + 1) failures.push(`journal ${index + 1}: metric ${metricIndex + 1} content is clipped`)
              const label = metric.querySelector('.journal-metric-label')
              const value = metric.querySelector('.journal-metric-value')
              if (!label || !value) failures.push(`journal ${index + 1}: metric ${metricIndex + 1} lacks explicit label/value hierarchy`)
            })
          }

          const apc = card.querySelector('.prep-journal-apc-metric')
          if (apc) {
            const estimate = apc.querySelector('.prep-journal-apc-cny')
            if (estimate && (estimate.scrollWidth > estimate.clientWidth + 1 || estimate.getBoundingClientRect().right > apc.getBoundingClientRect().right + 1)) failures.push(`journal ${index + 1}: APC CNY estimate overflows its metric`)
          }

          const footer = card.querySelector('.journal-center-card__links')
          if (footer) {
            const style = getComputedStyle(footer)
            if (style.backgroundImage !== 'none' || !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.backgroundColor)) failures.push(`journal ${index + 1}: footer is rendered as a heavy empty strip instead of inline actions`)
          }
        })
        return failures
      })
      failures.push(...result.map(message => `${ui}: ${message}`))
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify({ failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
