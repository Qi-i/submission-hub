import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const fail = message => failures.push(message)

const svg = (width, height, label) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="black"/><text x="20" y="40" font-size="24">${label}</text></svg>`)

async function openComposer(page) {
  await page.goto(`${baseUrl}?view=preparation&theme=light&ui=luminous`, { waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true'] .preparation-workspace").waitFor({ state: 'visible', timeout: 45000 })
  await page.locator(".preparation-business-rail > button[data-section-key='paper']").click()
  await page.locator(".preparation-workspace[data-section='paper']").waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.prep-figure-tool-entry:visible').first().click()
  await page.locator('.figure-composer').waitFor({ state: 'visible', timeout: 10000 })
}

try {
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } })
  await page.addInitScript(() => localStorage.removeItem('submission-hub.figure-composer.panes'))
  await openComposer(page)

  const identity = await page.locator('.figure-composer__identity').evaluate(element => ({
    name: element.querySelector('h2')?.textContent?.trim() || '',
    description: element.querySelector('p')?.textContent?.trim() || '',
  }))
  const projectName = await page.getByLabel('工程名称').inputValue()
  if (identity.name !== '未命名组图' || projectName !== '未命名组图') fail(`neutral project identity was lost (${identity.name} / ${projectName})`)
  if (/Figure\s*1|Supplementary\s*Figure|论文|manuscript/i.test(`${identity.name} ${projectName}`)) fail('new project is polluted by manuscript/publication identity')
  if (/Figure\s*1|Supplementary\s*Figure/i.test(identity.description)) fail(`default description exposes a generated publication number: ${identity.description}`)

  const fileInput = page.locator('.figure-composer__left input[type="file"]')
  await fileInput.setInputFiles([
    { name: 'panel-a.svg', mimeType: 'image/svg+xml', buffer: svg(640, 400, 'A') },
    { name: 'panel-b.svg', mimeType: 'image/svg+xml', buffer: svg(640, 400, 'B') },
  ])
  await page.locator('.figure-composer__layer').nth(1).waitFor({ state: 'visible', timeout: 10000 })
  if (await page.locator('.figure-composer__layer').count() !== 2) fail('two imported SVGs did not produce two figure layers')

  const layout = page.locator('.figure-composer__global-layout')
  const widthInput = layout.getByLabel('单图宽度')
  const gapInput = layout.getByLabel('图间距')
  await widthInput.fill('320')
  await gapInput.fill('24')
  await page.waitForTimeout(250)

  const layers = page.locator('.figure-composer__layer-main')
  await layers.nth(0).click()
  const inspector = page.locator('.figure-composer__inspector')
  const widthA = Number(await inspector.getByLabel('W').inputValue())
  const xA = Number(await inspector.getByLabel('X').inputValue())
  await layers.nth(1).click()
  const widthB = Number(await inspector.getByLabel('W').inputValue())
  const xB = Number(await inspector.getByLabel('X').inputValue())
  if (Math.abs(widthA - 320) > 1 || Math.abs(widthB - 320) > 1) fail(`global single-panel width did not reflow imported panels (${widthA}, ${widthB})`)
  if (Math.abs((xB - xA) - 344) > 3) fail(`24px gap was not reflected in panel geometry (x delta ${xB - xA}, expected ~344)`)

  const labels = page.locator('.figure-composer__global-labels')
  await labels.getByLabel('标签样式').selectOption('A')
  await labels.getByRole('button', { name: '标签应用到全部' }).click()
  await layers.nth(0).click()
  const panelLabelStyle = await inspector.getByLabel('标签', { exact: true }).inputValue()
  if (panelLabelStyle !== 'A') fail(`global label style did not propagate to panels (${panelLabelStyle})`)

  const left = page.locator('.figure-composer__left')
  const right = page.locator('.figure-composer__right')
  const splitters = page.locator('.figure-composer__splitter')
  const before = {
    left: (await left.boundingBox())?.width || 0,
    right: (await right.boundingBox())?.width || 0,
  }
  const leftSplitter = await splitters.nth(0).boundingBox()
  const rightSplitter = await splitters.nth(1).boundingBox()
  if (!leftSplitter || !rightSplitter) throw new Error('Figure Composer splitters are not measurable')

  await page.mouse.move(leftSplitter.x + leftSplitter.width / 2, leftSplitter.y + 120)
  await page.mouse.down()
  await page.mouse.move(leftSplitter.x + leftSplitter.width / 2 + 54, leftSplitter.y + 120, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(120)

  const movedRightSplitter = await splitters.nth(1).boundingBox()
  if (!movedRightSplitter) throw new Error('right splitter disappeared after left resize')
  await page.mouse.move(movedRightSplitter.x + movedRightSplitter.width / 2, movedRightSplitter.y + 120)
  await page.mouse.down()
  await page.mouse.move(movedRightSplitter.x + movedRightSplitter.width / 2 - 42, movedRightSplitter.y + 120, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(180)

  const after = {
    left: (await left.boundingBox())?.width || 0,
    right: (await right.boundingBox())?.width || 0,
  }
  if (after.left < before.left + 35) fail(`left splitter drag did not resize pane (${before.left} -> ${after.left})`)
  if (after.right < before.right + 25) fail(`right splitter drag did not resize pane (${before.right} -> ${after.right})`)

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('submission-hub.figure-composer.panes') || 'null'))
  if (!stored || Math.abs(stored.left - after.left) > 3 || Math.abs(stored.right - after.right) > 3) fail(`pane widths were not persisted (${JSON.stringify(stored)} vs ${JSON.stringify(after)})`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator("html[data-visual-ready='true'] .preparation-workspace").waitFor({ state: 'visible', timeout: 45000 })
  await page.locator(".preparation-business-rail > button[data-section-key='paper']").click()
  await page.locator('.prep-figure-tool-entry:visible').first().click()
  await page.locator('.figure-composer').waitFor({ state: 'visible', timeout: 10000 })
  const restored = {
    left: Number(await page.locator('.figure-composer__splitter').nth(0).getAttribute('aria-valuenow')),
    right: Number(await page.locator('.figure-composer__splitter').nth(1).getAttribute('aria-valuenow')),
  }
  if (Math.abs(restored.left - stored.left) > 1 || Math.abs(restored.right - stored.right) > 1) fail(`pane widths did not survive reload (${JSON.stringify(restored)} vs ${JSON.stringify(stored)})`)

  console.log(JSON.stringify({ failures, identity, widthA, widthB, xA, xB, before, after, stored, restored }, null, 2))
  await page.close()
} finally {
  await browser.close()
}

if (failures.length) throw new Error(failures.join(' | '))
