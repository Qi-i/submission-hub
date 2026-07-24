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

  if (ui === 'luminous-x') {
    const proxyButton = page.locator(".lx-status-bar[data-page='preparation'] .lx-page-proxy-controls").getByRole('button', { name: /期刊库/ }).first()
    if (await proxyButton.isVisible()) {
      await proxyButton.click({ force: true })
    } else {
      const fallbackButton = page.locator(".preparation-workspace:visible .prep-nav button[data-tone='journal']:visible").first()
      await fallbackButton.waitFor({ state: 'visible', timeout: 15000 })
      await fallbackButton.click({ force: true })
    }
  } else {
    const journalButton = page.locator(".preparation-workspace:visible .prep-nav button[data-tone='journal']:visible").first()
    await journalButton.waitFor({ state: 'visible', timeout: 15000 })
    await journalButton.click({ force: true })
  }

  const grid = page.locator('.preparation-workspace[data-section="journals"]:visible .journal-grid:visible').first()
  await grid.waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(180)
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

      if (columns.length < 3) localFailures.push(`desktop journal library exposes only ${columns.length} grid columns`)
      if (Number.parseFloat(gridStyle.columnGap) > 12) localFailures.push('desktop journal grid gap is too large')
      if (maxWidth > 390) localFailures.push(`journal cards are still too wide (${Math.round(maxWidth)}px)`)
      if (maxHeight > 285) localFailures.push(`journal cards are still too tall (${Math.round(maxHeight)}px)`)

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
        if (Number.parseFloat(mainStyle.paddingLeft) > 12 || Number.parseFloat(mainStyle.paddingTop) > 12) {
          localFailures.push(`journal ${index + 1}: main padding remains oversized`)
        }
        if (lineHeight && titleRect.height > lineHeight * 2 + 2) localFailures.push(`journal ${index + 1}: title exceeds two lines`)
        if (linksRect.height > 36) localFailures.push(`journal ${index + 1}: links footer is too tall`)
        if (rect.right > gridRect.right + 1.5 || rect.left < gridRect.left - 1.5) localFailures.push(`journal ${index + 1}: card exceeds grid edges`)
        if (card.scrollWidth > card.clientWidth + 2) localFailures.push(`journal ${index + 1}: horizontal overflow`)
        facts.forEach((fact, factIndex) => {
          if (fact.getBoundingClientRect().height > 25) localFailures.push(`journal ${index + 1}: fact ${factIndex + 1} is too tall`)
        })
      })

      return {
        failures: localFailures,
        details: {
          columns: columns.length,
          gap: gridStyle.columnGap,
          maxWidth: Math.round(maxWidth),
          maxHeight: Math.round(maxHeight),
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

try {
  for (const ui of ['luminous', 'luminous-x']) {
    for (const theme of ['light', 'dark']) await inspectDesktop(ui, theme)
    await inspectMobile(ui)
  }
  console.log(JSON.stringify({ failures, details }, null, 2))
  if (failures.length) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}
