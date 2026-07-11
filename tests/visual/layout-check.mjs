import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const tolerance = 1.5
const failures = []
const details = {}

async function openView(view, selector) {
  await page.goto(`${baseUrl}?view=${view}&theme=light`)
  await page.locator(`html[data-visual-ready='true'] ${selector}`).first().waitFor({ state: 'visible', timeout: 45000 })
  await page.waitForTimeout(250)
}

try {
  await openView('dashboard', '.paper-card-v3')

  const dashboard = await page.evaluate((tol) => {
    const failures = []
    const metrics = document.querySelector('.dashboard-metrics, .stats-bar')
    const grid = document.querySelector('.paper-grid')
    const cards = Array.from(document.querySelectorAll('.paper-card-v3'))

    if (!metrics || !grid || cards.length === 0) {
      return { failures: ['dashboard geometry is incomplete'], details: {} }
    }

    const metricsRect = metrics.getBoundingClientRect()
    const gridRect = grid.getBoundingClientRect()
    if (Math.abs(metricsRect.left - gridRect.left) > tol) failures.push('metrics and card grid left edges differ')
    if (Math.abs(metricsRect.right - gridRect.right) > tol) failures.push('metrics and card grid right edges differ')

    const rows = new Map()
    for (const card of cards) {
      const rect = card.getBoundingClientRect()
      const key = Math.round(rect.top)
      const row = rows.get(key) || []
      row.push(rect.height)
      rows.set(key, row)
    }
    for (const heights of rows.values()) {
      if (heights.length > 1 && Math.max(...heights) - Math.min(...heights) > tol) failures.push('cards in the same row are not equal height')
    }

    const cardChecks = []
    for (const [index, card] of cards.entries()) {
      const status = card.querySelector('.paper-status-area > .badge')
      const pill = card.querySelector('.journal-pill')
      const slot = card.querySelector('.paper-journal-slot')
      const substatus = card.querySelector('.paper-substatus')
      const cardRect = card.getBoundingClientRect()
      const cardStyle = getComputedStyle(card)
      const check = { index, journal: null, substatus: null }

      if (pill) {
        const icon = pill.querySelector('.journal-pill-icon')
        const text = pill.querySelector('.journal-pill-text')
        if (!status || !icon || !text || !slot) {
          failures.push(`card ${index + 1}: paper header elements are incomplete`)
        } else {
          const statusRect = status.getBoundingClientRect()
          const pillRect = pill.getBoundingClientRect()
          const pillStyle = getComputedStyle(pill)
          const expectedWidth = icon.getBoundingClientRect().width
            + text.scrollWidth
            + Number.parseFloat(pillStyle.paddingLeft)
            + Number.parseFloat(pillStyle.paddingRight)
            + Number.parseFloat(pillStyle.borderLeftWidth)
            + Number.parseFloat(pillStyle.borderRightWidth)
            + 8
          const expectedRight = cardRect.right - Number.parseFloat(cardStyle.paddingRight) - Number.parseFloat(cardStyle.borderRightWidth)

          if (Math.abs(statusRect.height - pillRect.height) > tol) failures.push(`card ${index + 1}: status and journal pills have different heights`)
          if (pillRect.width - expectedWidth > 3) failures.push(`card ${index + 1}: journal pill contains unnecessary blank width`)
          if (Math.abs(expectedRight - pillRect.right) > 3) failures.push(`card ${index + 1}: journal pill is not right aligned`)

          check.journal = { height: pillRect.height, width: pillRect.width, expectedWidth, right: pillRect.right, expectedRight }
        }
      }

      if (substatus && status) {
        const statusRect = status.getBoundingClientRect()
        const subRect = substatus.getBoundingClientRect()
        const style = getComputedStyle(substatus)
        if (style.display === 'none' || Number(style.opacity || 1) < 0.65 || subRect.height < 18) failures.push(`card ${index + 1}: substatus is not visually prominent`)
        if (subRect.top < statusRect.bottom - 1) failures.push(`card ${index + 1}: substatus overlaps main status`)
        check.substatus = { top: subRect.top, statusBottom: statusRect.bottom, height: subRect.height }
      }

      const accent = getComputedStyle(card, '::before')
      const accentLeft = Number.parseFloat(accent.left)
      const accentRight = Number.parseFloat(accent.right)
      const accentTop = Number.parseFloat(accent.top)
      if (accentLeft < 18 || accentRight < 18 || accentTop < 4) failures.push(`card ${index + 1}: accent line is not safely inset`)
      cardChecks.push(check)
    }

    return {
      failures,
      details: {
        metrics: { left: metricsRect.left, right: metricsRect.right },
        grid: { left: gridRect.left, right: gridRect.right },
        rows: Array.from(rows.values()),
        cards: cardChecks,
      },
    }
  }, tolerance)
  failures.push(...dashboard.failures)
  details.dashboard = dashboard.details
  await page.screenshot({ path: 'visual-review/layout-verified-light-desktop.png', fullPage: false })

  await openView('stats', '.stats-panel')
  details.stats = await page.evaluate(() => {
    const panel = document.querySelector('.stats-panel')
    const rect = panel.getBoundingClientRect()
    return { left: rect.left, right: rect.right }
  })

  await openView('preparation', '.preparation-workspace')
  details.preparation = await page.evaluate(() => {
    const panel = document.querySelector('.preparation-workspace')
    const rect = panel.getBoundingClientRect()
    return { left: rect.left, right: rect.right }
  })

  const dashboardEdges = details.dashboard.grid
  for (const [name, rect] of [['stats', details.stats], ['preparation', details.preparation]]) {
    if (Math.abs(rect.left - dashboardEdges.left) > tolerance) failures.push(`${name} page left edge differs from dashboard`)
    if (Math.abs(rect.right - dashboardEdges.right) > tolerance) failures.push(`${name} page right edge differs from dashboard`)
  }

  console.log(JSON.stringify({ failures, details }, null, 2))
  if (failures.length > 0) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}
