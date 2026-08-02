import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const browser = await chromium.launch({ headless: true })
const failures = []
const base = 'http://127.0.0.1:4174/tests/visual/index.html'
mkdirSync('focused-review', { recursive: true })

async function open(view, width = 1440, height = 1100) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(`${base}?view=${view}&theme=light&ui=luminous-x`)
  await page.locator("html[data-visual-ready='true']").waitFor({ timeout: 45000 })
  await page.waitForTimeout(500)
  return page
}

function overlaps(left, right) {
  if (!left || !right) return false
  return Math.min(left.right, right.right) - Math.max(left.left, right.left) > 2
    && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 2
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
    const topbar = workspace?.querySelector(':scope > .prep-topbar')
    const proxy = document.querySelector(".lx-status-bar[data-page='preparation'] .lx-page-proxy-controls")
    const portal = document.querySelector('#lx-preparation-actions-slot .prep-top-actions-portal')
    const statusHost = document.querySelector(".lx-status-bar[data-page='preparation'] .lx-status-controls-host")
    const original = workspace?.querySelector(':scope > .prep-nav')
    const assistant = workspace?.querySelector('.prep-productivity-host')
    const topics = workspace?.querySelector('.prep-topic-overview')
    const draftPanel = workspace?.querySelector('.prep-overview-drafts')
    const journalPanel = workspace?.querySelector('.prep-overview-journals')
    const draftList = draftPanel?.querySelector('.prep-overview-draft-list')
    const draftCards = Array.from(draftList?.querySelectorAll('.prep-draft-card.compact') || [])
    const draftTitle = draftPanel?.querySelector('.prep-panel-head h2')?.textContent?.trim() || ''
    const proxyJournal = Array.from(proxy?.querySelectorAll('button') || []).find(button => button.textContent?.replace(/\s+/g, '').includes('期刊库'))
    const primaryJournal = document.querySelector("button[data-main-nav-key='journals']")
    const primaryPeer = document.querySelector("button[data-main-nav-key='preparation']")
    const sidebarAction = document.querySelector('.header-context-primary')
    if (!workspace || !topbar || !proxy || !original) return null

    const listRect = draftList?.getBoundingClientRect()
    const cardRects = draftCards.map(card => card.getBoundingClientRect())
    const fullyVisibleDrafts = listRect
      ? cardRects.filter(card => card.top >= listRect.top - 1 && card.bottom <= listRect.bottom + 1).length
      : 0
    const primaryJournalStyle = primaryJournal ? getComputedStyle(primaryJournal) : null
    const primaryPeerStyle = primaryPeer ? getComputedStyle(primaryPeer) : null

    return {
      display: getComputedStyle(workspace).display,
      direction: getComputedStyle(workspace).flexDirection,
      workspace: workspace.getBoundingClientRect().toJSON(),
      topbarDisplay: getComputedStyle(topbar).display,
      proxy: proxy.getBoundingClientRect().toJSON(),
      portal: portal?.getBoundingClientRect().toJSON(),
      statusHost: statusHost?.getBoundingClientRect().toJSON(),
      portalSearch: !!portal?.querySelector('.prep-search input'),
      portalJournal: portal?.querySelector('.btn-journal-primary')?.textContent?.trim() || '',
      portalDraft: portal?.querySelector('.btn-context-new')?.textContent?.trim() || '',
      original: getComputedStyle(original).display,
      proxyJournalDisplay: proxyJournal ? getComputedStyle(proxyJournal).display : 'missing',
      sidebarAction: sidebarAction ? {
        display: getComputedStyle(sidebarAction).display,
        text: sidebarAction.textContent?.trim() || '',
        rect: sidebarAction.getBoundingClientRect().toJSON(),
      } : null,
      primaryJournalGeometry: primaryJournal && primaryJournalStyle ? {
        width: primaryJournal.getBoundingClientRect().width,
        height: primaryJournal.getBoundingClientRect().height,
        radius: primaryJournalStyle.borderRadius,
        justify: primaryJournalStyle.justifyContent,
      } : null,
      primaryPeerGeometry: primaryPeer && primaryPeerStyle ? {
        width: primaryPeer.getBoundingClientRect().width,
        height: primaryPeer.getBoundingClientRect().height,
        radius: primaryPeerStyle.borderRadius,
        justify: primaryPeerStyle.justifyContent,
      } : null,
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
    if (prepLayout.proxyJournalDisplay !== 'none' && prepLayout.proxyJournalDisplay !== 'missing') failures.push('preparation: journal library is still duplicated in subsection navigation')
    if (!prepLayout.primaryJournalGeometry || !prepLayout.primaryPeerGeometry) failures.push('preparation: primary navigation geometry is missing')
    else {
      if (Math.abs(prepLayout.primaryJournalGeometry.width - prepLayout.primaryPeerGeometry.width) > 1) failures.push('preparation: journal center width differs from peer routes')
      if (Math.abs(prepLayout.primaryJournalGeometry.height - prepLayout.primaryPeerGeometry.height) > 1) failures.push('preparation: journal center height differs from peer routes')
      if (prepLayout.primaryJournalGeometry.radius !== prepLayout.primaryPeerGeometry.radius) failures.push('preparation: journal center radius differs from peer routes')
      if (prepLayout.primaryJournalGeometry.justify !== prepLayout.primaryPeerGeometry.justify) failures.push('preparation: journal center alignment differs from peer routes')
    }
    if (!prepLayout.portal || !prepLayout.portalSearch) failures.push('preparation: real search controls were not moved into the header center lane')
    if (!prepLayout.portalJournal.includes('新增期刊') || !prepLayout.portalDraft.includes('新建草稿')) failures.push('preparation: source creation controls are missing')
    if (!prepLayout.sidebarAction || prepLayout.sidebarAction.display === 'none' || !prepLayout.sidebarAction.text.includes('新建草稿')) failures.push('preparation: contextual primary action is not visible above the sidebar filter')
    if (prepLayout.topbarDisplay !== 'none') failures.push('preparation: the redundant wide overview toolbar remains visible')
    if (overlaps(prepLayout.portal, prepLayout.proxy)) failures.push('preparation: header search overlaps subsection navigation')
    if (prepLayout.statusHost && prepLayout.portal && (prepLayout.portal.left < prepLayout.statusHost.left - 2 || prepLayout.portal.right > prepLayout.statusHost.right + 2)) failures.push('preparation: header search escapes the control lane')
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
    const portal = document.querySelector('#lx-preparation-actions-slot .prep-top-actions-portal')
    const sourceAction = portal?.querySelector('.btn-context-new')
    const journalAction = portal?.querySelector('.btn-journal-primary')
    const action = document.querySelector('.header-context-primary')
    return sourceAction && action ? {
      host: 'sidebar',
      actionDisplay: getComputedStyle(action).display,
      actionText: action.textContent?.trim() || '',
      journalActionText: journalAction?.textContent?.trim() || '',
      sourceDisplay: getComputedStyle(sourceAction).display,
    } : null
  })
  if (!draftActions) failures.push('preparation: contextual draft creation control is missing')
  else {
    if (draftActions.actionDisplay === 'none' || !draftActions.actionText.includes('新建草稿')) failures.push('preparation: new draft action is not visible above the sidebar filter')
    if (!draftActions.journalActionText.includes('新增期刊')) failures.push('preparation: journal source action is missing')
    if (draftActions.sourceDisplay !== 'none') failures.push('preparation: duplicate draft creation action remains in the header center lane')
  }

  const journalCenter = prep.locator("button[data-main-nav-key='journals']:visible").first()
  await journalCenter.click()
  await prep.locator(".preparation-workspace[data-section='journals']").waitFor({ state: 'visible', timeout: 5000 })
  await prep.waitForTimeout(150)
  const journalActions = await prep.evaluate(() => {
    const portal = document.querySelector('#lx-preparation-actions-slot .prep-top-actions-portal')
    const sourceAction = portal?.querySelector('.btn-journal-primary')
    const action = document.querySelector('.header-context-primary')
    return sourceAction && action ? {
      host: 'sidebar',
      actionDisplay: getComputedStyle(action).display,
      actionText: action.textContent?.trim() || '',
      sourceDisplay: getComputedStyle(sourceAction).display,
    } : null
  })
  if (!journalActions) failures.push('journal center: contextual journal creation control is missing')
  else {
    if (journalActions.actionDisplay === 'none' || !journalActions.actionText.includes('新增期刊')) failures.push('journal center: add journal action is not visible above the sidebar filter')
    if (journalActions.sourceDisplay !== 'none') failures.push('journal center: duplicate add journal action remains in the header center lane')
  }
  await prep.screenshot({ path: 'focused-review/luminous-x-preparation-journal-actions.png', fullPage: true })
  await prep.close()

  const narrowPrep = await open('preparation', 1280, 1000)
  const narrowProxy = narrowPrep.locator(".lx-status-bar[data-page='preparation'] .lx-page-proxy-controls")
  await narrowProxy.getByRole('button', { name: /草稿准备/ }).click()
  await narrowPrep.waitForTimeout(150)
  const narrowFallback = await narrowPrep.evaluate(() => {
    const workspace = document.querySelector(".preparation-workspace[data-section='drafts']")
    const topbar = workspace?.querySelector(':scope > .prep-topbar')
    const sourceAction = topbar?.querySelector('.btn-context-new')
    const portal = document.querySelector('#lx-preparation-actions-slot .prep-top-actions-portal')
    const action = document.querySelector('.header-context-primary')
    return workspace && topbar && sourceAction && action ? {
      portalPresent: !!portal,
      topbarDisplay: getComputedStyle(topbar).display,
      position: getComputedStyle(topbar).position,
      actionDisplay: getComputedStyle(action).display,
      actionText: action.textContent?.trim() || '',
      sourceDisplay: getComputedStyle(sourceAction).display,
    } : null
  })
  if (!narrowFallback) failures.push('preparation narrow: contextual sidebar action is missing')
  else {
    if (narrowFallback.portalPresent) failures.push('preparation narrow: actions remain portaled despite insufficient header width')
    if (narrowFallback.topbarDisplay === 'none' || narrowFallback.position !== 'sticky') failures.push('preparation narrow: fallback search strip is not visible and sticky')
    if (narrowFallback.actionDisplay === 'none' || !narrowFallback.actionText.includes('新建草稿')) failures.push('preparation narrow: new draft action is unavailable above the sidebar filter')
    if (narrowFallback.sourceDisplay !== 'none') failures.push('preparation narrow: duplicate in-page creation action remains visible')
  }
  await narrowPrep.screenshot({ path: 'focused-review/luminous-x-preparation-narrow-fallback.png', fullPage: true })
  await narrowPrep.close()

  console.log(JSON.stringify({ failures, statusSurfaces, journal, prepLayout, draftActions, journalActions, narrowFallback }, null, 2))
  if (failures.length) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}
