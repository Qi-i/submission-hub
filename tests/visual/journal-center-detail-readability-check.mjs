import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []

async function openJournalCenter(page, ui = 'luminous') {
  await page.goto(`${baseUrl}?view=preparation&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
  const entry = page.locator("button[data-main-nav-key='journals']:visible").first()
  await entry.waitFor({ state: 'visible', timeout: 15000 })
  await entry.click()
  await page.locator('.journal-center-workspace:visible .journal-center-card:visible').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(250)
}

async function openSubmissionManagement(page, ui = 'luminous') {
  await page.goto(`${baseUrl}?view=dashboard&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
  const entry = page.locator("button[data-main-nav-key='dashboard']:visible").first()
  if (await entry.count()) await entry.click()
  await page.locator('.paper-grid:visible .paper-card-v3:visible').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(250)
}

try {
  for (const ui of ['luminous', 'luminous-x']) {
    const page = await browser.newPage({ viewport: { width: 2048, height: 1085 } })
    try {
      await openJournalCenter(page, ui)
      const result = await page.evaluate(() => {
        const failures = []
        const cards = Array.from(document.querySelectorAll('.journal-center-workspace .journal-center-card'))

        const appHeader = document.querySelector('.app-header')
        const toolbar = document.querySelector('.journal-center-workspace .journal-center-toolbar')
        if (document.documentElement.dataset.ui === 'luminous' && appHeader && toolbar) {
          const gap = toolbar.getBoundingClientRect().top - appHeader.getBoundingClientRect().bottom
          if (gap < 9) failures.push(`Journal Center toolbar touches the global header (${gap.toFixed(1)}px gap)`)
        }

        const firstTop = cards[0]?.getBoundingClientRect().top
        const firstRow = cards.filter(card => firstTop != null && Math.abs(card.getBoundingClientRect().top - firstTop) < 2)
        if (firstRow.length > 1) {
          const heights = firstRow.map(card => card.getBoundingClientRect().height)
          const spread = Math.max(...heights) - Math.min(...heights)
          if (spread > 2) failures.push(`Journal Center first-row cards have inconsistent heights (${spread.toFixed(1)}px spread)`)
        }

        const surfaces = cards.map(card => {
          const style = getComputedStyle(card)
          return `${style.backgroundColor}|${style.backgroundImage}`
        })
        if (cards.length >= 4 && new Set(surfaces).size < 2) failures.push('Journal Center cards still use one indistinguishable surface colour')

        const favoriteStatuses = cards
          .filter(card => card.getAttribute('data-favorite') === 'true')
          .map(card => card.querySelector('.journal-priority-status'))
          .filter(Boolean)
          .map(status => {
            const style = getComputedStyle(status)
            return `${style.color}|${style.backgroundColor}|${style.backgroundImage}|${style.borderColor}`
          })
        if (favoriteStatuses.length > 1 && new Set(favoriteStatuses).size !== 1) failures.push('“重点期刊” badges do not share one consistent visual treatment')

        cards.forEach((card, index) => {
          if (card.querySelector('.journal-catalog-card__substatus')) failures.push(`journal ${index + 1}: redundant normal/risk substatus row is still visible`)

          const oa = card.querySelector('.journal-catalog-card__oa')
          const oaLabel = card.querySelector('.journal-catalog-card__oa-label')
          if (!oa || !oaLabel) failures.push(`journal ${index + 1}: OA mode is not rendered as a dedicated readable label`)
          else {
            const oaRect = oa.getBoundingClientRect()
            if (oaRect.width < 68) failures.push(`journal ${index + 1}: OA badge is visibly collapsed (${oaRect.width.toFixed(1)}px)`)
            if (oa.scrollWidth > oa.clientWidth + 1 || oaLabel.scrollWidth > oaLabel.clientWidth + 1) failures.push(`journal ${index + 1}: OA mode is clipped`)
          }

          const metrics = card.querySelector('.journal-catalog-card__metrics')
          const metricCards = metrics ? Array.from(metrics.children).filter(node => node instanceof HTMLElement && getComputedStyle(node).display !== 'none') : []
          if (metrics && metricCards.length) {
            if (getComputedStyle(metrics).display !== 'grid') failures.push(`journal ${index + 1}: metric rail still inherits flexible full-width stretching`)
            metricCards.forEach((metric, metricIndex) => {
              const rect = metric.getBoundingClientRect()
              if (rect.width > 220) failures.push(`journal ${index + 1}: metric ${metricIndex + 1} stretches too wide (${rect.width.toFixed(1)}px)`)
              if (metric.scrollWidth > metric.clientWidth + 1 || metric.scrollHeight > metric.clientHeight + 1) failures.push(`journal ${index + 1}: metric ${metricIndex + 1} content is clipped`)
              const label = metric.querySelector('.journal-metric-label')
              const value = metric.querySelector('.journal-metric-value')
              if (!label || !value) failures.push(`journal ${index + 1}: metric ${metricIndex + 1} lacks explicit label/value hierarchy`)
            })
          }

          const apc = card.querySelector('.prep-journal-apc-metric')
          if (apc) {
            const label = apc.querySelector('.journal-metric-label')
            const value = apc.querySelector('.journal-metric-value')
            const estimate = apc.querySelector('.prep-journal-apc-cny')
            const parts = [label, value, estimate].filter(Boolean)
            if (parts.length >= 2) {
              const centers = parts.map(part => {
                const rect = part.getBoundingClientRect()
                return rect.top + rect.height / 2
              })
              if (Math.max(...centers) - Math.min(...centers) > 7) failures.push(`journal ${index + 1}: APC is still stacked vertically instead of using one horizontal line`)
            }
            if (estimate && (estimate.scrollWidth > estimate.clientWidth + 1 || estimate.getBoundingClientRect().right > apc.getBoundingClientRect().right + 1)) failures.push(`journal ${index + 1}: APC CNY estimate overflows its metric`)
          }

          const footer = card.querySelector('.journal-center-card__links')
          if (footer) {
            const style = getComputedStyle(footer)
            if (style.backgroundImage !== 'none' || !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.backgroundColor)) failures.push(`journal ${index + 1}: footer is rendered as a heavy empty strip instead of inline actions`)
          }
        })
        return failures
      })
      failures.push(...result.map(message => `${ui}: ${message}`))

      await openSubmissionManagement(page, ui)
      const submissionResult = await page.evaluate(() => {
        const failures = []
        const cards = Array.from(document.querySelectorAll('.paper-grid .paper-card-v3:not(.journal-center-card)'))
        let checkedPublicationRank = false
        let checkedFooter = false

        cards.forEach((card, index) => {
          const archive = card.querySelector('.archive-chip-row')
          const ranks = card.querySelector('.paper-rank-row')
          if (!checkedPublicationRank && archive?.querySelector('.doi') && ranks) {
            checkedPublicationRank = true
            const a = archive.getBoundingClientRect()
            const r = ranks.getBoundingClientRect()
            if (Math.abs(a.top - r.top) > 4) failures.push(`submission ${index + 1}: DOI and journal quartiles are still on separate rows`)
          }

          const footer = card.querySelector('.paper-card-footer')
          const file = footer?.querySelector('.paper-footer-left .file-dot, .paper-footer-left .file-dot-button')
          const date = footer?.querySelector('.paper-date-info')
          if (!checkedFooter && footer && file && date?.textContent?.trim()) {
            checkedFooter = true
            const f = file.getBoundingClientRect()
            const d = date.getBoundingClientRect()
            const centerDelta = Math.abs((f.top + f.height / 2) - (d.top + d.height / 2))
            if (centerDelta > 5) failures.push(`submission ${index + 1}: attachment actions and date are not aligned on one footer row`)
            if (getComputedStyle(footer).flexWrap !== 'nowrap') failures.push(`submission ${index + 1}: footer still allows attachment/date row splitting`)
          }
        })

        if (!checkedPublicationRank) failures.push('submission fixture has no DOI + quartile card to verify publication metadata alignment')
        if (!checkedFooter) failures.push('submission fixture has no attachment + date card to verify footer alignment')
        return failures
      })
      failures.push(...submissionResult.map(message => `${ui}: ${message}`))
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify({ failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
