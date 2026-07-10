import { chromium } from 'playwright'

const url = 'http://127.0.0.1:4174/tests/visual/index.html?view=dashboard&theme=light'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

try {
  await page.goto(url)
  await page.locator("html[data-visual-ready='true'] .paper-card-v3").first().waitFor({ state: 'visible', timeout: 45000 })
  await page.waitForTimeout(250)

  const result = await page.evaluate(() => {
    const tolerance = 1.5
    const failures = []
    const metrics = document.querySelector('.dashboard-metrics')
    const grid = document.querySelector('.paper-grid')
    const cards = Array.from(document.querySelectorAll('.paper-card-v3'))

    if (!metrics || !grid || cards.length === 0) {
      return { failures: ['dashboard geometry is incomplete'], details: {} }
    }

    const metricsRect = metrics.getBoundingClientRect()
    const gridRect = grid.getBoundingClientRect()
    if (Math.abs(metricsRect.left - gridRect.left) > tolerance) failures.push('metrics and card grid left edges differ')
    if (Math.abs(metricsRect.right - gridRect.right) > tolerance) failures.push('metrics and card grid right edges differ')

    const rowTop = Math.min(...cards.map(card => card.getBoundingClientRect().top))
    const firstRow = cards.filter(card => Math.abs(card.getBoundingClientRect().top - rowTop) <= tolerance)
    const rowHeights = firstRow.map(card => card.getBoundingClientRect().height)
    if (rowHeights.length > 1 && Math.max(...rowHeights) - Math.min(...rowHeights) > tolerance) {
      failures.push('cards in the same row are not equal height')
    }

    const card = cards.find(item => item.querySelector('.journal-pill'))
    if (!card) return { failures: [...failures, 'journal pill is missing'], details: {} }

    const status = card.querySelector('.paper-status-area > .badge')
    const pill = card.querySelector('.journal-pill')
    const icon = card.querySelector('.journal-pill-icon')
    const text = card.querySelector('.journal-pill-text')
    if (!status || !pill || !icon || !text) return { failures: [...failures, 'paper header elements are incomplete'], details: {} }

    const statusRect = status.getBoundingClientRect()
    const pillRect = pill.getBoundingClientRect()
    if (Math.abs(statusRect.height - pillRect.height) > tolerance) failures.push('status and journal pills have different heights')

    const pillStyle = getComputedStyle(pill)
    const expectedWidth = icon.getBoundingClientRect().width
      + text.scrollWidth
      + Number.parseFloat(pillStyle.paddingLeft)
      + Number.parseFloat(pillStyle.paddingRight)
      + Number.parseFloat(pillStyle.borderLeftWidth)
      + Number.parseFloat(pillStyle.borderRightWidth)
      + 8
    if (pillRect.width - expectedWidth > 2) failures.push('journal pill contains unnecessary blank width')

    const cardRect = card.getBoundingClientRect()
    const cardStyle = getComputedStyle(card)
    const expectedRight = cardRect.right - Number.parseFloat(cardStyle.paddingRight) - Number.parseFloat(cardStyle.borderRightWidth)
    if (Math.abs(expectedRight - pillRect.right) > 3) failures.push('journal pill is not right aligned to the card content edge')

    const accent = getComputedStyle(card, '::before')
    const accentLeft = Number.parseFloat(accent.left)
    const accentRight = Number.parseFloat(accent.right)
    const accentTop = Number.parseFloat(accent.top)
    if (accentLeft < 18 || accentRight < 18 || accentTop < 4) failures.push('card accent line is not safely inset from rounded corners')

    return {
      failures,
      details: {
        metrics: { left: metricsRect.left, right: metricsRect.right },
        grid: { left: gridRect.left, right: gridRect.right },
        rowHeights,
        statusHeight: statusRect.height,
        journalHeight: pillRect.height,
        journalWidth: pillRect.width,
        expectedJournalWidth: expectedWidth,
        journalRight: pillRect.right,
        expectedJournalRight: expectedRight,
        accent: { left: accentLeft, right: accentRight, top: accentTop },
      },
    }
  })

  console.log(JSON.stringify(result, null, 2))
  await page.screenshot({ path: 'visual-review/layout-verified-light-desktop.png', fullPage: false })
  if (result.failures.length > 0) throw new Error(result.failures.join(' | '))
} finally {
  await browser.close()
}
