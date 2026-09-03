import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []
const fail = message => failures.push(message)
const closeEnough = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance

const materialCss = readFileSync(new URL('../../src/ui-geometry-contract.css', import.meta.url), 'utf8')
const finalCss = readFileSync(new URL('../../src/final-layout-navigation-fixes.css', import.meta.url), 'utf8')
const workspaceCss = readFileSync(new URL('../../src/styles/workspace-recovery.css', import.meta.url), 'utf8')
const railCss = readFileSync(new URL('../../src/styles/preparation-business-rail.css', import.meta.url), 'utf8')
for (const token of ['submission-hub-background-breathe 24s', 'submission-hub-panel-breathe 16s', '@media (prefers-reduced-motion: reduce)', "html[data-theme='dark'][data-ui]"]) {
  if (!materialCss.includes(token)) fail(`material contract source is missing: ${token}`)
}
for (const token of ["grid-template-columns: repeat(4, minmax(0, 1fr))", "html[data-ui='luminous'] body .paper-grid"]) {
  if (!finalCss.includes(token)) fail(`final layout contract source is missing: ${token}`)
}
for (const token of ['.journal-center-toolbar', '.journal-center-search', '.journal-center-grid', '.figure-composer__splitter']) {
  if (!workspaceCss.includes(token)) fail(`recovered workspace contract source is missing: ${token}`)
}
for (const token of ['.preparation-business-rail', '.preparation-business-rail__item', 'height: 32px', 'background: transparent']) {
  if (!railCss.includes(token)) fail(`Preparation rail source is missing: ${token}`)
}

function luminance(rgb = '') {
  const match = rgb.match(/rgba?\(([^)]+)\)/)
  if (!match) return 0
  const [r = 0, g = 0, b = 0] = match[1].split(',').slice(0, 3).map(Number)
  const channel = value => {
    const x = value / 255
    return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4
  }
  return .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b)
}

async function openPage(ui, view, theme = 'light', options = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'no-preference', ...options })
  await page.goto(`${baseUrl}?view=${view}&theme=${theme}&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true'] .app-header").waitFor({ state: 'visible', timeout: 45000 })
  await page.waitForTimeout(300)
  return page
}

for (const ui of ['luminous', 'luminous-x']) {
  for (const view of ['dashboard', 'preparation', 'stats']) {
    const page = await openPage(ui, view)
    try {
      const report = await page.evaluate(currentView => {
        const visible = element => {
          if (!element) return false
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0
        }
        const rect = element => element?.getBoundingClientRect().toJSON() || null
        const header = document.querySelector('.app-layout > .app-header')
        const statusBar = Array.from(document.querySelectorAll('.app-layout > .lx-status-bar')).find(visible)
        const shell = statusBar || header
        const selectors = currentView === 'dashboard'
          ? ['.app-layout > .metric-grid', '.app-layout > .action-center', '.app-layout > .paper-grid, .app-layout > .lx-board-view, .app-layout > .lx-journal-view']
          : currentView === 'preparation'
            ? ['.app-layout > .online-preparation-shell, .app-layout > .preparation-suite']
            : ['.app-layout > .stats-panel']
        const surfaces = selectors.map(selector => Array.from(document.querySelectorAll(selector)).find(visible)).filter(Boolean)
        const menuGroups = Array.from(document.querySelectorAll('.header-tabs, .preparation-business-rail, .stats-module-controls')).filter(visible).map(root => {
          const buttons = Array.from(root.querySelectorAll(':scope > button')).filter(visible)
          return { name: root.className, heights: buttons.map(button => button.getBoundingClientRect().height), radii: buttons.map(button => parseFloat(getComputedStyle(button).borderRadius) || 0) }
        })
        const panels = Array.from(document.querySelectorAll('.prep-dashboard, .prep-panel, .prep-topic-card, .prep-draft-card, .action-center, .metric-card, .stats-summary-card, .chart-card')).filter(visible).slice(0, 18)
        const grids = Array.from(document.querySelectorAll('.prep-dashboard-grid, .prep-overview-grid, .prep-card-grid, .paper-grid, .metric-grid, .stats-summary-unified, .stats-distribution-grid')).filter(visible)
        const mainNavButtons = Array.from(document.querySelectorAll("button[data-main-nav-key]")).filter(visible)
        const journalCenter = mainNavButtons.find(button => button.dataset.mainNavKey === 'journals')
        const preparationButton = mainNavButtons.find(button => button.dataset.mainNavKey === 'preparation')
        const journalStyle = journalCenter ? getComputedStyle(journalCenter) : null
        const preparationStyle = preparationButton ? getComputedStyle(preparationButton) : null
        const prepNav = document.querySelector('.preparation-workspace[data-section="overview"] > .preparation-business-rail')
        const prepButtons = prepNav ? Array.from(prepNav.querySelectorAll(':scope > button')).filter(visible) : []
        return {
          header: rect(header),
          shell: rect(shell),
          surfaces: surfaces.map(element => ({ rect: rect(element), marginTop: parseFloat(getComputedStyle(element).marginTop) || 0 })),
          menuGroups,
          panelRadii: panels.map(panel => parseFloat(getComputedStyle(panel).borderRadius) || 0),
          gridGaps: grids.map(grid => Math.max(parseFloat(getComputedStyle(grid).rowGap) || 0, parseFloat(getComputedStyle(grid).columnGap) || 0)),
          journal: journalStyle ? { width: journalCenter.getBoundingClientRect().width, height: journalCenter.getBoundingClientRect().height, radius: journalStyle.borderRadius } : null,
          preparationRoute: preparationStyle ? { width: preparationButton.getBoundingClientRect().width, height: preparationButton.getBoundingClientRect().height, radius: preparationStyle.borderRadius } : null,
          prep: prepNav ? {
            rect: rect(prepNav),
            labels: prepButtons.map(button => (button.textContent || '').replace(/\s+/g, ' ').trim()),
            heights: prepButtons.map(button => button.getBoundingClientRect().height),
            idleGradients: prepButtons.filter(button => !button.classList.contains('active')).map(button => getComputedStyle(button).backgroundImage),
            overflow: prepNav.scrollWidth - prepNav.clientWidth,
            topbar: rect(document.querySelector('.preparation-workspace[data-section="overview"] > .prep-topbar')),
          } : null,
          overviewJournalPanel: !!Array.from(document.querySelectorAll('.prep-overview-journals')).find(visible),
        }
      }, view)

      if (!report.header || !report.shell) {
        fail(`${ui}/${view}: top-level shell is missing`)
        continue
      }
      report.surfaces.forEach((surface, index) => {
        if (!closeEnough(surface.rect.left, report.shell.left) || !closeEnough(surface.rect.right, report.shell.right)) fail(`${ui}/${view}: content surface ${index + 1} does not align with its lane`)
        if (surface.marginTop < 8 || surface.marginTop > 18) fail(`${ui}/${view}: top margin ${surface.marginTop}px is outside contract`)
      })
      if (ui === 'luminous-x') {
        const gap = report.shell.left - report.header.right
        if (report.header.width < 200 || report.header.width > 250) fail(`${ui}/${view}: sidebar width ${report.header.width}px is invalid`)
        if (gap < 12 || gap > 42) fail(`${ui}/${view}: sidebar/content gap ${gap}px is invalid`)
      } else if (!closeEnough(report.header.left, report.shell.left) || !closeEnough(report.header.right, report.shell.right)) {
        fail(`${ui}/${view}: top header and content shell do not align`)
      }
      report.menuGroups.forEach(group => {
        if (group.heights.length && Math.max(...group.heights) - Math.min(...group.heights) > 3) fail(`${ui}/${view}: ${group.name} heights differ`)
        if (group.radii.some(radius => radius < 7 || radius > 12)) fail(`${ui}/${view}: ${group.name} radius is outside contract`)
      })
      if (report.panelRadii.some(radius => radius < 12 || radius > 16)) fail(`${ui}/${view}: panel radius is outside contract`)
      if (report.gridGaps.some(gap => gap < 8 || gap > 14)) fail(`${ui}/${view}: grid interval is outside contract`)

      if (view === 'preparation') {
        if (!report.journal || !report.preparationRoute) fail(`${ui}: Journal Center or Preparation primary entry is missing`)
        else if (ui === 'luminous-x') {
          if (!closeEnough(report.journal.width, report.preparationRoute.width, 1)) fail(`${ui}: Journal Center width differs from peer routes`)
          if (!closeEnough(report.journal.height, report.preparationRoute.height, 1)) fail(`${ui}: Journal Center height differs from peer routes`)
          if (report.journal.radius !== report.preparationRoute.radius) fail(`${ui}: Journal Center radius differs from peer routes`)
        }
        const required = ['总览', '论文准备', '投稿材料', '期刊匹配', '投稿前检查']
        if (!report.prep) fail(`${ui}: compact Preparation rail is missing`)
        else {
          if (report.prep.labels.length !== 5) fail(`${ui}: Preparation does not expose exactly five business routes (${report.prep.labels.join(' / ')})`)
          for (const label of required) if (!report.prep.labels.some(item => item.includes(label))) fail(`${ui}: Preparation route ${label} is missing`)
          if (report.prep.rect.height > 44) fail(`${ui}: Preparation rail is oversized (${report.prep.rect.height}px)`)
          if (report.prep.heights.some(height => height > 36)) fail(`${ui}: Preparation rail contains oversized buttons (${report.prep.heights.join(',')})`)
          if (report.prep.idleGradients.some(value => value && value !== 'none')) fail(`${ui}: idle Preparation routes still use decorative gradients`)
          if (report.prep.overflow > 2) fail(`${ui}: Preparation rail overflows by ${report.prep.overflow}px`)
          if (ui === 'luminous' && report.prep.topbar && report.prep.topbar.height > 76) fail(`${ui}: Preparation workspace header is oversized (${report.prep.topbar.height}px)`)
        }
        if (!report.overviewJournalPanel) fail(`${ui}: journal overview panel was removed from Preparation overview`)
      }
      details.push(`${ui}/${view}: header=${report.header.left}-${report.header.right}; content=${report.shell.left}-${report.shell.right}`)
    } finally {
      await page.close()
    }
  }

  const journalPage = await openPage(ui, 'preparation')
  try {
    const entry = journalPage.locator("button[data-main-nav-key='journals']:visible").first()
    await entry.click()
    await journalPage.locator('.journal-center-workspace').waitFor({ state: 'visible', timeout: 15000 })
    await journalPage.locator('.journal-center-search input').waitFor({ state: 'visible', timeout: 15000 })
    const journalRouteActive = await entry.evaluate(element => element.classList.contains('active'))
    const preparationRouteActive = await journalPage.locator("button[data-main-nav-key='preparation']:visible").first().evaluate(element => element.classList.contains('active'))
    if (!journalRouteActive) fail(`${ui}/journal-center: main route is not active after navigation`)
    if (preparationRouteActive) fail(`${ui}/journal-center: Preparation remains active while Journal Center is open`)
    const catalog = await journalPage.evaluate(() => {
      const workspace = document.querySelector('.journal-center-workspace')
      const toolbar = workspace?.querySelector('.journal-center-toolbar')
      const search = workspace?.querySelector('.journal-center-search')
      const cards = Array.from(workspace?.querySelectorAll('.journal-center-card') || [])
      const toolbarRect = toolbar?.getBoundingClientRect()
      const searchRect = search?.getBoundingClientRect()
      return {
        toolbar: toolbarRect?.toJSON() || null,
        search: searchRect?.toJSON() || null,
        cards: cards.length,
        prepNav: !!workspace?.querySelector('.preparation-business-rail'),
        oldFilters: !!document.querySelector('.journal-catalog-top-filters'),
        overflow: toolbar ? toolbar.scrollWidth - toolbar.clientWidth : 999,
      }
    })
    if (!catalog.cards) fail(`${ui}/journal-center: no Journal Center cards rendered`)
    if (catalog.prepNav) fail(`${ui}/journal-center: Preparation business navigation leaked into Journal Center`)
    if (catalog.oldFilters) fail(`${ui}/journal-center: obsolete catalogue filter bar remains mounted`)
    if (!catalog.toolbar || !catalog.search) fail(`${ui}/journal-center: toolbar/search geometry is missing`)
    else {
      if (catalog.overflow > 2) fail(`${ui}/journal-center: toolbar overflows by ${catalog.overflow}px`)
      if (catalog.search.top < catalog.toolbar.top - 1 || catalog.search.bottom > catalog.toolbar.bottom + 1 || catalog.search.left < catalog.toolbar.left - 1 || catalog.search.right > catalog.toolbar.right + 1) fail(`${ui}/journal-center: search is clipped by its toolbar`)
      if (catalog.toolbar.height > 118) fail(`${ui}/journal-center: toolbar is excessively tall (${catalog.toolbar.height}px)`)
    }
    details.push(`${ui}/journal-center: cards=${catalog.cards}; toolbar=${catalog.toolbar?.height || 0}px`)
  } finally {
    await journalPage.close()
  }

  const darkPage = await openPage(ui, 'dashboard', 'dark')
  try {
    const dark = await darkPage.evaluate(() => {
      const card = document.querySelector('.paper-card-v3')
      const title = card?.querySelector('.card-title')
      const secondary = card?.querySelector('.card-subtitle, .paper-date-info, .paper-history')
      return { title: title ? getComputedStyle(title).color : '', secondary: secondary ? getComputedStyle(secondary).color : '', cardBackground: card ? getComputedStyle(card).backgroundColor : '' }
    })
    if (dark.title && luminance(dark.title) < .55) fail(`${ui}/dark: primary card text is too dim`)
    if (dark.secondary && luminance(dark.secondary) < .25) fail(`${ui}/dark: secondary card text is too dim`)
    details.push(`${ui}/dark: card=${dark.cardBackground}`)
  } finally {
    await darkPage.close()
  }
}

await browser.close()
if (failures.length) {
  console.error('UI geometry contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}
console.log('UI geometry contract passed.')
details.forEach(item => console.log(`- ${item}`))
