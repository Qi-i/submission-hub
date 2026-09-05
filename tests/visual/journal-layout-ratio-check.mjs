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
const errorMessage = error => error instanceof Error ? error.message : String(error)

async function submissionReference(page, ui) {
  await page.goto(`${baseUrl}?view=dashboard&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true'] .paper-grid .paper-card-v3").first().waitFor({ state: 'visible', timeout: 45000 })
  return page.evaluate(() => {
    const grid = document.querySelector('.paper-grid')
    const card = grid?.querySelector('.paper-card-v3')
    if (!grid || !card) return null
    return {
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
      gridLeft: grid.getBoundingClientRect().left,
      gridRight: grid.getBoundingClientRect().right,
      cardWidth: card.getBoundingClientRect().width,
    }
  })
}

async function openPreparation(page, ui) {
  await page.goto(`${baseUrl}?view=preparation&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator(`html[data-ui='${ui}'][data-visual-ready='true'] .preparation-workspace:visible`).waitFor({ state: 'visible', timeout: 45000 })
  await page.locator('.preparation-workspace[data-section="overview"]:visible .prep-journal-overview-card').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(250)
}

async function openJournalCenter(page) {
  const entry = page.locator("button[data-main-nav-key='journals']:visible").first()
  await entry.click()
  await page.locator('.journal-center-workspace:visible .journal-center-grid:visible').waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(220)
}

async function inspect(ui, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
  const label = `${ui}/${viewport.label}`
  try {
    const reference = await submissionReference(page, ui)
    if (!reference) {
      failures.push(`${label}: Submission Management reference is missing`)
      return
    }

    await openPreparation(page, ui)
    const overview = await page.evaluate(() => {
      const root = document.querySelector('.preparation-workspace[data-section="overview"]')
      const cards = root ? Array.from(root.querySelectorAll('.prep-journal-overview-card')) : []
      return cards.map((card, index) => {
        const rect = card.getBoundingClientRect()
        const title = card.querySelector('.prep-overview-journal-title b')?.getBoundingClientRect()
        const identity = card.querySelector('.prep-journal-local-identity')?.getBoundingClientRect()
        const publisher = card.querySelector('.prep-overview-journal-title small')?.getBoundingClientRect()
        const rank = card.querySelector('.prep-journal-rank-blocks')?.getBoundingClientRect()
        const meta = card.querySelector('.prep-overview-journal-meta')?.getBoundingClientRect()
        const contentBottom = Math.max(rect.top, title?.bottom || rect.top, identity?.bottom || rect.top, publisher?.bottom || rect.top, rank?.bottom || rect.top, meta?.bottom || rect.top)
        return { index, clientHeight: card.clientHeight, scrollHeight: card.scrollHeight, titleBottom: title?.bottom ?? null, identityTop: identity?.top ?? null, identityBottom: identity?.bottom ?? null, publisherTop: publisher?.top ?? null, contentBottom, cardBottom: rect.bottom }
      })
    })
    if (!overview.length) failures.push(`${label}: overview journal cards are missing`)
    overview.forEach(card => {
      if (card.scrollHeight > card.clientHeight + 2) failures.push(`${label}: overview journal ${card.index + 1} is vertically clipped`)
      if (card.contentBottom > card.cardBottom - 2) failures.push(`${label}: overview journal ${card.index + 1} content escapes its card`)
      if (card.identityTop !== null && card.titleBottom !== null && card.identityTop < card.titleBottom - 2) failures.push(`${label}: overview journal ${card.index + 1} identity overlaps English title`)
      if (card.identityBottom !== null && card.publisherTop !== null && card.publisherTop < card.identityBottom - 2) failures.push(`${label}: overview journal ${card.index + 1} publisher overlaps identity`)
    })

    await openJournalCenter(page)
    const toolbarGeometry = await page.evaluate(() => {
      const toolbar = document.querySelector('.journal-center-workspace .journal-center-toolbar')
      const search = toolbar?.querySelector('.journal-center-search')
      if (!toolbar || !search) return null
      const toolbarRect = toolbar.getBoundingClientRect()
      const searchRect = search.getBoundingClientRect()
      return {
        clientHeight: toolbar.clientHeight,
        scrollHeight: toolbar.scrollHeight,
        clientWidth: toolbar.clientWidth,
        scrollWidth: toolbar.scrollWidth,
        toolbar: toolbarRect.toJSON(),
        search: searchRect.toJSON(),
      }
    })
    if (!toolbarGeometry) failures.push(`${label}: Journal Center toolbar/search is missing`)
    else {
      if (toolbarGeometry.scrollHeight > toolbarGeometry.clientHeight + 2) failures.push(`${label}: Journal Center toolbar clips vertically (${toolbarGeometry.clientHeight}/${toolbarGeometry.scrollHeight}px)`)
      if (toolbarGeometry.scrollWidth > toolbarGeometry.clientWidth + 2) failures.push(`${label}: Journal Center toolbar clips horizontally (${toolbarGeometry.clientWidth}/${toolbarGeometry.scrollWidth}px)`)
      if (toolbarGeometry.search.top < toolbarGeometry.toolbar.top - 1 || toolbarGeometry.search.bottom > toolbarGeometry.toolbar.bottom + 1) failures.push(`${label}: Journal Center search is vertically outside toolbar`)
      if (toolbarGeometry.search.left < toolbarGeometry.toolbar.left - 1 || toolbarGeometry.search.right > toolbarGeometry.toolbar.right + 1) failures.push(`${label}: Journal Center search is horizontally outside toolbar`)
    }

    const library = await page.evaluate(() => {
      const grid = document.querySelector('.journal-center-workspace .journal-center-grid')
      const cards = grid ? Array.from(grid.querySelectorAll('.journal-center-card')) : []
      const gridRect = grid?.getBoundingClientRect()
      return {
        isPaperGrid: !!grid?.classList.contains('paper-grid'),
        columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        gridLeft: gridRect?.left || 0,
        gridRight: gridRect?.right || 0,
        gridHeight: gridRect?.height || 0,
        cards: cards.map((card, index) => {
          const rect = card.getBoundingClientRect()
          const title = card.querySelector('.journal-catalog-card__title-block > .card-title')?.getBoundingClientRect()
          const identity = card.querySelector('.journal-catalog-card__title-block > .card-subtitle')?.getBoundingClientRect()
          const publisher = card.querySelector('.journal-catalog-card__publisher-rail')?.getBoundingClientRect()
          const footer = card.querySelector('.journal-catalog-card__footer')?.getBoundingClientRect()
          return {
            index,
            isPaperCard: card.classList.contains('paper-card-v3'),
            width: rect.width,
            height: rect.height,
            scrollWidth: card.scrollWidth,
            clientWidth: card.clientWidth,
            scrollHeight: card.scrollHeight,
            clientHeight: card.clientHeight,
            titleBottom: title?.bottom ?? null,
            identityTop: identity?.top ?? null,
            identityRight: identity?.right ?? null,
            cardRight: rect.right,
            publisherBottom: publisher?.bottom ?? null,
            titleTop: title?.top ?? null,
            footerBottom: footer?.bottom ?? null,
            cardBottom: rect.bottom,
          }
        }),
      }
    })

    if (!library.isPaperGrid) failures.push(`${label}: Journal Center is not using paper-grid`)
    if (library.columns !== reference.columns) failures.push(`${label}: Journal Center columns diverge from Submission Management (${library.columns}/${reference.columns})`)
    if (Math.abs(library.gridLeft - reference.gridLeft) > 3 || Math.abs(library.gridRight - reference.gridRight) > 3) failures.push(`${label}: Journal Center horizontal lane diverges from Submission Management`)
    if (!library.cards.length) failures.push(`${label}: Journal Center cards are missing`)
    library.cards.forEach(card => {
      if (!card.isPaperCard) failures.push(`${label}: journal ${card.index + 1} is not a paper-card-v3`)
      if (Math.abs(card.width - reference.cardWidth) > 4) failures.push(`${label}: journal ${card.index + 1} width diverges from Submission Management`)
      if (card.scrollWidth > card.clientWidth + 2) failures.push(`${label}: journal ${card.index + 1} horizontally overflows`)
      if (card.scrollHeight > card.clientHeight + 2) failures.push(`${label}: journal ${card.index + 1} vertically clips content`)
      if (card.identityTop !== null && card.titleBottom !== null && card.identityTop < card.titleBottom - 2) failures.push(`${label}: journal ${card.index + 1} Chinese identity overlaps title`)
      if (card.identityRight !== null && card.identityRight > card.cardRight + 2) failures.push(`${label}: journal ${card.index + 1} Chinese identity escapes card`)
      if (card.publisherBottom !== null && card.titleTop !== null && card.publisherBottom > card.titleTop + 2) failures.push(`${label}: journal ${card.index + 1} publisher rail overlaps title`)
      if (card.footerBottom !== null && card.footerBottom > card.cardBottom + 2) failures.push(`${label}: journal ${card.index + 1} footer escapes card`)
    })

    details.push({ label, reference, overview, library })
    if (viewport.label === 'ultrawide') await page.screenshot({ path: `visual-review/${ui}-journal-library-ultrawide.png`, fullPage: false })
  } catch (error) {
    failures.push(`${label}: ${errorMessage(error)}`)
  } finally {
    await page.close()
  }
}

try {
  for (const ui of ['luminous', 'luminous-x']) for (const viewport of viewports) await inspect(ui, viewport)
} finally {
  console.log(JSON.stringify({ failures, details }, null, 2))
  await browser.close()
}
if (failures.length) throw new Error(failures.join(' | '))
