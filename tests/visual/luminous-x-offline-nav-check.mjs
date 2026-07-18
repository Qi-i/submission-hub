import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const url = 'http://127.0.0.1:4174/tests/visual/index.html?view=dashboard&theme=light&ui=luminous-x'

try {
  await page.goto(url)
  await page.locator("html[data-ui='luminous-x'][data-visual-ready='true'] .paper-card-v3").first().waitFor({ state: 'visible', timeout: 45000 })
  await page.waitForTimeout(350)

  const result = await page.evaluate(() => {
    const failures = []
    const header = document.querySelector('.app-header')
    const tabs = document.querySelector('.app-layout > .tab-bar')
    if (!header || !tabs) return { failures: ['Luminous X offline rail or tab bar is missing'], details: {} }

    const headerRect = header.getBoundingClientRect()
    const tabsRect = tabs.getBoundingClientRect()
    const buttons = Array.from(tabs.querySelectorAll('.tab-btn')).map((button, index) => {
      const rect = button.getBoundingClientRect()
      if (rect.left < headerRect.left - 2 || rect.right > headerRect.right + 2) {
        failures.push(`offline navigation button ${index + 1} escapes the control rail`)
      }
      return { index: index + 1, text: button.textContent?.trim(), rect: rect.toJSON() }
    })

    if (tabsRect.left < headerRect.left - 2 || tabsRect.right > headerRect.right + 2) {
      failures.push('offline navigation container escapes the control rail')
    }
    if (tabsRect.width > headerRect.width - 10) failures.push('offline navigation is wider than the rail interior')

    return {
      failures,
      details: {
        header: headerRect.toJSON(),
        tabs: tabsRect.toJSON(),
        buttons,
      },
    }
  })

  console.log(JSON.stringify(result, null, 2))
  if (result.failures.length) throw new Error(result.failures.join(' | '))
} finally {
  await browser.close()
}
