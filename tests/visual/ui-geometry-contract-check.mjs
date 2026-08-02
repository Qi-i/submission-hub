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
for (const token of [
  'submission-hub-background-breathe 24s',
  'submission-hub-panel-breathe 16s',
  '@media (prefers-reduced-motion: reduce)',
  'radial-gradient(ellipse at 10% 4%',
  "html[data-theme='dark'][data-ui]",
]) {
  if (!materialCss.includes(token)) fail(`material contract source is missing: ${token}`)
}
for (const token of [
  "preparation-workspace[data-section='journals'] > .prep-nav",
  '.prep-journal-card.is-catalog-filtered-out',
  "grid-template-columns: repeat(4, minmax(0, 1fr))",
  "html[data-ui='luminous'] body .paper-grid",
]) {
  if (!finalCss.includes(token)) fail(`final layout contract source is missing: ${token}`)
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
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'no-preference',
    ...options,
  })
  await page.goto(`${baseUrl}?view=${view}&theme=${theme}&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true'] .app-header").waitFor({ state: 'visible', timeout: 45000 })
  await page.waitForTimeout(350)
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
            ? ['.app-layout > .preparation-suite']
            : ['.app-layout > .stats-panel']
        const surfaces = selectors.map(selector => Array.from(document.querySelectorAll(selector)).find(visible)).filter(Boolean)
        const menuGroups = Array.from(document.querySelectorAll('.header-tabs, .prep-nav, .lx-page-proxy-controls, .stats-module-controls'))
          .filter(visible)
          .map(root => {
            const buttons = Array.from(root.querySelectorAll(':scope > button')).filter(visible)
            return {
              name: root.className,
              heights: buttons.map(button => Math.round(button.getBoundingClientRect().height * 10) / 10),
              radii: buttons.map(button => parseFloat(getComputedStyle(button).borderRadius) || 0),
            }
          })
        const panels = Array.from(document.querySelectorAll('.prep-dashboard, .prep-panel, .prep-topic-card, .prep-draft-card, .prep-journal-card, .action-center, .metric-card, .stats-summary-card, .chart-card')).filter(visible).slice(0, 18)
        const grids = Array.from(document.querySelectorAll('.prep-dashboard-grid, .prep-overview-grid, .prep-card-grid, .journal-grid, .paper-grid, .metric-grid, .stats-summary-unified, .stats-distribution-grid')).filter(visible)
        const journalCenter = document.querySelector(".header-tabs > button[data-main-nav-key='journals'], .tab-bar > button[data-main-nav-key='journals']")
        const journalStyle = journalCenter ? getComputedStyle(journalCenter) : null
        const prepNav = document.querySelector('.preparation-workspace[data-section="overview"] > .prep-nav')
        const prepLabels = prepNav
          ? Array.from(prepNav.querySelectorAll(':scope > button')).filter(visible).map(button => (button.textContent || '').replace(/\s+/g, ' ').trim())
          : []
        return {
          header: rect(header),
          shell: rect(shell),
          surfaces: surfaces.map(element => ({ rect: rect(element), marginTop: parseFloat(getComputedStyle(element).marginTop) || 0 })),
          menuGroups,
          panelRadii: panels.map(panel => parseFloat(getComputedStyle(panel).borderRadius) || 0),
          gridGaps: grids.map(grid => Math.max(parseFloat(getComputedStyle(grid).rowGap) || 0, parseFloat(getComputedStyle(grid).columnGap) || 0)),
          journal: journalStyle ? {
            backgroundColor: journalStyle.backgroundColor,
            backgroundImage: journalStyle.backgroundImage,
            borderColor: journalStyle.borderColor,
            boxShadow: journalStyle.boxShadow,
            height: journalCenter.getBoundingClientRect().height,
            radius: journalStyle.borderRadius,
          } : null,
          prepLabels,
          overviewJournalPanel: !!Array.from(document.querySelectorAll('.prep-overview-journals')).find(visible),
          visibleText: Array.from(document.querySelectorAll('.preparation-workspace button, .preparation-workspace h2, .preparation-workspace .prep-empty')).filter(visible).map(element => element.textContent || '').join(' '),
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
        if (!report.journal) fail(`${ui}: Journal Center primary entry is missing`)
        else {
          const transparent = ['transparent', 'rgba(0, 0, 0, 0)'].includes(report.journal.backgroundColor)
          if (transparent && report.journal.backgroundImage === 'none') fail(`${ui}: Journal Center has no route surface`)
          if (['transparent', 'rgba(0, 0, 0, 0)'].includes(report.journal.borderColor)) fail(`${ui}: Journal Center has no visible boundary`)
          if (report.journal.boxShadow === 'none') fail(`${ui}: Journal Center has no depth`)
        }
        const required = ['总览', '选题池', '草稿准备', '期刊比较']
        if (report.prepLabels.length !== 4) fail(`${ui}: Preparation does not expose exactly four routes (${report.prepLabels.join(' / ')})`)
        for (const label of required) if (!report.prepLabels.some(item => item.includes(label))) fail(`${ui}: Preparation route ${label} is missing`)
        if (report.prepLabels.some(item => item.includes('期刊库'))) fail(`${ui}: duplicate journal-library route remains in Preparation`)
        if (!report.overviewJournalPanel) fail(`${ui}: journal overview panel was removed from Preparation overview`)
        if (/收藏期刊/.test(report.visibleText)) fail(`${ui}: legacy favorite-only wording remains visible`)
      }
      details.push(`${ui}/${view}: header=${report.header.left}-${report.header.right}; content=${report.shell.left}-${report.shell.right}`)
    } finally {
      await page.close()
    }
  }

  const catalogPage = await openPage(ui, 'preparation')
  try {
    const entry = catalogPage.locator(".header-tabs > button[data-main-nav-key='journals'], .tab-bar > button[data-main-nav-key='journals']").first()
    await entry.evaluate(element => element.click())
    await catalogPage.locator('.journal-catalog-top-filters').waitFor({ state: 'visible', timeout: 15000 })
    await catalogPage.locator('.preparation-workspace[data-section="journals"] .journal-grid').waitFor({ state: 'visible', timeout: 15000 })
    const catalog = await catalogPage.evaluate(currentUi => {
      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0
      }
      const workspace = document.querySelector('.preparation-workspace[data-section="journals"]')
      const filters = document.querySelector('.journal-catalog-top-filters')
      const expectedHost = currentUi === 'luminous-x'
        ? document.querySelector('.lx-status-bar[data-page="preparation"] .lx-status-controls-host')
        : workspace?.querySelector(':scope > .prep-topbar')
      const buttons = Array.from(filters?.querySelectorAll('.journal-catalog-filter') || [])
      const cards = Array.from(workspace?.querySelectorAll('.prep-journal-card') || [])
      const nav = workspace?.querySelector(':scope > .prep-nav')
      return {
        correctHost: !!filters && filters.parentElement === expectedHost,
        labels: buttons.map(button => button.textContent?.trim() || ''),
        active: buttons.find(button => button.classList.contains('active'))?.dataset.filter || '',
        cards: cards.length,
        visibleCards: cards.filter(visible).length,
        ordinary: cards.filter(card => card.dataset.catalogPriority === 'ordinary').length,
        navDisplay: nav ? getComputedStyle(nav).display : 'missing',
        overflow: filters ? filters.scrollWidth - filters.clientWidth : 0,
      }
    }, ui)
    for (const label of ['全部', '重点期刊', '投稿自动收录', '手动记录']) if (!catalog.labels.some(item => item.startsWith(label))) fail(`${ui}/catalog: filter ${label} is missing`)
    if (!catalog.correctHost) fail(`${ui}/catalog: filters are not hosted in the top control area`)
    if (catalog.active !== 'all') fail(`${ui}/catalog: default filter is not all`)
    if (catalog.cards !== catalog.visibleCards) fail(`${ui}/catalog: default view hides records (${catalog.visibleCards}/${catalog.cards})`)
    if (!catalog.ordinary) fail(`${ui}/catalog: non-favorite records are missing`)
    if (catalog.navDisplay !== 'none') fail(`${ui}/catalog: lower Preparation navigation row remains visible`)
    if (catalog.overflow > 2) fail(`${ui}/catalog: top filters overflow by ${catalog.overflow}px`)
    details.push(`${ui}/catalog: ${catalog.labels.join('|')}; records=${catalog.visibleCards}/${catalog.cards}`)
  } finally {
    await catalogPage.close()
  }

  const darkPage = await openPage(ui, 'dashboard', 'dark')
  try {
    const dark = await darkPage.evaluate(() => {
      const card = document.querySelector('.paper-card-v3')
      const title = card?.querySelector('.card-title')
      const secondary = card?.querySelector('.card-subtitle, .paper-date-info, .paper-history')
      const cardStyle = card ? getComputedStyle(card) : null
      const bodyStyle = getComputedStyle(document.body)
      return {
        bodyBackground: bodyStyle.backgroundImage,
        title: title ? getComputedStyle(title).color : '',
        secondary: secondary ? getComputedStyle(secondary).color : '',
        border: cardStyle?.borderColor || '',
      }
    })
    if (!dark.bodyBackground.includes('radial-gradient')) fail(`${ui}/dark: spatial background fields are missing`)
    if (luminance(dark.title) < .70) fail(`${ui}/dark: title is too dim (${dark.title})`)
    if (dark.secondary && luminance(dark.secondary) < .42) fail(`${ui}/dark: secondary text is too dim (${dark.secondary})`)
    if (['transparent', 'rgba(0, 0, 0, 0)'].includes(dark.border)) fail(`${ui}/dark: card boundary disappears`)
  } finally {
    await darkPage.close()
  }

  const reducedPage = await openPage(ui, 'dashboard', 'dark', { reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
  try {
    const animations = await reducedPage.evaluate(() => ({
      body: getComputedStyle(document.body).animationName,
      header: getComputedStyle(document.querySelector('.app-header')).animationName,
    }))
    if (animations.body !== 'none' || animations.header !== 'none') fail(`${ui}/reduced-motion: animations remain active (${animations.body}/${animations.header})`)
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
