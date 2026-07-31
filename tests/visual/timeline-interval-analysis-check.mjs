import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []

await mkdir('visual-review', { recursive: true })

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

async function inspect(ui) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await page.goto(`${baseUrl}?view=dashboard&theme=light&ui=${ui}`, { waitUntil: 'domcontentloaded' })
    await page.locator(`html[data-ui='${ui}'][data-visual-ready='true'] .paper-card-v3`).first().waitFor({ state: 'visible', timeout: 45000 })

    const revisionCard = page.locator('.paper-card-v3', { hasText: 'Benchmarking multimodal retrieval' }).first()
    await revisionCard.waitFor({ state: 'visible', timeout: 15000 })
    await revisionCard.click()

    const modal = page.locator('.compact-form-modal:visible').first()
    await modal.waitFor({ state: 'visible', timeout: 15000 })
    const timeline = modal.locator('.timeline-editor').first()
    await timeline.waitFor({ state: 'visible', timeout: 15000 })
    await timeline.scrollIntoViewIfNeeded()
    await page.waitForTimeout(180)

    const summaryPills = timeline.locator('.timeline-insight-pill')
    const firstResponse = timeline.locator(".timeline-insight-pill[data-kind='first-response']")
    const resultRows = timeline.locator(".timeline-round-cell[data-kind='result']")

    const summaryCount = await summaryPills.count()
    const firstResponseText = (await firstResponse.textContent())?.replace(/\s+/g, ' ').trim() || ''
    const resultTexts = (await resultRows.allTextContents()).map(text => text.replace(/\s+/g, ' ').trim())

    if (summaryCount !== 5) failures.push(`${ui}: expected 5 timeline summary metrics, found ${summaryCount}`)
    if (!/首轮返意见\s*\d+\s*天/.test(firstResponseText)) failures.push(`${ui}: first-response metric was not calculated (${firstResponseText})`)
    if (!resultTexts.some(text => /首轮返意见\s*\d+\s*天/.test(text))) failures.push(`${ui}: completed review round is missing from the table`)

    await timeline.locator('.timeline-interval-toggle').click()
    const analyzer = timeline.locator('.timeline-custom-analysis')
    await analyzer.waitFor({ state: 'visible', timeout: 5000 })

    const selects = analyzer.locator('select')
    const result = analyzer.locator('.timeline-custom-result')
    const startValue = await selects.nth(0).inputValue()
    const endValue = await selects.nth(1).inputValue()
    const resultText = (await result.textContent())?.replace(/\s+/g, ' ').trim() || ''
    const highlightedRows = await timeline.locator('.timeline-range-row').count()

    if (!startValue || !endValue) failures.push(`${ui}: custom interval endpoints were not initialized`)
    if (!/\d+\s*天/.test(resultText)) failures.push(`${ui}: custom interval result is missing (${resultText})`)
    if (highlightedRows < 2) failures.push(`${ui}: selected interval is not highlighted across timeline rows`)

    const geometry = await timeline.evaluate(element => {
      const table = element.querySelector('.timeline-table-mode')
      const header = element.querySelector('.timeline-table-head')
      const resultCell = element.querySelector(".timeline-round-cell[data-kind='result']")
      return {
        scrollWidth: table?.scrollWidth || 0,
        clientWidth: table?.clientWidth || 0,
        headerColumns: header ? getComputedStyle(header).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        resultCellWidth: resultCell?.getBoundingClientRect().width || 0,
      }
    })

    if (geometry.scrollWidth > geometry.clientWidth + 2) failures.push(`${ui}: timeline analysis causes horizontal overflow (${geometry.scrollWidth}/${geometry.clientWidth})`)
    if (geometry.headerColumns !== 7) failures.push(`${ui}: timeline header does not expose the dot plus six data columns (${geometry.headerColumns})`)
    if (geometry.resultCellWidth < 80) failures.push(`${ui}: review-round analysis column is too narrow (${Math.round(geometry.resultCellWidth)}px)`)

    details.push({ ui, summaryCount, firstResponseText, resultTexts, startValue, endValue, resultText, highlightedRows, geometry })
    await page.screenshot({ path: `visual-review/${ui}-timeline-interval-analysis.png`, fullPage: false })
  } catch (error) {
    failures.push(`${ui}: ${errorMessage(error)}`)
  } finally {
    await page.close()
  }
}

try {
  await inspect('luminous')
  await inspect('luminous-x')
} finally {
  console.log(JSON.stringify({ failures, details }, null, 2))
  await browser.close()
}

if (failures.length) throw new Error(failures.join(' | '))
