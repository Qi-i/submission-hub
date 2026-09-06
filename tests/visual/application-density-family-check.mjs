import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []

function fail(message) { failures.push(message) }

async function open(page, view, ui = 'luminous') {
  await page.goto(`${baseUrl}?view=${view}&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
  await page.waitForTimeout(250)
}

for (const ui of ['luminous', 'luminous-x']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await open(page, 'dashboard', ui)
    const reference = await page.evaluate(() => {
      const card = document.querySelector('.paper-grid .paper-card-v3')
      const style = card ? getComputedStyle(card) : null
      const root = getComputedStyle(document.documentElement)
      return {
        font: getComputedStyle(document.body).fontFamily,
        cardRadius: style ? parseFloat(style.borderRadius) : 0,
        controlHeight: parseFloat(root.getPropertyValue('--app-control-height')) || 34,
      }
    })

    await open(page, 'preparation', ui)
    const matchNav = page.locator("button[data-section-key='match']:visible").first()
    await matchNav.waitFor({ state: 'visible', timeout: 10000 })
    await matchNav.click()
    await page.locator('.journal-match-workspace:visible').waitFor({ state: 'visible', timeout: 10000 })
    const match = await page.evaluate(() => {
      const candidate = document.querySelector('.journal-match-candidate')
      const title = candidate?.querySelector('.journal-match-candidate__head strong')
      const identity = candidate?.querySelector('.journal-match-candidate__identity')
      const panel = document.querySelector('.journal-match-candidates')
      const chips = Array.from(document.querySelectorAll('.journal-match-candidate__ranks span'))
      const colored = chips.filter(chip => {
        const bg = getComputedStyle(chip).backgroundColor
        return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
      }).length
      return {
        font: getComputedStyle(document.body).fontFamily,
        titleSize: title ? parseFloat(getComputedStyle(title).fontSize) : 0,
        identitySize: identity ? parseFloat(getComputedStyle(identity).fontSize) : 0,
        candidateRadius: candidate ? parseFloat(getComputedStyle(candidate).borderRadius) : 0,
        panelRadius: panel ? parseFloat(getComputedStyle(panel).borderRadius) : 0,
        colored,
        chipCount: chips.length,
      }
    })
    if (match.font !== reference.font) fail(`${ui}: Preparation uses a different font stack`)
    if (match.titleSize < 11.5) fail(`${ui}: Journal Match candidate title is too small (${match.titleSize}px)`)
    if (match.identitySize && match.identitySize < 10) fail(`${ui}: Journal Match identity is too small (${match.identitySize}px)`)
    if (match.candidateRadius < 10 || match.panelRadius < 14) fail(`${ui}: Journal Match geometry is outside the application family (${match.candidateRadius}/${match.panelRadius}px)`)
    if (match.chipCount && match.colored < Math.ceil(match.chipCount * 0.6)) fail(`${ui}: Journal Match loses journal semantic colours (${match.colored}/${match.chipCount})`)

    const journalEntry = page.locator("button[data-main-nav-key='journals']:visible").first()
    await journalEntry.click()
    await page.locator('.journal-center-workspace:visible .journal-center-card').first().waitFor({ state: 'visible', timeout: 10000 })
    const catalog = await page.evaluate(() => {
      const grid = document.querySelector('.journal-center-grid')
      const card = document.querySelector('.journal-center-card')
      const metrics = Array.from(document.querySelectorAll('.journal-center-card .journal-catalog-card__metrics > div'))
      const firstTop = card?.getBoundingClientRect().top || 0
      const rowCards = Array.from(document.querySelectorAll('.journal-center-card')).filter(item => Math.abs(item.getBoundingClientRect().top - firstTop) <= 2)
      return {
        columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        firstRow: rowCards.length,
        cardHeight: card ? card.getBoundingClientRect().height : 0,
        cardRadius: card ? parseFloat(getComputedStyle(card).borderRadius) : 0,
        maxMetricHeight: metrics.length ? Math.max(...metrics.map(item => item.getBoundingClientRect().height)) : 0,
        font: getComputedStyle(document.body).fontFamily,
      }
    })
    if (catalog.font !== reference.font) fail(`${ui}: Journal Center uses a different font stack`)
    if (catalog.columns < 4 || catalog.firstRow < 4) fail(`${ui}: Journal Center remains too sparse at 1440px (${catalog.columns} columns, ${catalog.firstRow} first-row cards)`)
    if (catalog.cardHeight > 275) fail(`${ui}: Journal Center cards remain too tall (${catalog.cardHeight.toFixed(1)}px)`)
    if (catalog.maxMetricHeight > 42) fail(`${ui}: Journal Center metric blocks remain too tall (${catalog.maxMetricHeight.toFixed(1)}px)`)
    if (Math.abs(catalog.cardRadius - reference.cardRadius) > 4) fail(`${ui}: Journal Center no longer belongs to the shared card family (${catalog.cardRadius}/${reference.cardRadius}px)`)

    await open(page, 'stats', ui)
    const stats = await page.evaluate(() => {
      const panel = document.querySelector('.stats-panel')
      const control = document.querySelector('.stats-module-controls button, .stats-visibility-controls button')
      return {
        font: getComputedStyle(document.body).fontFamily,
        panelRadius: panel ? parseFloat(getComputedStyle(panel).borderRadius) : 0,
        controlHeight: control ? control.getBoundingClientRect().height : 0,
      }
    })
    if (stats.font !== reference.font) fail(`${ui}: Statistics uses a different font stack`)
    if (stats.panelRadius && (stats.panelRadius < 12 || stats.panelRadius > 20)) fail(`${ui}: Statistics panel radius drifts from the application family (${stats.panelRadius}px)`)
    if (stats.controlHeight && Math.abs(stats.controlHeight - reference.controlHeight) > 2) fail(`${ui}: Statistics controls drift from the application control scale (${stats.controlHeight}/${reference.controlHeight}px)`)
  } catch (error) {
    fail(`${ui}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await page.close()
  }
}

await browser.close()

if (failures.length) {
  console.error('Application density family check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Application density family check passed.')
