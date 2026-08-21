import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []
const fail = message => failures.push(message)

const preparationSource = readFileSync(new URL('../../src/components/PreparationWorkspace.tsx', import.meta.url), 'utf8')
const onlinePreparationSource = readFileSync(new URL('../../src/components/OnlinePreparationWorkspace.tsx', import.meta.url), 'utf8')
if (preparationSource.includes('className="spinner"')) fail('投稿准备加载态仍复用全局 spinner 类')
if (!preparationSource.includes('prep-loading-icon')) fail('投稿准备缺少独立加载图标契约')
if (!preparationSource.includes('prep-journal-apc-cny') || !preparationSource.includes('prep-overview-apc-cny')) fail('期刊 APC 人民币参考价未由 React 直接渲染')
if ((onlinePreparationSource.match(/await load\(false\)/g) || []).length < 6) fail('保存/删除后仍会触发全屏投稿准备 loading')

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
    const preparation = await page.evaluate(currentUi => {
      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0
      }
      const workspace = document.querySelector('.preparation-workspace[data-section="overview"]')
      const nav = workspace?.querySelector(':scope > .prep-nav-primary')
      const buttons = Array.from(nav?.querySelectorAll(':scope > button') || []).filter(visible)
      return {
        labels: buttons.map(button => (button.textContent || '').replace(/\s+/g, ' ').trim()),
        columns: nav ? getComputedStyle(nav).gridTemplateColumns.split(' ').filter(Boolean).length : null,
      }
    }, ui)

    const requiredRoutes = ['总览', '论文准备', '投稿材料', '期刊匹配', '投稿前检查']
    for (const label of requiredRoutes) {
      if (!preparation.labels.some(item => item.includes(label))) fail(`${ui}: 投稿准备缺少“${label}”`)
    }
    if (preparation.labels.length !== 5) fail(`${ui}: 投稿准备可见菜单不是 5 个（${preparation.labels.join(' / ')}）`)
    if (preparation.labels.some(item => ['选题池', '草稿准备', '期刊库', '期刊比较'].some(legacy => item.includes(legacy)))) {
      fail(`${ui}: 投稿准备一级导航仍混入旧二级入口（${preparation.labels.join(' / ')}）`)
    }
    if (preparation.columns !== 5) fail(`${ui}: 投稿准备不是五列（${preparation.columns}）`)

    const journalEntry = page.locator("button[data-main-nav-key='journals']:visible").first()
    await journalEntry.waitFor({ state: 'visible', timeout: 15000 })
    await journalEntry.evaluate(element => element.click())
    await page.locator('.journal-catalog-top-filters').waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('.journal-center-workspace[data-section="match"] .journal-grid').waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(250)

    const placement = await page.evaluate(currentUi => {
      const workspace = document.querySelector('.journal-center-workspace[data-section="match"]')
      const filters = document.querySelector('.journal-catalog-top-filters')
      const expectedHost = currentUi === 'luminous-x'
        ? document.querySelector('.lx-status-bar[data-page="journals"] .lx-status-controls-host')
        : workspace?.querySelector(':scope > .prep-topbar')
      const nav = workspace?.querySelector(':scope > .prep-nav')
      return {
        correctHost: !!filters && filters.parentElement === expectedHost,
        navDisplay: nav ? getComputedStyle(nav).display : 'missing',
        legacyRow: !!workspace?.querySelector(':scope > .journal-catalog-toolbar'),
        overflow: filters ? filters.scrollWidth - filters.clientWidth : 0,
      }
    }, ui)

    if (!placement.correctHost) fail(`${ui}: 筛选未进入顶部控制区`)
    if (placement.navDisplay !== 'missing') fail(`${ui}: 独立期刊中心不应显示投稿准备五业务条`)
    if (placement.legacyRow) fail(`${ui}: 期刊中心仍显示旧筛选说明行`)
    if (placement.overflow > 2) fail(`${ui}: 顶部筛选溢出 ${placement.overflow}px`)

    const apc = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.journal-center-workspace[data-section="match"] .prep-journal-card'))
      const priced = cards.filter(card => {
        const cell = card.querySelector('.prep-journal-apc-metric')
        const value = cell?.querySelector('b')?.textContent?.trim() || ''
        return value && value !== '—' && value !== '--'
      })
      return {
        priced: priced.length,
        declarativeCny: priced.filter(card => !!card.querySelector('.prep-journal-apc-cny')).length,
        legacyInjected: document.querySelectorAll('.prep-journal-card .journal-card-cny').length,
      }
    })
    if (apc.priced > 0 && apc.declarativeCny !== apc.priced) fail(`${ui}: 有 ${apc.priced} 个 APC 金额，但仅 ${apc.declarativeCny} 个直接渲染人民币参考价`)
    if (apc.legacyInjected > 0) fail(`${ui}: 仍由后置 DOM 增强器注入 ${apc.legacyInjected} 个 APC 人民币节点`)

    for (const filter of ['all', 'focus', 'submission-history', 'manual']) {
      await page.locator(`.journal-catalog-filter[data-filter="${filter}"]`).first().click()
      await page.waitForTimeout(120)
      const result = await page.evaluate(activeFilter => {
        const visible = element => {
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0
        }
        const workspace = document.querySelector('.journal-center-workspace[data-section="match"]')
        const button = document.querySelector(`.journal-catalog-filter[data-filter="${activeFilter}"]`)
        const expected = Number((button?.textContent || '').match(/(\d+)\s*$/)?.[1] || -1)
        const cards = Array.from(workspace?.querySelectorAll('.prep-journal-card') || [])
        return {
          expected,
          actual: cards.filter(visible).length,
          active: button?.classList.contains('active') || false,
          state: workspace?.dataset.journalCatalogFilter || '',
        }
      }, filter)
      if (!result.active || result.state !== filter) fail(`${ui}/${filter}: 激活状态未同步`)
      if (result.actual !== result.expected) fail(`${ui}/${filter}: 显示 ${result.actual} 条，预期 ${result.expected} 条`)
    }

    if (ui === 'luminous-x') {
      const parity = await page.evaluate(() => {
        const visible = element => {
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0
        }
        const buttons = Array.from(document.querySelectorAll('button[data-main-nav-key]')).filter(visible)
        const journal = buttons.find(button => button.dataset.mainNavKey === 'journals')
        const peer = buttons.find(button => button.dataset.mainNavKey === 'preparation')
        if (!journal || !peer) return null
        const journalStyle = getComputedStyle(journal)
        const peerStyle = getComputedStyle(peer)
        return {
          widthDelta: Math.abs(journal.getBoundingClientRect().width - peer.getBoundingClientRect().width),
          heightDelta: Math.abs(journal.getBoundingClientRect().height - peer.getBoundingClientRect().height),
          journalRadius: journalStyle.borderRadius,
          peerRadius: peerStyle.borderRadius,
          justify: journalStyle.justifyContent,
        }
      })
      if (!parity) fail('luminous-x: 无法读取期刊中心及同级菜单')
      else {
        if (parity.widthDelta > 1) fail(`luminous-x: 期刊中心宽度差 ${parity.widthDelta}px`)
        if (parity.heightDelta > 1) fail(`luminous-x: 期刊中心高度差 ${parity.heightDelta}px`)
        if (parity.journalRadius !== parity.peerRadius) fail('luminous-x: 期刊中心圆角与同级菜单不一致')
        if (parity.justify !== 'flex-start') fail(`luminous-x: 期刊中心未左对齐（${parity.justify}）`)
      }
    }

    details.push(`${ui}: routes=${preparation.labels.join('|')}; filters verified`)
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
    }
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
  console.error('Journal Center header/filter regression check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}
console.log('Journal Center header/filter regression check passed.')
details.forEach(item => console.log(`- ${item}`))
