import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []

function fail(message) {
  failures.push(message)
}

for (const ui of ['luminous', 'luminous-x']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const label = ui

  try {
    await page.goto(`${baseUrl}?view=dashboard&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
    await page.locator(`html[data-ui='${ui}'][data-visual-ready='true'] .paper-card-v3`).first().waitFor({ state: 'visible', timeout: 45000 })
    await page.waitForTimeout(250)

    const card = page.locator('.paper-card-v3').first()
    const cardText = await card.innerText()
    const actionRail = card.locator('.paper-action-rail')
    const publisher = actionRail.locator('.publisher-mark')
    const backend = actionRail.locator('.paper-backend-link')
    const statusBackend = card.locator('.paper-status-backend')

    if (/\bID\s+DEMO-/i.test(cardText)) fail(`${label}: manuscript number is still exposed on the card`)
    if (/Editorial Manager|ScholarOne|Open Journal Systems/i.test(cardText)) fail(`${label}: submission platform is still exposed on the card`)
    if (await publisher.count() !== 1) fail(`${label}: publisher mark is missing`)
    if (await backend.count() !== 1) fail(`${label}: explicit backend action is missing`)
    if (await statusBackend.count() !== 1) fail(`${label}: status is not an actionable backend link`)

    if (await backend.count()) {
      const href = await backend.getAttribute('href')
      if (href !== 'https://example.com/submission-a') fail(`${label}: backend action does not prefer the manuscript-specific URL (${href})`)
    }
    if (await statusBackend.count()) {
      const href = await statusBackend.getAttribute('href')
      if (href !== 'https://example.com/submission-a') fail(`${label}: status action points to the wrong URL (${href})`)
    }

    const geometry = await card.evaluate(element => {
      const sectionSelector = ':scope > .paper-card-head, :scope > .paper-action-rail, :scope > .title-block, :scope > .archive-chip-row, :scope > .paper-rank-row, :scope > .author-list-v2, :scope > .paper-history, :scope > .paper-card-footer'
      const sections = Array.from(element.querySelectorAll(sectionSelector)).filter(section => {
        const style = getComputedStyle(section)
        const rect = section.getBoundingClientRect()
        return style.display !== 'none' && rect.width > 0 && rect.height > 0
      })
      const gaps = sections.slice(1).map((section, index) => {
        const previous = sections[index].getBoundingClientRect()
        const current = section.getBoundingClientRect()
        return Math.round((current.top - previous.bottom) * 10) / 10
      })
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        publisherText: element.querySelector('.publisher-mark')?.textContent?.trim() || '',
        backendText: element.querySelector('.paper-backend-link')?.textContent?.trim() || '',
        gaps,
        maxGap: gaps.length ? Math.max(...gaps) : 0,
        minGap: gaps.length ? Math.min(...gaps) : 0,
      }
    })
    if (geometry.scrollWidth > geometry.clientWidth + 2) fail(`${label}: card has horizontal overflow ${geometry.scrollWidth}/${geometry.clientWidth}`)
    if (geometry.maxGap > 16) fail(`${label}: card section spacing is still irregular; max gap ${geometry.maxGap}px (${geometry.gaps.join(', ')})`)
    if (geometry.minGap < -2) fail(`${label}: card sections overlap; min gap ${geometry.minGap}px (${geometry.gaps.join(', ')})`)
    details.push(`${label}: publisher=${geometry.publisherText}; backend=${geometry.backendText}; gaps=${geometry.gaps.join('/')}`)

    const journalButton = card.locator('.journal-pill-button')
    await journalButton.hover()
    const journalPopover = card.locator('.journal-quick-overlay')
    await journalPopover.waitFor({ state: 'visible', timeout: 3000 })
    await page.waitForTimeout(120)
    const popoverGeometry = await journalPopover.evaluate((overlay, cardElement) => {
      const overlayRect = overlay.getBoundingClientRect()
      const cardRect = cardElement.getBoundingClientRect()
      const style = getComputedStyle(overlay)
      return {
        position: style.position,
        width: overlayRect.width,
        height: overlayRect.height,
        topDelta: overlayRect.top - cardRect.top,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    }, await card.elementHandle())
    if (popoverGeometry.position !== 'absolute') fail(`${label}: journal details still use ${popoverGeometry.position} positioning instead of an anchored popover`)
    if (popoverGeometry.width > 430 || popoverGeometry.height > 600) fail(`${label}: journal popover is oversized ${popoverGeometry.width}×${popoverGeometry.height}`)
    if (popoverGeometry.topDelta < 20 || popoverGeometry.topDelta > 90) fail(`${label}: journal popover is not anchored to the journal row (top delta ${popoverGeometry.topDelta})`)
    if (popoverGeometry.width > popoverGeometry.viewportWidth * 0.75 || popoverGeometry.height > popoverGeometry.viewportHeight * 0.8) fail(`${label}: journal details still behave like a page-covering modal`)

    await journalPopover.locator('.journal-quick-card').hover()
    await page.waitForTimeout(280)
    if (!(await journalPopover.isVisible())) fail(`${label}: journal popover closes while moving from the journal name into the popover`)
    await page.mouse.move(2, 2)
    await page.waitForTimeout(360)
    if (await journalPopover.isVisible()) fail(`${label}: journal popover does not close after pointer leaves it`)

    const acceptedCard = page.locator('.paper-card-v3').filter({ hasText: 'Journal of Open Research Software' }).first()
    if (await acceptedCard.count()) {
      const acceptedGenericPortal = acceptedCard.locator('.paper-backend-link.is-journal')
      if (await acceptedGenericPortal.count()) fail(`${label}: accepted paper still exposes the generic submission portal`)
      const acceptedStatusLink = acceptedCard.locator('.paper-status-backend')
      if (await acceptedStatusLink.count() !== 1) {
        fail(`${label}: accepted status is not linked to the publication page`)
      } else {
        const href = await acceptedStatusLink.getAttribute('href')
        const hint = await acceptedStatusLink.locator('.paper-status-backend-hint').textContent()
        if (href !== 'https://example.com/article') fail(`${label}: accepted status points to ${href} instead of the publication page`)
        if (!hint?.includes('见刊')) fail(`${label}: accepted status does not communicate the publication action`)
      }
    } else {
      fail(`${label}: accepted-paper fixture is missing`)
    }

    await card.locator('.title-block').click({ force: true })
    await page.locator('.compact-form-modal').waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(150)
    const visibleSystemFields = await page.locator('.compact-form-modal .compact-field').evaluateAll(fields => fields
      .filter(field => {
        const directLabel = Array.from(field.children).find(child => child.matches('span'))?.textContent?.trim() || ''
        const input = field.querySelector('input')
        const platform = directLabel === '投稿系统' || directLabel.startsWith('投稿系统（') || input?.getAttribute('list') === 'submission-system-options'
        if (!platform) return false
        const style = getComputedStyle(field)
        const rect = field.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      })
      .map(field => field.textContent?.trim() || '投稿系统'))
    if (visibleSystemFields.length) fail(`${label}: submission-platform field remains selectable in the editor (${visibleSystemFields.join(' / ')})`)
  } catch (error) {
    fail(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await page.close()
  }
}

await browser.close()

if (failures.length) {
  console.error('Submission card action check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Submission card action check passed.')
details.forEach(item => console.log(`- ${item}`))
