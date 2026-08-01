import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []

function fail(message) {
  failures.push(message)
}

function closeEnough(left, right, tolerance = 2) {
  return Math.abs(left - right) <= tolerance
}

for (const ui of ['luminous', 'luminous-x']) {
  for (const view of ['dashboard', 'preparation', 'stats']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
    try {
      await page.goto(`${baseUrl}?view=${view}&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
      await page.locator("html[data-visual-ready='true'] .app-header").waitFor({ state: 'visible', timeout: 45000 })
      await page.waitForTimeout(450)

      const report = await page.evaluate(currentView => {
        const visible = element => {
          if (!element) return false
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
        }
        const rect = element => element?.getBoundingClientRect().toJSON() || null
        const header = document.querySelector('.app-layout > .app-header')
        const headerTabs = Array.from(document.querySelectorAll('.app-header .header-tabs, .app-layout > .tab-bar')).find(visible)
        const statusBar = Array.from(document.querySelectorAll('.app-layout > .lx-status-bar')).find(visible)
        const targets = currentView === 'dashboard'
          ? ['.app-layout > .metric-grid', '.app-layout > .action-center', '.app-layout > .paper-grid, .app-layout > .lx-board-view, .app-layout > .lx-journal-view']
          : currentView === 'preparation'
            ? ['.app-layout > .preparation-suite']
            : ['.app-layout > .stats-panel']
        const surfaces = targets.map(selector => Array.from(document.querySelectorAll(selector)).find(visible)).filter(Boolean)
        const navigationSurfaces = [header, headerTabs, statusBar].filter(visible)
        const navigationBottom = navigationSurfaces.length
          ? Math.max(...navigationSurfaces.map(element => element.getBoundingClientRect().bottom))
          : 0
        const firstContent = [...surfaces].sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top)[0]
        const navigationGap = firstContent ? Math.round((firstContent.getBoundingClientRect().top - navigationBottom) * 10) / 10 : null

        const contentGaps = [...surfaces]
          .sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top)
          .slice(1)
          .map((element, index, ordered) => {
            const previous = [...surfaces].sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top)[index].getBoundingClientRect()
            const current = element.getBoundingClientRect()
            return Math.round((current.top - previous.bottom) * 10) / 10
          })
          .filter(gap => gap >= 0)

        const menuRoots = Array.from(document.querySelectorAll('.header-tabs, .prep-nav, .lx-page-proxy-controls, .stats-module-controls')).filter(visible)
        const menuButtons = menuRoots.flatMap(root => Array.from(root.querySelectorAll(':scope > button')).filter(visible))
        const menuHeights = menuButtons.map(button => Math.round(button.getBoundingClientRect().height * 10) / 10)
        const menuRadii = menuButtons.map(button => parseFloat(getComputedStyle(button).borderRadius) || 0)

        const panels = Array.from(document.querySelectorAll('.prep-dashboard, .prep-panel, .prep-topic-card, .prep-draft-card, .prep-journal-card, .action-center, .metric-card, .stats-summary-card, .chart-card')).filter(visible).slice(0, 18)
        const panelRadii = panels.map(panel => parseFloat(getComputedStyle(panel).borderRadius) || 0)

        const journalCenter = document.querySelector(".header-tabs > button[data-main-nav-key='journals'], .tab-bar > button[data-main-nav-key='journals']")
        const journalStyle = journalCenter ? getComputedStyle(journalCenter) : null
        const duplicateJournalButtons = Array.from(document.querySelectorAll(".preparation-workspace > .prep-nav button, .lx-status-bar[data-page='preparation'] .lx-page-proxy-controls button"))
          .filter(button => (button.textContent || '').replace(/\s+/g, '').includes('期刊库') && visible(button))
        const visibleText = Array.from(document.querySelectorAll('.preparation-workspace button, .preparation-workspace h2, .preparation-workspace .prep-empty, .journal-form-modal'))
          .filter(visible)
          .map(element => element.textContent || '')
          .join(' ')

        return {
          header: rect(header),
          primaryNav: rect(statusBar || headerTabs || header),
          surfaces: surfaces.map(rect),
          navigationGap,
          contentGaps,
          menuHeights,
          menuRadii,
          panelRadii,
          journalCenter: journalCenter ? {
            display: journalStyle?.display,
            backgroundColor: journalStyle?.backgroundColor,
            backgroundImage: journalStyle?.backgroundImage,
            borderRadius: journalStyle?.borderRadius,
          } : null,
          duplicateJournalCount: duplicateJournalButtons.length,
          visibleText,
        }
      }, view)

      if (!report.header || !report.primaryNav) {
        fail(`${ui}/${view}: primary navigation geometry is missing`)
        continue
      }
      report.surfaces.forEach((surface, index) => {
        if (!surface) return
        if (!closeEnough(surface.left, report.primaryNav.left) || !closeEnough(surface.right, report.primaryNav.right)) {
          fail(`${ui}/${view}: surface ${index + 1} does not share primary-navigation boundaries (${surface.left}/${surface.right} vs ${report.primaryNav.left}/${report.primaryNav.right})`)
        }
      })
      if (report.navigationGap !== null && (report.navigationGap < 8 || report.navigationGap > 18)) fail(`${ui}/${view}: primary navigation to content gap is outside the contract (${report.navigationGap})`)
      if (report.contentGaps.some(gap => gap < 8 || gap > 18)) fail(`${ui}/${view}: content-module gap is outside the contract (${report.contentGaps.join(', ')})`)
      if (report.menuHeights.length && Math.max(...report.menuHeights) - Math.min(...report.menuHeights) > 3) fail(`${ui}/${view}: menu button heights differ (${report.menuHeights.join(', ')})`)
      if (report.menuRadii.some(radius => radius < 7 || radius > 11)) fail(`${ui}/${view}: menu radius is outside the control scale (${report.menuRadii.join(', ')})`)
      if (report.panelRadii.some(radius => radius < 12 || radius > 16)) fail(`${ui}/${view}: panel radius is outside the panel scale (${report.panelRadii.join(', ')})`)

      if (view === 'preparation') {
        if (!report.journalCenter) fail(`${ui}: journal center primary entry is missing`)
        else if ((report.journalCenter.backgroundColor === 'rgba(0, 0, 0, 0)' || report.journalCenter.backgroundColor === 'transparent') && report.journalCenter.backgroundImage === 'none') {
          fail(`${ui}: journal center has no colored surface`)
        }
        if (report.duplicateJournalCount) fail(`${ui}: journal library is duplicated in preparation navigation`)
        if (/收藏期刊/.test(report.visibleText)) fail(`${ui}: legacy “收藏期刊” wording remains visible`)
        if (!/新增期刊|期刊档案/.test(report.visibleText)) fail(`${ui}: journal center terminology is missing`)
      }

      details.push(`${ui}/${view}: boundaries=${report.primaryNav.left}-${report.primaryNav.right}; navigationGap=${report.navigationGap}; contentGaps=${report.contentGaps.join('/')}; menuRadius=${report.menuRadii.slice(0, 5).join('/')}; panelRadius=${report.panelRadii.slice(0, 5).join('/')}`)
    } catch (error) {
      fail(`${ui}/${view}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      await page.close()
    }
  }
}

await browser.close()

if (failures.length) {
  console.error('UI geometry contract check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('UI geometry contract check passed.')
details.forEach(item => console.log(`- ${item}`))
