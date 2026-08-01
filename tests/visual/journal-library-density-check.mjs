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

async function openJournalLibrary(page, ui, theme) {
  await page.goto(`${baseUrl}?view=preparation&theme=${theme}&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
  const journalCenter = page.locator(".header-tabs > button[data-main-nav-key='journals'], .tab-bar > button[data-main-nav-key='journals']").first()
  await journalCenter.waitFor({ state: 'visible', timeout: 15000 })
  await journalCenter.evaluate(element => element.click())

  const grid = page.locator('.preparation-workspace[data-section="journals"]:visible .journal-grid:visible').first()
  await grid.waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(260)
}

async function openNewJournalEditor(page) {
  const buttons = page.locator('.btn-journal-primary')
  const count = await buttons.count()
  for (let index = 0; index < count; index += 1) {
    await buttons.nth(index).evaluate(element => element.click())
    const modal = page.locator('.journal-form-modal:visible').first()
    try {
      await modal.waitFor({ state: 'visible', timeout: 1800 })
      return modal
    } catch {
      // Responsive layouts may retain an inert copy; continue to the next action.
    }
  }
  const diagnostics = await buttons.evaluateAll(elements => elements.map(element => ({
    text: element.textContent?.trim() || '',
    display: getComputedStyle(element).display,
    visibility: getComputedStyle(element).visibility,
    rect: element.getBoundingClientRect().toJSON(),
  })))
  throw new Error(`Unable to open journal editor from ${count} actions: ${JSON.stringify(diagnostics)}`)
}

async function inspectDesktop(ui, theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await openJournalLibrary(page, ui, theme)

    const result = await page.evaluate(() => {
      const workspace = Array.from(document.querySelectorAll('.preparation-workspace[data-section="journals"]')).find(element => {
        const style = getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden' && element.getBoundingClientRect().width > 0
      })
      const grid = workspace?.querySelector('.journal-grid')
      const cards = grid ? Array.from(grid.querySelectorAll('.prep-journal-card')) : []
      if (!grid || cards.length === 0) return { failures: ['journal library fixture is incomplete'], details: {} }

      const localFailures = []
      const gridStyle = getComputedStyle(grid)
      const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean)
      const gridRect = grid.getBoundingClientRect()
      const cardRects = cards.map(card => card.getBoundingClientRect())
      const maxWidth = Math.max(...cardRects.map(rect => rect.width))
      const maxHeight = Math.max(...cardRects.map(rect => rect.height))
      const footerHeights = []
      const isVisible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }

      if (columns.length < 3) localFailures.push(`desktop journal library exposes only ${columns.length} grid columns`)
      if (Number.parseFloat(gridStyle.columnGap) > 12) localFailures.push('desktop journal grid gap is too large')
      if (maxWidth > 390) localFailures.push(`journal cards are still too wide (${Math.round(maxWidth)}px)`)
      if (maxHeight > 330) localFailures.push(`journal cards are still too tall (${Math.round(maxHeight)}px)`)

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
        const titleRect = title.getBoundingClientRect()
        const linksRect = links.getBoundingClientRect()
        const lineHeight = Number.parseFloat(titleStyle.lineHeight)
        footerHeights.push(linksRect.height)
        if (Number.parseFloat(mainStyle.paddingLeft) > 12 || Number.parseFloat(mainStyle.paddingTop) > 12) {
          localFailures.push(`journal ${index + 1}: main padding remains oversized`)
        }
        if (lineHeight && titleRect.height > lineHeight * 2 + 2) localFailures.push(`journal ${index + 1}: title exceeds two lines`)
        if (title.scrollHeight > title.clientHeight + 2) localFailures.push(`journal ${index + 1}: title is visually clipped`)
        if (linksRect.height < 38 || linksRect.height > 42) localFailures.push(`journal ${index + 1}: links footer is not the fixed 40px rail`)
        if (Math.abs(rect.bottom - linksRect.bottom) > 1.5) localFailures.push(`journal ${index + 1}: links footer is not anchored to the card bottom`)
        if (rect.right > gridRect.right + 1.5 || rect.left < gridRect.left - 1.5) localFailures.push(`journal ${index + 1}: card exceeds grid edges`)
        if (card.scrollWidth > card.clientWidth + 2) localFailures.push(`journal ${index + 1}: horizontal overflow`)

        const metricHost = card.querySelector('.prep-journal-numbers')
        const metricCells = Array.from(card.querySelectorAll('.prep-journal-numbers > div'))
        const visibleMetricCells = metricCells.filter(isVisible)
        visibleMetricCells.forEach((cell, metricIndex) => {
          const value = cell.querySelector('b')?.textContent?.trim() || ''
          if (!value || ['—', '--', '-', '–'].includes(value)) localFailures.push(`journal ${index + 1}: unknown metric ${metricIndex + 1} is visible`)
        })
        if (metricHost && visibleMetricCells.length === 0 && isVisible(metricHost)) localFailures.push(`journal ${index + 1}: empty metric row still occupies space`)

        const rankChips = Array.from(card.querySelectorAll('.prep-journal-rank-blocks > span'))
        rankChips.forEach((chip, rankIndex) => {
          if (chip.scrollWidth > chip.clientWidth + 2) localFailures.push(`journal ${index + 1}: rank chip ${rankIndex + 1} is clipped`)
        })

        const linkKeys = Array.from(links.querySelectorAll('a')).map(link => {
          const url = new URL(link.href)
          url.hash = ''
          return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}`.toLowerCase()
        })
        if (new Set(linkKeys).size !== linkKeys.length) localFailures.push(`journal ${index + 1}: duplicate links remain visible`)

        facts.forEach((fact, factIndex) => {
          if (fact.getBoundingClientRect().height > 29) localFailures.push(`journal ${index + 1}: fact ${factIndex + 1} is too tall`)
        })
      })

      if (footerHeights.length && Math.max(...footerHeights) - Math.min(...footerHeights) > 1) {
        localFailures.push('journal link footers do not share one fixed height')
      }

      return {
        failures: localFailures,
        details: {
          columns: columns.length,
          gap: gridStyle.columnGap,
          maxWidth: Math.round(maxWidth),
          maxHeight: Math.round(maxHeight),
          footerHeight: footerHeights.length ? Math.round(footerHeights[0]) : 0,
          cards: cards.length,
        },
      }
    })

    failures.push(...result.failures.map(message => `${ui}/${theme}: ${message}`))
    details.push({ ui, theme, ...result.details })

    if (theme === 'light') {
      await page.screenshot({
        path: `visual-review/${ui}-journal-library-light-desktop.png`,
        fullPage: true,
      })
    }
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
      const workspace = Array.from(document.querySelectorAll('.preparation-workspace[data-section="journals"]')).find(element => {
        const style = getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden' && element.getBoundingClientRect().width > 0
      })
      const grid = workspace?.querySelector('.journal-grid')
      const cards = grid ? Array.from(grid.querySelectorAll('.prep-journal-card')) : []
      if (!grid || cards.length === 0) return ['mobile journal library fixture is incomplete']
      const localFailures = []
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean)
      if (columns.length !== 1) localFailures.push(`mobile journal library has ${columns.length} columns`)
      cards.forEach((card, index) => {
        if (card.scrollWidth > card.clientWidth + 2) localFailures.push(`journal ${index + 1}: mobile horizontal overflow`)
        const links = card.querySelector('.prep-journal-links')
        if (links && Math.abs(card.getBoundingClientRect().bottom - links.getBoundingClientRect().bottom) > 1.5) {
          localFailures.push(`journal ${index + 1}: mobile links footer is not bottom anchored`)
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
      const requestUrl = decodeURIComponent(route.request().url())
      const isInsights = requestUrl.includes('/journal/journal-of-rock-mechanics-and-geotechnical-engineering/about/insights')
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: isInsights
          ? `# Journal Insights\n\nPublishing timeline\n\n2 days\n\nSubmission to first decision\n\n49 days\n\nSubmission to decision after review\n\n174 days\n\nSubmission to acceptance\n\nAcceptance rate\n\n16%\n\nAcceptance Rate`
          : '# Journal homepage\n\nView all insights\n\nNo timeline values are exposed on this summary page.',
      })
    })
    await openJournalLibrary(page, ui, 'light')
    const modal = await openNewJournalEditor(page)
    const button = modal.getByRole('button', { name: '获取审稿周期' })
    await button.waitFor({ state: 'visible', timeout: 15000 })

    const fieldLabels = await modal.locator('.prep-field > span').allTextContents()
    const apcLabel = fieldLabels.map(text => text.trim()).find(text => text === 'APC') || ''
    if (apcLabel !== 'APC') failures.push(`${ui}/form: APC field label was not normalized`)
    for (const label of ['中文译名', '缩写', '中文简介翻译', '选刊标签', '选刊备注']) {
      if (!fieldLabels.some(text => text.trim() === label)) failures.push(`${ui}/form: missing journal selection field ${label}`)
    }

    const nameField = modal.locator('.prep-field', { hasText: '英文期刊名' }).locator('input').first()
    const websiteField = modal.locator('.prep-field', { hasText: '期刊官网' }).locator('input').first()
    const sourceField = modal.locator('.prep-field', { hasText: '审稿周期来源' }).locator('input').first()
    await nameField.fill('Journal of Rock Mechanics and Geotechnical Engineering')
    await websiteField.fill(journalUrl)
    await sourceField.fill('')

    const layering = await modal.evaluate(element => {
      const overlay = element.parentElement
      const header = document.querySelector('.app-header')
      const overlayRect = overlay?.getBoundingClientRect()
      const headerStyle = header ? getComputedStyle(header) : null
      return {
        overlayClass: overlay?.className || '',
        overlayTop: overlayRect?.top ?? 999,
        overlayBottom: overlayRect?.bottom ?? 0,
        viewportHeight: window.innerHeight,
        overlayZ: overlay ? Number.parseFloat(getComputedStyle(overlay).zIndex) : 0,
        headerVisibility: headerStyle?.visibility || '',
        headerPointerEvents: headerStyle?.pointerEvents || '',
      }
    })
    if (!layering.overlayClass.includes('modal-overlay')) failures.push(`${ui}/form: journal editor is not inside the modal overlay`)
    if (layering.overlayTop > 1 || layering.overlayBottom < layering.viewportHeight - 1) failures.push(`${ui}/form: journal overlay does not cover the full viewport`)
    if (layering.overlayZ < 10000) failures.push(`${ui}/form: journal overlay z-index is too low`)
    if (layering.headerVisibility !== 'hidden' || layering.headerPointerEvents !== 'none') failures.push(`${ui}/form: sticky app header remains interactive above the journal editor`)

    await button.click()
    await page.waitForFunction(() => {
      const modalElement = Array.from(document.querySelectorAll('.journal-form-modal')).find(element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      })
      if (!modalElement) return false
      const byLabel = label => Array.from(modalElement.querySelectorAll('.prep-field')).find(field => field.querySelector(':scope > span')?.textContent?.trim().includes(label))?.querySelector('input')?.value || ''
      return byLabel('首轮决定') === '2'
        && byLabel('总审稿周期') === '174'
        && byLabel('接收率') === '16'
        && byLabel('审稿周期来源').endsWith('/about/insights')
    }, undefined, { timeout: 15000 })

    const buttonCount = await modal.getByRole('button', { name: '获取审稿周期' }).count()
    if (buttonCount !== 1) failures.push(`${ui}/form: review lookup button is duplicated`)
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
