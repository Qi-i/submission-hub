import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []
await mkdir('visual-review', { recursive: true })
const errorMessage = error => error instanceof Error ? error.message : String(error)
const closeEnough = (a, b, tolerance = 1.5) => Math.abs(a - b) <= tolerance

async function openJournalCenter(page, ui, theme) {
  await page.goto(`${baseUrl}?view=preparation&theme=${theme}&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true']").waitFor({ state: 'attached', timeout: 45000 })
  const entry = page.locator("button[data-main-nav-key='journals']:visible").first()
  await entry.waitFor({ state: 'visible', timeout: 15000 })
  await entry.click()
  await page.locator('.journal-center-workspace:visible .journal-center-grid:visible').waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(220)
}

async function readSubmissionReference(page, ui, theme) {
  await page.goto(`${baseUrl}?view=dashboard&theme=${theme}&ui=${ui}`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true'] .paper-grid .paper-card-v3").first().waitFor({ state: 'visible', timeout: 45000 })
  return page.evaluate(() => {
    const grid = document.querySelector('.paper-grid')
    const card = document.querySelector('.paper-grid .paper-card-v3')
    const status = card?.querySelector('.paper-status-area > .badge')
    const title = card?.querySelector('.card-title')
    if (!grid || !card || !status || !title) return null
    const cardStyle = getComputedStyle(card)
    const statusStyle = getComputedStyle(status)
    const titleStyle = getComputedStyle(title)
    const accentStyle = getComputedStyle(card, '::before')
    return {
      gridWidth: grid.getBoundingClientRect().width,
      radius: parseFloat(cardStyle.borderRadius),
      statusHeight: status.getBoundingClientRect().height,
      statusRadius: parseFloat(statusStyle.borderRadius),
      titleFontSize: parseFloat(titleStyle.fontSize),
      accentHeight: parseFloat(accentStyle.height),
    }
  })
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
    const reference = await readSubmissionReference(page, ui, theme)
    if (!reference) {
      failures.push(`${ui}/${theme}: submission-management reference card is missing`)
      return
    }

    await openJournalCenter(page, ui, theme)
    const result = await page.evaluate(referenceStyle => {
      const visible = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }
      const grid = document.querySelector('.journal-center-workspace .journal-center-grid')
      const workspace = document.querySelector('.journal-center-workspace')
      const cards = grid ? Array.from(grid.querySelectorAll('.journal-center-card')) : []
      if (!grid || !workspace || !cards.length) return { failures: ['Journal Center fixture is incomplete'], details: {} }

      const localFailures = []
      const gridStyle = getComputedStyle(grid)
      const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean)
      const gridRect = grid.getBoundingClientRect()
      const workspaceRect = workspace.getBoundingClientRect()
      const cardRects = cards.map(card => card.getBoundingClientRect())

      if (columns.length < 3) localFailures.push(`Journal Center exposes only ${columns.length} desktop columns`)
      if (parseFloat(gridStyle.columnGap) > 14) localFailures.push('Journal Center grid gap is looser than submission management')
      if (!gridStyle.gridAutoRows.includes('max-content')) localFailures.push(`Journal Center grid rows are not content-sized (${gridStyle.gridAutoRows})`)
      if (gridStyle.alignItems !== 'start') localFailures.push(`Journal Center grid items stretch vertically (${gridStyle.alignItems})`)
      if (Math.abs(workspaceRect.width - referenceStyle.gridWidth) > 3) localFailures.push(`Journal Center page lane differs from submission management (${Math.round(workspaceRect.width)} vs ${Math.round(referenceStyle.gridWidth)}px)`)
      if (Math.min(...cardRects.map(rect => rect.width)) < 400) localFailures.push('Journal Center cards are still undersized')
      if (Math.max(...cardRects.map(rect => rect.width)) > 540) localFailures.push('Journal Center cards are too wide')
      if (Math.max(...cardRects.map(rect => rect.height)) > 460) localFailures.push('Journal Center cards are excessively tall')

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect()
        const body = card.querySelector('.journal-catalog-card__main')
        const status = card.querySelector('.journal-catalog-card__status')
        const substatus = card.querySelector('.journal-catalog-card__substatus')
        const title = card.querySelector('.journal-catalog-card__title-block > h3')
        const subtitle = card.querySelector('.journal-catalog-card__subtitle')
        const facts = Array.from(card.querySelectorAll('.prep-journal-facts > span'))
        const links = card.querySelector('.journal-catalog-card__footer')
        if (!body || !status || !substatus || !title || !subtitle) {
          localFailures.push(`journal ${index + 1}: submission-style hierarchy is incomplete`)
          return
        }

        const cardStyle = getComputedStyle(card)
        const bodyStyle = getComputedStyle(body)
        const statusStyle = getComputedStyle(status)
        const titleStyle = getComputedStyle(title)
        const subtitleStyle = getComputedStyle(subtitle)
        const accentStyle = getComputedStyle(card, '::before')

        if (!closeEnough(parseFloat(cardStyle.borderRadius), referenceStyle.radius, 1.5)) localFailures.push(`journal ${index + 1}: card radius diverges from submission cards`)
        if (!closeEnough(status.getBoundingClientRect().height, referenceStyle.statusHeight, 1.5)) localFailures.push(`journal ${index + 1}: primary state block height diverges from submission cards`)
        if (!closeEnough(parseFloat(statusStyle.borderRadius), referenceStyle.statusRadius, 2)) localFailures.push(`journal ${index + 1}: primary state radius diverges from submission cards`)
        if (!closeEnough(parseFloat(titleStyle.fontSize), referenceStyle.titleFontSize, 1.5)) localFailures.push(`journal ${index + 1}: title scale diverges from submission cards`)
        if (!closeEnough(parseFloat(accentStyle.height), referenceStyle.accentHeight, 1)) localFailures.push(`journal ${index + 1}: semantic accent line diverges from submission cards`)
        if (parseFloat(bodyStyle.paddingLeft) < 13 || parseFloat(bodyStyle.paddingLeft) > 22) localFailures.push(`journal ${index + 1}: body padding is not in the submission-card range`)
        if (parseFloat(subtitleStyle.borderLeftWidth) < 2) localFailures.push(`journal ${index + 1}: secondary identity lacks the submission-style accent rule`)
        if (rect.right > gridRect.right + 1.5 || rect.left < gridRect.left - 1.5) localFailures.push(`journal ${index + 1}: card exceeds grid edges`)
        if (card.scrollWidth > card.clientWidth + 2) localFailures.push(`journal ${index + 1}: horizontal overflow`)
        if (cardStyle.alignSelf !== 'start') localFailures.push(`journal ${index + 1}: card still stretches within its grid row`)
        if (parseFloat(bodyStyle.flexGrow) !== 0) localFailures.push(`journal ${index + 1}: card body consumes artificial vertical space`)

        const lineHeight = parseFloat(titleStyle.lineHeight)
        if (Number.isFinite(lineHeight) && title.scrollHeight > lineHeight * 2.5) localFailures.push(`journal ${index + 1}: title exceeds two readable lines`)

        const anchors = links ? Array.from(links.querySelectorAll('a')).filter(visible) : []
        if (anchors.length) {
          const linksStyle = getComputedStyle(links)
          if (linksStyle.flexWrap !== 'wrap') localFailures.push(`journal ${index + 1}: footer links do not wrap`)
          if (parseFloat(linksStyle.flexGrow) !== 0) localFailures.push(`journal ${index + 1}: footer still stretches into a fixed slot`)
          const keys = anchors.map(link => {
            const url = new URL(link.href)
            url.hash = ''
            return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}`.toLowerCase()
          })
          if (new Set(keys).size !== keys.length) localFailures.push(`journal ${index + 1}: duplicate links remain visible`)
        }

        for (const [groupName, group] of [
          ['ranks', card.querySelector('.prep-journal-rank-blocks')],
          ['facts', card.querySelector('.prep-journal-facts')],
          ['metrics', card.querySelector('.prep-journal-numbers')],
        ]) {
          if (!group || !visible(group)) continue
          const style = getComputedStyle(group)
          if (style.display !== 'flex' || style.flexWrap !== 'wrap') localFailures.push(`journal ${index + 1}: ${groupName} are not content-driven flex-wrap`)
        }

        const metrics = Array.from(card.querySelectorAll('.prep-journal-numbers > div')).filter(visible)
        metrics.forEach((metric, metricIndex) => {
          const value = metric.querySelector('b')?.textContent?.trim() || ''
          if (!value || ['—', '--', '-', '–'].includes(value)) localFailures.push(`journal ${index + 1}: empty metric ${metricIndex + 1} remains visible`)
        })
        facts.forEach((fact, factIndex) => {
          if (visible(fact) && fact.getBoundingClientRect().height > 34) localFailures.push(`journal ${index + 1}: fact ${factIndex + 1} is too tall`)
        })
      })

      const coloredChips = Array.from(grid.querySelectorAll('.prep-journal-rank-blocks > span, .prep-journal-facts > span')).filter(visible)
      if (!coloredChips.length) localFailures.push('Journal Center has no visible rank/fact color blocks')
      else if (!coloredChips.some(chip => !['transparent', 'rgba(0, 0, 0, 0)'].includes(getComputedStyle(chip).backgroundColor))) localFailures.push('Journal Center rank/fact blocks lost their colored surfaces')

      return {
        failures: localFailures,
        details: {
          columns: columns.length,
          workspaceWidth: Math.round(workspaceRect.width),
          referenceWidth: Math.round(referenceStyle.gridWidth),
          minWidth: Math.round(Math.min(...cardRects.map(rect => rect.width))),
          maxWidth: Math.round(Math.max(...cardRects.map(rect => rect.width))),
          maxHeight: Math.round(Math.max(...cardRects.map(rect => rect.height))),
          cards: cards.length,
        },
      }
    }, reference)

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
        const links = card.querySelector('.journal-catalog-card__footer')
        if (links && getComputedStyle(links).flexWrap !== 'wrap') localFailures.push(`journal ${index + 1}: mobile links do not wrap`)
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
