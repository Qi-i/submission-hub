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
  await page.waitForTimeout(400)
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
  await prep.locator('.prep-productivity').waitFor({ state: 'visible' })
  await prep.screenshot({ path: 'focused-review/luminous-x-preparation-compact.png', fullPage: true })

  const prepLayout = await prep.evaluate(() => {
    const workspace = document.querySelector('.preparation-workspace')
    const topbar = workspace?.querySelector(':scope > .prep-topbar')
    const nav = workspace?.querySelector(':scope > .preparation-business-rail')
    const portal = document.querySelector('#lx-preparation-actions-slot .prep-top-actions-portal')
    const assistant = workspace?.querySelector('.prep-productivity')
    const topics = workspace?.querySelector('.prep-topic-overview')
    const draftPanel = workspace?.querySelector('.prep-overview-drafts')
    const journalPanel = workspace?.querySelector('.prep-overview-journals')
    const primaryJournal = document.querySelector("button[data-main-nav-key='journals']")
    const primaryPeer = document.querySelector("button[data-main-nav-key='preparation']")
    if (!workspace || !nav) return null

    const buttons = Array.from(nav.querySelectorAll(':scope > button')).filter(button => {
      const style = getComputedStyle(button)
      const rect = button.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    })
    const primaryJournalStyle = primaryJournal ? getComputedStyle(primaryJournal) : null
    const primaryPeerStyle = primaryPeer ? getComputedStyle(primaryPeer) : null

    return {
      workspace: workspace.getBoundingClientRect().toJSON(),
      topbarDisplay: topbar ? getComputedStyle(topbar).display : 'missing',
      nav: nav.getBoundingClientRect().toJSON(),
      labels: buttons.map(button => (button.textContent || '').replace(/\s+/g, ' ').trim()),
      buttonHeights: buttons.map(button => button.getBoundingClientRect().height),
      navOverflow: nav.scrollWidth - nav.clientWidth,
      portal: portal?.getBoundingClientRect().toJSON(),
      portalSearch: !!portal?.querySelector('.prep-search input'),
      assistant: assistant?.getBoundingClientRect().toJSON(),
      topics: topics?.getBoundingClientRect().toJSON(),
      draftPanel: draftPanel?.getBoundingClientRect().toJSON(),
      journalPanel: journalPanel?.getBoundingClientRect().toJSON(),
      primaryJournalGeometry: primaryJournal && primaryJournalStyle ? {
        width: primaryJournal.getBoundingClientRect().width,
        height: primaryJournal.getBoundingClientRect().height,
        radius: primaryJournalStyle.borderRadius,
      } : null,
      primaryPeerGeometry: primaryPeer && primaryPeerStyle ? {
        width: primaryPeer.getBoundingClientRect().width,
        height: primaryPeer.getBoundingClientRect().height,
        radius: primaryPeerStyle.borderRadius,
      } : null,
    }
  })

  if (!prepLayout) failures.push('preparation: required elements missing')
  else {
    const required = ['总览', '论文准备', '投稿材料', '期刊匹配', '投稿前检查']
    required.forEach(label => {
      if (!prepLayout.labels.some(item => item.includes(label))) failures.push(`preparation: route missing ${label}`)
    })
    if (prepLayout.labels.length !== 5) failures.push(`preparation: expected five routes, got ${prepLayout.labels.join(' / ')}`)
    if (!prepLayout.portal || !prepLayout.portalSearch) failures.push('preparation: real search controls were not moved into the Luminous X header lane')
    if (prepLayout.navOverflow > 2) failures.push(`preparation: canonical navigation overflows by ${prepLayout.navOverflow}px`)
    if (prepLayout.nav.height > 44 || prepLayout.buttonHeights.some(height => height > 36)) failures.push('preparation: business navigation is still rendered as oversized card blocks')
    if (prepLayout.draftPanel && prepLayout.journalPanel && Math.abs(prepLayout.draftPanel.height - prepLayout.journalPanel.height) > 4) failures.push('preparation: overview draft and journal panels are not equal height')
    if (prepLayout.assistant && prepLayout.topics && Math.abs(prepLayout.assistant.left - prepLayout.topics.left) > 4) failures.push('preparation: overview modules do not share one column')
    if (!prepLayout.primaryJournalGeometry || !prepLayout.primaryPeerGeometry) failures.push('preparation: global Journal Center geometry is missing')
    else {
      if (Math.abs(prepLayout.primaryJournalGeometry.width - prepLayout.primaryPeerGeometry.width) > 1) failures.push('preparation: Journal Center width differs from peer routes')
      if (Math.abs(prepLayout.primaryJournalGeometry.height - prepLayout.primaryPeerGeometry.height) > 1) failures.push('preparation: Journal Center height differs from peer routes')
      if (prepLayout.primaryJournalGeometry.radius !== prepLayout.primaryPeerGeometry.radius) failures.push('preparation: Journal Center radius differs from peer routes')
    }
  }

  const prepNav = prep.locator('.preparation-workspace > .preparation-business-rail')
  await prepNav.getByRole('button', { name: /论文准备/ }).click()
  await prep.locator(".preparation-workspace[data-section='paper']").waitFor({ state: 'visible', timeout: 5000 })
  const paperPanels = await prep.locator(".preparation-workspace[data-section='paper'] .prep-primary-section-grid > section").count()
  if (paperPanels < 2) failures.push(`preparation: paper workspace expected topic + draft panels, got ${paperPanels}`)

  const figureEntry = prep.locator('.prep-figure-tool-entry:visible').first()
  await figureEntry.waitFor({ state: 'visible', timeout: 5000 })
  const entryIcon = await figureEntry.locator('.prep-figure-tool-entry__icon svg').evaluate(element => element.getBoundingClientRect().toJSON())
  if (entryIcon.width < 18 || entryIcon.height < 18) failures.push(`preparation: Figure Composer entry icon is not prominent (${entryIcon.width}×${entryIcon.height}px)`)
  await figureEntry.click()
  await prep.locator(".preparation-workspace[data-section='figures'] .figure-composer").waitFor({ state: 'visible', timeout: 10000 })
  if (await prep.locator(".preparation-workspace[data-section='figures'] > .preparation-business-rail").count()) failures.push('preparation: business navigation remains mounted in Figure Composer mode')
  const composerGeometry = await prep.locator('.figure-composer').evaluate(element => {
    const rect = element.getBoundingClientRect()
    const splitters = Array.from(element.querySelectorAll('.figure-composer__splitter')).map(splitter => splitter.getBoundingClientRect().toJSON())
    return { width: rect.width, overflow: element.scrollWidth - element.clientWidth, splitters }
  })
  if (composerGeometry.width < 700) failures.push(`preparation: Figure Composer workspace is unexpectedly narrow (${composerGeometry.width}px)`)
  if (composerGeometry.overflow > 2) failures.push(`preparation: Figure Composer root horizontally overflows by ${composerGeometry.overflow}px`)
  if (composerGeometry.splitters.length !== 2) failures.push(`preparation: expected two draggable Figure Composer splitters, got ${composerGeometry.splitters.length}`)
  await prep.screenshot({ path: 'focused-review/luminous-x-figure-composer.png', fullPage: true })

  await prep.getByRole('button', { name: /返回投稿准备/ }).click()
  await prep.locator('.preparation-workspace > .preparation-business-rail').waitFor({ state: 'visible', timeout: 5000 })
  const journalCenter = prep.locator("button[data-main-nav-key='journals']:visible").first()
  await journalCenter.click()
  await prep.locator('.journal-center-workspace').waitFor({ state: 'visible', timeout: 10000 })
  await prep.locator('.journal-center-search input').waitFor({ state: 'visible', timeout: 5000 })
  if (await prep.locator('.journal-center-workspace .preparation-business-rail').count()) failures.push('journal-center: Preparation business navigation leaked into first-class Journal Center')
  if (await prep.locator(".preparation-workspace[data-section='match'] .journal-grid").count()) failures.push('journal-center: top-level Journal Center is still a Preparation match clone')
  await prep.close()

  const narrowPrep = await open('preparation', 1280, 1000)
  const narrow = await narrowPrep.evaluate(() => {
    const nav = document.querySelector('.preparation-workspace > .preparation-business-rail')
    if (!nav) return null
    const rect = nav.getBoundingClientRect()
    const labels = Array.from(nav.querySelectorAll(':scope > button')).filter(button => {
      const style = getComputedStyle(button)
      return style.display !== 'none' && style.visibility !== 'hidden'
    }).map(button => (button.textContent || '').replace(/\s+/g, ' ').trim())
    return { labels, overflow: nav.scrollWidth - nav.clientWidth, rect: rect.toJSON() }
  })
  if (!narrow) failures.push('preparation narrow: canonical navigation missing')
  else {
    if (narrow.labels.length !== 5) failures.push(`preparation narrow: expected five routes, got ${narrow.labels.join(' / ')}`)
    if (narrow.overflow > 2) failures.push(`preparation narrow: navigation overflows by ${narrow.overflow}px`)
  }
  await narrowPrep.close()

  console.log(JSON.stringify({ failures, statusSurfaces, journal, prepLayout, composerGeometry, narrow }, null, 2))
  if (failures.length) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}
