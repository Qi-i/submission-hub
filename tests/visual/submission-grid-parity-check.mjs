import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []

const cases = [
  {
    name: '2k-150-percent',
    width: 1707,
    height: 960,
    columns: 4,
    minimumWidth: { luminous: 395, 'luminous-x': 330 },
  },
  {
    name: 'standard-1440',
    width: 1440,
    height: 1000,
    columns: 3,
    minimumWidth: { luminous: 430, 'luminous-x': 360 },
  },
  {
    name: '2k-native',
    width: 2560,
    height: 1200,
    columns: 5,
    minimumWidth: { luminous: 450, 'luminous-x': 420 },
  },
]

const interfaces = ['luminous', 'luminous-x']

function fail(message) {
  failures.push(message)
}

function rectText(rect) {
  if (!rect) return 'none'
  return `${rect.left.toFixed(2)}..${rect.right.toFixed(2)} (w=${rect.width.toFixed(2)})`
}

for (const current of cases) {
  const columnsByInterface = new Map()

  for (const ui of interfaces) {
    const page = await browser.newPage({ viewport: { width: current.width, height: current.height } })
    try {
      await page.goto(`${baseUrl}?view=dashboard&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
      await page.locator("html[data-visual-ready='true'] .paper-grid .paper-card-v3").first().waitFor({ state: 'visible', timeout: 45000 })
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;}' })
      await page.waitForTimeout(100)

      const result = await page.evaluate(() => {
        const grid = document.querySelector('.paper-grid')
        const cards = Array.from(grid?.querySelectorAll('.paper-card-v3') || [])
        if (!grid || cards.length === 0) return null

        const serializeRect = rect => rect ? {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        } : null

        const gridRect = grid.getBoundingClientRect()
        const firstTop = Math.round(cards[0].getBoundingClientRect().top)
        const firstRow = cards.filter(card => Math.abs(card.getBoundingClientRect().top - firstTop) <= 2)

        const cardChecks = firstRow.map((card, index) => {
          const rect = card.getBoundingClientRect()
          const slot = card.querySelector('.paper-journal-slot')
          const journal = card.querySelector('.journal-pill-button, .journal-pill')
          const rail = card.querySelector('.paper-action-rail')
          const slotRect = slot?.getBoundingClientRect() || null
          const journalRect = journal?.getBoundingClientRect() || null
          const railRect = rail?.getBoundingClientRect() || null
          const cardStyle = getComputedStyle(card)
          const slotStyle = slot ? getComputedStyle(slot) : null
          const journalStyle = journal ? getComputedStyle(journal) : null
          return {
            index,
            width: rect.width,
            overflow: card.scrollWidth - card.clientWidth,
            cardRect: serializeRect(rect),
            slotRect: serializeRect(slotRect),
            journalRect: serializeRect(journalRect),
            railRect: serializeRect(railRect),
            journalEscapes: journalRect ? journalRect.left < rect.left - 1 || journalRect.right > rect.right + 1 : false,
            railEscapes: railRect ? railRect.left < rect.left - 1 || railRect.right > rect.right + 1 : false,
            styles: {
              cardDisplay: cardStyle.display,
              cardColumns: cardStyle.gridTemplateColumns,
              cardOverflow: cardStyle.overflow,
              slotDisplay: slotStyle?.display || '',
              slotWidth: slotStyle?.width || '',
              slotMaxWidth: slotStyle?.maxWidth || '',
              slotOverflow: slotStyle?.overflow || '',
              slotTransform: slotStyle?.transform || '',
              journalDisplay: journalStyle?.display || '',
              journalPosition: journalStyle?.position || '',
              journalWidth: journalStyle?.width || '',
              journalMaxWidth: journalStyle?.maxWidth || '',
              journalMargin: journalStyle?.margin || '',
              journalPadding: journalStyle?.padding || '',
              journalBorder: journalStyle?.borderWidth || '',
              journalBoxSizing: journalStyle?.boxSizing || '',
              journalTransform: journalStyle?.transform || '',
            },
          }
        })

        return {
          columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
          firstRowCount: firstRow.length,
          gridWidth: gridRect.width,
          gridOverflow: grid.scrollWidth - grid.clientWidth,
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          cardChecks,
        }
      })

      if (!result) {
        fail(`${current.name}/${ui}: submission grid is missing`)
        continue
      }

      columnsByInterface.set(ui, result.columns)
      if (result.columns !== current.columns) {
        fail(`${current.name}/${ui}: grid has ${result.columns} columns, expected ${current.columns}`)
      }
      if (result.firstRowCount !== current.columns) {
        fail(`${current.name}/${ui}: first row has ${result.firstRowCount} cards, expected ${current.columns}`)
      }
      if (result.gridOverflow > 2) fail(`${current.name}/${ui}: grid overflows by ${result.gridOverflow}px`)
      if (result.pageOverflow > 2) fail(`${current.name}/${ui}: page overflows by ${result.pageOverflow}px`)

      for (const card of result.cardChecks) {
        const minimum = current.minimumWidth[ui]
        if (card.width < minimum) {
          fail(`${current.name}/${ui}/card-${card.index + 1}: width ${card.width.toFixed(1)}px is below ${minimum}px`)
        }
        if (card.overflow > 2) fail(`${current.name}/${ui}/card-${card.index + 1}: horizontal overflow ${card.overflow}px`)
        if (card.journalEscapes) {
          fail(`${current.name}/${ui}/card-${card.index + 1}: journal escapes card; card=${rectText(card.cardRect)}; slot=${rectText(card.slotRect)}; journal=${rectText(card.journalRect)}; styles=${JSON.stringify(card.styles)}`)
        }
        if (card.railEscapes) {
          fail(`${current.name}/${ui}/card-${card.index + 1}: action rail escapes card; card=${rectText(card.cardRect)}; rail=${rectText(card.railRect)}`)
        }
      }

      details.push(`${current.name}/${ui}: ${result.columns} columns; grid=${result.gridWidth.toFixed(1)}px; card=${result.cardChecks[0]?.width.toFixed(1) || 'n/a'}px`)
    } catch (error) {
      fail(`${current.name}/${ui}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      await page.close()
    }
  }

  if (columnsByInterface.size === interfaces.length) {
    const luminous = columnsByInterface.get('luminous')
    const luminousX = columnsByInterface.get('luminous-x')
    if (luminous !== luminousX) {
      fail(`${current.name}: Luminous uses ${luminous} columns but Luminous X uses ${luminousX}`)
    }
  }
}

await browser.close()

if (failures.length) {
  console.error('Submission grid parity check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Submission grid parity check passed.')
details.forEach(item => console.log(`- ${item}`))
