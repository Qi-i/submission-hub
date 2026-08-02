import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []

const cases = [
  { name: '2k-150-percent', width: 1707, height: 960, columns: 4, maxSideGutter: 18, minCardWidth: 395 },
  { name: 'standard-1440', width: 1440, height: 1000, columns: 3, maxSideGutter: 18, minCardWidth: 430 },
  { name: '2k-native', width: 2560, height: 1200, columns: 5, maxSideGutter: 90, minCardWidth: 450 },
]

function fail(message) {
  failures.push(message)
}

for (const current of cases) {
  const page = await browser.newPage({ viewport: { width: current.width, height: current.height } })
  try {
    await page.goto(`${baseUrl}?view=dashboard&theme=light&ui=luminous`, { waitUntil: 'domcontentloaded' })
    await page.locator("html[data-visual-ready='true'] .paper-grid .paper-card-v3").first().waitFor({ state: 'visible', timeout: 45000 })
    await page.waitForTimeout(350)

    const result = await page.evaluate(() => {
      const grid = document.querySelector('.paper-grid')
      const cards = Array.from(grid?.querySelectorAll('.paper-card-v3') || [])
      if (!grid || cards.length === 0) return null

      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const overlap = (left, right) => {
        if (!left || !right) return 0
        const vertical = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top)
        if (vertical <= 1) return 0
        return Math.min(left.right, right.right) - Math.max(left.left, right.left)
      }

      const gridRect = grid.getBoundingClientRect()
      const firstTop = Math.round(cards[0].getBoundingClientRect().top)
      const firstRow = cards.filter(card => Math.abs(card.getBoundingClientRect().top - firstTop) <= 2)
      const cardChecks = firstRow.map((card, index) => {
        const cardRect = card.getBoundingClientRect()
        const status = card.querySelector('.paper-status-area > .badge')
        const journal = card.querySelector('.journal-pill-button')
        const substatus = card.querySelector('.paper-substatus')
        const rail = card.querySelector('.paper-action-rail')
        const statusRect = status && visible(status) ? status.getBoundingClientRect() : null
        const journalRect = journal && visible(journal) ? journal.getBoundingClientRect() : null
        const substatusRect = substatus && visible(substatus) ? substatus.getBoundingClientRect() : null
        const railRect = rail && visible(rail) ? rail.getBoundingClientRect() : null
        return {
          index,
          width: cardRect.width,
          horizontalOverflow: card.scrollWidth - card.clientWidth,
          statusJournalOverlap: overlap(statusRect, journalRect),
          substatusRailOverlap: overlap(substatusRect, railRect),
          journalEscapes: journalRect ? journalRect.left < cardRect.left - 1 || journalRect.right > cardRect.right + 1 : false,
          railEscapes: railRect ? railRect.left < cardRect.left - 1 || railRect.right > cardRect.right + 1 : false,
        }
      })

      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
        gridLeft: gridRect.left,
        gridRight: window.innerWidth - gridRect.right,
        gridWidth: gridRect.width,
        firstRowCount: firstRow.length,
        cardChecks,
      }
    })

    if (!result) {
      fail(`${current.name}: dashboard grid is missing`)
      continue
    }

    if (result.columns !== current.columns) fail(`${current.name}: grid has ${result.columns} columns, expected ${current.columns}`)
    if (result.firstRowCount !== current.columns) fail(`${current.name}: first row has ${result.firstRowCount} cards, expected ${current.columns}`)
    if (result.gridLeft > current.maxSideGutter || result.gridRight > current.maxSideGutter) {
      fail(`${current.name}: side gutters are too large (${result.gridLeft.toFixed(1)}px / ${result.gridRight.toFixed(1)}px)`)
    }
    if (Math.abs(result.gridLeft - result.gridRight) > 2) fail(`${current.name}: workspace is not horizontally balanced`)

    for (const card of result.cardChecks) {
      if (card.width < current.minCardWidth) fail(`${current.name}/card-${card.index + 1}: width ${card.width.toFixed(1)}px is below ${current.minCardWidth}px`)
      if (card.horizontalOverflow > 2) fail(`${current.name}/card-${card.index + 1}: horizontal overflow ${card.horizontalOverflow}px`)
      if (card.statusJournalOverlap > 1) fail(`${current.name}/card-${card.index + 1}: status overlaps journal by ${card.statusJournalOverlap.toFixed(1)}px`)
      if (card.substatusRailOverlap > 1) fail(`${current.name}/card-${card.index + 1}: system status overlaps action rail by ${card.substatusRailOverlap.toFixed(1)}px`)
      if (card.journalEscapes) fail(`${current.name}/card-${card.index + 1}: journal module escapes card`)
      if (card.railEscapes) fail(`${current.name}/card-${card.index + 1}: action rail escapes card`)
    }

    details.push(`${current.name}: ${result.columns} columns; grid=${result.gridWidth.toFixed(1)}px; gutters=${result.gridLeft.toFixed(1)}/${result.gridRight.toFixed(1)}px; card=${result.cardChecks[0]?.width.toFixed(1) || 'n/a'}px`)
  } catch (error) {
    fail(`${current.name}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await page.close()
  }
}

await browser.close()

if (failures.length) {
  console.error('Responsive workspace density check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Responsive workspace density check passed.')
details.forEach(item => console.log(`- ${item}`))
