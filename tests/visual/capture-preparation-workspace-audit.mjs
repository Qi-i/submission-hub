import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
await mkdir('visual-review', { recursive: true })

try {
  for (const ui of ['luminous', 'luminous-x']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
    try {
      await page.goto(`${baseUrl}?view=preparation&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
      await page.locator("html[data-visual-ready='true'] .preparation-workspace").waitFor({ state: 'visible', timeout: 45000 })
      await page.waitForTimeout(250)

      const sectionKeys = await page.locator("button[data-section-key]:visible").evaluateAll(nodes => nodes
        .map(node => node.getAttribute('data-section-key'))
        .filter(Boolean))

      for (const key of [...new Set(sectionKeys)]) {
        const button = page.locator(`button[data-section-key='${key}']:visible`).first()
        if (!(await button.count())) continue
        await button.click()
        await page.waitForTimeout(220)
        await page.screenshot({ path: `visual-review/${ui}-preparation-${key}-light-desktop.png`, fullPage: true })
      }

      const figureEntry = page.locator('.prep-figure-tool-entry:visible').first()
      if (await figureEntry.count()) {
        await figureEntry.click()
        const composer = page.locator('.figure-composer, .figure-composer-workspace, [data-figure-composer]:visible').first()
        if (await composer.count()) {
          await composer.waitFor({ state: 'visible', timeout: 10000 })
          await page.waitForTimeout(220)
          await page.screenshot({ path: `visual-review/${ui}-figure-composer-light-desktop.png`, fullPage: true })
        }
      }
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}
