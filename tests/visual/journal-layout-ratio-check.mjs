import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []

await mkdir('visual-review', { recursive: true })

const viewports = [
  { label: 'wide', width: 1680, height: 1050 },
  { label: 'ultrawide', width: 2200, height: 1200 },
]

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

async function openPreparation(page, ui) {
  await page.goto(`${baseUrl}?view=preparation&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator(`html[data-ui='${ui}'][data-visual-ready='true'] .preparation-workspace:visible`).waitFor({ state: 'visible', timeout: 45000 })
  await page.locator('.preparation-workspace[data-section="overview"]:visible .prep-journal-overview-card').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(300)
}

async function openJournalLibrary(page, ui) {
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
  await page.waitForTimeout(300)
}

async function inspect(ui, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
  const label = `${ui}/${viewport.label}`

  try {
    await openPreparation(page, ui)

    const overview = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.preparation-workspace[data-section="overview"]:visible .prep-journal-overview-card'))
      return cards.map((card, index) => {
        const rect = card.getBoundingClientRect()
        const title = card.querySelector('.prep-overview-journal-title b')?.getBoundingClientRect()
        const identity = card.querySelector('.prep-journal-local-identity')?.getBoundingClientRect()
        const publisher = card.querySelector('.prep-overview-journal-title small')?.getBoundingClientRect()
        const rank = card.querySelector('.prep-journal-rank-blocks')?.getBoundingClientRect()
        const meta = card.querySelector('.prep-overview-journal-meta')?.getBoundingClientRect()
        const contentBottom = Math.max(rect.top, title?.bottom || rect.top, identity?.bottom || rect.top, publisher?.bottom || rect.top, rank?.bottom || rect.top, meta?.bottom || rect.top)
        return {
          index,
          height: rect.height,
          clientHeight: card.clientHeight,
          scrollHeight: card.scrollHeight,
          identityTop: identity?.top ?? null,
          identityBottom: identity?.bottom ?? null,
          titleBottom: title?.bottom ?? null,
          publisherTop: publisher?.top ?? null,
          contentBottom,
          cardBottom: rect.bottom,
        }
      })
    })

    overview.forEach(card => {
      if (card.scrollHeight > card.clientHeight + 2) failures.push(`${label}: overview journal ${card.index + 1} is vertically clipped`)
      if (card.contentBottom > card.cardBottom - 3) failures.push(`${label}: overview journal ${card.index + 1} content reaches outside its card`)
      if (card.identityTop !== null && card.titleBottom !== null && card.identityTop < card.titleBottom - 2) failures.push(`${label}: overview journal ${card.index + 1} Chinese identity overlaps the English name`)
      if (card.identityBottom !== null && card.publisherTop !== null && card.publisherTop < card.identityBottom - 2) failures.push(`${label}: overview journal ${card.index + 1} publisher overlaps the Chinese identity`)
    })

    await openJournalLibrary(page, ui)

    const library = await page.evaluate(() => {
      const grid = document.querySelector('.preparation-workspace[data-section="journals"]:visible .journal-grid:visible')
      const cards = grid ? Array.from(grid.querySelectorAll('.prep-journal-card')) : []
      const gridRect = grid?.getBoundingClientRect()
      return {
        gridAutoRows: grid ? getComputedStyle(grid).gridAutoRows : '',
        gridHeight: gridRect?.height || 0,
        cards: cards.map((card, index) => {
          const rect = card.getBoundingClientRect()
          const main = card.querySelector('.prep-journal-card-main')
          const mainRect = main?.getBoundingClientRect()
          const title = main?.querySelector(':scope > h3')?.getBoundingClientRect()
          const identity = main?.querySelector(':scope > .prep-journal-local-identity')?.getBoundingClientRect()
          const publisher = main?.querySelector(':scope > .prep-journal-publisher')?.getBoundingClientRect()
          const children = main ? Array.from(main.children).filter(element => {
            const style = getComputedStyle(element)
            const childRect = element.getBoundingClientRect()
            return style.display !== 'none' && style.visibility !== 'hidden' && childRect.width > 0 && childRect.height > 0
          }) : []
          const contentBottom = children.length ? Math.max(...children.map(element => element.getBoundingClientRect().bottom)) : (mainRect?.top || 0)
          return {
            index,
            height: rect.height,
            mainBottom: mainRect?.bottom ?? 0,
            blankBelowContent: mainRect ? mainRect.bottom - contentBottom : 0,
            titleBottom: title?.bottom ?? null,
            identityTop: identity?.top ?? null,
            identityBottom: identity?.bottom ?? null,
            identityLeft: identity?.left ?? null,
            identityRight: identity?.right ?? null,
            publisherTop: publisher?.top ?? null,
            mainLeft: mainRect?.left ?? null,
            mainRight: mainRect?.right ?? null,
          }
        }),
      }
    })

    if (!library.cards.length) failures.push(`${label}: journal library cards are missing`)
    if (/\b1fr\b/.test(library.gridAutoRows)) failures.push(`${label}: journal rows still use viewport-filling 1fr tracks`)

    const maxHeight = library.cards.length ? Math.max(...library.cards.map(card => card.height)) : 0
    if (maxHeight > 340) failures.push(`${label}: journal cards remain excessively tall (${Math.round(maxHeight)}px)`)

    library.cards.forEach(card => {
      if (card.blankBelowContent > 110) failures.push(`${label}: journal ${card.index + 1} retains ${Math.round(card.blankBelowContent)}px of empty body space`)
      if (card.identityTop !== null && card.titleBottom !== null && card.identityTop < card.titleBottom - 2) failures.push(`${label}: journal ${card.index + 1} Chinese identity overlaps the title`)
      if (card.identityBottom !== null && card.publisherTop !== null && card.publisherTop < card.identityBottom - 2) failures.push(`${label}: journal ${card.index + 1} Chinese identity is displaced below the publisher`)
      if (card.identityLeft !== null && card.mainLeft !== null && card.identityLeft > card.mainLeft + 18) failures.push(`${label}: journal ${card.index + 1} Chinese identity is horizontally displaced`)
      if (card.identityRight !== null && card.mainRight !== null && card.identityRight > card.mainRight + 2) failures.push(`${label}: journal ${card.index + 1} Chinese identity exceeds the card width`)
    })

    details.push({ label, overview, library })

    if (viewport.label === 'ultrawide') {
      await page.screenshot({ path: `visual-review/${ui}-journal-library-ultrawide.png`, fullPage: false })
    }
  } catch (error) {
    failures.push(`${label}: ${errorMessage(error)}`)
  } finally {
    await page.close()
  }
}

try {
  for (const ui of ['luminous', 'luminous-x']) {
    for (const viewport of viewports) await inspect(ui, viewport)
  }
} finally {
  console.log(JSON.stringify({ failures, details }, null, 2))
  await browser.close()
}

if (failures.length) throw new Error(failures.join(' | '))
