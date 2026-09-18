import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const fail = message => failures.push(message)
const svg = (label) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="white"/><text x="20" y="40" font-size="24">${label}</text></svg>`)

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
    localStorage.removeItem('submission-hub.figure-composer.toolbar.v2')
    localStorage.removeItem('submission-hub.figure-composer.toolbar.v3')
    localStorage.removeItem('submission-hub.figure-composer.toolbar.v4')
    localStorage.removeItem('submission-hub.figure-composer.panes')
  })
  await openComposer(page)

  const undo = page.getByTitle('撤销编辑', { exact: true })
  const redo = page.getByTitle('重做编辑', { exact: true })
  if (await undo.count() !== 1) fail('missing Figure Composer undo control')
  if (await redo.count() !== 1) fail('missing Figure Composer redo control')

  const fileInput = page.locator('.figure-composer__left input[type="file"]')
  await fileInput.setInputFiles([
    { name: 'history-a.svg', mimeType: 'image/svg+xml', buffer: svg('A') },
    { name: 'history-b.svg', mimeType: 'image/svg+xml', buffer: svg('B') },
  ])
  await page.locator('.figure-composer__layer').nth(1).waitFor({ state: 'visible', timeout: 10000 })

  if (await undo.count()) {
    if (await undo.isDisabled()) fail('undo stays disabled after importing panels')
    await undo.click()
    await page.waitForTimeout(100)
    if (await page.locator('.figure-composer__layer').count() !== 0) fail('undo did not revert the panel import')
    if (await redo.isDisabled()) fail('redo stays disabled after undo')
    await redo.click()
    await page.locator('.figure-composer__layer').nth(1).waitFor({ state: 'visible', timeout: 5000 })
    if (await page.locator('.figure-composer__layer').count() !== 2) fail('redo did not restore imported panels')
  }

  const layers = page.locator('.figure-composer__layer-main')
  await layers.nth(0).click()
  const inspector = page.locator('.figure-composer__inspector')
  const xInput = inspector.getByRole('spinbutton', { name: 'X', exact: true })
  const originalX = Number(await xInput.inputValue())
  await xInput.fill(String(originalX + 80))
  await page.waitForTimeout(80)
  const movedX = Number(await xInput.inputValue())
  if (Math.abs(movedX - (originalX + 80)) > 1) fail(`panel X edit did not apply (${originalX} -> ${movedX})`)

  await page.locator('.figure-composer__canvas').click({ position: { x: 4, y: 4 } })
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(100)
  await layers.nth(0).click()
  const undoneX = Number(await inspector.getByRole('spinbutton', { name: 'X', exact: true }).inputValue())
  if (Math.abs(undoneX - originalX) > 1) fail(`Ctrl+Z did not restore panel geometry (${movedX} -> ${undoneX}, expected ${originalX})`)

  await page.keyboard.press('Control+Shift+z')
  await page.waitForTimeout(100)
  const redoneX = Number(await inspector.getByRole('spinbutton', { name: 'X', exact: true }).inputValue())
  if (Math.abs(redoneX - movedX) > 1) fail(`Ctrl+Shift+Z did not redo panel geometry (${undoneX} -> ${redoneX}, expected ${movedX})`)

  const save = page.getByRole('button', { name: '保存工程名称', exact: true })
  await save.click()
  await page.locator('.figure-composer__status').filter({ hasText: 'IndexedDB' }).waitFor({ state: 'visible', timeout: 10000 })
  if (Number(await storedAssetCount(page)) !== 2) fail('initial save did not persist both active panel assets')

  await layers.nth(0).click()
  await page.getByTitle('删除选中', { exact: true }).click()
  await page.waitForTimeout(100)
  if (await page.locator('.figure-composer__layer').count() !== 1) fail('delete selected did not remove one panel')
  await save.click()
  await page.waitForTimeout(150)
  const prunedAssetCount = Number(await storedAssetCount(page))
  if (prunedAssetCount !== 1) fail(`saving after deletion retained stale IndexedDB assets (${prunedAssetCount}, expected 1)`)

  await undo.click()
  await page.waitForTimeout(100)
  if (await page.locator('.figure-composer__layer').count() !== 2) fail('undo did not restore a deleted panel and its runtime asset')

  const projectName = page.getByLabel('工程名称', { exact: true })
  await projectName.focus()
  const layerCountBeforeNativeUndo = await page.locator('.figure-composer__layer').count()
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(80)
  const layerCountAfterNativeUndo = await page.locator('.figure-composer__layer').count()
  if (layerCountAfterNativeUndo !== layerCountBeforeNativeUndo) fail('global undo intercepted Ctrl+Z while an input was focused')

  console.log(JSON.stringify({ failures, originalX, movedX, undoneX, redoneX, prunedAssetCount, layerCountBeforeNativeUndo, layerCountAfterNativeUndo }, null, 2))
  await page.close()
} finally {
  await browser.close()
}

if (failures.length) throw new Error(failures.join(' | '))
