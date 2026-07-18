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
    const switcher = document.querySelector('.ui-mode-switcher')
    const metrics = document.querySelector('.dashboard-metrics, .stats-bar')
    const grid = document.querySelector('.paper-grid')
    const panels = Array.from(document.querySelectorAll('.paper-card-v3, .metric-card, .stat-card, .prep-panel, .stats-panel, .modal'))
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (root.dataset.ui !== 'luminous-x') failures.push(`${name}: Luminous X mode is not active`)
    if (rootStyle.getPropertyValue('--lx-cyan').trim().toLowerCase() !== '#3cf5ff') failures.push(`${name}: cyan token is incorrect`)
    if (rootStyle.getPropertyValue('--lx-magenta').trim().toLowerCase() !== '#ff4f9f') failures.push(`${name}: magenta token is incorrect`)
    if (rootStyle.getPropertyValue('--lx-purple').trim().toLowerCase() !== '#8b5cf6') failures.push(`${name}: purple token is incorrect`)
    if (document.documentElement.scrollWidth > viewportWidth + 2) failures.push(`${name}: horizontal overflow exists`)

    if (!app || !header || !status || !switcher) {
      failures.push(`${name}: core Luminous X shell is incomplete`)
      return { failures, details: {} }
    }

    const appStyle = getComputedStyle(app)
    const headerStyle = getComputedStyle(header)
    const headerRect = header.getBoundingClientRect()
    const statusRect = status.getBoundingClientRect()
    const switcherRect = switcher.getBoundingClientRect()
    const currentLabel = switcher.querySelector('.ui-mode-switcher-label')?.textContent || ''
    const actionLabel = switcher.querySelector('button')?.getAttribute('aria-label') || ''

    if (headerStyle.position !== 'fixed') failures.push(`${name}: desktop control rail is not fixed`)
    if (headerRect.width < 190 || headerRect.width > 285) failures.push(`${name}: control rail width is not sidebar-like`)
    if (headerRect.height < viewportHeight - 80) failures.push(`${name}: control rail does not span the desktop stage`)
    if (Number.parseFloat(appStyle.paddingLeft) < 220) failures.push(`${name}: content is not offset from the control rail`)
    if (statusRect.left <= headerRect.right + 8) failures.push(`${name}: workspace status bar overlaps the control rail`)
    if (statusRect.right > viewportWidth + 2) failures.push(`${name}: workspace status bar escapes the viewport`)
    if (currentLabel !== 'Luminous X' || !actionLabel.includes('经典')) failures.push(`${name}: UI switcher does not expose Luminous X and classic fallback`)
    if (switcherRect.right > viewportWidth + 1 || switcherRect.bottom > viewportHeight + 1) failures.push(`${name}: UI switcher escapes the viewport`)

    if (metrics) {
      const columns = getComputedStyle(metrics).gridTemplateColumns.split(' ').filter(Boolean).length
      if (columns < 2 || columns > 4) failures.push(`${name}: metric console does not use the intended two-row grid`)
    }

    if (grid) {
      const gridRect = grid.getBoundingClientRect()
      if (Math.abs(gridRect.left - statusRect.left) > 4) failures.push(`${name}: paper grid and status bar are not aligned`)
      if (Math.abs(gridRect.right - statusRect.right) > 4) failures.push(`${name}: paper grid and status bar widths differ`)
    }

    const panelGeometry = panels.map((panel, index) => {
      const rect = panel.getBoundingClientRect()
      if (rect.left < -2 || rect.right > viewportWidth + 2) failures.push(`${name}: panel ${index + 1} escapes the viewport`)
      return {
        index: index + 1,
        className: panel.className,
        rect: rect.toJSON(),
        width: getComputedStyle(panel).width,
        minWidth: getComputedStyle(panel).minWidth,
        maxWidth: getComputedStyle(panel).maxWidth,
      }
    })

    return {
      failures,
      details: {
        theme: root.dataset.theme,
        header: headerRect.toJSON(),
        status: statusRect.toJSON(),
        paddingLeft: appStyle.paddingLeft,
        panelCount: panels.length,
        panels: panelGeometry,
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
    if (headerRect.width < viewportWidth - 4) failures.push(`${name}: mobile header does not span the viewport`)
    if (statusRect.left < 8 || statusRect.right > viewportWidth - 8) failures.push(`${name}: mobile status bar has unsafe gutters`)
    if (switcherRect.width > 54) failures.push(`${name}: mobile UI switcher is too wide`)

    return {
      failures,
      details: {
        header: headerRect.toJSON(),
        status: statusRect.toJSON(),
        switcher: switcherRect.toJSON(),
      },
    }
  }, name)

  failures.push(...result.failures)
  details[name] = result.details
}

try {
  const dashboardLight = await openView({ view: 'dashboard', theme: 'light', selector: '.paper-card-v3' })
  await inspectDesktop(dashboardLight, 'luminous-x dashboard light')
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
  if (xHeader && legacyGeometry) {
    if (!(xHeader.width < 300 && xHeader.height > legacyGeometry.height * 3)) {
      failures.push('Luminous X is not structurally distinct from the previous Luminous header')
    }
  }

  if (details['luminous-x dashboard light']?.background === details['luminous-x dashboard dark']?.background) {
    failures.push('Luminous X light and dark themes use the same page background')
  }

  console.log(JSON.stringify({ failures, details }, null, 2))
  if (failures.length > 0) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}
