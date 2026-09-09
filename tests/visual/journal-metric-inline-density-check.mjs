import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []

async function openJournalCenter(page, ui) {
  await page.goto(`${baseUrl}?view=preparation&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
  const entry = page.locator("button[data-main-nav-key='journals']:visible").first()
  await entry.waitFor({ state: 'visible', timeout: 15000 })
  await entry.click()
  await page.locator('.journal-center-workspace:visible .journal-center-card:visible').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(250)
}

try {
  for (const ui of ['luminous', 'luminous-x']) {
    const page = await browser.newPage({ viewport: { width: 1707, height: 960 } })
    try {
      await openJournalCenter(page, ui)
      const result = await page.evaluate(() => {
        const failures = []
        const cards = Array.from(document.querySelectorAll('.journal-center-workspace .journal-center-card'))
        let checkedMetrics = false
        let checkedApc = false

        cards.forEach((card, cardIndex) => {
          const metrics = card.querySelector('.journal-catalog-card__metrics')
          if (!metrics) return
          const items = Array.from(metrics.children).filter(node => node instanceof HTMLElement && getComputedStyle(node).display !== 'none')
          if (!items.length) return
          checkedMetrics = true

          const railStyle = getComputedStyle(metrics)
          if (railStyle.display !== 'grid') failures.push(`journal ${cardIndex + 1}: metric rail is not a content-sized grid (${railStyle.display})`)
          if (railStyle.justifyContent !== 'start' && railStyle.justifyContent !== 'normal') failures.push(`journal ${cardIndex + 1}: metric rail still distributes spare width (${railStyle.justifyContent})`)

          items.forEach((item, itemIndex) => {
            const style = getComputedStyle(item)
            const rect = item.getBoundingClientRect()
            const label = item.querySelector('.journal-metric-label')
            const value = item.querySelector('.journal-metric-value')
            if (!label || !value) return

            const labelRect = label.getBoundingClientRect()
            const valueRect = value.getBoundingClientRect()
            const centerDelta = Math.abs((labelRect.top + labelRect.height / 2) - (valueRect.top + valueRect.height / 2))
            if (centerDelta > 7) failures.push(`journal ${cardIndex + 1}: metric ${itemIndex + 1} still stacks label/value vertically (${centerDelta.toFixed(1)}px)`)
            if (style.flexWrap !== 'nowrap') failures.push(`journal ${cardIndex + 1}: metric ${itemIndex + 1} allows internal wrapping (${style.flexWrap})`)

            const range = document.createRange()
            range.selectNodeContents(item)
            const contentRect = range.getBoundingClientRect()
            const deadSpace = rect.width - contentRect.width
            if (deadSpace > 34) failures.push(`journal ${cardIndex + 1}: metric ${itemIndex + 1} keeps ${deadSpace.toFixed(1)}px of avoidable internal blank space`)

            const verticalDeadSpace = rect.height - Math.max(labelRect.height, valueRect.height)
            if (verticalDeadSpace > 16) failures.push(`journal ${cardIndex + 1}: metric ${itemIndex + 1} keeps ${verticalDeadSpace.toFixed(1)}px of avoidable vertical blank space`)
            if (rect.height > 30) failures.push(`journal ${cardIndex + 1}: metric ${itemIndex + 1} is ${rect.height.toFixed(1)}px tall instead of a compact single-line chip`)

            if (item.classList.contains('prep-journal-apc-metric')) {
              checkedApc = true
              if (item.parentElement !== metrics) failures.push(`journal ${cardIndex + 1}: APC was moved out of the metric rail`)
              const estimate = item.querySelector('.prep-journal-apc-cny')
              if (estimate) {
                const estimateRect = estimate.getBoundingClientRect()
                const estimateCenter = estimateRect.top + estimateRect.height / 2
                const labelCenter = labelRect.top + labelRect.height / 2
                if (Math.abs(estimateCenter - labelCenter) > 7) failures.push(`journal ${cardIndex + 1}: APC estimate still wraps onto another internal line`)
              }
            }
          })
        })

        if (!checkedMetrics) failures.push('journal fixture has no metric rail to verify')
        if (!checkedApc) failures.push('journal fixture has no APC metric to verify')
        return failures
      })
      failures.push(...result.map(message => `${ui}: ${message}`))
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify({ failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))