import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []

const closeEnough = (left, right, tolerance = 2) => Math.abs(left - right) <= tolerance
const fail = message => failures.push(message)

function rgbLuminance(value = '') {
  const match = value.match(/rgba?\(([^)]+)\)/)
  if (!match) return 0
  const [r = 0, g = 0, b = 0] = match[1].split(',').slice(0, 3).map(Number)
  const channel = number => {
    const normalized = number / 255
    return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4
  }
  return .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b)
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
        const statusBar = Array.from(document.querySelectorAll('.app-layout > .lx-status-bar')).find(visible)
        const targets = currentView === 'dashboard'
          ? ['.app-layout > .metric-grid', '.app-layout > .action-center', '.app-layout > .paper-grid, .app-layout > .lx-board-view, .app-layout > .lx-journal-view']
          : currentView === 'preparation'
            ? ['.app-layout > .preparation-suite']
            : ['.app-layout > .stats-panel']
        const surfaces = targets.map(selector => Array.from(document.querySelectorAll(selector)).find(visible)).filter(Boolean)
        const shell = statusBar || header
        const surfaceStyles = surfaces.map(element => ({
          rect: rect(element),
          marginTop: parseFloat(getComputedStyle(element).marginTop) || 0,
        }))

        const menuGroups = Array.from(document.querySelectorAll('.header-tabs, .prep-nav, .lx-page-proxy-controls, .stats-module-controls'))
          .filter(visible)
          .map(root => {
            const buttons = Array.from(root.querySelectorAll(':scope > button')).filter(visible)
            return {
              className: root.className,
              heights: buttons.map(button => Math.round(button.getBoundingClientRect().height * 10) / 10),
              radii: buttons.map(button => parseFloat(getComputedStyle(button).borderRadius) || 0),
            }
          })

        const panels = Array.from(document.querySelectorAll('.prep-dashboard, .prep-panel, .prep-topic-card, .prep-draft-card, .prep-journal-card, .action-center, .metric-card, .stats-summary-card, .chart-card')).filter(visible).slice(0, 18)
        const panelRadii = panels.map(panel => parseFloat(getComputedStyle(panel).borderRadius) || 0)
        const grids = Array.from(document.querySelectorAll('.prep-dashboard-grid, .prep-overview-grid, .prep-card-grid, .journal-grid, .paper-grid, .metric-grid, .stats-summary-unified, .stats-distribution-grid')).filter(visible)
        const gridGaps = grids.map(grid => {
          const style = getComputedStyle(grid)
          return Math.max(parseFloat(style.rowGap) || 0, parseFloat(style.columnGap) || 0)
        })

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
          shell: rect(shell),
          surfaces: surfaceStyles,
          menuGroups,
          panelRadii,
          gridGaps,
          journalCenter: journalCenter ? {
            backgroundColor: journalStyle?.backgroundColor,
            backgroundImage: journalStyle?.backgroundImage,
            borderColor: journalStyle?.borderColor,
            boxShadow: journalStyle?.boxShadow,
          } : null,
          duplicateJournalCount: duplicateJournalButtons.length,
          visibleText,
          overviewJournalPanel: !!Array.from(document.querySelectorAll('.prep-overview-journals')).find(visible),
        }
      }, view)

      if (!report.header || !report.shell) {
        fail(`${ui}/${view}: top-level shell is missing`)
        continue
      }

      report.surfaces.forEach((surface, index) => {
        if (!surface.rect) return
        if (!closeEnough(surface.rect.left, report.shell.left) || !closeEnough(surface.rect.right, report.shell.right)) {
          fail(`${ui}/${view}: surface ${index + 1} does not share content-lane boundaries (${surface.rect.left}/${surface.rect.right} vs ${report.shell.left}/${report.shell.right})`)
        }
        if (surface.marginTop < 8 || surface.marginTop > 18) fail(`${ui}/${view}: surface ${index + 1} uses a non-contract top margin (${surface.marginTop})`)
      })

      if (ui === 'luminous-x') {
        const sidebarGap = report.shell.left - report.header.right
        if (report.header.width < 200 || report.header.width > 250) fail(`${ui}/${view}: sidebar width is invalid (${report.header.width})`)
        if (sidebarGap < 12 || sidebarGap > 42) fail(`${ui}/${view}: sidebar overlaps or detaches from content lane (gap ${sidebarGap})`)
      } else if (!closeEnough(report.header.left, report.shell.left) || !closeEnough(report.header.right, report.shell.right)) {
        fail(`${ui}/${view}: top header and content shell do not align`)
      }

      report.menuGroups.forEach(group => {
        if (group.heights.length && Math.max(...group.heights) - Math.min(...group.heights) > 3) fail(`${ui}/${view}: ${group.className} button heights differ (${group.heights.join(', ')})`)
        if (group.radii.some(radius => radius < 7 || radius > 11)) fail(`${ui}/${view}: ${group.className} radius is outside control scale (${group.radii.join(', ')})`)
      })
      if (report.panelRadii.some(radius => radius < 12 || radius > 16)) fail(`${ui}/${view}: panel radius is outside panel scale (${report.panelRadii.join(', ')})`)
      if (report.gridGaps.some(gap => gap < 8 || gap > 14)) fail(`${ui}/${view}: grid interval is outside the 12px rhythm (${report.gridGaps.join(', ')})`)

      if (view === 'preparation') {
        if (!report.journalCenter) fail(`${ui}: journal center primary entry is missing`)
        else {
          const transparent = report.journalCenter.backgroundColor === 'rgba(0, 0, 0, 0)' || report.journalCenter.backgroundColor === 'transparent'
          if (transparent && report.journalCenter.backgroundImage === 'none') fail(`${ui}: journal center has no colored surface`)
          if (!report.journalCenter.borderColor || report.journalCenter.borderColor === 'rgba(0, 0, 0, 0)') fail(`${ui}: journal center has no visible border`)
          if (!report.journalCenter.boxShadow || report.journalCenter.boxShadow === 'none') fail(`${ui}: journal center lacks primary-route depth`)
        }
        if (report.duplicateJournalCount) fail(`${ui}: journal library is duplicated in preparation navigation`)
        if (!report.overviewJournalPanel) fail(`${ui}: preparation overview lost its journal summary panel`)
        if (/收藏期刊/.test(report.visibleText)) fail(`${ui}: legacy “收藏期刊” wording remains visible`)
        if (!/新增期刊|期刊档案/.test(report.visibleText)) fail(`${ui}: journal center terminology is missing`)
      }

      details.push(`${ui}/${view}: header=${report.header.left}-${report.header.right}; content=${report.shell.left}-${report.shell.right}; margins=${report.surfaces.map(item => item.marginTop).join('/')}; panelRadius=${report.panelRadii.slice(0, 5).join('/')}; gridGap=${report.gridGaps.slice(0, 5).join('/')}`)
    } catch (error) {
      fail(`${ui}/${view}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      await page.close()
    }
  }

  const catalogPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  try {
    await catalogPage.goto(`${baseUrl}?view=preparation&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
    await catalogPage.locator("html[data-visual-ready='true'] .preparation-workspace").waitFor({ state: 'visible', timeout: 45000 })
    const journalCenter = catalogPage.locator(".header-tabs > button[data-main-nav-key='journals'], .tab-bar > button[data-main-nav-key='journals']").first()
    await journalCenter.evaluate(element => element.click())
    await catalogPage.locator('.preparation-workspace[data-section="journals"] .journal-catalog-toolbar').waitFor({ state: 'visible', timeout: 10000 })
    await catalogPage.waitForTimeout(250)

    const catalog = await catalogPage.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0
      }
      const workspace = document.querySelector('.preparation-workspace[data-section="journals"]')
      const toolbar = workspace?.querySelector('.journal-catalog-toolbar')
      const filters = Array.from(toolbar?.querySelectorAll('.journal-catalog-filter') || [])
      const cards = Array.from(workspace?.querySelectorAll('.prep-journal-card') || [])
      return {
        filterLabels: filters.map(button => button.textContent?.trim() || ''),
        activeFilter: filters.find(button => button.classList.contains('active'))?.dataset.filter || '',
        cardCount: cards.length,
        visibleCardCount: cards.filter(visible).length,
        autoCards: cards.filter(card => card.dataset.catalogSource === 'submission-history').length,
        ordinaryCards: cards.filter(card => card.dataset.catalogPriority === 'ordinary').length,
        toolbarOverflow: toolbar ? toolbar.scrollWidth - toolbar.clientWidth : 0,
      }
    })

    if (catalog.filterLabels.length !== 4) fail(`${ui}: journal catalog must expose four filters (${catalog.filterLabels.join(' / ')})`)
    for (const label of ['全部', '重点期刊', '投稿自动收录', '手动记录']) {
      if (!catalog.filterLabels.some(item => item.startsWith(label))) fail(`${ui}: journal catalog filter “${label}” is missing`)
    }
    if (catalog.activeFilter !== 'all') fail(`${ui}: journal catalog does not default to all records`)
    if (catalog.visibleCardCount !== catalog.cardCount) fail(`${ui}: default journal catalog hides records (${catalog.visibleCardCount}/${catalog.cardCount})`)
    if (catalog.ordinaryCards === 0) fail(`${ui}: journal catalog has no ordinary/non-favorite records in the visual fixture`)
    if (catalog.toolbarOverflow > 2) fail(`${ui}: journal catalog toolbar overflows by ${catalog.toolbarOverflow}px`)
    details.push(`${ui}/catalog: filters=${catalog.filterLabels.join('|')}; cards=${catalog.visibleCardCount}/${catalog.cardCount}; auto=${catalog.autoCards}; ordinary=${catalog.ordinaryCards}`)
  } catch (error) {
    fail(`${ui}/catalog: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await catalogPage.close()
  }

  const darkPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  try {
    await darkPage.goto(`${baseUrl}?view=dashboard&theme=dark&ui=${ui}`, { waitUntil: 'domcontentloaded' })
    await darkPage.locator("html[data-visual-ready='true'] .paper-card-v3").first().waitFor({ state: 'visible', timeout: 45000 })
    await darkPage.waitForTimeout(350)
    const dark = await darkPage.evaluate(() => {
      const bodyStyle = getComputedStyle(document.body)
      const card = document.querySelector('.paper-card-v3')
      const title = card?.querySelector('.card-title')
      const secondary = card?.querySelector('.card-subtitle, .paper-date-info, .paper-history')
      const input = document.querySelector('input')
      const panelStyle = card ? getComputedStyle(card) : null
      return {
        bodyAnimation: bodyStyle.animationName,
        bodyBackground: bodyStyle.backgroundImage,
        titleColor: title ? getComputedStyle(title).color : '',
        secondaryColor: secondary ? getComputedStyle(secondary).color : '',
        panelBackground: panelStyle?.backgroundColor || '',
        panelBorder: panelStyle?.borderColor || '',
        inputColor: input ? getComputedStyle(input).color : '',
      }
    })
    if (dark.bodyAnimation === 'none') fail(`${ui}/dark: background breathing is not active`)
    if (!dark.bodyBackground.includes('radial-gradient')) fail(`${ui}/dark: spatial background fields are missing`)
    if (rgbLuminance(dark.titleColor) < .70) fail(`${ui}/dark: title is too dim (${dark.titleColor})`)
    if (dark.secondaryColor && rgbLuminance(dark.secondaryColor) < .42) fail(`${ui}/dark: secondary text is too dim (${dark.secondaryColor})`)
    if (!dark.panelBorder || dark.panelBorder === 'rgba(0, 0, 0, 0)') fail(`${ui}/dark: card boundary disappears`)
    details.push(`${ui}/dark: title=${dark.titleColor}; secondary=${dark.secondaryColor}; panel=${dark.panelBackground}; border=${dark.panelBorder}`)
  } catch (error) {
    fail(`${ui}/dark: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await darkPage.close()
  }

  const reducedPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  try {
    await reducedPage.goto(`${baseUrl}?view=dashboard&theme=dark&ui=${ui}`, { waitUntil: 'domcontentloaded' })
    await reducedPage.locator("html[data-visual-ready='true'] .app-header").waitFor({ state: 'visible', timeout: 45000 })
    const animations = await reducedPage.evaluate(() => ({
      body: getComputedStyle(document.body).animationName,
      header: getComputedStyle(document.querySelector('.app-header')).animationName,
    }))
    if (animations.body !== 'none' || animations.header !== 'none') fail(`${ui}/reduced-motion: material animations remain active (${animations.body}/${animations.header})`)
  } catch (error) {
    fail(`${ui}/reduced-motion: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await reducedPage.close()
  }
}

await browser.close()
if (failures.length) {
  console.error('UI geometry and material contract check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}
console.log('UI geometry and material contract check passed.')
details.forEach(item => console.log(`- ${item}`))
