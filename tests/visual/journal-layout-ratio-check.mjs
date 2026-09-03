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
        gridAutoRows: grid ? getComputedStyle(grid).gridAutoRows : '',
        gridHeight: gridRect?.height || 0,
        cards: cards.map((card, index) => {
          const rect = card.getBoundingClientRect()
          const body = card.querySelector('.journal-center-card__body')
          const bodyRect = body?.getBoundingClientRect()
          const title = body?.querySelector('h2')?.getBoundingClientRect()
          const identity = body?.querySelector('.journal-center-card__identity')?.getBoundingClientRect()
          const publisher = body?.querySelector(':scope > p')?.getBoundingClientRect()
          const children = body ? Array.from(body.children).filter(element => {
            const style = getComputedStyle(element)
            const childRect = element.getBoundingClientRect()
            return style.display !== 'none' && style.visibility !== 'hidden' && childRect.width > 0 && childRect.height > 0
          }) : []
          const contentBottom = children.length ? Math.max(...children.map(element => element.getBoundingClientRect().bottom)) : (bodyRect?.top || 0)
          return {
            index,
            height: rect.height,
            scrollWidth: card.scrollWidth,
            clientWidth: card.clientWidth,
            blankBelowContent: bodyRect ? bodyRect.bottom - contentBottom : 0,
            titleBottom: title?.bottom ?? null,
            identityTop: identity?.top ?? null,
            identityBottom: identity?.bottom ?? null,
            identityLeft: identity?.left ?? null,
            identityRight: identity?.right ?? null,
            publisherTop: publisher?.top ?? null,
            bodyLeft: bodyRect?.left ?? null,
            bodyRight: bodyRect?.right ?? null,
          }
        }),
      }
    })

    if (!library.cards.length) failures.push(`${label}: Journal Center cards are missing`)
    if (/\b1fr\b/.test(library.gridAutoRows)) failures.push(`${label}: Journal Center rows use viewport-filling 1fr tracks`)
    const maxHeight = library.cards.length ? Math.max(...library.cards.map(card => card.height)) : 0
    if (maxHeight > 340) failures.push(`${label}: Journal Center cards are excessively tall (${Math.round(maxHeight)}px)`)
    library.cards.forEach(card => {
      if (card.scrollWidth > card.clientWidth + 2) failures.push(`${label}: journal ${card.index + 1} horizontally overflows`)
      if (card.blankBelowContent > 28) failures.push(`${label}: journal ${card.index + 1} retains ${Math.round(card.blankBelowContent)}px empty body space`)
      if (card.identityTop !== null && card.titleBottom !== null && card.identityTop < card.titleBottom - 2) failures.push(`${label}: journal ${card.index + 1} identity overlaps title`)
      if (card.identityBottom !== null && card.publisherTop !== null && card.publisherTop < card.identityBottom - 2) failures.push(`${label}: journal ${card.index + 1} publisher overlaps identity`)
      if (card.identityLeft !== null && card.bodyLeft !== null && card.identityLeft < card.bodyLeft - 2) failures.push(`${label}: journal ${card.index + 1} identity escapes left edge`)
      if (card.identityRight !== null && card.bodyRight !== null && card.identityRight > card.bodyRight + 2) failures.push(`${label}: journal ${card.index + 1} identity exceeds body width`)
    })
    details.push({ label, overview, library })
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
