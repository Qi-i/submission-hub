import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const failures = []
const base = 'http://127.0.0.1:4174/tests/visual/index.html'

async function open(view) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  await page.goto(`${base}?view=${view}&theme=light&ui=luminous-x`)
  await page.locator("html[data-visual-ready='true']").waitFor({ timeout: 45000 })
  await page.waitForTimeout(500)
  return page
}

try {
  const dashboard = await open('dashboard')
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
  await prep.locator('.prep-productivity-host').waitFor({ state: 'attached' })
  const prepLayout = await prep.evaluate(() => {
    const workspace = document.querySelector('.preparation-workspace')
    const topbar = workspace?.querySelector('.prep-topbar')
    const proxy = document.querySelector(".lx-status-bar[data-page='preparation'] .lx-page-proxy-controls")
    const original = workspace?.querySelector(':scope > .prep-nav')
    const assistant = workspace?.querySelector('.prep-productivity-host')
    const topics = workspace?.querySelector('.prep-topic-overview')
    if (!workspace || !topbar || !proxy || !original) return null
    return {
      display: getComputedStyle(workspace).display,
      direction: getComputedStyle(workspace).flexDirection,
      workspace: workspace.getBoundingClientRect().toJSON(),
      topbar: topbar.getBoundingClientRect().toJSON(),
      proxy: proxy.getBoundingClientRect().toJSON(),
      original: getComputedStyle(original).display,
      assistant: assistant?.getBoundingClientRect().toJSON(),
      topics: topics?.getBoundingClientRect().toJSON(),
    }
  })
  if (!prepLayout) failures.push('preparation: required elements missing')
  else {
    if (prepLayout.display !== 'flex' || prepLayout.direction !== 'column') failures.push('preparation: overview is not a vertical flow')
    if (prepLayout.original !== 'none') failures.push('preparation: duplicate navigation is visible')
    if (prepLayout.topbar.width > prepLayout.workspace.width * .72) failures.push('preparation: action toolbar still spans the page')
    if (Math.abs(prepLayout.topbar.right - prepLayout.workspace.right) > 4) failures.push('preparation: action toolbar is not right aligned')
    if (prepLayout.assistant && prepLayout.topics) {
      if (Math.abs(prepLayout.assistant.left - prepLayout.topics.left) > 4) failures.push('preparation: modules do not share one column')
      const overlap = Math.min(prepLayout.assistant.bottom, prepLayout.topics.bottom) - Math.max(prepLayout.assistant.top, prepLayout.topics.top)
      if (overlap > 2) failures.push('preparation: modules still overlap or sit side by side')
    }
  }
  await prep.close()

  console.log(JSON.stringify({ failures, journal, prepLayout }, null, 2))
  if (failures.length) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}
