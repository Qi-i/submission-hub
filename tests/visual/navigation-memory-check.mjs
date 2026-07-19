import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const failures = []
const base = 'http://127.0.0.1:4174/tests/visual/navigation-memory.html'
const scope = 'visual-account-a'
const key = `submission-hub:navigation:${scope}`

try {
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({
      page: 'preparation',
      preparationSection: 'journals',
      layoutMode: 'board',
    }))
  }, { key })

  await page.goto(`${base}?scope=${scope}`)
  await page.locator('main[data-current-page="preparation"]').waitFor()
  await page.locator('.preparation-workspace[data-section="journals"]').waitFor()

  await page.getByRole('button', { name: '投稿管理' }).click()
  await page.locator('main[data-current-page="dashboard"]').waitFor()
  await page.getByRole('button', { name: '看板视图' }).click()
  await page.locator('main[data-current-layout="board"]').waitFor()
  await page.reload()
  await page.locator('main[data-current-page="dashboard"][data-current-layout="board"]').waitFor()

  await page.getByRole('button', { name: '投稿准备' }).click()
  await page.locator('.preparation-workspace[data-section="journals"]').waitFor()
  await page.getByRole('button', { name: '草稿准备' }).first().click()
  await page.locator('.preparation-workspace[data-section="drafts"]').waitFor()
  await page.getByRole('button', { name: '个人统计' }).click()
  await page.locator('main[data-current-page="stats"]').waitFor()
  await page.reload()
  await page.locator('main[data-current-page="stats"]').waitFor()

  await page.getByRole('button', { name: '投稿准备' }).click()
  await page.locator('.preparation-workspace[data-section="drafts"]').waitFor()

  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), key)
  if (stored.page !== 'preparation') failures.push(`stored page is ${String(stored.page)}`)
  if (stored.preparationSection !== 'drafts') failures.push(`stored preparation section is ${String(stored.preparationSection)}`)
  if (stored.layoutMode !== 'board') failures.push(`stored layout mode is ${String(stored.layoutMode)}`)

  const isolated = await browser.newPage()
  await isolated.goto(`${base}?scope=visual-account-b`)
  await isolated.locator('main[data-current-page="dashboard"][data-current-layout="workflow"]').waitFor()
  const isolatedState = await isolated.evaluate(() => localStorage.getItem('submission-hub:navigation:visual-account-b'))
  if (isolatedState !== null) failures.push('navigation state leaked across account scopes')
  await isolated.close()
  await context.close()
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}

console.log(JSON.stringify({ failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
