import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []
await mkdir('visual-review', { recursive: true })

const errorMessage = error => error instanceof Error ? error.message : String(error)

async function openJournalLibrary(page, ui, theme) {
  await page.goto(`${baseUrl}?view=preparation&theme=${theme}&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
  const journalCenter = page.locator(".header-tabs > button[data-main-nav-key='journals'], .tab-bar > button[data-main-nav-key='journals']").first()
  await journalCenter.waitFor({ state: 'visible', timeout: 15000 })
  await journalCenter.evaluate(element => element.click())
  await page.locator('.preparation-workspace[data-section="journals"]:visible .journal-grid:visible').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(260)
}

async function openNewJournalEditor(page) {
  const buttons = page.locator('.btn-journal-primary')
  for (let index = 0; index < await buttons.count(); index += 1) {
    await buttons.nth(index).evaluate(element => element.click())
    const modal = page.locator('.journal-form-modal:visible').first()
    try {
      await modal.waitFor({ state: 'visible', timeout: 1800 })
      return modal
    } catch {
      // Responsive layouts may retain an inert hidden copy.
    }
  }
  const diagnostics = await buttons.evaluateAll(elements => elements.map(element => ({
    text: element.textContent?.trim() || '',
    display: getComputedStyle(element).display,
    visibility: getComputedStyle(element).visibility,
    rect: element.getBoundingClientRect().toJSON(),
  })))
  throw new Error(`Unable to open journal editor: ${JSON.stringify(diagnostics)}`)
}

async function inspectDesktop(ui, theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await openJournalLibrary(page, ui, theme)
    const result = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const grid = document.querySelector('.preparation-workspace[data-section="journals"]:not([hidden]) .journal-grid')
      const cards = grid ? Array.from(grid.querySelectorAll('.prep-journal-card')) : []
      if (!grid || !cards.length) return { failures: ['journal library fixture is incomplete'], details: {} }

      const localFailures = []
      const gridStyle = getComputedStyle(grid)
      const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean)
      const gridRect = grid.getBoundingClientRect()
      const cardRects = cards.map(card => card.getBoundingClientRect())
      const visibleFooterHeights = []

      if (columns.length < 3) localFailures.push(`desktop journal library exposes only ${columns.length} columns`)
      if (parseFloat(gridStyle.columnGap) > 12) localFailures.push('desktop journal grid gap is too large')
      if (Math.max(...cardRects.map(rect => rect.width)) > 390) localFailures.push('journal cards are too wide')
      if (Math.max(...cardRects.map(rect => rect.height)) > 330) localFailures.push('journal cards are too tall')

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect()
        const main = card.querySelector('.prep-journal-card-main')
        const title = card.querySelector('h3')
        const facts = Array.from(card.querySelectorAll('.prep-journal-facts > *'))
        const links = card.querySelector('.prep-journal-links')
        if (!main || !title || !links) {
          localFailures.push(`journal ${index + 1}: compact card structure is incomplete`)
          return
        }

        const mainStyle = getComputedStyle(main)
        const titleStyle = getComputedStyle(title)
        const lineHeight = parseFloat(titleStyle.lineHeight)
        if (parseFloat(mainStyle.paddingLeft) > 12 || parseFloat(mainStyle.paddingTop) > 12) localFailures.push(`journal ${index + 1}: main padding is oversized`)
        if (lineHeight && title.getBoundingClientRect().height > lineHeight * 2 + 2) localFailures.push(`journal ${index + 1}: title exceeds two lines`)
        if (title.scrollHeight > title.clientHeight + 2) localFailures.push(`journal ${index + 1}: title is clipped`)
        if (rect.right > gridRect.right + 1.5 || rect.left < gridRect.left - 1.5) localFailures.push(`journal ${index + 1}: card exceeds grid edges`)
        if (card.scrollWidth > card.clientWidth + 2) localFailures.push(`journal ${index + 1}: horizontal overflow`)

        const linkAnchors = Array.from(links.querySelectorAll('a')).filter(visible)
        if (linkAnchors.length) {
          const linksRect = links.getBoundingClientRect()
          visibleFooterHeights.push(linksRect.height)
          if (linksRect.height < 38 || linksRect.height > 42) localFailures.push(`journal ${index + 1}: visible links footer is not the fixed 40px rail`)
          if (Math.abs(rect.bottom - linksRect.bottom) > 1.5) localFailures.push(`journal ${index + 1}: visible links footer is not bottom anchored`)
          const linkKeys = linkAnchors.map(link => {
            const url = new URL(link.href)
            url.hash = ''
            return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}`.toLowerCase()
          })
          if (new Set(linkKeys).size !== linkKeys.length) localFailures.push(`journal ${index + 1}: duplicate links remain visible`)
        }

        const metricHost = card.querySelector('.prep-journal-numbers')
        const visibleMetrics = Array.from(card.querySelectorAll('.prep-journal-numbers > div')).filter(visible)
        visibleMetrics.forEach((cell, metricIndex) => {
          const value = cell.querySelector('b')?.textContent?.trim() || ''
          if (!value || ['—', '--', '-', '–'].includes(value)) localFailures.push(`journal ${index + 1}: unknown metric ${metricIndex + 1} is visible`)
        })
        if (metricHost && !visibleMetrics.length && visible(metricHost)) localFailures.push(`journal ${index + 1}: empty metric row occupies space`)
        Array.from(card.querySelectorAll('.prep-journal-rank-blocks > span')).forEach((chip, rankIndex) => {
          if (chip.scrollWidth > chip.clientWidth + 2) localFailures.push(`journal ${index + 1}: rank chip ${rankIndex + 1} is clipped`)
        })
        facts.forEach((fact, factIndex) => {
          if (visible(fact) && fact.getBoundingClientRect().height > 29) localFailures.push(`journal ${index + 1}: fact ${factIndex + 1} is too tall`)
        })
      })

      if (visibleFooterHeights.length > 1 && Math.max(...visibleFooterHeights) - Math.min(...visibleFooterHeights) > 1) localFailures.push('visible journal link footers do not share one height')
      return {
        failures: localFailures,
        details: {
          columns: columns.length,
          gap: gridStyle.columnGap,
          maxWidth: Math.round(Math.max(...cardRects.map(rect => rect.width))),
          maxHeight: Math.round(Math.max(...cardRects.map(rect => rect.height))),
          visibleFooters: visibleFooterHeights.length,
          cards: cards.length,
        },
      }
    })
    failures.push(...result.failures.map(message => `${ui}/${theme}: ${message}`))
    details.push({ ui, theme, ...result.details })
    if (theme === 'light') await page.screenshot({ path: `visual-review/${ui}-journal-library-light-desktop.png`, fullPage: true })
  } catch (error) {
    failures.push(`${ui}/${theme}: runtime check failed: ${errorMessage(error)}`)
  } finally {
    await page.close()
  }
}

async function inspectMobile(ui) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  try {
    await openJournalLibrary(page, ui, 'light')
    const result = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const grid = document.querySelector('.preparation-workspace[data-section="journals"] .journal-grid')
      const cards = grid ? Array.from(grid.querySelectorAll('.prep-journal-card')) : []
      if (!grid || !cards.length) return ['mobile journal library fixture is incomplete']
      const localFailures = []
      if (getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length !== 1) localFailures.push('mobile journal library is not single-column')
      cards.forEach((card, index) => {
        if (card.scrollWidth > card.clientWidth + 2) localFailures.push(`journal ${index + 1}: mobile horizontal overflow`)
        const links = card.querySelector('.prep-journal-links')
        if (links && Array.from(links.querySelectorAll('a')).some(visible) && Math.abs(card.getBoundingClientRect().bottom - links.getBoundingClientRect().bottom) > 1.5) {
          localFailures.push(`journal ${index + 1}: visible mobile links footer is not bottom anchored`)
        }
      })
      return localFailures
    })
    failures.push(...result.map(message => `${ui}/mobile: ${message}`))
  } catch (error) {
    failures.push(`${ui}/mobile: runtime check failed: ${errorMessage(error)}`)
  } finally {
    await page.close()
  }
}

async function inspectReviewLookup(ui) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const journalUrl = 'https://www.sciencedirect.com/journal/journal-of-rock-mechanics-and-geotechnical-engineering'
  page.on('pageerror', error => console.error(`[${ui}-journal-form-pageerror]`, error.message))
  try {
    await page.route('https://r.jina.ai/**', async route => {
      const isInsights = decodeURIComponent(route.request().url()).includes('/about/insights')
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: isInsights
          ? '# Journal Insights\n\n2 days\n\nSubmission to first decision\n\n174 days\n\nSubmission to acceptance\n\n16%\n\nAcceptance Rate'
          : '# Journal homepage\n\nView all insights',
      })
    })
    await openJournalLibrary(page, ui, 'light')
    const modal = await openNewJournalEditor(page)
    const fieldLabels = (await modal.locator('.prep-field > span').allTextContents()).map(text => text.trim())
    const requiredFields = [
      { name: 'APC', matches: label => label.includes('APC') },
      { name: '中文译名', matches: label => label === '中文译名' },
      { name: '缩写', matches: label => label === '缩写' },
      { name: '中文简介翻译', matches: label => label === '中文简介翻译' },
      { name: '选刊标签', matches: label => label === '选刊标签' },
      { name: '选刊备注', matches: label => label === '选刊备注' },
    ]
    for (const field of requiredFields) {
      if (!fieldLabels.some(field.matches)) failures.push(`${ui}/form: missing field ${field.name}`)
    }
    await modal.locator('.prep-field', { hasText: '英文期刊名' }).locator('input').first().fill('Journal of Rock Mechanics and Geotechnical Engineering')
    await modal.locator('.prep-field', { hasText: '期刊官网' }).locator('input').first().fill(journalUrl)
    await modal.locator('.prep-field', { hasText: '审稿周期来源' }).locator('input').first().fill('')

    const layering = await modal.evaluate(element => {
      const overlay = element.parentElement
      const header = document.querySelector('.app-header')
      const headerStyle = header ? getComputedStyle(header) : null
      return {
        overlayClass: overlay?.className || '',
        overlayRect: overlay?.getBoundingClientRect().toJSON(),
        viewportHeight: window.innerHeight,
        overlayZ: overlay ? parseFloat(getComputedStyle(overlay).zIndex) : 0,
        headerVisibility: headerStyle?.visibility || '',
        headerPointerEvents: headerStyle?.pointerEvents || '',
      }
    })
    if (!layering.overlayClass.includes('modal-overlay')) failures.push(`${ui}/form: editor is outside modal overlay`)
    if (!layering.overlayRect || layering.overlayRect.top > 1 || layering.overlayRect.bottom < layering.viewportHeight - 1) failures.push(`${ui}/form: overlay does not cover viewport`)
    if (layering.overlayZ < 10000) failures.push(`${ui}/form: overlay z-index is too low`)
    if (layering.headerVisibility !== 'hidden' || layering.headerPointerEvents !== 'none') failures.push(`${ui}/form: sticky header remains interactive`)

    const button = modal.getByRole('button', { name: '获取审稿周期' })
    if (await button.count() !== 1) failures.push(`${ui}/form: review lookup button is duplicated`)
    await button.click()
    await page.waitForFunction(() => {
      const modalElement = document.querySelector('.journal-form-modal')
      if (!modalElement) return false
      const byLabel = label => Array.from(modalElement.querySelectorAll('.prep-field')).find(field => field.querySelector(':scope > span')?.textContent?.trim().includes(label))?.querySelector('input')?.value || ''
      return byLabel('首轮决定') === '2' && byLabel('总审稿周期') === '174' && byLabel('接收率') === '16' && byLabel('审稿周期来源').endsWith('/about/insights')
    }, undefined, { timeout: 15000 })
    await page.screenshot({ path: `visual-review/${ui}-journal-review-lookup.png`, fullPage: false })
  } catch (error) {
    failures.push(`${ui}/form: review lookup failed: ${errorMessage(error)}`)
  } finally {
    await page.close()
  }
}

try {
  for (const ui of ['luminous', 'luminous-x']) {
    for (const theme of ['light', 'dark']) await inspectDesktop(ui, theme)
    await inspectMobile(ui)
    await inspectReviewLookup(ui)
  }
  console.log(JSON.stringify({ failures, details }, null, 2))
  if (failures.length) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}