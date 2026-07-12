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
      const revision = card.querySelector('.paper-revision-inline')
      const cardRect = card.getBoundingClientRect()
      const cardStyle = getComputedStyle(card)
      const check = { index, journal: null, substatus: null, revisionVisible: false }

      if (pill) {
        const text = pill.querySelector('.journal-pill-text')
        if (!status || !text || !slot) {
          failures.push(`card ${index + 1}: paper header elements are incomplete`)
        } else {
          const statusStyle = getComputedStyle(status)
          const textStyle = getComputedStyle(text)
          const pillRect = pill.getBoundingClientRect()
          const lineHeight = Number.parseFloat(textStyle.lineHeight)
          const expectedRight = cardRect.right - Number.parseFloat(cardStyle.paddingRight) - Number.parseFloat(cardStyle.borderRightWidth)

          if (Number.parseFloat(textStyle.fontSize) <= Number.parseFloat(statusStyle.fontSize)) failures.push(`card ${index + 1}: journal name is not visually dominant`)
          if (Number.isFinite(lineHeight) && text.scrollHeight > lineHeight * 2.35) failures.push(`card ${index + 1}: journal name exceeds two lines`)
          if (Math.abs(expectedRight - pillRect.right) > 3) failures.push(`card ${index + 1}: journal pill is not right aligned`)

          check.journal = { fontSize: textStyle.fontSize, right: pillRect.right, expectedRight, height: pillRect.height }
        }
      }

      if (substatus && status) {
        const statusRect = status.getBoundingClientRect()
        const subRect = substatus.getBoundingClientRect()
        const statusStyle = getComputedStyle(status)
        const style = getComputedStyle(substatus)
        if (style.display === 'none' || Number(style.opacity || 1) < 0.65 || subRect.height < 16) failures.push(`card ${index + 1}: substatus is not readable`)
        if (Number.parseFloat(style.fontSize) >= Number.parseFloat(statusStyle.fontSize)) failures.push(`card ${index + 1}: substatus is not visually secondary`)
        if (subRect.top < statusRect.bottom - 1) failures.push(`card ${index + 1}: substatus overlaps main status instead of sitting below it`)
        check.substatus = { top: subRect.top, statusBottom: statusRect.bottom, height: subRect.height, fontSize: style.fontSize }
      }

      if (revision) {
        const revisionStyle = getComputedStyle(revision)
        const revisionRect = revision.getBoundingClientRect()
        const visible = revisionStyle.display !== 'none' && revisionStyle.visibility !== 'hidden' && revisionRect.width > 0 && revisionRect.height > 0
        if (visible) failures.push(`card ${index + 1}: revision round is still externally visible`)
        check.revisionVisible = visible
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
  const preparation = await page.evaluate((tol) => {
    const failures = []
    const panel = document.querySelector('.preparation-workspace')
    const productivity = document.querySelector('.prep-productivity')
    const workbench = document.querySelector('.prep-nav')
    const dashboard = document.querySelector('.prep-dashboard')
    const overviewPanels = Array.from(document.querySelectorAll('.prep-overview-grid > .prep-panel'))
    const journalPanel = document.querySelector('.prep-overview-journals')
    const journalCards = Array.from(document.querySelectorAll('.prep-overview-journals .prep-journal-overview-card'))
    const navButtons = Array.from(document.querySelectorAll('.prep-nav button'))
    const rect = panel.getBoundingClientRect()

    if (!workbench || !dashboard) failures.push('preparation workbench or dashboard is missing')
    if (workbench && dashboard) {
      const workbenchRect = workbench.getBoundingClientRect()
      const dashboardRect = dashboard.getBoundingClientRect()
      if (Math.abs(workbenchRect.height - dashboardRect.height) > tol) failures.push('preparation workbench and dashboard heights differ')
      const beforeContent = getComputedStyle(workbench, '::before').content
      const afterContent = getComputedStyle(workbench, '::after').content
      if (!['none', 'normal', '""', "''"].includes(beforeContent)) failures.push('preparation workbench still renders an overlapping pseudo title')
      if (!['none', 'normal', '""', "''"].includes(afterContent)) failures.push('preparation workbench still renders overlapping pseudo copy')
    }
    if (overviewPanels.length >= 2) {
      const heights = overviewPanels.map(item => item.getBoundingClientRect().height)
      if (Math.max(...heights) - Math.min(...heights) > tol) failures.push('priority draft and saved journal panel heights differ')
    }
    if (journalPanel && journalCards.length >= 2) {
      const panelRect = journalPanel.getBoundingClientRect()
      const secondRect = journalCards[1].getBoundingClientRect()
      if (secondRect.bottom > panelRect.bottom + tol) failures.push('saved journal overview cannot fully show two journal cards')
    }
    navButtons.forEach((button, index) => {
      if (button.scrollWidth > button.clientWidth + 2) failures.push(`preparation workbench button ${index + 1} overflows`)
    })
    if (productivity) {
      const productivityRect = productivity.getBoundingClientRect()
      if (Math.abs(productivityRect.left - rect.left) > tol || Math.abs(productivityRect.right - rect.right) > tol) failures.push('paper assistant edges differ from preparation page')
    }

    return { failures, details: { left: rect.left, right: rect.right } }
  }, tolerance)
  failures.push(...preparation.failures)
  details.preparation = preparation.details

  const journalTab = page.locator('.prep-nav button[data-tone="journal"]')
  if (await journalTab.count()) {
    await journalTab.first().click()
    await page.locator('.prep-card-grid.journal-grid').waitFor({ state: 'visible' })
    await page.waitForTimeout(120)
    const journalTabGeometry = await page.evaluate((tol) => {
      const failures = []
      const panel = document.querySelector('.preparation-workspace')
      const nav = document.querySelector('.prep-nav')
      const grid = document.querySelector('.prep-card-grid.journal-grid')
      if (!panel || !nav || !grid) return { failures: ['journal tab geometry is incomplete'] }
      const panelRect = panel.getBoundingClientRect()
      const navRect = nav.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      if (navRect.bottom > gridRect.top + tol) failures.push('workbench overlaps journal library after tab switch')
      if (Math.abs(panelRect.left - gridRect.left) > tol || Math.abs(panelRect.right - gridRect.right) > tol) failures.push('journal library edges differ from preparation page')
      return { failures }
    }, tolerance)
    failures.push(...journalTabGeometry.failures)
  }

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
