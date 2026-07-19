import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = {}

const closeEnough = (left, right, tolerance = 1.5) => Math.abs(left - right) <= tolerance

async function inspectPreparation(ui, theme) {
  const name = `${ui}-${theme}`
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto(`${baseUrl}?view=preparation&theme=${theme}&ui=${ui}`)
  await page.locator("html[data-visual-ready='true'] .preparation-workspace").waitFor({ state: 'visible', timeout: 45000 })
  await page.locator('.prep-draft-card.compact').first().waitFor({ state: 'visible' })
  await page.locator('.prep-journal-overview-card').first().waitFor({ state: 'visible' })
  await page.waitForTimeout(350)

  const geometry = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON() || null
    const rects = selector => Array.from(document.querySelectorAll(selector)).map(element => element.getBoundingClientRect().toJSON())
    const styles = selector => {
      const element = document.querySelector(selector)
      if (!element) return null
      const style = getComputedStyle(element)
      return {
        borderRadius: style.borderRadius,
        background: style.backgroundColor,
        boxShadow: style.boxShadow,
        borderColor: style.borderColor,
      }
    }
    const switcher = document.querySelector('.ui-mode-switcher')
    const switchRect = switcher?.getBoundingClientRect().toJSON() || null
    return {
      ui: document.documentElement.dataset.ui,
      draftPanel: rect('.prep-overview-drafts'),
      journalPanel: rect('.prep-overview-journals'),
      draftCards: rects('.prep-overview-draft-list .prep-draft-card.compact'),
      journalCards: rects('.prep-overview-journal-list .prep-journal-overview-card'),
      draftStyle: styles('.prep-overview-draft-list .prep-draft-card.compact'),
      journalStyle: styles('.prep-overview-journal-list .prep-journal-overview-card'),
      switchRect,
      switchVisibleWidth: switchRect ? window.innerWidth - switchRect.left : null,
      cardMaterial: getComputedStyle(document.documentElement).getPropertyValue('--coh-card-bg').trim(),
    }
  })

  if (geometry.ui !== ui) failures.push(`${name}: wrong UI mode ${geometry.ui}`)
  if (!geometry.draftPanel || !geometry.journalPanel) failures.push(`${name}: overview panels are missing`)
  else if (!closeEnough(geometry.draftPanel.height, geometry.journalPanel.height)) {
    failures.push(`${name}: 草稿推进 and 收藏期刊 panels are not equal height (${geometry.draftPanel.height}/${geometry.journalPanel.height})`)
  }

  if (!geometry.draftCards.length || !geometry.journalCards.length) failures.push(`${name}: overview records are missing`)
  else {
    const allHeights = [...geometry.draftCards, ...geometry.journalCards].map(item => item.height)
    if (Math.max(...allHeights) - Math.min(...allHeights) > 1.5) {
      failures.push(`${name}: overview record cards do not share one height (${allHeights.join(', ')})`)
    }
    if (geometry.draftCards.length < 3) failures.push(`${name}: 草稿推进 does not expose at least three records`)
    if (geometry.journalCards.length < 2) failures.push(`${name}: 收藏期刊 does not expose multiple records`)
  }

  if (!geometry.draftStyle || !geometry.journalStyle) failures.push(`${name}: overview card styles are missing`)
  else {
    if (geometry.draftStyle.borderRadius !== geometry.journalStyle.borderRadius) failures.push(`${name}: draft and journal cards use different radii`)
    if (geometry.draftStyle.background !== geometry.journalStyle.background) failures.push(`${name}: draft and journal cards use different surface materials`)
    if (geometry.draftStyle.boxShadow === 'none' || geometry.journalStyle.boxShadow === 'none') failures.push(`${name}: overview cards lack the shared elevation treatment`)
  }

  if (!geometry.switchRect) failures.push(`${name}: UI switcher is missing`)
  else if (geometry.switchVisibleWidth > 48) failures.push(`${name}: idle UI switcher is not tucked against the edge (${geometry.switchVisibleWidth}px visible)`)

  const switcher = page.locator('.ui-mode-switcher')
  const beforeHover = await switcher.boundingBox()
  await switcher.hover()
  await page.waitForTimeout(240)
  const afterHover = await switcher.boundingBox()
  const labelOpacity = await page.locator('.ui-mode-switcher-label').evaluate(element => Number.parseFloat(getComputedStyle(element).opacity))
  if (!beforeHover || !afterHover || afterHover.x >= beforeHover.x - 25) failures.push(`${name}: UI switcher does not expand on hover`)
  if (labelOpacity < 0.8) failures.push(`${name}: expanded UI switcher label remains hidden`)

  await page.locator('.prep-overview-draft-list .prep-draft-card.compact .prep-draft-main').first().click()
  const overlay = page.locator('.modal-overlay')
  await overlay.waitFor({ state: 'visible', timeout: 10000 })
  const modalLayer = await page.evaluate(() => {
    const overlay = document.querySelector('.modal-overlay')
    const modal = overlay?.querySelector('.modal')
    const controls = [document.querySelector('.app-header'), document.querySelector('.lx-status-bar'), document.querySelector('.prep-topbar')].filter(Boolean)
    const controlZ = controls.map(element => Number.parseInt(getComputedStyle(element).zIndex, 10) || 0)
    return {
      overlayZ: overlay ? Number.parseInt(getComputedStyle(overlay).zIndex, 10) || 0 : 0,
      maxControlZ: Math.max(0, ...controlZ),
      modalRect: modal?.getBoundingClientRect().toJSON() || null,
      switchOpacity: Number.parseFloat(getComputedStyle(document.querySelector('.ui-mode-switcher')).opacity),
    }
  })
  if (modalLayer.overlayZ <= modalLayer.maxControlZ) failures.push(`${name}: editor overlay is below a floating page menu`)
  if (!modalLayer.modalRect || modalLayer.modalRect.top < -1 || modalLayer.modalRect.bottom > 1001) failures.push(`${name}: editor modal escapes the viewport`)
  if (modalLayer.switchOpacity > 0.05) failures.push(`${name}: edge UI switch remains visible above an open editor`)

  details[name] = { geometry, modalLayer }
  await page.close()
}

try {
  await inspectPreparation('luminous', 'light')
  await inspectPreparation('luminous', 'dark')
  await inspectPreparation('luminous-x', 'light')
  await inspectPreparation('luminous-x', 'dark')

  if (details['luminous-light']?.geometry.cardMaterial === details['luminous-x-light']?.geometry.cardMaterial) {
    failures.push('Luminous and Luminous X no longer retain distinct surface materials')
  }

  console.log(JSON.stringify({ failures, details }, null, 2))
  if (failures.length) throw new Error(failures.join(' | '))
} finally {
  await browser.close()
}
