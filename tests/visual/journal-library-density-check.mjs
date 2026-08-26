import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []
await mkdir('visual-review', { recursive: true })
const errorMessage = error => error instanceof Error ? error.message : String(error)

async function openJournalCenter(page, ui, theme) {
  await page.goto(`${baseUrl}?view=preparation&theme=${theme}&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
  const entry = page.locator("button[data-main-nav-key='journals']:visible").first()
  await entry.waitFor({ state: 'visible', timeout: 15000 })
  await entry.click()
  await page.locator('.journal-center-workspace:visible .journal-center-grid:visible').waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(220)
}

async function openNewJournalEditor(page) {
  const button = page.locator('.journal-center-toolbar__actions > button.primary:visible').first()
  await button.waitFor({ state: 'visible', timeout: 10000 })
  await button.click()
  const modal = page.locator('.journal-form-modal:visible').first()
  await modal.waitFor({ state: 'visible', timeout: 5000 })
  return modal
}

async function inspectDesktop(ui, theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await openJournalCenter(page, ui, theme)
    const result = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const grid = document.querySelector('.journal-center-workspace .journal-center-grid')
      const cards = grid ? Array.from(grid.querySelectorAll('.journal-center-card')) : []
      if (!grid || !cards.length) return { failures: ['Journal Center fixture is incomplete'], details: {} }
      const localFailures = []
      const gridStyle = getComputedStyle(grid)
      const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean)
      const gridRect = grid.getBoundingClientRect()
      const cardRects = cards.map(card => card.getBoundingClientRect())
      const footerHeights = []
      if (columns.length < 3) localFailures.push(`desktop Journal Center exposes only ${columns.length} columns`)
      if (parseFloat(gridStyle.columnGap) > 12) localFailures.push('desktop Journal Center grid gap is too large')
      if (Math.max(...cardRects.map(rect => rect.width)) > 390) localFailures.push('Journal Center cards are too wide')
      if (Math.max(...cardRects.map(rect => rect.height)) > 340) localFailures.push('Journal Center cards are too tall')

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect()
        const body = card.querySelector('.journal-center-card__body')
        const title = card.querySelector('.journal-center-card__body h2')
        const facts = Array.from(card.querySelectorAll('.journal-center-card__facts > span'))
        const links = card.querySelector('.journal-center-card__links')
        if (!body || !title || !links) {
          localFailures.push(`journal ${index + 1}: independent card structure is incomplete`)
          return
        }
        const bodyStyle = getComputedStyle(body)
        const titleStyle = getComputedStyle(title)
        if (parseFloat(bodyStyle.paddingLeft) > 12 || parseFloat(bodyStyle.paddingTop) > 12) localFailures.push(`journal ${index + 1}: body padding is oversized`)
        if (String(titleStyle.webkitLineClamp) !== '2') localFailures.push(`journal ${index + 1}: title is not limited to two lines`)
        if (rect.right > gridRect.right + 1.5 || rect.left < gridRect.left - 1.5) localFailures.push(`journal ${index + 1}: card exceeds grid edges`)
        if (card.scrollWidth > card.clientWidth + 2) localFailures.push(`journal ${index + 1}: horizontal overflow`)

        const anchors = Array.from(links.querySelectorAll('a')).filter(visible)
        if (anchors.length) {
          const linksRect = links.getBoundingClientRect()
          footerHeights.push(linksRect.height)
          if (linksRect.height < 34 || linksRect.height > 40) localFailures.push(`journal ${index + 1}: links footer is not a compact fixed rail`)
          if (Math.abs(rect.bottom - linksRect.bottom) > 1.5) localFailures.push(`journal ${index + 1}: links footer is not bottom anchored`)
          const keys = anchors.map(link => {
            const url = new URL(link.href)
            url.hash = ''
            return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}`.toLowerCase()
          })
          if (new Set(keys).size !== keys.length) localFailures.push(`journal ${index + 1}: duplicate links remain visible`)
        }

        const metrics = Array.from(card.querySelectorAll('.journal-center-card__metrics > span')).filter(visible)
        metrics.forEach((metric, metricIndex) => {
          const value = metric.querySelector('b')?.textContent?.trim() || ''
          if (!value || ['—', '--', '-', '–'].includes(value)) localFailures.push(`journal ${index + 1}: empty metric ${metricIndex + 1} remains visible`)
        })
        Array.from(card.querySelectorAll('.journal-center-ranks > span')).forEach((chip, rankIndex) => {
          if (chip.scrollWidth > chip.clientWidth + 2) localFailures.push(`journal ${index + 1}: rank chip ${rankIndex + 1} is clipped`)
        })
        facts.forEach((fact, factIndex) => {
          if (visible(fact) && fact.getBoundingClientRect().height > 29) localFailures.push(`journal ${index + 1}: fact ${factIndex + 1} is too tall`)
        })
      })
      if (footerHeights.length > 1 && Math.max(...footerHeights) - Math.min(...footerHeights) > 1) localFailures.push('Journal Center link footers do not share one height')
      return { failures: localFailures, details: { columns: columns.length, gap: gridStyle.columnGap, maxWidth: Math.round(Math.max(...cardRects.map(rect => rect.width))), maxHeight: Math.round(Math.max(...cardRects.map(rect => rect.height))), visibleFooters: footerHeights.length, cards: cards.length } }
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
    await openJournalCenter(page, ui, 'light')
    const result = await page.evaluate(() => {
      const grid = document.querySelector('.journal-center-workspace .journal-center-grid')
      const cards = grid ? Array.from(grid.querySelectorAll('.journal-center-card')) : []
      if (!grid || !cards.length) return ['mobile Journal Center fixture is incomplete']
      const localFailures = []
      if (getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length !== 1) localFailures.push('mobile Journal Center is not single-column')
      cards.forEach((card, index) => {
        if (card.scrollWidth > card.clientWidth + 2) localFailures.push(`journal ${index + 1}: mobile horizontal overflow`)
        const links = card.querySelector('.journal-center-card__links')
        if (links && Math.abs(card.getBoundingClientRect().bottom - links.getBoundingClientRect().bottom) > 1.5) localFailures.push(`journal ${index + 1}: mobile links footer is not bottom anchored`)
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
      await route.fulfill({ status: 200, contentType: 'text/plain', body: isInsights ? '# Journal Insights\n\n2 days\n\nSubmission to first decision\n\n174 days\n\nSubmission to acceptance\n\n16%\n\nAcceptance Rate' : '# Journal homepage\n\nView all insights' })
    })
    await openJournalCenter(page, ui, 'light')
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
    for (const field of requiredFields) if (!fieldLabels.some(field.matches)) failures.push(`${ui}/form: missing field ${field.name}`)
    await modal.locator('.prep-field', { hasText: '英文期刊名' }).locator('input').first().fill('Journal of Rock Mechanics and Geotechnical Engineering')
    await modal.locator('.prep-field', { hasText: '期刊官网' }).locator('input').first().fill(journalUrl)
    await modal.locator('.prep-field', { hasText: '审稿周期来源' }).locator('input').first().fill('')

    const layering = await modal.evaluate(element => {
      const overlay = element.parentElement
      const header = document.querySelector('.app-header')
      const headerStyle = header ? getComputedStyle(header) : null
      return { overlayClass: overlay?.className || '', overlayRect: overlay?.getBoundingClientRect().toJSON(), viewportHeight: window.innerHeight, overlayZ: overlay ? parseFloat(getComputedStyle(overlay).zIndex) : 0, headerVisibility: headerStyle?.visibility || '', headerPointerEvents: headerStyle?.pointerEvents || '' }
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
