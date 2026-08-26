import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []
const fail = message => failures.push(message)

const preparationSource = readFileSync(new URL('../../src/components/PreparationWorkspace.tsx', import.meta.url), 'utf8')
const journalCenterSource = readFileSync(new URL('../../src/components/JournalCenterWorkspace.tsx', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('../../src/components/Dashboard.tsx', import.meta.url), 'utf8')
if (preparationSource.includes('className="spinner"')) fail('投稿准备加载态仍复用全局 spinner 类')
if (!preparationSource.includes('prep-loading-icon')) fail('投稿准备缺少独立加载图标契约')
if (!preparationSource.includes('JournalMatchWorkspace')) fail('投稿准备的期刊匹配没有独立工作区')
if (!journalCenterSource.includes('journal-center-toolbar') || !journalCenterSource.includes('journal-center-search')) fail('期刊中心缺少独立标题/搜索工具栏')
if (!dashboardSource.includes('<JournalCenterWorkspace')) fail('顶层期刊中心未直接渲染独立工作区')
if (dashboardSource.includes('workspaceMode="journal-center"')) fail('顶层期刊中心仍通过投稿准备伪装')

async function openPage(ui, view, viewport = { width: 1680, height: 1050 }) {
  const page = await browser.newPage({ viewport })
  await page.goto(`${baseUrl}?view=${view}&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true'] .app-header").waitFor({ state: 'visible', timeout: 45000 })
  await page.waitForTimeout(300)
  return page
}

for (const ui of ['luminous', 'luminous-x']) {
  const page = await openPage(ui, 'preparation')
  try {
    const preparation = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0
      }
      const workspace = document.querySelector('.preparation-workspace[data-section="overview"]')
      const nav = workspace?.querySelector(':scope > .prep-nav-primary')
      const buttons = Array.from(nav?.querySelectorAll(':scope > button') || []).filter(visible)
      const topbar = workspace?.querySelector(':scope > .prep-topbar')
      return {
        labels: buttons.map(button => (button.textContent || '').replace(/\s+/g, ' ').trim()),
        navOverflow: nav ? nav.scrollWidth - nav.clientWidth : 999,
        navHeight: nav?.getBoundingClientRect().height || 0,
        buttonHeights: buttons.map(button => button.getBoundingClientRect().height),
        topbarHeight: topbar && visible(topbar) ? topbar.getBoundingClientRect().height : 0,
      }
    })

    const requiredRoutes = ['总览', '论文准备', '投稿材料', '期刊匹配', '投稿前检查']
    for (const label of requiredRoutes) if (!preparation.labels.some(item => item.includes(label))) fail(`${ui}: 投稿准备缺少“${label}”`)
    if (preparation.labels.length !== 5) fail(`${ui}: 投稿准备可见菜单不是 5 个（${preparation.labels.join(' / ')}）`)
    if (preparation.labels.some(item => ['选题池', '草稿准备', '期刊库', '期刊比较'].some(legacy => item.includes(legacy)))) fail(`${ui}: 投稿准备一级导航仍混入旧入口`)
    if (preparation.navOverflow > 2) fail(`${ui}: 投稿准备二级导航横向溢出 ${preparation.navOverflow}px`)
    if (preparation.navHeight > 44) fail(`${ui}: 投稿准备二级导航仍像大卡片条（${preparation.navHeight}px）`)
    if (preparation.buttonHeights.some(height => height > 36)) fail(`${ui}: 投稿准备子菜单按钮过高（${preparation.buttonHeights.join(', ')}）`)
    if (ui === 'luminous' && preparation.topbarHeight > 76) fail(`${ui}: 投稿准备标题栏仍过高（${preparation.topbarHeight}px）`)

    const matchButton = page.locator('.preparation-workspace > .prep-nav-primary').getByRole('button', { name: /期刊匹配/ })
    await matchButton.click()
    await page.locator('.preparation-workspace[data-section="match"] .journal-match-workspace').waitFor({ state: 'visible', timeout: 10000 })
    if (await page.locator('.preparation-workspace[data-section="match"] .journal-grid').count()) fail(`${ui}: 期刊匹配仍复制期刊中心目录网格`)

    const journalEntry = page.locator("button[data-main-nav-key='journals']:visible").first()
    await journalEntry.waitFor({ state: 'visible', timeout: 15000 })
    await journalEntry.evaluate(element => element.click())
    await page.locator('.journal-center-workspace').waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('.journal-center-toolbar').waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('.journal-center-search input').waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(250)

    const placement = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0
      }
      const workspace = document.querySelector('.journal-center-workspace')
      const toolbar = workspace?.querySelector('.journal-center-toolbar')
      const search = workspace?.querySelector('.journal-center-search')
      const actions = workspace?.querySelector('.journal-center-toolbar__actions')
      const title = workspace?.querySelector('.journal-center-toolbar__title')
      const prepNav = workspace?.querySelector('.prep-nav-primary')
      const oldFilters = document.querySelector('.journal-catalog-top-filters')
      const oldToolbar = workspace?.querySelector('.journal-catalog-toolbar')
      const toolbarRect = toolbar?.getBoundingClientRect()
      const searchRect = search?.getBoundingClientRect()
      const cards = Array.from(workspace?.querySelectorAll('.journal-center-card') || []).filter(visible)
      return {
        toolbar: toolbarRect?.toJSON() || null,
        search: searchRect?.toJSON() || null,
        actions: actions?.getBoundingClientRect().toJSON() || null,
        title: title?.getBoundingClientRect().toJSON() || null,
        toolbarOverflowX: toolbar ? toolbar.scrollWidth - toolbar.clientWidth : 999,
        toolbarOverflowY: toolbar ? toolbar.scrollHeight - toolbar.clientHeight : 999,
        prepNav: !!prepNav,
        oldFilters: !!oldFilters,
        oldToolbar: !!oldToolbar,
        cards: cards.length,
      }
    })

    if (!placement.toolbar || !placement.search) fail(`${ui}: 期刊中心标题栏或搜索框不存在`)
    else {
      if (placement.toolbarOverflowX > 2) fail(`${ui}: 期刊中心标题栏横向溢出 ${placement.toolbarOverflowX}px`)
      if (placement.search.left < placement.toolbar.left - 1 || placement.search.right > placement.toolbar.right + 1) fail(`${ui}: 期刊中心搜索框横向越出标题栏`)
      if (placement.search.top < placement.toolbar.top - 1 || placement.search.bottom > placement.toolbar.bottom + 1) fail(`${ui}: 期刊中心搜索框被标题栏裁切`)
      if (placement.toolbar.height > 118) fail(`${ui}: 期刊中心标题栏异常过高（${placement.toolbar.height}px）`)
    }
    if (placement.prepNav) fail(`${ui}: 独立期刊中心不应显示投稿准备五业务条`)
    if (placement.oldFilters || placement.oldToolbar) fail(`${ui}: 独立期刊中心仍残留旧筛选/说明行`)

    const routeState = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const buttons = Array.from(document.querySelectorAll('button[data-main-nav-key]')).filter(visible)
      const journal = buttons.find(button => button.dataset.mainNavKey === 'journals')
      const prep = buttons.find(button => button.dataset.mainNavKey === 'preparation')
      return {
        journalActive: journal?.classList.contains('active') || false,
        prepActive: prep?.classList.contains('active') || false,
        widthDelta: journal && prep ? Math.abs(journal.getBoundingClientRect().width - prep.getBoundingClientRect().width) : null,
        heightDelta: journal && prep ? Math.abs(journal.getBoundingClientRect().height - prep.getBoundingClientRect().height) : null,
        journalRadius: journal ? getComputedStyle(journal).borderRadius : '',
        prepRadius: prep ? getComputedStyle(prep).borderRadius : '',
      }
    })
    if (!routeState.journalActive) fail(`${ui}: 打开期刊中心后顶栏入口未激活`)
    if (routeState.prepActive) fail(`${ui}: 打开期刊中心后投稿准备仍保持激活`)
    if (ui === 'luminous-x' && routeState.widthDelta != null) {
      if (routeState.widthDelta > 1 || routeState.heightDelta > 1) fail(`luminous-x: 期刊中心与同级主菜单几何不一致`)
      if (routeState.journalRadius !== routeState.prepRadius) fail('luminous-x: 期刊中心圆角与同级主菜单不一致')
    }

    const search = page.locator('.journal-center-search input')
    const initialCards = await page.locator('.journal-center-card:visible').count()
    await search.fill('Landslides')
    await page.waitForTimeout(180)
    const searchedCards = await page.locator('.journal-center-card:visible').count()
    if (initialCards > 0 && searchedCards > initialCards) fail(`${ui}: 期刊中心搜索没有收敛结果`)
    await search.fill('')

    details.push(`${ui}: prepNav=${preparation.navHeight}px; journalToolbar=${placement.toolbar?.height || 0}px; cards=${placement.cards}`)
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
    return { columns: style.gridTemplateColumns.split(' ').filter(Boolean).length, overflow: paperGrid.scrollWidth - paperGrid.clientWidth }
  })
  if (!grid) fail('luminous/dashboard: 投稿卡片网格不存在')
  else {
    if (grid.columns !== 4) fail(`luminous/dashboard: 投稿管理不是四列（${grid.columns}）`)
    if (grid.overflow > 2) fail(`luminous/dashboard: 四列横向溢出 ${grid.overflow}px`)
    details.push(`luminous/dashboard: columns=${grid.columns}`)
  }
} catch (error) {
  fail(`luminous/dashboard: ${error instanceof Error ? error.message : String(error)}`)
} finally {
  await dashboard.close()
}

await browser.close()
if (failures.length) {
  console.error('Journal Center / Preparation chrome regression check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}
console.log('Journal Center / Preparation chrome regression check passed.')
details.forEach(item => console.log(`- ${item}`))
