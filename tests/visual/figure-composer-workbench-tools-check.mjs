import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const fail = message => failures.push(message)

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
  await page.addInitScript(() => {
    localStorage.removeItem('submission-hub.figure-composer.toolbar')
    localStorage.removeItem('submission-hub.figure-composer.panes')
  })
  await openComposer(page)

  const headerToolbar = page.locator('.figure-composer__header .figure-composer__toolbar')
  if (await headerToolbar.count() !== 1) fail('Figure Composer toolbar is not using the free header workspace')
  if (await page.locator('.figure-composer__center > .figure-composer__toolbar').count()) fail('legacy toolbar still consumes a separate row above the canvas')

  const headerBox = await page.locator('.figure-composer__header').boundingBox()
  if (!headerBox) throw new Error('Figure Composer header is not measurable')
  if (headerBox.height > 96) fail(`workbench header is still too tall (${headerBox.height.toFixed(1)}px)`)

  if (await headerToolbar.count()) {
    const toolbarOverflow = await headerToolbar.evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX,
    }))
    if (toolbarOverflow.scrollWidth > toolbarOverflow.clientWidth + 3) fail(`tool ribbon still requires horizontal scrolling (${toolbarOverflow.scrollWidth} > ${toolbarOverflow.clientWidth})`)
    if (toolbarOverflow.overflowX === 'scroll' || toolbarOverflow.overflowX === 'auto') fail(`tool ribbon still exposes horizontal scrolling (${toolbarOverflow.overflowX})`)
  }

  for (const tool of ['select', 'move', 'pan']) {
    if (await page.locator(`[data-fc-tool-mode="${tool}"]`).count() !== 1) fail(`missing ${tool} interaction tool`)
  }
  for (const title of ['适配画布', '100%', '放大视图', '缩小视图', '删除选中']) {
    if (await page.getByTitle(title, { exact: true }).count() < 1) fail(`missing basic workbench action: ${title}`)
  }

  const coreClusters = ['tools', 'layout', 'arrange', 'view']
  for (const key of coreClusters) {
    const cluster = page.locator(`[data-tool-cluster="${key}"]`)
    if (await cluster.count() !== 1) fail(`missing ${key} tool group`)
    else if ((await cluster.getAttribute('aria-expanded')) !== 'true') fail(`${key} tool group should be visible by default`)
  }

  const viewport = page.locator('.figure-composer__canvas-viewport')
  const canvas = page.locator('.figure-composer__canvas')
  await page.getByTitle('100%', { exact: true }).click()
  await page.waitForTimeout(80)

  let viewportBox = await viewport.boundingBox()
  let canvasBox = await canvas.boundingBox()
  if (!viewportBox || !canvasBox) throw new Error('Figure Composer viewport/canvas is not measurable')
  for (let i = 0; i < 6 && canvasBox.width <= viewportBox.width + 20; i += 1) {
    await page.getByTitle('放大视图', { exact: true }).click()
    await page.waitForTimeout(50)
    viewportBox = await viewport.boundingBox()
    canvasBox = await canvas.boundingBox()
    if (!viewportBox || !canvasBox) throw new Error('zoomed Figure Composer viewport/canvas is not measurable')
  }
  if (canvasBox.width <= viewportBox.width + 20) fail(`manual zoom cannot exceed overview width (${canvasBox.width.toFixed(1)} <= ${viewportBox.width.toFixed(1)})`)

  const zoomedViewport = await viewport.evaluate(element => {
    element.scrollLeft = 0
    element.scrollTop = 0
    return { clientWidth: element.clientWidth, clientHeight: element.clientHeight, scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight }
  })
  await page.waitForTimeout(50)
  const zeroScrollCanvasBox = await canvas.boundingBox()
  const zeroScrollViewportBox = await viewport.boundingBox()
  if (!zeroScrollCanvasBox || !zeroScrollViewportBox) throw new Error('zero-scroll canvas geometry unavailable')
  if (zeroScrollCanvasBox.x < zeroScrollViewportBox.x - 1) fail(`zoomed canvas is clipped to the left by centered overflow (${zeroScrollCanvasBox.x.toFixed(1)} < ${zeroScrollViewportBox.x.toFixed(1)})`)
  if (zoomedViewport.scrollWidth <= zoomedViewport.clientWidth + 20) fail('zoomed canvas does not create a scrollable detail workspace')

  const maxScroll = await viewport.evaluate(element => {
    const max = Math.max(0, element.scrollWidth - element.clientWidth)
    element.scrollLeft = Math.round(max * 0.35)
    return { max, current: element.scrollLeft }
  })
  if (maxScroll.max < 40 || maxScroll.current < 10) fail(`zoomed viewport cannot scroll horizontally (${JSON.stringify(maxScroll)})`)

  await page.locator('[data-fc-tool-mode="pan"]').click()
  const mode = await page.locator('.figure-composer__canvas-viewport').getAttribute('data-interaction-mode')
  if (mode !== 'pan') fail(`pan tool did not switch canvas mode (${mode || 'missing'})`)
  const panCanvasBox = await canvas.boundingBox()
  if (!panCanvasBox) throw new Error('pan canvas geometry unavailable')
  const beforePan = await viewport.evaluate(element => element.scrollLeft)
  const startX = Math.min(panCanvasBox.x + panCanvasBox.width - 80, Math.max(panCanvasBox.x + 80, zeroScrollViewportBox.x + zeroScrollViewportBox.width * 0.65))
  const startY = Math.min(panCanvasBox.y + panCanvasBox.height - 80, Math.max(panCanvasBox.y + 80, zeroScrollViewportBox.y + zeroScrollViewportBox.height * 0.5))
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX - 120, startY, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(80)
  const afterPan = await viewport.evaluate(element => element.scrollLeft)
  if (afterPan <= beforePan + 30) fail(`pan tool did not move the zoomed viewport (${beforePan} -> ${afterPan})`)

  await page.locator('[data-fc-tool-mode="select"]').click()
  if ((await viewport.getAttribute('data-interaction-mode')) !== 'select') fail('select tool did not restore selection mode')

  const sectionMetrics = await page.locator('.figure-composer__left > .figure-composer__section').first().evaluate(element => {
    const style = getComputedStyle(element)
    const button = element.querySelector('button')
    return {
      paddingTop: parseFloat(style.paddingTop) || 0,
      paddingBottom: parseFloat(style.paddingBottom) || 0,
      buttonHeight: button instanceof HTMLElement ? button.getBoundingClientRect().height : 0,
    }
  })
  if (sectionMetrics.paddingTop > 9 || sectionMetrics.paddingBottom > 9) fail(`side rail sections remain too loose (${sectionMetrics.paddingTop}/${sectionMetrics.paddingBottom}px)`)
  if (sectionMetrics.buttonHeight > 34) fail(`side rail primary control remains unnecessarily tall (${sectionMetrics.buttonHeight}px)`)

  console.log(JSON.stringify({ failures, headerBox, zoomedViewport, maxScroll, beforePan, afterPan, sectionMetrics }, null, 2))
  await page.close()
} finally {
  await browser.close()
}

if (failures.length) throw new Error(failures.join(' | '))
