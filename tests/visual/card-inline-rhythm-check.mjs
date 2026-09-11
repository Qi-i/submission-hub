import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const tierUrl = 'http://127.0.0.1:4174/tests/visual/journal-tier.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []

const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max
const closeEnough = (a, b, tolerance = 1.5) => Math.abs(a - b) <= tolerance

function validateBlock(prefix, block, { height, pad }) {
  if (!block) return
  if (!inRange(block.height, height[0], height[1])) failures.push(`${prefix}: height ${block.height.toFixed(1)}px outside ${height[0]}-${height[1]}px`)
  if (pad && (!inRange(block.paddingLeft, pad[0], pad[1]) || !inRange(block.paddingRight, pad[0], pad[1]))) {
    failures.push(`${prefix}: horizontal padding ${block.paddingLeft}/${block.paddingRight}px outside ${pad[0]}-${pad[1]}px`)
  }
}

async function submissionGeometry(ui) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await page.goto(`${baseUrl}?view=dashboard&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
    await page.locator("html[data-visual-ready='true'] .paper-grid .paper-card-v3").first().waitFor({ state: 'visible', timeout: 45000 })
    return await page.evaluate(() => {
      const visible = element => {
        if (!(element instanceof HTMLElement)) return false
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const geom = element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return {
          height: rect.height,
          left: rect.left,
          right: rect.right,
          paddingLeft: parseFloat(style.paddingLeft) || 0,
          paddingRight: parseFloat(style.paddingRight) || 0,
          text: element.textContent?.trim() || '',
        }
      }
      return Array.from(document.querySelectorAll('.paper-grid .paper-card-v3:not(.journal-center-card)')).filter(visible).slice(0, 6).map((card, index) => {
        const primary = Array.from(card.querySelectorAll('.paper-status-area > .badge, .paper-status-area > .paper-status-backend')).find(visible)
        const journal = Array.from(card.querySelectorAll('.journal-pill-button')).find(visible)
        return {
          index,
          primary: primary ? geom(primary) : null,
          journal: journal ? geom(journal) : null,
          secondary: Array.from(card.querySelectorAll(':scope > .paper-action-rail > .publisher-mark, :scope > .paper-action-rail > .badge, :scope > .author-list-v2 > .author-badge-v2')).filter(visible).map(geom),
          compact: Array.from(card.querySelectorAll(':scope > .paper-rank-row > .badge, :scope > .archive-chip-row > .archive-chip, :scope > .paper-card-footer .paper-next-action-chip, :scope > .paper-card-footer .deadline-badge')).filter(visible).map(geom),
        }
      })
    })
  } finally {
    await page.close()
  }
}

async function journalGeometry(ui) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await page.goto(`${baseUrl}?view=preparation&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
    await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
    await page.locator("button[data-main-nav-key='journals']:visible").first().click()
    await page.locator('.journal-center-workspace:visible .journal-center-card').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(180)
    return await page.evaluate(() => {
      const visible = element => {
        if (!(element instanceof HTMLElement)) return false
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const geom = element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return {
          height: rect.height,
          paddingLeft: parseFloat(style.paddingLeft) || 0,
          paddingRight: parseFloat(style.paddingRight) || 0,
          text: element.textContent?.trim() || '',
        }
      }
      return Array.from(document.querySelectorAll('.journal-center-workspace .journal-center-card')).filter(visible).slice(0, 5).map((card, index) => {
        const status = card.querySelector('.journal-catalog-card__status')
        const oa = card.querySelector('.journal-catalog-card__oa')
        return {
          index,
          status: status instanceof HTMLElement && visible(status) ? geom(status) : null,
          oa: oa instanceof HTMLElement && visible(oa) ? geom(oa) : null,
          topMeta: Array.from(card.querySelectorAll('.journal-catalog-card__publisher-rail > .publisher-mark, .journal-catalog-card__publisher-rail > .journal-catalog-card__abbreviation')).filter(visible).map(geom),
          compact: Array.from(card.querySelectorAll('.journal-catalog-card__ranks > span, .journal-catalog-card__facts > span, .journal-catalog-card__footer > a')).filter(visible).map(geom),
          metrics: Array.from(card.querySelectorAll('.journal-catalog-card__metrics > div')).filter(visible).map(geom),
        }
      })
    })
  } finally {
    await page.close()
  }
}

async function publisherPolicy() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await page.goto(`${tierUrl}?theme=light&ui=luminous`, { waitUntil: 'domcontentloaded' })
    await page.locator("html[data-visual-ready='true'] .journal-center-card").first().waitFor({ state: 'visible', timeout: 45000 })
    return await page.evaluate(() => Array.from(document.querySelectorAll('.journal-center-card[data-tier-case]')).map(card => {
      const publisher = card.querySelector('.publisher-mark-name')
      const visible = publisher instanceof HTMLElement && getComputedStyle(publisher).display !== 'none' && publisher.getBoundingClientRect().width > 0
      return {
        key: card.getAttribute('data-tier-case') || '',
        expected: card.getAttribute('data-publisher-expected') || '',
        actual: visible ? publisher.textContent?.trim() || '' : '',
      }
    }))
  } finally {
    await page.close()
  }
}

try {
  for (const ui of ['luminous', 'luminous-x']) {
    const submissions = await submissionGeometry(ui)
    submissions.forEach(card => {
      const prefix = `${ui}/submission card ${card.index + 1}`
      validateBlock(`${prefix} primary`, card.primary, { height: [29, 31], pad: [8, 11] })
      validateBlock(`${prefix} journal`, card.journal, { height: [29, 31], pad: [8, 11] })
      if (card.primary && card.journal) {
        if (!closeEnough(card.primary.height, card.journal.height, 1)) failures.push(`${prefix}: primary and journal heights diverge`)
        if (card.journal.left - card.primary.right < 4) failures.push(`${prefix}: primary/journal gutter ${(card.journal.left - card.primary.right).toFixed(1)}px is too small`)
      }
      card.secondary.forEach((item, index) => validateBlock(`${prefix} secondary ${index + 1}`, item, { height: [25, 27], pad: [7, 10] }))
      card.compact.forEach((item, index) => validateBlock(`${prefix} compact ${index + 1}`, item, { height: [23, 25], pad: [7, 10] }))
    })
    details.push({ ui, submissionCards: submissions.length })

    const journals = await journalGeometry(ui)
    journals.forEach(card => {
      const prefix = `${ui}/journal card ${card.index + 1}`
      const topBlocks = [card.status, ...card.topMeta, card.oa].filter(Boolean)
      topBlocks.forEach((item, index) => validateBlock(`${prefix} top metadata ${index + 1}`, item, { height: [29, 31], pad: [8, 10] }))
      if (card.status && !/[★☆]/.test(card.status.text)) failures.push(`${prefix}: first top metadata block is not a star rating (${card.status.text})`)
      if (card.status && card.oa && !closeEnough(card.status.height, card.oa.height, 1)) failures.push(`${prefix}: rating/OA heights diverge`)
      card.compact.forEach((item, index) => validateBlock(`${prefix} compact ${index + 1}`, item, { height: [23, 25], pad: [7, 9] }))
      card.metrics.forEach((item, index) => validateBlock(`${prefix} metric ${index + 1}`, item, { height: [40, 44], pad: [7, 9] }))
    })
    details.push({ ui, journalCards: journals.length })
  }

  const publishers = await publisherPolicy()
  publishers.forEach(item => {
    if (item.actual !== item.expected) failures.push(`publisher/${item.key}: expected "${item.expected || 'hidden'}", got "${item.actual || 'hidden'}"`)
    if (item.actual && /[()（）]/.test(item.actual)) failures.push(`publisher/${item.key}: redundant parentheses remain (${item.actual})`)
  })
  details.push({ publisherCases: publishers })
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
