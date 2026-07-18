import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const failures = []
const themeSource = readFileSync('src/lib/theme.tsx', 'utf8')
const authSource = readFileSync('src/lib/auth.tsx', 'utf8')

if (!/uiMode:\s*'luminous-x'/.test(themeSource)) failures.push('Luminous X is not the default UI')
if (!authSource.includes('submission_hub_ui_mode') || !authSource.includes('submission_hub_theme_mode')) failures.push('account preference metadata keys are missing')

mkdirSync('focused-review', { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto('http://127.0.0.1:4174/tests/visual/index.html?view=dashboard&theme=light&ui=luminous-x&guide=1')
  const guide = page.locator('.first-run-guide')
  await guide.waitFor({ state: 'visible', timeout: 45000 })
  await page.screenshot({ path: 'focused-review/luminous-x-first-run-guide.png', fullPage: true })

  const stepCount = await page.locator('.first-run-progress > button').count()
  if (stepCount !== 4) failures.push(`first-run guide expected four steps, received ${stepCount}`)

  const title = page.locator('#first-run-title')
  const firstTitle = (await title.textContent())?.trim() || ''
  await page.locator('.first-run-next').click()
  await page.waitForFunction(previous => document.querySelector('#first-run-title')?.textContent?.trim() !== previous, firstTitle)
  const secondTitle = (await title.textContent())?.trim() || ''
  if (!firstTitle || !secondTitle || firstTitle === secondTitle) failures.push('first-run guide next step does not advance')

  await page.locator('.first-run-skip').click()
  await guide.waitFor({ state: 'hidden', timeout: 10000 })
  const stored = await page.evaluate(() => localStorage.getItem('submission-hub:onboarding:offline:luminous-x-guide-v1'))
  if (stored !== '1') failures.push(`first-run guide completion marker is ${String(stored)}`)
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}

console.log(JSON.stringify({ failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
