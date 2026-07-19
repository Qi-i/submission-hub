import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = {}

async function openView({ view, theme = 'light', ui = 'luminous-x', viewport = { width: 1440, height: 1000 }, selector }) {
  const page = await browser.newPage({ viewport })
  await page.goto(`${baseUrl}?view=${view}&theme=${theme}&ui=${ui}`)
  await page.locator(`html[data-visual-ready='true'] ${selector}`).first().waitFor({ state: 'visible', timeout: 45000 })
  await page.waitForTimeout(350)
  return page
}

async function inspectDesktop(page, name) {
  const result = await page.evaluate((name) => {
    const failures = []
    const root = document.documentElement
    const rootStyle = getComputedStyle(root)
    const app = document.querySelector('.app-layout')
    const header = document.querySelector('.app-header')
    const status = document.querySelector('.lx-status-bar')
    const statusTitle = status?.querySelector('.lx-status-core strong')
    const controlsHost = status?.querySelector('.lx-status-controls-host')
    const statusCount = status?.querySelector('.lx-status-count')
    const utility = document.querySelector('.header-utility-stack')
    const viewSwitch = document.querySelector('.lx-view-switch')
    const switcher = document.querySelector('.ui-mode-switcher')
    const metrics = document.querySelector('.dashboard-metrics, .stats-bar')
    const grid = document.querySelector('.paper-grid')
    const paperCard = document.querySelector('.paper-card-v3')
    const paperTitle = paperCard?.querySelector('.card-title')
    const panels = Array.from(document.querySelectorAll('.paper-card-v3, .metric-card, .stat-card, .prep-panel, .stats-panel, .modal'))
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const parseRgb = value => {
      const match = value.match(/rgba?\(([^)]+)\)/)
      if (!match) return null
      const parts = match[1].split(',').map(part => Number.parseFloat(part.trim()))
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
    }
    const luminance = color => {
      const channels = [color.r, color.g, color.b].map(value => {
        const channel = value / 255
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const contrast = (left, right) => {
      const a = luminance(left)
      const b = luminance(right)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }

    if (root.dataset.ui !== 'luminous-x') failures.push(`${name}: Luminous X mode is not active`)
    if (rootStyle.getPropertyValue('--lx-cyan').trim().toLowerCase() !== '#3cf5ff') failures.push(`${name}: cyan token is incorrect`)
    if (rootStyle.getPropertyValue('--lx-magenta').trim().toLowerCase() !== '#ff4f9f') failures.push(`${name}: magenta token is incorrect`)
    if (rootStyle.getPropertyValue('--lx-purple').trim().toLowerCase() !== '#8b5cf6') failures.push(`${name}: purple token is incorrect`)
    if (document.documentElement.scrollWidth > viewportWidth + 2) failures.push(`${name}: horizontal overflow exists`)

    if (!app || !header || !status || !controlsHost || !statusCount || !utility || !switcher) {
      failures.push(`${name}: core Luminous X shell is incomplete`)
      return { failures, details: {} }
    }

    const appStyle = getComputedStyle(app)
    const headerStyle = getComputedStyle(header)
    const headerRect = header.getBoundingClientRect()
    const utilityRect = utility.getBoundingClientRect()
    const statusRect = status.getBoundingClientRect()
    const controlsRect = controlsHost.getBoundingClientRect()
    const countRect = statusCount.getBoundingClientRect()
    const switcherRect = switcher.getBoundingClientRect()
    const currentLabel = switcher.querySelector('.ui-mode-switcher-label')?.textContent || ''
    const actionLabel = switcher.querySelector('button')?.getAttribute('aria-label') || ''
    const pageTitle = statusTitle?.textContent?.trim() || ''

    if (headerStyle.position !== 'fixed') failures.push(`${name}: desktop control rail is not fixed`)
    if (headerRect.width < 190 || headerRect.width > 260) failures.push(`${name}: control rail width is not compact`)
    if (headerRect.height < viewportHeight - 80) failures.push(`${name}: control rail does not span the desktop stage`)
    if (Number.parseFloat(appStyle.paddingLeft) < 220) failures.push(`${name}: content is not offset from the control rail`)
    if (utilityRect.left < headerRect.left - 1 || utilityRect.right > headerRect.right + 1) failures.push(`${name}: utility block escapes the sidebar`)
    if (utilityRect.bottom > headerRect.bottom + 1) failures.push(`${name}: utility block exceeds the sidebar height`)
    if (statusRect.left <= headerRect.right + 8) failures.push(`${name}: top control bar overlaps the sidebar`)
    if (statusRect.right > viewportWidth + 2) failures.push(`${name}: top control bar escapes the viewport`)
    if (statusRect.height > 98) failures.push(`${name}: top control bar is too tall and recreates the empty band`)
    if (Math.abs(countRect.right - statusRect.right) > 2) failures.push(`${name}: record count is not aligned to the right edge`)
    if (controlsRect.right > countRect.left + 2) failures.push(`${name}: page controls overlap the record count`)
    if (/工作区|分析舱|控制台/.test(pageTitle)) failures.push(`${name}: page title still uses an awkward suffix`)
    if (currentLabel !== 'Luminous X' || actionLabel.includes('经典') || !actionLabel.includes('Luminous')) failures.push(`${name}: UI switcher still exposes the retired Classic interface`)
    const visibleSwitcherWidth = viewportWidth - switcherRect.left
    if (switcherRect.left < -1 || visibleSwitcherWidth < 28 || visibleSwitcherWidth > 54 || switcherRect.bottom > viewportHeight + 1) failures.push(`${name}: UI switcher does not expose a safe edge handle (${visibleSwitcherWidth}px visible)`)

    if (name.includes('dashboard')) {
      if (!viewSwitch || viewSwitch.querySelectorAll('button').length !== 3) failures.push(`${name}: three functional view controls are missing`)
    }

    if (name.includes('preparation')) {
      const prepNav = document.querySelector('.prep-nav')
      if (!prepNav) failures.push(`${name}: preparation navigation is missing`)
      else {
        const rect = prepNav.getBoundingClientRect()
        if (rect.top < statusRect.top - 2 || rect.bottom > statusRect.bottom + 2) failures.push(`${name}: preparation navigation was not moved into the top row`)
        if (rect.right > countRect.left + 2) failures.push(`${name}: preparation navigation overlaps record count`)
      }
    }

    if (name.includes('statistics')) {
      const moduleControls = document.querySelector('.stats-module-controls')
      if (!moduleControls) failures.push(`${name}: statistics module controls are missing`)
      else {
        const rect = moduleControls.getBoundingClientRect()
        if (rect.top < statusRect.top - 2 || rect.bottom > statusRect.bottom + 2) failures.push(`${name}: statistics controls were not moved into the top row`)
        if (rect.right > countRect.left + 2) failures.push(`${name}: statistics controls overlap record count`)
      }
    }

    if (metrics) {
      const columns = getComputedStyle(metrics).gridTemplateColumns.split(' ').filter(Boolean).length
      if (name.includes('dashboard') && columns !== 8) failures.push(`${name}: submission metrics should use one eight-column row on desktop`)
    }

    if (grid) {
      const gridRect = grid.getBoundingClientRect()
      if (Math.abs(gridRect.left - statusRect.left) > 4) failures.push(`${name}: paper grid and top control bar are not aligned`)
      if (Math.abs(gridRect.right - statusRect.right) > 4) failures.push(`${name}: paper grid and top control bar widths differ`)
    }

    let cardBackground = null
    let titleColor = null
    let titleContrast = null
    if (paperCard && paperTitle) {
      const cardStyle = getComputedStyle(paperCard)
      const titleStyle = getComputedStyle(paperTitle)
      cardBackground = parseRgb(cardStyle.backgroundColor)
      titleColor = parseRgb(titleStyle.color)
      if (cardBackground?.a < 0.98) failures.push(`${name}: paper card still uses a translucent gray surface`)
      if (cardBackground && titleColor) {
        titleContrast = contrast(cardBackground, titleColor)
        if (titleContrast < 7) failures.push(`${name}: paper title contrast is below the high-readability target`)
      }
    }

    const panelGeometry = panels.map((panel, index) => {
      const rect = panel.getBoundingClientRect()
      if (rect.left < -2 || rect.right > viewportWidth + 2) failures.push(`${name}: panel ${index + 1} escapes the viewport`)
      return { index: index + 1, className: panel.className, rect: rect.toJSON() }
    })

    return {
      failures,
      details: {
        theme: root.dataset.theme,
        pageTitle,
        header: headerRect.toJSON(),
        utility: utilityRect.toJSON(),
        status: statusRect.toJSON(),
        controls: controlsRect.toJSON(),
        count: countRect.toJSON(),
        paddingLeft: appStyle.paddingLeft,
        panelCount: panels.length,
        panels: panelGeometry,
        cardBackground,
        titleColor,
        titleContrast,
        background: getComputedStyle(document.body).backgroundImage,
      },
    }
  }, name)

  failures.push(...result.failures)
  details[name] = result.details
}

async function inspectMobile(page, name) {
  const result = await page.evaluate((name) => {
    const failures = []
    const root = document.documentElement
    const header = document.querySelector('.app-header')
    const status = document.querySelector('.lx-status-bar')
    const switcher = document.querySelector('.ui-mode-switcher')
    const viewportWidth = window.innerWidth

    if (root.dataset.ui !== 'luminous-x') failures.push(`${name}: Luminous X mode is not active`)
    if (document.documentElement.scrollWidth > viewportWidth + 2) failures.push(`${name}: horizontal overflow exists`)
    if (!header || !status || !switcher) return { failures: [...failures, `${name}: mobile shell is incomplete`], details: {} }

    const headerRect = header.getBoundingClientRect()
    const statusRect = status.getBoundingClientRect()
    const switcherRect = switcher.getBoundingClientRect()
    const headerStyle = getComputedStyle(header)

    if (headerStyle.position !== 'sticky') failures.push(`${name}: mobile header is not sticky`)
    if (headerRect.width < viewportWidth - 20) failures.push(`${name}: mobile header does not span the safe content width`)
    if (statusRect.left < 8 || statusRect.right > viewportWidth - 8) failures.push(`${name}: mobile top control bar has unsafe gutters`)
    if (switcherRect.width > 54) failures.push(`${name}: mobile UI switcher is too wide`)

    return {
      failures,
      details: { header: headerRect.toJSON(), status: statusRect.toJSON(), switcher: switcherRect.toJSON() },
    }
  }, name)

  failures.push(...result.failures)
  details[name] = result.details
}

try {
  const dashboardLight = await openView({ view: 'dashboard', theme: 'light', selector: '.paper-card-v3' })
  await inspectDesktop(dashboardLight, 'luminous-x dashboard light')

  await dashboardLight.getByRole('button', { name: '看板视图' }).click()
  const board = dashboardLight.locator('.lx-board-view')
  await board.waitFor({ state: 'visible' })
  if (await dashboardLight.locator('.lx-board-column').count() < 3) failures.push('Luminous X board view did not create status columns')
  const boardGeometry = await board.evaluate(element => {
    const outer = element.getBoundingClientRect()
    const columns = Array.from(element.querySelectorAll('.lx-board-column')).map(column => column.getBoundingClientRect().toJSON())
    return { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, outer: outer.toJSON(), columns }
  })
  if (boardGeometry.scrollWidth > boardGeometry.clientWidth + 2) failures.push('Luminous X board still requires inaccessible horizontal scrolling')
  if (boardGeometry.columns.some(column => column.left < boardGeometry.outer.left - 2 || column.right > boardGeometry.outer.right + 2)) failures.push('Luminous X board column escapes the visible board width')

  await dashboardLight.getByRole('button', { name: '按期刊视图' }).click()
  await dashboardLight.locator('.lx-journal-view').waitFor({ state: 'visible' })
  if (await dashboardLight.locator('.lx-journal-group').count() < 1) failures.push('Luminous X journal view did not create journal groups')
  await dashboardLight.close()

  const dashboardDark = await openView({ view: 'dashboard', theme: 'dark', selector: '.paper-card-v3' })
  await inspectDesktop(dashboardDark, 'luminous-x dashboard dark')
  await dashboardDark.close()

  const preparation = await openView({ view: 'preparation', theme: 'light', selector: '.preparation-workspace' })
  await inspectDesktop(preparation, 'luminous-x preparation light')
  await preparation.close()

  const statistics = await openView({ view: 'stats', theme: 'light', selector: '.stats-panel' })
  await inspectDesktop(statistics, 'luminous-x statistics light')
  await statistics.close()

  const mobile = await openView({
    view: 'dashboard',
    theme: 'light',
    viewport: { width: 390, height: 844 },
    selector: '.paper-card-v3',
  })
  await inspectMobile(mobile, 'luminous-x dashboard mobile')
  await mobile.close()

  const legacyLuminous = await openView({ view: 'dashboard', theme: 'light', ui: 'luminous', selector: '.paper-card-v3' })
  const legacyGeometry = await legacyLuminous.evaluate(() => {
    const header = document.querySelector('.app-header')?.getBoundingClientRect()
    return header ? header.toJSON() : null
  })
  await legacyLuminous.close()
  details['legacy luminous header'] = legacyGeometry

  const xHeader = details['luminous-x dashboard light']?.header
  if (xHeader && legacyGeometry && !(xHeader.width < 260 && xHeader.height > legacyGeometry.height * 3)) {
    failures.push('Luminous X is not structurally distinct from the previous Luminous header')
  }

  if (details['luminous-x dashboard light']?.background === details['luminous-x dashboard dark']?.background) {
    failures.push('Luminous X light and dark themes use the same page background')
  }

  console.log(JSON.stringify({ failures, details }, null, 2))
  if (failures.length > 0) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}
