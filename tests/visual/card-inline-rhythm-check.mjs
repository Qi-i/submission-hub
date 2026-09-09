import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const tierUrl = 'http://127.0.0.1:4174/tests/visual/journal-tier.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []
await mkdir('visual-review', { recursive: true })

const closeEnough = (a, b, tolerance = 1.5) => Math.abs(a - b) <= tolerance
const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max

async function inspectSubmission(ui) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await page.goto(`${baseUrl}?view=dashboard&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
    await page.locator("html[data-visual-ready='true'] .paper-grid .paper-card-v3").first().waitFor({ state: 'visible', timeout: 45000 })

    const result = await page.evaluate(() => {
      const visible = element => {
        if (!(element instanceof HTMLElement)) return false
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const geometry = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return {
          height: rect.height,
          left: rect.left,
          right: rect.right,
          centerY: rect.top + rect.height / 2,
          paddingLeft: parseFloat(style.paddingLeft) || 0,
          paddingRight: parseFloat(style.paddingRight) || 0,
          radius: parseFloat(style.borderRadius) || 0,
          text: element.textContent?.trim() || '',
        }
      }

      const cards = Array.from(document.querySelectorAll('.paper-grid .paper-card-v3:not(.journal-center-card)')).filter(visible)
      return cards.slice(0, 6).map((card, index) => {
        const primary = Array.from(card.querySelectorAll('.paper-status-area > .badge, .paper-status-area > .paper-status-backend')).find(visible)
        const journal = Array.from(card.querySelectorAll('.journal-pill-button')).find(visible)
        const action = Array.from(card.querySelectorAll(':scope > .paper-action-rail > .publisher-mark, :scope > .paper-action-rail > .badge')).filter(visible)
        const ranks = Array.from(card.querySelectorAll(':scope > .paper-rank-row > .badge')).filter(visible)
        const authors = Array.from(card.querySelectorAll(':scope > .author-list-v2 > .author-badge-v2')).filter(visible)
        const footer = Array.from(card.querySelectorAll(':scope > .paper-card-footer .paper-next-action-chip, :scope > .paper-card-footer .deadline-badge')).filter(visible)
        return {
          index,
          primary: primary ? geometry(primary) : null,
          journal: journal ? geometry(journal) : null,
          action: action.map(geometry),
          ranks: ranks.map(geometry),
          authors: authors.map(geometry),
          footer: footer.map(geometry),
        }
      })
    })

    result.forEach(card => {
      const prefix = `${ui}/submission card ${card.index + 1}`
      if (card.primary) {
        if (!inRange(card.primary.height, 29, 31)) failures.push(`${prefix}: primary status height ${card.primary.height.toFixed(1)}px is outside 30px rhythm`)
        if (!inRange(card.primary.paddingLeft, 8, 11) || !inRange(card.primary.paddingRight, 8, 11)) failures.push(`${prefix}: primary status horizontal padding is unbalanced (${card.primary.paddingLeft}/${card.primary.paddingRight}px)`)
      }
      if (card.journal) {
        if (!inRange(card.journal.height, 29, 31)) failures.push(`${prefix}: journal pill height ${card.journal.height.toFixed(1)}px is outside 30px rhythm`)
        if (!inRange(card.journal.paddingLeft, 8, 11) || !inRange(card.journal.paddingRight, 8, 11)) failures.push(`${prefix}: journal pill horizontal padding is unbalanced (${card.journal.paddingLeft}/${card.journal.paddingRight}px)`)
      }
      if (card.primary && card.journal) {
        if (!closeEnough(card.primary.height, card.journal.height, 1)) failures.push(`${prefix}: header blocks do not share a visual height (${card.primary.height.toFixed(1)}/${card.journal.height.toFixed(1)}px)`)
        if (card.primary.right > card.journal.left - 4) failures.push(`${prefix}: status and journal blocks overlap or have insufficient gutter (${(card.journal.left - card.primary.right).toFixed(1)}px)`)
      }

      const secondary = [...card.action, ...card.authors]
      secondary.forEach((item, index) => {
        if (!inRange(item.height, 25, 27)) failures.push(`${prefix}: secondary block ${index + 1} height ${item.height.toFixed(1)}px is outside 26px rhythm`)
        if (!inRange(item.paddingLeft, 7, 10) || !inRange(item.paddingRight, 7, 10)) failures.push(`${prefix}: secondary block ${index + 1} horizontal padding is unbalanced (${item.paddingLeft}/${item.paddingRight}px)`)
      })

      card.ranks.forEach((item, index) => {
        if (!inRange(item.height, 23, 25)) failures.push(`${prefix}: rank block ${index + 1} height ${item.height.toFixed(1)}px is outside 24px rhythm`)
        if (!inRange(item.paddingLeft, 7, 9) || !inRange(item.paddingRight, 7, 9)) failures.push(`${prefix}: rank block ${index + 1} horizontal padding is unbalanced (${item.paddingLeft}/${item.paddingRight}px)`)
      })

      card.footer.forEach((item, index) => {
        if (!inRange(item.height, 23, 27)) failures.push(`${prefix}: footer block ${index + 1} height ${item.height.toFixed(1)}px is visually off-rhythm`)
        if (!inRange(item.paddingLeft, 7, 10) || !inRange(item.paddingRight, 7, 10)) failures.push(`${prefix}: footer block ${index + 1} horizontal padding is unbalanced (${item.paddingLeft}/${item.paddingRight}px)`)
      })
    })

    details.push({ ui, submissionCards: result.length })
    await page.screenshot({ path: `visual-review/${ui}-card-inline-rhythm-dashboard.png`, fullPage: false })
  } finally {
    await page.close()
  }
}

async function inspectJournalCenter(ui) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await page.goto(`${baseUrl}?view=preparation&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
    await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
    await page.locator("button[data-main-nav-key='journals']:visible").first().click()
    await page.locator('.journal-center-workspace:visible .journal-center-card').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(180)

    const result = await page.evaluate(() => {
      const visible = element => {
        if (!(element instanceof HTMLElement)) return false
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const geometry = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return {
          height: rect.height,
          paddingLeft: parseFloat(style.paddingLeft) || 0,
          paddingRight: parseFloat(style.paddingRight) || 0,
          centerY: rect.top + rect.height / 2,
          text: element.textContent?.trim() || '',
        }
      }
      return Array.from(document.querySelectorAll('.journal-center-workspace .journal-center-card')).filter(visible).slice(0, 5).map((card, index) => ({
        index,
        status: card.querySelector('.journal-catalog-card__status') && geometry(card.querySelector('.journal-catalog-card__status')),
        oa: card.querySelector('.journal-catalog-card__oa') && geometry(card.querySelector('.journal-catalog-card__oa')),
        publisher: Array.from(card.querySelectorAll('.journal-catalog-card__publisher-rail > .publisher-mark, .journal-catalog-card__publisher-rail > .journal-catalog-card__abbreviation')).filter(visible).map(geometry),
        ranks: Array.from(card.querySelectorAll('.journal-catalog-card__ranks > span')).filter(visible).map(geometry),
        facts: Array.from(card.querySelectorAll('.journal-catalog-card__facts > span')).filter(visible).map(geometry),
        metrics: Array.from(card.querySelectorAll('.journal-catalog-card__metrics > div')).filter(visible).map(geometry),
        links: Array.from(card.querySelectorAll('.journal-catalog-card__footer > a')).filter(visible).map(geometry),
      })))
    })

    result.forEach(card => {
      const prefix = `${ui}/journal card ${card.index + 1}`
      for (const [name, item] of [['status', card.status], ['OA', card.oa]]) {
        if (!item) continue
        if (!inRange(item.height, 29, 31)) failures.push(`${prefix}: ${name} height ${item.height.toFixed(1)}px is outside 30px primary rhythm`)
        if (!inRange(item.paddingLeft, 8, 11) || !inRange(item.paddingRight, 8, 11)) failures.push(`${prefix}: ${name} horizontal padding is unbalanced (${item.paddingLeft}/${item.paddingRight}px)`)
      }
      if (card.status && card.oa && !closeEnough(card.status.height, card.oa.height, 1)) failures.push(`${prefix}: status and OA do not share one row height`)

      card.publisher.forEach((item, index) => {
        if (!inRange(item.height, 25, 27)) failures.push(`${prefix}: publisher block ${index + 1} height ${item.height.toFixed(1)}px is outside 26px metadata rhythm`)
      })
      ;[...card.ranks, ...card.facts, ...card.links].forEach((item, index) => {
        if (!inRange(item.height, 23, 25)) failures.push(`${prefix}: compact block ${index + 1} height ${item.height.toFixed(1)}px is outside 24px rhythm`)
        if (!inRange(item.paddingLeft, 7, 9) || !inRange(item.paddingRight, 7, 9)) failures.push(`${prefix}: compact block ${index + 1} horizontal padding is unbalanced (${item.paddingLeft}/${item.paddingRight}px)`)
      })
      card.metrics.forEach((item, index) => {
        if (!inRange(item.height, 40, 44)) failures.push(`${prefix}: two-line metric ${index + 1} height ${item.height.toFixed(1)}px is outside 42px rhythm`)
        if (!inRange(item.paddingLeft, 7, 9) || !inRange(item.paddingRight, 7, 9)) failures.push(`${prefix}: metric ${index + 1} horizontal padding is unbalanced (${item.paddingLeft}/${item.paddingRight}px)`)
      })
    })

    details.push({ ui, journalCards: result.length })
    await page.screenshot({ path: `visual-review/${ui}-card-inline-rhythm-journal-center.png`, fullPage: false })
  } finally {
    await page.close()
  }
}

async function inspectPublisherPolicy() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await page.goto(`${tierUrl}?theme=light&ui=luminous`, { waitUntil: 'domcontentloaded' })
    await page.locator("html[data-visual-ready='true'] .journal-center-card").first().waitFor({ state: 'visible', timeout: 45000 })
    const result = await page.evaluate(() => Array.from(document.querySelectorAll('.journal-center-card[data-tier-case]')).map(card => {
      const publisher = card.querySelector('.publisher-mark-name')
      const style = publisher instanceof HTMLElement ? getComputedStyle(publisher) : null
      const visible = publisher instanceof HTMLElement && style?.display !== 'none' && publisher.getBoundingClientRect().width > 0
      return {
        key: card.getAttribute('data-tier-case') || '',
        expected: card.getAttribute('data-publisher-expected') || '',
        actual: visible ? publisher.textContent?.trim() || '' : '',
      }
    }))

    result.forEach(item => {
      if (item.actual !== item.expected) failures.push(`publisher/${item.key}: expected "${item.expected || 'hidden'}", got "${item.actual || 'hidden'}"`)
      if (item.actual && /[()（）]/.test(item.actual)) failures.push(`publisher/${item.key}: redundant parenthetical publisher text remains visible (${item.actual})`)
    })
    details.push({ publisherCases: result })
  } finally {
    await page.close()
  }
}

try {
  for (const ui of ['luminous', 'luminous-x']) {
    await inspectSubmission(ui)
    await inspectJournalCenter(ui)
  }
  await inspectPublisherPolicy()
} finally {
  await browser.close()
}

if (failures.length) {
  console.error('Card inline rhythm / publisher contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  console.error(JSON.stringify(details, null, 2))
  process.exit(1)
}

console.log('Card inline rhythm / publisher contract passed.')
console.log(JSON.stringify(details, null, 2))
