import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const failures = []
const themeSource = readFileSync('src/lib/theme.tsx', 'utf8')
const authSource = readFileSync('src/lib/auth.tsx', 'utf8')

if (!/uiMode:\s*'luminous-x'/.test(themeSource)) failures.push('Luminous X is not the default UI')
if (!authSource.includes('submission_hub_ui_mode') || !authSource.includes('submission_hub_theme_mode')) failures.push('account preference metadata keys are missing')

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto('http://127.0.0.1:4174/tests/visual/index.html?view=dashboard&theme=light&ui=luminous-x&guide=1')
  await page.locator('.first-run-guide').waitFor({ state: 'visible', timeout: 45000 })
  if (await page.locator('.first-run-progress button').count() !== 4) failures.push('first-run guide does not contain four steps')
  const firstTitle = await page.locator('#first-run-title').textContent()
  await page.getByRole('button', { name: /下一步/ }).click()
  const secondTitle = await page.locator('#first-run-title').textContent()
  if (!firstTitle || !secondTitle || firstTitle === secondTitle) failures.push('first-run guide next step does not advance')
  await page.getByRole('button', { name: '跳过指引' }).first().click()
  await page.locator('.first-run-guide').waitFor({ state: 'hidden' })
  const stored = await page.evaluate(() => localStorage.getItem('submission-hub:onboarding:offline:luminous-x-guide-v1'))
  if (stored !== '1') failures.push('first-run guide completion is not remembered locally')
} finally {
  await browser.close()
}

console.log(JSON.stringify({ failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
