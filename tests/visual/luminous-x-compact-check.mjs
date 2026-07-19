import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const browser = await chromium.launch({ headless: true })
const failures = []
const base = 'http://127.0.0.1:4174/tests/visual/index.html'
mkdirSync('focused-review', { recursive: true })

async function open(view) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  await page.goto(`${base}?view=${view}&theme=light&ui=luminous-x`)
  await page.locator("html[data-visual-ready='true']").waitFor({ timeout: 45000 })
  await page.waitForTimeout(500)
  return page
}

try {
  const dashboard = await open('dashboard')
  const statusSurfaces = await dashboard.evaluate(() => Array.from(document.querySelectorAll('.paper-grid .paper-card-v3')).map(card => {
    const status = card.querySelector('.paper-status-area')?.getAttribute('data-status') || 'unknown'
    const style = getComputedStyle(card)
    return { status, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, borderColor: style.borderColor }
  }))
  const surfaceByStatus = new Map()
  statusSurfaces.forEach(item => {
    if (!surfaceByStatus.has(item.status)) surfaceByStatus.set(item.status, `${item.backgroundColor}|${item.backgroundImage}|${item.borderColor}`)
  })
  if (surfaceByStatus.size >= 2 && new Set(surfaceByStatus.values()).size < surfaceByStatus.size) failures.push('dashboard: different statuses still share the same card surface')

  await dashboard.getByRole('button', { name: '按期刊视图' }).click()
  await dashboard.locator('.lx-journal-group').first().waitFor()
  await dashboard.screenshot({ path: 'focused-review/luminous-x-journal-view.png', fullPage: true })
  const journal = await dashboard.evaluate(() => Array.from(document.querySelectorAll('.lx-journal-group')).map(group => {
    const grid = group.querySelector('.lx-journal-group-grid')
    const cards = Array.from(group.querySelectorAll('.paper-card-v3'))
    const rect = grid?.getBoundingClientRect()
    return { grid: rect?.toJSON(), cards: cards.map(card => card.getBoundingClientRect().toJSON()) }
  }))
  journal.forEach((group, index) => {
    if (!group.grid || !group.cards.length) return
    if (group.cards.length === 1 && group.cards[0].width < group.grid.width * .9) failures.push(`journal ${index + 1}: single card wastes half the row`)
    if (group.cards.some(card => card.height > 520)) failures.push(`journal ${index + 1}: card is stretched vertically`)
  })
  await dashboard.close()

  const prep = await open('preparation')
  await prep.locator('.prep-productivity-host').waitFor({ state: 'attached' })
  await prep.screenshot({ path: 'focused-review/luminous-x-preparation-compact.png', fullPage: true })
  const prepLayout = await prep.evaluate(() => {
    const workspace = document.querySelector('.preparation-workspace')
    const topbar = workspace?.querySelector('.prep-topbar')
    const proxy = document.querySelector(".lx-status-bar[data-page='preparation'] .lx-page-proxy-controls")
    const original = workspace?.querySelector(':scope > .prep-nav')
    const assistant = workspace?.querySelector('.prep-productivity-host')
    const topics = workspace?.querySelector('.prep-topic-overview')
    const draftPanel = workspace?.querySelector('.prep-overview-drafts')
    const journalPanel = workspace?.querySelector('.prep-overview-journals')
    const draftList = draftPanel?.querySelector('.prep-overview-draft-list')
    const draftCards = Array.from(draftList?.querySelectorAll('.prep-draft-card.compact') || [])
    const draftTitle = draftPanel?.querySelector('.prep-panel-head h2')?.textContent?.trim() || ''
    if (!workspace || !topbar || !proxy || !original) return null

    const listRect = draftList?.getBoundingClientRect()
    const cardRects = draftCards.map(card => card.getBoundingClientRect())
    const fullyVisibleDrafts = listRect
      ? cardRects.filter(card => card.top >= listRect.top - 1 && card.bottom <= listRect.bottom + 1).length
      : 0

    return {
      display: getComputedStyle(workspace).display,
      direction: getComputedStyle(workspace).flexDirection,
      workspace: workspace.getBoundingClientRect().toJSON(),
      topbar: topbar.getBoundingClientRect().toJSON(),
      proxy: proxy.getBoundingClientRect().toJSON(),
      original: getComputedStyle(original).display,
      assistant: assistant?.getBoundingClientRect().toJSON(),
      topics: topics?.getBoundingClientRect().toJSON(),
      draftTitle,
      draftPanel: draftPanel?.getBoundingClientRect().toJSON(),
      journalPanel: journalPanel?.getBoundingClientRect().toJSON(),
      draftCards: cardRects.map(rect => rect.toJSON()),
      fullyVisibleDrafts,
    }
  })
  if (!prepLayout) failures.push('preparation: required elements missing')
  else {
    if (prepLayout.display !== 'flex' || prepLayout.direction !== 'column') failures.push('preparation: overview is not a vertical flow')
    if (prepLayout.original !== 'none') failures.push('preparation: duplicate navigation is visible')
    if (prepLayout.topbar.width > prepLayout.workspace.width * .72) failures.push('preparation: overview action toolbar still spans the page')
    if (Math.abs(prepLayout.topbar.right - prepLayout.workspace.right) > 4) failures.push('preparation: overview action toolbar is not right aligned')
    if (prepLayout.draftTitle !== '草稿推进') failures.push(`preparation: draft panel title is ${prepLayout.draftTitle || 'missing'}`)
    if (prepLayout.draftPanel && prepLayout.journalPanel && Math.abs(prepLayout.draftPanel.height - prepLayout.journalPanel.height) > 4) failures.push('preparation: draft and journal panels are not equal height')
    if (prepLayout.draftCards.length >= 2 && prepLayout.fullyVisibleDrafts < 2) failures.push('preparation: fewer than two complete draft records are visible')
    if (prepLayout.draftCards.some(card => card.height > 130)) failures.push('preparation: overview draft card is still too tall')
    if (prepLayout.assistant && prepLayout.topics) {
      if (Math.abs(prepLayout.assistant.left - prepLayout.topics.left) > 4) failures.push('preparation: modules do not share one column')
      const overlap = Math.min(prepLayout.assistant.bottom, prepLayout.topics.bottom) - Math.max(prepLayout.assistant.top, prepLayout.topics.top)
      if (overlap > 2) failures.push('preparation: modules still overlap or sit side by side')
    }
  }

  const prepProxy = prep.locator(".lx-status-bar[data-page='preparation'] .lx-page-proxy-controls")
  await prepProxy.getByRole('button', { name: /草稿准备/ }).click()
  await prep.waitForTimeout(150)
  const draftActions = await prep.evaluate(() => {
    const workspace = document.querySelector(".preparation-workspace[data-section='drafts']")
    const topbar = workspace?.querySelector('.prep-topbar')
    const action = workspace?.querySelector('.btn-context-new')
    const journalAction = workspace?.querySelector('.btn-journal-primary')
    return workspace && topbar && action ? {
      position: getComputedStyle(topbar).position,
      actionDisplay: getComputedStyle(action).display,
      actionText: action.textContent?.trim() || '',
      journalActionDisplay: journalAction ? getComputedStyle(journalAction).display : 'missing',
    } : null
  })
  if (!draftActions) failures.push('preparation: draft creation controls are missing')
  else {
    if (draftActions.position !== 'sticky') failures.push('preparation: draft creation strip is not sticky')
    if (draftActions.actionDisplay === 'none' || !draftActions.actionText.includes('新建草稿')) failures.push('preparation: new draft action is not visible')
    if (draftActions.journalActionDisplay !== 'none') failures.push('preparation: unrelated journal action remains in draft creation strip')
  }

  await prepProxy.getByRole('button', { name: /期刊库/ }).click()
  await prep.waitForTimeout(150)
  const journalActions = await prep.evaluate(() => {
    const workspace = document.querySelector(".preparation-workspace[data-section='journals']")
    const topbar = workspace?.querySelector('.prep-topbar')
    const action = workspace?.querySelector('.btn-journal-primary')
    return workspace && topbar && action ? {
      position: getComputedStyle(topbar).position,
      actionDisplay: getComputedStyle(action).display,
      actionText: action.textContent?.trim() || '',
    } : null
  })
  if (!journalActions) failures.push('preparation: journal creation controls are missing')
  else {
    if (journalActions.position !== 'sticky') failures.push('preparation: journal creation strip is not sticky')
    if (journalActions.actionDisplay === 'none' || !journalActions.actionText.includes('收藏期刊')) failures.push('preparation: collect journal action is not visible')
  }
  await prep.screenshot({ path: 'focused-review/luminous-x-preparation-journal-actions.png', fullPage: true })
  await prep.close()

  console.log(JSON.stringify({ failures, statusSurfaces, journal, prepLayout, draftActions, journalActions }, null, 2))
  if (failures.length) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}
