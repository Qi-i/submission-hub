import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const tierUrl = 'http://127.0.0.1:4174/tests/visual/journal-tier.html'
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

async function openDashboard(page, ui) {
  await page.goto(`${baseUrl}?view=dashboard&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
  await page.locator('.paper-grid:visible .paper-card-v3:visible').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(250)
}

try {
  for (const ui of ['luminous', 'luminous-x']) {
    const page = await browser.newPage({ viewport: { width: 1707, height: 960 } })
    try {
      await openJournalCenter(page, ui)
      const journalFailures = await page.evaluate(() => {
        const failures = []
        const cards = Array.from(document.querySelectorAll('.journal-center-workspace .journal-center-card'))

        const expectedSurfaceCodes = ['Q1', 'Q1', 'Q2']
        cards.slice(0, expectedSurfaceCodes.length).forEach((card, index) => {
          const expected = expectedSurfaceCodes[index]
          const code = card.getAttribute('data-surface-code')
          const tier = card.getAttribute('data-surface-tier')
          const watermark = getComputedStyle(card, '::after').content.replace(/["']/g, '')
          if (code !== expected) failures.push(`journal ${index + 1}: expected rank surface code ${expected}, got ${code || 'missing'}`)
          if (!tier) failures.push(`journal ${index + 1}: rank surface tier is missing`)
          if (watermark !== expected) failures.push(`journal ${index + 1}: expected rank watermark ${expected}, got ${watermark || 'missing'}`)
        })

        if (cards.length >= 2) {
          const first = getComputedStyle(cards[0]).backgroundImage
          const second = getComputedStyle(cards[1]).backgroundImage
          if (first !== second) failures.push('journals in the same JCR Q1 tier should use the same primary card surface')
        }
        if (cards.length >= 3) {
          const q1 = getComputedStyle(cards[0]).backgroundImage
          const q2 = getComputedStyle(cards[2]).backgroundImage
          if (q1 === q2) failures.push('JCR Q1 and Q2 cards should have visibly distinct primary surfaces')
        }

        cards.forEach((card, index) => {
          const cardRect = card.getBoundingClientRect()
          const accent = getComputedStyle(card, '::before')
          const accentWidth = Number.parseFloat(accent.width)
          const accentHeight = Number.parseFloat(accent.height)
          if (!Number.isFinite(accentWidth) || accentWidth < cardRect.width * 0.72) {
            failures.push(`journal ${index + 1}: top accent is still a short dash (${Number.isFinite(accentWidth) ? accentWidth.toFixed(1) : 'NaN'}px of ${cardRect.width.toFixed(1)}px card)`)
          }
          if (!Number.isFinite(accentHeight) || accentHeight < 1.5 || accentHeight > 3.5) {
            failures.push(`journal ${index + 1}: top accent height is inconsistent (${accentHeight || 0}px)`)
          }

          const header = card.querySelector('.journal-catalog-card__head')
          const publisherRail = card.querySelector('.journal-catalog-card__publisher-rail')
          const status = card.querySelector('.journal-catalog-card__status')
          const oaSlot = card.querySelector('.journal-catalog-card__oa-slot')
          const oa = card.querySelector('.journal-catalog-card__oa')
          const abbreviation = card.querySelector('.journal-catalog-card__abbreviation')
          if (!header || !publisherRail || !status || !oaSlot || !oa) {
            failures.push(`journal ${index + 1}: header fixture is incomplete`)
          } else {
            if (publisherRail.parentElement !== header) failures.push(`journal ${index + 1}: publisher and abbreviation still occupy a separate card row below the priority/OA header`)
            const headerRect = header.getBoundingClientRect()
            const statusRect = status.getBoundingClientRect()
            const oaSlotRect = oaSlot.getBoundingClientRect()
            const oaRect = oa.getBoundingClientRect()
            const oaStyle = getComputedStyle(oa)
            const statusCenter = statusRect.top + statusRect.height / 2
            const oaCenter = oaRect.top + oaRect.height / 2
            if (oaStyle.display === 'none' || oaStyle.visibility === 'hidden' || Number.parseFloat(oaStyle.opacity || '1') < 0.1 || oaRect.width < 40 || oaRect.height < 18) {
              failures.push(`journal ${index + 1}: OA badge is not visibly rendered (${oaRect.width.toFixed(1)}x${oaRect.height.toFixed(1)}px)`)
            }
            if (oaSlotRect.right > headerRect.right + 1 || oaSlotRect.left < headerRect.left - 1 || oaRect.right > cardRect.right - 4 || oaRect.left < cardRect.left + 4) {
              failures.push(`journal ${index + 1}: OA badge is clipped or positioned outside the visible header/card`)
            }
            if (Math.abs(statusCenter - oaCenter) > 8) failures.push(`journal ${index + 1}: priority and OA no longer share the first header row`)

            if (cardRect.width >= 390) {
              const aligned = [status, publisherRail, oa, abbreviation].filter(Boolean).map(node => {
                const rect = node.getBoundingClientRect()
                return rect.top + rect.height / 2
              })
              if (aligned.length > 1 && Math.max(...aligned) - Math.min(...aligned) > 8) {
                failures.push(`journal ${index + 1}: wide card does not align priority, publisher, abbreviation and OA on one header row`)
              }
            }

            const publisherRect = publisherRail.getBoundingClientRect()
            if (publisherRect.left < headerRect.left - 1 || publisherRect.right > headerRect.right + 1) failures.push(`journal ${index + 1}: publisher rail overflows card header`)
          }

          const metrics = card.querySelector('.journal-catalog-card__metrics')
          if (metrics && getComputedStyle(metrics).display !== 'grid') {
            failures.push(`journal ${index + 1}: metric rail regressed from content-sized grid`)
          }
          const apc = metrics?.querySelector('.prep-journal-apc-metric')
          if (apc) {
            const parts = ['.journal-metric-label', '.journal-metric-value', '.prep-journal-apc-cny']
              .map(selector => apc.querySelector(selector))
              .filter(Boolean)
            if (parts.length >= 2) {
              const centers = parts.map(part => {
                const rect = part.getBoundingClientRect()
                return rect.top + rect.height / 2
              })
              if (Math.max(...centers) - Math.min(...centers) > 7) {
                failures.push(`journal ${index + 1}: APC content is internally wrapped instead of staying on one line`)
              }
            }
          }
        })

        return failures
      })
      failures.push(...journalFailures.map(message => `${ui}: ${message}`))

      await openDashboard(page, ui)
      const dashboardFailures = await page.evaluate(() => {
        const failures = []
        const acceptedCard = Array.from(document.querySelectorAll('.paper-grid .paper-card-v3:not(.journal-center-card)'))
          .find(card => card.querySelector(".paper-status-area[data-status='accepted']"))
        if (!acceptedCard) return ['accepted fixture card is missing']

        const archive = acceptedCard.querySelector('.archive-chip-row')
        const rank = acceptedCard.querySelector('.paper-rank-row')
        const visibleRankItems = rank
          ? Array.from(rank.children).filter(node => node instanceof HTMLElement && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden')
          : []
        const rankText = visibleRankItems.map(node => node.textContent || '').join('')
        if (/已发表|已接收|published|accepted/i.test(rankText)) failures.push(`accepted card repeats publication status inside journal-rank metadata (${rankText.trim()})`)

        if (archive && rank && visibleRankItems.length > 1) {
          const archiveRect = archive.getBoundingClientRect()
          const cardRect = acceptedCard.getBoundingClientRect()
          const rankRects = visibleRankItems.map(node => node.getBoundingClientRect())
          const tops = rankRects.map(rect => rect.top)
          const topSpread = Math.max(...tops) - Math.min(...tops)
          if (topSpread > 2) failures.push(`accepted DOI/quartile rail wraps rank badges onto multiple lines (${topSpread.toFixed(1)}px top spread)`)
          if (Math.abs(rankRects[0].top - archiveRect.top) > 4) failures.push('accepted DOI and quartile metadata are not aligned on one row')
          const lastRight = Math.max(...rankRects.map(rect => rect.right))
          if (lastRight > cardRect.right - 8) failures.push(`accepted DOI/quartile rail overflows the card by ${(lastRight - (cardRect.right - 8)).toFixed(1)}px`)
        }
        return failures
      })
      failures.push(...dashboardFailures.map(message => `${ui}: ${message}`))
    } finally {
      await page.close()
    }
  }

  const tierPage = await browser.newPage({ viewport: { width: 1707, height: 960 } })
  try {
    await tierPage.goto(tierUrl, { waitUntil: 'domcontentloaded' })
    await tierPage.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
    const tierFailures = await tierPage.evaluate(() => {
      const failures = []
      document.querySelectorAll('[data-tier-case]').forEach(wrapper => {
        const expected = wrapper.getAttribute('data-expected')
        const key = wrapper.getAttribute('data-tier-case')
        const card = wrapper.matches('.journal-center-card') ? wrapper : wrapper.querySelector('.journal-center-card')
        if (!card) {
          failures.push(`${key}: card missing`)
          return
        }
        const code = card.getAttribute('data-surface-code')
        const watermark = getComputedStyle(card, '::after').content.replace(/["']/g, '')
        if (code !== expected) failures.push(`${key}: expected ${expected}, got ${code || 'missing'}`)
        if (watermark !== expected) failures.push(`${key}: watermark expected ${expected}, got ${watermark || 'missing'}`)
      })
      return failures
    })
    failures.push(...tierFailures.map(message => `tier-rule: ${message}`))
  } finally {
    await tierPage.close()
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify({ failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
