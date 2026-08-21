import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []
const fail = message => failures.push(message)

async function openPage(ui, view, viewport = { width: 1680, height: 1050 }) {
  const page = await browser.newPage({ viewport })
  await page.goto(`${baseUrl}?view=${view}&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true'] .app-header").waitFor({ state: 'visible', timeout: 45000 })
  await page.waitForTimeout(450)
  return page
}

async function activeStyle(page, key) {
  return page.evaluate(currentKey => {
    const button = document.querySelector(`button[data-main-nav-key='${currentKey}']`)
    if (!button) return null
    const style = getComputedStyle(button)
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      height: button.getBoundingClientRect().height,
      width: button.getBoundingClientRect().width,
    }
  }, key)
}

function compareStyles(ui, left, right, properties) {
  if (!left || !right) {
    fail(`${ui}: 无法读取同级导航样式`)
    return
  }
  for (const property of properties) {
    if (left[property] !== right[property]) fail(`${ui}: 期刊中心 ${property} 与同级按钮不一致`)
  }
}

const dashboard = await openPage('luminous-x', 'dashboard')
try {
  const geometry = await dashboard.evaluate(() => {
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON() || null
    const labels = Array.from(document.querySelectorAll('.header-utility-grid > button, .header-utility-grid > .project-feedback .project-feedback-trigger'))
      .filter(element => {
        const style = getComputedStyle(element)
        const bounds = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0
      })
      .map(element => (element.textContent || '').replace(/\s+/g, '').trim())
    return {
      labels,
      theme: rect(".header-utility-grid > button[data-utility-key='theme']"),
      settings: rect(".header-utility-grid > button[data-utility-key='settings']"),
      imported: rect(".header-utility-grid > button[data-utility-key='import']"),
      exported: rect(".header-utility-grid > button[data-utility-key='export']"),
      feedback: rect('.project-feedback-trigger'),
      utility: rect('.header-utility-grid'),
      primary: rect('.lx-new-paper'),
      filter: rect('.header-toolbox'),
    }
  })

  for (const label of ['主题', '设置', '导入', '导出', '反馈']) {
    if (!geometry.labels.some(item => item.includes(label))) fail(`luminous-x/dashboard: 工具区缺少“${label}”文字`)
  }
  if (!geometry.imported || !geometry.exported || Math.abs(geometry.imported.top - geometry.exported.top) > 1) {
    fail('luminous-x/dashboard: 导入与导出未处于同一行')
  }
  if (!geometry.feedback || !geometry.utility || geometry.feedback.width < geometry.utility.width - 2) {
    fail('luminous-x/dashboard: 项目反馈按钮未填满工具区空白行')
  }
  if (!geometry.primary || !geometry.filter || geometry.primary.bottom > geometry.filter.top + 1) {
    fail('luminous-x/dashboard: 新建投稿未移动到检索筛选上方')
  }

  const trigger = dashboard.getByRole('button', { name: '项目与反馈' })
  await trigger.click()
  const menu = dashboard.locator('.project-feedback-menu')
  await menu.waitFor({ state: 'visible', timeout: 10000 })
  const popup = await dashboard.evaluate(() => {
    const menu = document.querySelector('.project-feedback-menu')?.getBoundingClientRect()
    const trigger = document.querySelector('.project-feedback-trigger')?.getBoundingClientRect()
    return menu && trigger ? {
      menu: menu.toJSON(),
      trigger: trigger.toJSON(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    } : null
  })
  if (!popup) fail('luminous-x/dashboard: 项目与反馈弹窗未渲染')
  else {
    if (popup.menu.top < 0 || popup.menu.left < 0 || popup.menu.right > popup.viewport.width || popup.menu.bottom > popup.viewport.height) {
      fail('luminous-x/dashboard: 项目与反馈弹窗仍被视口裁切')
    }
    if (popup.menu.bottom > popup.trigger.top + 2) fail('luminous-x/dashboard: 项目与反馈弹窗未向上展开')
  }
  details.push(`dashboard utility labels=${geometry.labels.join('|')}`)
} catch (error) {
  fail(`luminous-x/dashboard: ${error instanceof Error ? error.message : String(error)}`)
} finally {
  await dashboard.close()
}

const preparationX = await openPage('luminous-x', 'preparation')
try {
  const primary = preparationX.locator('.header-context-primary')
  await primary.waitFor({ state: 'visible', timeout: 10000 })
  const initial = (await primary.textContent() || '').replace(/\s+/g, '')
  if (!initial.includes('新建草稿')) fail(`luminous-x/preparation: 总览主操作错误（${initial}）`)

  const sourceVisibility = await preparationX.evaluate(() => Array.from(document.querySelectorAll('.prep-top-actions-portal .btn-journal-primary, .prep-top-actions-portal .btn-context-new'))
    .some(element => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }))
  if (sourceVisibility) fail('luminous-x/preparation: 顶部仍重复显示新增类按钮')

  const preparationActive = await activeStyle(preparationX, 'preparation')
  await preparationX.locator("button[data-main-nav-key='journals']").click()
  await preparationX.locator('.preparation-workspace[data-section="journals"]').waitFor({ state: 'visible', timeout: 15000 })
  await preparationX.waitForTimeout(300)
  const journalLabel = (await primary.textContent() || '').replace(/\s+/g, '')
  if (!journalLabel.includes('新增期刊')) fail(`luminous-x/journals: 主操作未切换为新增期刊（${journalLabel}）`)
  const journalActive = await activeStyle(preparationX, 'journals')
  compareStyles('luminous-x active navigation', journalActive, preparationActive, [
    'color', 'backgroundColor', 'backgroundImage', 'borderColor', 'borderRadius', 'boxShadow', 'height', 'width',
  ])
  details.push(`luminous-x preparation primary=${initial}; journal primary=${journalLabel}`)
} catch (error) {
  fail(`luminous-x/preparation: ${error instanceof Error ? error.message : String(error)}`)
} finally {
  await preparationX.close()
}

const preparationLuminous = await openPage('luminous', 'preparation')
try {
  const primaryGeometry = await preparationLuminous.evaluate(() => {
    const tones = ['overview', 'paper', 'materials', 'match', 'check']
    const buttons = tones.map(tone => {
      const element = document.querySelector(`.preparation-workspace > .prep-nav-primary > button[data-tone='${tone}']`)
      if (!element) return null
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return {
        tone,
        display: style.display,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }
    }).filter(Boolean)
    const nav = document.querySelector('.preparation-workspace > .prep-nav-primary')?.getBoundingClientRect()
    return { buttons, nav: nav?.toJSON() || null }
  })

  if (primaryGeometry.buttons.length !== 5) {
    fail(`luminous/preparation: 一级工作区可见按钮数量错误（${primaryGeometry.buttons.length}）`)
  } else {
    const tops = primaryGeometry.buttons.map(item => item.top)
    const widths = primaryGeometry.buttons.map(item => item.width)
    if (Math.max(...tops) - Math.min(...tops) > 1) fail('luminous/preparation: 五个一级工作区未处于同一行')
    if (Math.max(...widths) - Math.min(...widths) > 2) fail('luminous/preparation: 五个一级工作区宽度不一致')
    for (const item of primaryGeometry.buttons) {
      if (item.display === 'none' || item.visibility === 'hidden' || item.pointerEvents === 'none') {
        fail(`luminous/preparation: ${item.tone} 一级工作区不可交互`)
      }
    }
  }
  if (!primaryGeometry.nav || primaryGeometry.nav.height > 60) {
    fail(`luminous/preparation: 一级工作区导航容器高度异常（${primaryGeometry.nav?.height ?? 'missing'}）`)
  }

  const routes = [
    ['paper', 'paper'],
    ['materials', 'materials'],
    ['match', 'match'],
    ['check', 'check'],
  ]
  for (const [tone, section] of routes) {
    await preparationLuminous.locator(`.preparation-workspace > .prep-nav-primary > button[data-tone='${tone}']`).click()
    await preparationLuminous.locator(`.preparation-workspace[data-section='${section}']`).waitFor({ state: 'visible', timeout: 10000 })
    await preparationLuminous.locator(".preparation-workspace > .prep-nav-primary > button[data-tone='overview']").click()
    await preparationLuminous.locator(".preparation-workspace[data-section='overview']").waitFor({ state: 'visible', timeout: 10000 })
  }

  const figureEntry = preparationLuminous.locator('.prep-figure-tool-entry:visible').first()
  await figureEntry.waitFor({ state: 'visible', timeout: 10000 })
  await figureEntry.click()
  await preparationLuminous.locator('.figure-composer').waitFor({ state: 'visible', timeout: 10000 })
  await preparationLuminous.getByRole('button', { name: /返回投稿准备/ }).click()
  await preparationLuminous.locator(".preparation-workspace[data-section='overview']").waitFor({ state: 'visible', timeout: 10000 })

  const preparationActive = await activeStyle(preparationLuminous, 'preparation')
  await preparationLuminous.locator("button[data-main-nav-key='journals']").click()
  await preparationLuminous.locator('.preparation-workspace[data-section="journals"]').waitFor({ state: 'visible', timeout: 15000 })
  await preparationLuminous.waitForTimeout(300)

  const journalGap = await preparationLuminous.evaluate(() => {
    const topbar = document.querySelector('.preparation-workspace[data-section="journals"] > .prep-topbar')?.getBoundingClientRect()
    const grid = document.querySelector('.preparation-workspace[data-section="journals"] > .prep-card-grid.journal-grid')?.getBoundingClientRect()
    return topbar && grid ? grid.top - topbar.bottom : null
  })
  if (journalGap === null) fail('luminous/journals: 无法读取顶栏与期刊卡片网格位置')
  else if (journalGap < 12) fail(`luminous/journals: 顶栏与期刊卡片间距过小（${journalGap.toFixed(1)}px）`)

  const journalActive = await activeStyle(preparationLuminous, 'journals')
  compareStyles('luminous active navigation', journalActive, preparationActive, [
    'color', 'backgroundColor', 'backgroundImage', 'borderColor', 'borderRadius', 'boxShadow', 'height',
  ])
  details.push(`luminous five business workspaces and secondary Figure Composer entry remain clickable; journal gap=${journalGap?.toFixed(1) ?? 'missing'}px`)
} catch (error) {
  fail(`luminous/preparation: ${error instanceof Error ? error.message : String(error)}`)
} finally {
  await preparationLuminous.close()
}

await browser.close()
if (failures.length) {
  console.error('Header action coherence regression check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}
console.log('Header action coherence regression check passed.')
details.forEach(item => console.log(`- ${item}`))
