import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = {}

async function openView({ view, theme = 'light', ui = 'luminous', viewport = { width: 1440, height: 1000 }, selector }) {
  const page = await browser.newPage({ viewport })
  await page.goto(`${baseUrl}?view=${view}&theme=${theme}&ui=${ui}`)
  await page.locator(`html[data-visual-ready='true'] ${selector}`).first().waitFor({ state: 'visible', timeout: 45000 })
  await page.waitForTimeout(300)
  return page
}

async function inspectPage(page, name, expectedUi = 'luminous') {
  const result = await page.evaluate(({ name, expectedUi }) => {
    const failures = []
    const root = document.documentElement
    const rootStyle = getComputedStyle(root)
    const switcher = document.querySelector('.ui-mode-switcher')
    const header = document.querySelector('.app-header')
    const viewportWidth = window.innerWidth

    if (root.dataset.ui !== expectedUi) failures.push(`${name}: expected data-ui=${expectedUi}, received ${root.dataset.ui || 'unset'}`)
    if (expectedUi === 'luminous' && rootStyle.getPropertyValue('--luminous-cyan').trim().toLowerCase() !== '#3cf5ff') {
      failures.push(`${name}: luminous cyan design token is missing`)
    }
    if (document.documentElement.scrollWidth > viewportWidth + 2) failures.push(`${name}: page has horizontal overflow`)

    if (!switcher) {
      failures.push(`${name}: UI mode switcher is missing`)
    } else {
      const rect = switcher.getBoundingClientRect()
      const visibleWidth = viewportWidth - rect.left
      const currentLabel = switcher.querySelector('.ui-mode-switcher-label')?.textContent || ''
      const actionLabel = switcher.querySelector('button')?.getAttribute('aria-label') || ''
      if (rect.left < -1 || visibleWidth < 28 || visibleWidth > 54) failures.push(`${name}: UI mode switcher does not expose a safe edge handle (${visibleWidth}px visible)`)
      if (viewportWidth <= 640 && rect.width > 54) failures.push(`${name}: mobile UI switcher is too wide`)
      if (expectedUi === 'luminous' && (currentLabel !== 'Luminous' || !actionLabel.includes('Luminous X'))) {
        failures.push(`${name}: Luminous switch state or next action is unclear`)
      }
      if (expectedUi === 'luminous-x' && (currentLabel !== 'Luminous X' || actionLabel.includes('经典') || !actionLabel.includes('Luminous'))) {
        failures.push(`${name}: Luminous X switch state still exposes the retired Classic UI`)
      }
    }

    if (header) {
      const rect = header.getBoundingClientRect()
      if (rect.left < -1 || rect.right > viewportWidth + 1) failures.push(`${name}: header escapes the viewport`)
    }

    const panels = Array.from(document.querySelectorAll('.paper-card-v3, .metric-card, .stat-card, .prep-panel, .stats-panel, .modal'))
    panels.forEach((panel, index) => {
      const rect = panel.getBoundingClientRect()
      if (rect.left < -2 || rect.right > viewportWidth + 2) failures.push(`${name}: panel ${index + 1} escapes the viewport`)
    })

    const journalLabels = Array.from(document.querySelectorAll('.journal-pill-text'))
    journalLabels.forEach((label, index) => {
      const style = getComputedStyle(label)
      const lineHeight = Number.parseFloat(style.lineHeight)
      if (Number.isFinite(lineHeight) && label.scrollHeight > lineHeight * 2.35) failures.push(`${name}: journal label ${index + 1} exceeds two lines`)
      if (Number.parseFloat(style.fontSize) < 11) failures.push(`${name}: journal label ${index + 1} is too small`)
    })

    return {
      failures,
      details: {
        ui: root.dataset.ui,
        theme: root.dataset.theme,
        viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        panelCount: panels.length,
        switcher: switcher ? switcher.getBoundingClientRect().toJSON() : null,
        background: getComputedStyle(document.body).backgroundImage,
      },
    }
  }, { name, expectedUi })

  failures.push(...result.failures)
  details[name] = result.details
}

async function inspectFourPageNavigation() {
  const page = await openView({
    view: 'dashboard',
    theme: 'light',
    viewport: { width: 2048, height: 900 },
    selector: '.paper-card-v3',
  })

  const result = await page.evaluate(() => {
    const fixture = document.createElement('header')
    fixture.className = 'app-header app-header-refined luminous-navigation-fixture'
    fixture.style.position = 'fixed'
    fixture.style.inset = '8px 8px auto 8px'
    fixture.style.zIndex = '20000'
    fixture.innerHTML = `
      <div class="header-left-cluster">
        <div class="header-brand"><div class="header-logo">SH</div><div><div class="header-title">Submission Hub</div><div class="header-subtitle">学术投稿与成果管理</div></div></div>
        <nav class="header-tabs" aria-label="主导航测试">
          <button>投稿准备</button>
          <button>投稿管理</button>
          <button class="active">个人统计</button>
          <button>后台管理</button>
        </nav>
      </div>
      <div class="luminous-header-center-slot">
        <div class="stats-module-controls stats-module-controls-portal">
          <button>核心概览</button><button>过程指标</button><button>趋势图</button><button>分布概览</button><button>恢复默认</button>
        </div>
      </div>
      <div class="header-actions"><button class="btn btn-ghost btn-sm">导入</button><button class="btn btn-ghost btn-sm">备份</button><button class="btn btn-ghost btn-sm">设置</button></div>`
    document.body.appendChild(fixture)

    const inspect = () => {
      const nav = fixture.querySelector('.header-tabs')
      const center = fixture.querySelector('.luminous-header-center-slot')
      const actions = fixture.querySelector('.header-actions')
      const buttons = Array.from(fixture.querySelectorAll('.header-tabs button'))
      return {
        header: fixture.getBoundingClientRect().toJSON(),
        nav: nav?.getBoundingClientRect().toJSON(),
        center: center?.getBoundingClientRect().toJSON(),
        actions: actions?.getBoundingClientRect().toJSON(),
        buttons: buttons.map(button => ({
          text: button.textContent?.trim() || '',
          rect: button.getBoundingClientRect().toJSON(),
          whiteSpace: getComputedStyle(button).whiteSpace,
          writingMode: getComputedStyle(button).writingMode,
        })),
      }
    }

    const withContext = inspect()
    const center = fixture.querySelector('.luminous-header-center-slot')
    if (center) center.innerHTML = ''
    const withoutContext = inspect()
    fixture.remove()
    return { withContext, withoutContext }
  })

  const withContext = result.withContext
  const withoutContext = result.withoutContext
  withContext.buttons.forEach((button, index) => {
    if (button.whiteSpace !== 'nowrap') failures.push(`luminous navigation ${button.text}: text can wrap`)
    if (!button.writingMode.startsWith('horizontal')) failures.push(`luminous navigation ${button.text}: writing mode is not horizontal`)
    if (button.rect.height > 44 || button.rect.width < 70) failures.push(`luminous navigation ${button.text}: invalid geometry ${button.rect.width}x${button.rect.height}`)
    const comparison = withoutContext.buttons[index]
    if (comparison && (Math.abs(button.rect.left - comparison.rect.left) > 1 || Math.abs(button.rect.width - comparison.rect.width) > 1)) {
      failures.push(`luminous navigation ${button.text}: position changes between pages`)
    }
  })
  if (withContext.nav && withContext.actions && withContext.nav.right > withContext.actions.left - 4) failures.push('luminous navigation overlaps header actions')
  if (withContext.header.right > 2049 || withContext.header.left < -1) failures.push('luminous four-page header escapes the viewport')
  details['luminous four-page navigation'] = result
  await page.close()
}

try {
  const dashboardLight = await openView({ view: 'dashboard', theme: 'light', selector: '.paper-card-v3' })
  await inspectPage(dashboardLight, 'luminous dashboard light')
  await dashboardLight.close()

  const dashboardDark = await openView({ view: 'dashboard', theme: 'dark', selector: '.paper-card-v3' })
  await inspectPage(dashboardDark, 'luminous dashboard dark')
  await dashboardDark.close()

  const preparationLight = await openView({ view: 'preparation', theme: 'light', selector: '.preparation-workspace' })
  await inspectPage(preparationLight, 'luminous preparation light')
  await preparationLight.close()

  const statisticsLight = await openView({ view: 'stats', theme: 'light', selector: '.stats-panel' })
  await inspectPage(statisticsLight, 'luminous statistics light')
  await statisticsLight.close()

  await inspectFourPageNavigation()

  const dashboardMobile = await openView({
    view: 'dashboard',
    theme: 'light',
    viewport: { width: 390, height: 844 },
    selector: '.paper-card-v3',
  })
  await inspectPage(dashboardMobile, 'luminous dashboard mobile')
  await dashboardMobile.close()

  const retiredClassic = await openView({ view: 'dashboard', theme: 'light', ui: 'classic', selector: '.paper-card-v3' })
  await inspectPage(retiredClassic, 'retired Classic migration', 'luminous')
  await retiredClassic.close()

  if (details['luminous dashboard light']?.background === details['luminous dashboard dark']?.background) {
    failures.push('luminous light and dark themes use the same page background')
  }

  console.log(JSON.stringify({ failures, details }, null, 2))
  if (failures.length > 0) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}
