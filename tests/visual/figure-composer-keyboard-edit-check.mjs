import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const fail = message => failures.push(message)
const svg = label => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="white"/><text x="20" y="40" font-size="24">${label}</text></svg>`)

async function openComposer(page) {
  await page.goto(`${baseUrl}?view=preparation&theme=light&ui=luminous`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true'] .preparation-workspace").waitFor({ state: 'visible', timeout: 45000 })
  await page.locator(".preparation-business-rail > button[data-section-key='paper']").click()
  await page.locator('.prep-figure-tool-entry:visible').first().click()
  await page.locator('.figure-composer').waitFor({ state: 'visible', timeout: 10000 })
}

async function storedAssetCount(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('submission-hub-figure-composer')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('assets', 'readonly')
      const count = transaction.objectStore('assets').count()
      count.onsuccess = () => { resolve(count.result); db.close() }
      count.onerror = () => { reject(count.error); db.close() }
    }
  }))
}

try {
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } })
  await page.addInitScript(() => {
    localStorage.removeItem('submission-hub.figure-composer.toolbar.v3')
    localStorage.removeItem('submission-hub.figure-composer.panes')
  })
  await openComposer(page)

  const fileInput = page.locator('.figure-composer__left input[type="file"]')
  await fileInput.setInputFiles({ name: 'keyboard-a.svg', mimeType: 'image/svg+xml', buffer: svg('A') })
  await page.locator('.figure-composer__layer').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.figure-composer__layer-main').click()

  const inspector = page.locator('.figure-composer__inspector')
  const xInput = inspector.getByRole('spinbutton', { name: 'X', exact: true })
  const yInput = inspector.getByRole('spinbutton', { name: 'Y', exact: true })
  const originalX = Number(await xInput.inputValue())
  const originalY = Number(await yInput.inputValue())

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(80)
  const nudgedX = Number(await xInput.inputValue())
  if (Math.abs(nudgedX - (originalX + 1)) > 0.1) fail(`ArrowRight did not nudge selected panel by 1 logical px (${originalX} -> ${nudgedX})`)

  await page.keyboard.press('Shift+ArrowDown')
  await page.waitForTimeout(80)
  const nudgedY = Number(await yInput.inputValue())
  if (Math.abs(nudgedY - (originalY + 10)) > 0.1) fail(`Shift+ArrowDown did not nudge selected panel by 10 logical px (${originalY} -> ${nudgedY})`)

  await page.keyboard.press('Control+d')
  await page.waitForTimeout(100)
  const duplicatedCount = await page.locator('.figure-composer__layer').count()
  if (duplicatedCount !== 2) fail(`Ctrl+D did not duplicate the selected panel (${duplicatedCount}, expected 2)`)

  if (duplicatedCount === 2) {
    const duplicatedX = Number(await inspector.getByRole('spinbutton', { name: 'X', exact: true }).inputValue())
    const duplicatedY = Number(await inspector.getByRole('spinbutton', { name: 'Y', exact: true }).inputValue())
    if (Math.abs(duplicatedX - (nudgedX + 12)) > 0.1 || Math.abs(duplicatedY - (nudgedY + 12)) > 0.1) {
      fail(`duplicated panel did not receive the expected 12 px offset (${duplicatedX}, ${duplicatedY})`)
    }
  }

  const save = page.getByRole('button', { name: /保存本地草稿/ }).first()
  await save.click()
  await page.locator('.figure-composer__status').filter({ hasText: 'IndexedDB' }).waitFor({ state: 'visible', timeout: 10000 })
  const assetCount = Number(await storedAssetCount(page))
  if (assetCount !== 1) fail(`duplicating one panel copied its Blob instead of reusing the asset (${assetCount}, expected 1)`)

  await page.keyboard.press('Delete')
  await page.waitForTimeout(100)
  const afterDelete = await page.locator('.figure-composer__layer').count()
  if (afterDelete !== 1) fail(`Delete did not remove the selected duplicated panel (${afterDelete}, expected 1)`)

  await page.keyboard.press('Control+z')
  await page.waitForTimeout(100)
  const afterUndo = await page.locator('.figure-composer__layer').count()
  if (afterUndo !== 2) fail(`Ctrl+Z did not restore the keyboard-deleted panel (${afterUndo}, expected 2)`)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(80)
  const selectionText = await page.locator('.figure-composer__selection-count').innerText()
  if (!selectionText.includes('未选择')) fail(`Escape did not clear panel selection (${selectionText})`)

  await page.locator('.figure-composer__layer-main').first().click()
  const xBeforeInputKey = Number(await inspector.getByRole('spinbutton', { name: 'X', exact: true }).inputValue())
  const projectName = page.getByLabel('工程名称')
  await projectName.focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(80)
  const xAfterInputKey = Number(await inspector.getByRole('spinbutton', { name: 'X', exact: true }).inputValue())
  if (Math.abs(xAfterInputKey - xBeforeInputKey) > 0.1) fail('global arrow-key nudge intercepted an editable input target')

  console.log(JSON.stringify({ failures, originalX, originalY, nudgedX, nudgedY, duplicatedCount, assetCount, afterDelete, afterUndo, selectionText, xBeforeInputKey, xAfterInputKey }, null, 2))
  await page.close()
} finally {
  await browser.close()
}

if (failures.length) throw new Error(failures.join(' | '))
