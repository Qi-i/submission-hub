import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []

function fail(message) {
  failures.push(message)
}

function visible(element) {
  const style = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0
}

async function openPage(ui, view, viewport = { width: 1680, height: 1050 }) {
  const page = await browser.newPage({ viewport })
  await page.goto(`${baseUrl}?view=${view}&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true'] .app-header").waitFor({ state: 'visible', timeout: 45000 })
  await page.waitForTimeout(350)
  return page
}

for (const ui of ['luminous', 'luminous-x']) {
  const page = await openPage(ui, 'preparation')
  try {
    const preparationNav = await page.evaluate(currentUi => {
      const workspace = document.querySelector('.preparation-workspace[data-section="overview"]')
      const nav = currentUi === 'luminous-x'
        ? document.querySelector('.lx-status-bar[data-page="preparation"] .lx-page-proxy-controls')
        : workspace?.querySelector(':scope > .prep-nav')
      const buttons = Array.from(nav?.querySelectorAll(':scope > button') || []).filter(visible)
      return {
        labels: buttons.map(button => (button.textContent || '').replace(/\s+/g, ' ').trim()),
        columns: nav && currentUi === 'luminous' ? getComputedStyle(nav).gridTemplateColumns.split(' ').filter(Boolean).length : null,
      }
    }, ui)

    const requiredRoutes = ['总览', '选题池', '草稿准备', '期刊比较']
    if (preparationNav.labels.length !== 4) fail(`${ui}: 投稿准备可见菜单不是 4 个（${preparationNav.labels.join(' / ')}）`)
    for (const label of requiredRoutes) {
      if (!preparationNav.labels.some(item => item.includes(label))) fail(`${ui}: 投稿准备缺少“${label}”菜单`)
    }
    if (preparationNav.labels.some(item => item.includes('期刊库'))) fail(`${ui}: 投稿准备仍显示重复“期刊库”入口`)
    if (ui === 'luminous' && preparationNav.columns !== 4) fail(`${ui}: 投稿准备桌面菜单不是四列（${preparationNav.columns}）`)

    const journalEntry = page.locator(".header-tabs > button[data-main-nav-key='journals']:visible, .tab-bar > button[data-main-nav-key='journals']:visible").first()
    await journalEntry.waitFor({ state: 'visible', timeout: 15000 })
    await journalEntry.evaluate(element => element.click())
    await page.locator('.journal-catalog-top-filters').waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('.preparation-workspace[data-section="journals"] .journal-grid').waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(250)

    const placement = await page.evaluate(currentUi => {
      const workspace = document.querySelector('.preparation-workspace[data-section="journals"]')
      const filters = document.querySelector('.journal-catalog-top-filters')
      const nav = workspace?.querySelector(':scope > .prep-nav')
      const directLegacy = workspace?.querySelector(':scope > .journal-catalog-toolbar')
      const expectedHost = currentUi === 'luminous-x'
        ? document.querySelector('.lx-status-bar[data-page="preparation"] .lx-status-controls-host')
        : workspace?.querySelector(':scope > .prep-topbar')
      return {
        correctHost: !!filters && filters.parentElement === expectedHost,
        navDisplay: nav ? getComputedStyle(nav).display : 'missing',
        legacyDirectRow: !!directLegacy,
        filterOverflow: filters ? filters.scrollWidth - filters.clientWidth : 0,
      }
    }, ui)

    if (!placement.correctHost) fail(`${ui}: 期刊筛选没有移动到顶部控制区`)
    if (placement.navDisplay !== 'none') fail(`${ui}: 期刊中心仍显示投稿准备子菜单行`)
    if (placement.legacyDirectRow) fail(`${ui}: 期刊中心仍保留下方独立筛选说明行`)
    if (placement.filterOverflow > 2) fail(`${ui}: 顶部筛选控件横向溢出 ${placement.filterOverflow}px`)

    for (const filter of ['all', 'focus', 'submission-history', 'manual']) {
      const button = page.locator(`.journal-catalog-top-filters .journal-catalog-filter[data-filter="${filter}"]`).first()
      await button.click()
      await page.waitForTimeout(120)
      const state = await page.evaluate(activeFilter => {
        const workspace = document.querySelector('.preparation-workspace[data-section="journals"]')
        const button = document.querySelector(`.journal-catalog-top-filters .journal-catalog-filter[data-filter="${activeFilter}"]`)
        const match = (button?.textContent || '').match(/(\d+)\s*$/)
        const expected = match ? Number(match[1]) : -1
        const cards = Array.from(workspace?.querySelectorAll('.prep-journal-card') || [])
        const visibleCards = cards.filter(visible)
        return {
          expected,
          visible: visibleCards.length,
          active: button?.classList.contains('active') || false,
          workspaceFilter: workspace?.dataset.journalCatalogFilter || '',
          hiddenClassCount: cards.filter(card => card.classList.contains('is-catalog-filtered-out')).length,
        }
      }, filter)

      if (!state.active || state.workspaceFilter !== filter) fail(`${ui}/${filter}: 筛选按钮没有进入激活状态`)
      if (state.expected < 0) fail(`${ui}/${filter}: 无法读取筛选数量`)
      else if (state.visible !== state.expected) fail(`${ui}/${filter}: 显示 ${state.visible} 条，预期 ${state.expected} 条`)
      if (filter !== 'all' && state.hiddenClassCount === 0 && state.expected < 13) fail(`${ui}/${filter}: 筛选后未隐藏任何不匹配卡片`)
    }

    if (ui === 'luminous-x') {
      const navCoherence = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('.app-header .header-tabs > button')).filter(visible)
        const journal = buttons.find(button => button.dataset.mainNavKey === 'journals')
        const peer = buttons.find(button => button.dataset.mainNavKey === 'preparation')
        if (!journal || !peer) return null
        const journalStyle = getComputedStyle(journal)
        const peerStyle = getComputedStyle(peer)
        return {
          journalWidth: journal.getBoundingClientRect().width,
          peerWidth: peer.getBoundingClientRect().width,
          journalHeight: journal.getBoundingClientRect().height,
          peerHeight: peer.getBoundingClientRect().height,
          journalRadius: journalStyle.borderRadius,
          peerRadius: peerStyle.borderRadius,
          justify: journalStyle.justifyContent,
        }
      })
      if (!navCoherence) fail('luminous-x: 无法读取侧栏菜单样式')
      else {
        if (Math.abs(navCoherence.journalWidth - navCoherence.peerWidth) > 1) fail('luminous-x: 期刊中心与其他侧栏按钮宽度不一致')
        if (Math.abs(navCoherence.journalHeight - navCoherence.peerHeight) > 1) fail('luminous-x: 期刊中心与其他侧栏按钮高度不一致')
        if (navCoherence.journalRadius !== navCoherence.peerRadius) fail('luminous-x: 期刊中心与其他侧栏按钮圆角不一致')
        if (navCoherence.justify !== 'flex-start') fail(`luminous-x: 期刊中心未按侧栏左对齐（${navCoherence.justify}）`)
      }
    }

    details.push(`${ui}: preparation routes=${preparationNav.labels.join('|')}; header filters verified`)
  } catch (error) {
    fail(`${ui}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await page.close()
  }
}

const dashboard = await openPage('luminous', 'dashboard')
try {
  const grid = await dashboard.evaluate(() => {
    const paperGrid = document.querySelector('.paper-grid')
    if (!paperGrid) return null
    const style = getComputedStyle(paperGrid)
    return {
      columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
      overflow: paperGrid.scrollWidth - paperGrid.clientWidth,
      visibleCards: Array.from(paperGrid.querySelectorAll('.paper-card-v3, .card.glass-card')).filter(visible).length,
    }
  })
  if (!grid) fail('luminous/dashboard: 投稿卡片网格不存在')
  else {
    if (grid.columns !== 4) fail(`luminous/dashboard: 普通视图投稿管理不是四列（${grid.columns}）`)
    if (grid.overflow > 2) fail(`luminous/dashboard: 四列布局横向溢出 ${grid.overflow}px`)
    if (grid.visibleCards < 4) fail(`luminous/dashboard: 测试数据不足以验证四列（${grid.visibleCards}）`)
    details.push(`luminous/dashboard: columns=${grid.columns}; cards=${grid.visibleCards}`)
  }
} catch (error) {
  fail(`luminous/dashboard: ${error instanceof Error ? error.message : String(error)}`)
} finally {
  await dashboard.close()
}

await browser.close()

if (failures.length) {
  console.error('Journal Center header/filter regression check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Journal Center header/filter regression check passed.')
details.forEach(item => console.log(`- ${item}`))
