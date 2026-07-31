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

    const geometry = await card.evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      publisherText: element.querySelector('.publisher-mark')?.textContent?.trim() || '',
      backendText: element.querySelector('.paper-backend-link')?.textContent?.trim() || '',
    }))
    if (geometry.scrollWidth > geometry.clientWidth + 2) fail(`${label}: card has horizontal overflow ${geometry.scrollWidth}/${geometry.clientWidth}`)
    details.push(`${label}: publisher=${geometry.publisherText}; backend=${geometry.backendText}`)

    await card.locator('.title-block').click({ force: true })
    await page.locator('.compact-form-modal').waitFor({ state: 'visible', timeout: 15000 })
    const systemField = page.locator('.compact-form-body > .compact-section:nth-child(2) > .compact-grid.two:first-of-type > .compact-field:nth-child(2)')
    if (await systemField.count()) {
      const display = await systemField.evaluate(element => getComputedStyle(element).display)
      if (display !== 'none') fail(`${label}: submission-platform field remains selectable in the editor`)
    } else {
      fail(`${label}: expected legacy submission-platform field was not found for compatibility check`)
    }
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
