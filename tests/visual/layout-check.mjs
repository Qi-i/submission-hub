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
    const cards = Array.from(grid?.querySelectorAll('.paper-card-v3') || [])
    if (!metrics || !grid || !cards.length) return { failures: ['dashboard geometry is incomplete'], details: {} }

    const metricsRect = metrics.getBoundingClientRect()
    const gridRect = grid.getBoundingClientRect()
    const gridStyle = getComputedStyle(grid)
    if (Math.abs(metricsRect.left - gridRect.left) > tol) failures.push('metrics and card grid left edges differ')
    if (Math.abs(metricsRect.right - gridRect.right) > tol) failures.push('metrics and card grid right edges differ')

    const rows = new Map()
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect()
      const row = rows.get(Math.round(rect.top)) || []
      row.push(rect.height)
      rows.set(Math.round(rect.top), row)

      const status = card.querySelector('.paper-status-area > .badge')
      const pill = card.querySelector('.journal-pill')
      const title = card.querySelector('.card-title')
      if (!status || !title) failures.push(`card ${index + 1}: canonical submission hierarchy is incomplete`)
      if (pill) {
        const text = pill.querySelector('.journal-pill-text')
        if (!text) failures.push(`card ${index + 1}: journal pill text is missing`)
        else if (text.scrollWidth > text.clientWidth + 2 && getComputedStyle(text).textOverflow !== 'ellipsis') failures.push(`card ${index + 1}: journal pill overflows without truncation`)
      }
      const accent = getComputedStyle(card, '::before')
      if (Number.parseFloat(accent.left) < 18 || Number.parseFloat(accent.right) < 18 || Number.parseFloat(accent.top) < 4) failures.push(`card ${index + 1}: accent line is not safely inset`)
    })
    for (const heights of rows.values()) if (heights.length > 1 && Math.max(...heights) - Math.min(...heights) > tol) failures.push('cards in the same row are not equal height')

    return {
      failures,
      details: {
        metrics: { left: metricsRect.left, right: metricsRect.right },
        grid: { left: gridRect.left, right: gridRect.right, width: gridRect.width },
        columns: gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        firstCardWidth: cards[0].getBoundingClientRect().width,
        rows: Array.from(rows.values()),
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
    const topbar = document.querySelector('.prep-topbar')
    const workbench = document.querySelector('.preparation-business-rail')
    const dashboard = document.querySelector('.prep-dashboard')
    const overviewPanels = Array.from(document.querySelectorAll('.prep-overview-grid > .prep-panel'))
    const journalPanel = document.querySelector('.prep-overview-journals')
    const journalCards = Array.from(document.querySelectorAll('.prep-overview-journals .prep-journal-overview-card'))
    const navButtons = Array.from(document.querySelectorAll('.preparation-business-rail > button'))
    const rect = panel.getBoundingClientRect()

    if (!topbar) failures.push('preparation topbar is missing')
    if (topbar && topbar.getBoundingClientRect().height > 92) failures.push('preparation topbar wastes too much vertical space')
    if (!workbench || !dashboard) failures.push('preparation workbench or dashboard is missing')
    if (workbench && dashboard) {
      const workbenchRect = workbench.getBoundingClientRect()
      const dashboardRect = dashboard.getBoundingClientRect()
      if (workbenchRect.height > 70) failures.push('preparation secondary navigation is not compact')
      if (dashboardRect.height > 190) failures.push('preparation dashboard row is not compact')
      if (workbenchRect.bottom > dashboardRect.top + tol) failures.push('preparation secondary navigation overlaps the dashboard')
      if (dashboardRect.top - workbenchRect.bottom < 8) failures.push('preparation secondary navigation lacks separation from the dashboard')
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
      if (button.getBoundingClientRect().height > 82) failures.push(`preparation workbench button ${index + 1} is too tall`)
    })
    if (productivity) {
      const productivityRect = productivity.getBoundingClientRect()
      if (Math.abs(productivityRect.left - rect.left) > tol || Math.abs(productivityRect.right - rect.right) > tol) failures.push('paper assistant edges differ from preparation page')
    }

    return {
      failures,
      details: { left: rect.left, right: rect.right, topbarHeight: topbar?.getBoundingClientRect().height, workbenchHeight: workbench?.getBoundingClientRect().height, dashboardHeight: dashboard?.getBoundingClientRect().height },
    }
  }, tolerance)
  failures.push(...preparation.failures)
  details.preparation = preparation.details

  const journalCenter = page.locator("button[data-main-nav-key='journals']:visible, .tab-bar .tab-btn:visible").filter({ hasText: '期刊中心' }).first()
  if (await journalCenter.count()) {
    await journalCenter.click()
    await page.locator('.journal-center-workspace .journal-center-grid').waitFor({ state: 'visible' })
    await page.waitForTimeout(180)
    const journalTabGeometry = await page.evaluate(({ tol, reference }) => {
      const failures = []
      const panel = document.querySelector('.journal-center-workspace')
      const toolbar = panel?.querySelector(':scope > .journal-center-toolbar')
      const grid = panel?.querySelector(':scope > .journal-center-grid')
      if (!panel || !toolbar || !grid) return { failures: ['journal tab geometry is incomplete'], details: {} }
      const toolbarRect = toolbar.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
      const cards = Array.from(grid.querySelectorAll('.journal-center-card'))

      if (toolbarRect.bottom > gridRect.top + tol) failures.push('Journal Center toolbar overlaps journal catalogue')
      if (panel.querySelector('.preparation-business-rail, .prep-nav-primary')) failures.push('standalone Journal Center renders Preparation navigation')
      if (!grid.classList.contains('paper-grid')) failures.push('Journal Center does not share the Submission Management paper-grid')
      if (columns !== reference.columns) failures.push(`Journal Center column count differs from Submission Management (${columns}/${reference.columns})`)
      if (Math.abs(gridRect.left - reference.grid.left) > 3 || Math.abs(gridRect.right - reference.grid.right) > 3) failures.push('Journal Center card lane differs from Submission Management')
      if (Math.abs(toolbarRect.left - gridRect.left) > 3 || Math.abs(toolbarRect.right - gridRect.right) > 3) failures.push('Journal Center toolbar does not align with card lane')
      if (toolbar.scrollHeight > toolbar.clientHeight + 2) failures.push('Journal Center toolbar clips vertically')
      if (toolbar.scrollWidth > toolbar.clientWidth + 2) failures.push('Journal Center toolbar clips horizontally')

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect()
        const title = card.querySelector('.journal-catalog-card__title-block > .card-title')
        const status = card.querySelector('.paper-status-area > .badge')
        const footer = card.querySelector('.journal-center-card__links')
        if (!card.classList.contains('paper-card-v3')) failures.push(`journal ${index + 1}: card does not share paper-card-v3`)
        if (!title || !status) failures.push(`journal ${index + 1}: canonical card hierarchy is incomplete`)
        if (Math.abs(rect.width - reference.firstCardWidth) > 4) failures.push(`journal ${index + 1}: width differs from Submission Management`)
        if (card.scrollWidth > card.clientWidth + 2 || card.scrollHeight > card.clientHeight + 2) failures.push(`journal ${index + 1}: card content overflows`)
        if (footer && footer.getBoundingClientRect().bottom > rect.bottom + 2) failures.push(`journal ${index + 1}: footer escapes card`)
      })
      return { failures, details: { columns, cards: cards.length, left: gridRect.left, right: gridRect.right } }
    }, { tol: tolerance, reference: dashboard.details })
    failures.push(...journalTabGeometry.failures)
    details.journalCenter = journalTabGeometry.details
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
