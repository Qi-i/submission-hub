import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const fail = message => failures.push(message)
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="white"/><rect x="8" y="8" width="624" height="384" fill="none" stroke="black"/></svg>')

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
    localStorage.removeItem('submission-hub.figure-composer.toolbar.v2')
    localStorage.removeItem('submission-hub.figure-composer.toolbar.v3')
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

  const visibleByDefault = ['tools', 'edit', 'selection', 'layout', 'view']
  for (const key of visibleByDefault) {
    const cluster = page.locator(`[data-tool-cluster="${key}"]`)
    if (await cluster.count() !== 1) fail(`missing ${key} tool group`)
    else if ((await cluster.getAttribute('aria-expanded')) !== 'true') fail(`${key} tool group should be visible by default`)
  }
  const alignCluster = page.locator('[data-tool-cluster="align"]')
  if (await alignCluster.count() !== 1) fail('missing align tool group')
  else if ((await alignCluster.getAttribute('aria-expanded')) !== 'false') fail('dense alignment group should stay collapsible by default')

  const clusterGeometry = await page.locator('.figure-composer__tool-cluster[aria-expanded="true"]').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element)
    const head = element.querySelector('.figure-composer__tool-cluster-head')
    const body = element.querySelector('.figure-composer__tool-cluster-body')
    return {
      key: element.getAttribute('data-tool-cluster'),
      height: element.getBoundingClientRect().height,
      direction: style.flexDirection,
      headHeight: head instanceof HTMLElement ? head.getBoundingClientRect().height : 0,
      bodyHeight: body instanceof HTMLElement ? body.getBoundingClientRect().height : 0,
      bodyWrap: body instanceof HTMLElement ? getComputedStyle(body).flexWrap : '',
    }
  }))
  for (const item of clusterGeometry) {
    if (item.direction !== 'column') fail(`${item.key} tool group is still a side-label strip instead of a compact ribbon block`)
    if (item.height > 48) fail(`${item.key} tool group is too tall (${item.height}px)`)
    if (item.headHeight > 16) fail(`${item.key} tool group heading wastes vertical space (${item.headHeight}px)`)
    if (item.bodyWrap !== 'nowrap') fail(`${item.key} tool group wraps controls (${item.bodyWrap})`)
  }

  const importButton = page.locator('.figure-composer__import')
  const importText = (await importButton.innerText()).trim().replace(/\s+/g, ' ')
  if (importText !== '导入图片') fail(`import control still expands file formats in the visible label (${importText})`)
  const importTitle = await importButton.getAttribute('title')
  if (!importTitle || !/PNG/i.test(importTitle) || !/PDF/i.test(importTitle)) fail('supported import formats should move to the import tooltip')

  const globalLayout = page.locator('.figure-composer__global-layout')
  const globalLayoutBox = await globalLayout.boundingBox()
  if (!globalLayoutBox) throw new Error('global layout panel is not measurable')
  if (globalLayoutBox.height > 185) fail(`global layout still consumes too much rail height (${globalLayoutBox.height.toFixed(1)}px)`)
  const globalAdvanced = globalLayout.locator('.figure-composer__global-advanced')
  if (await globalAdvanced.count() !== 1 || await globalAdvanced.getAttribute('open') !== null) fail('advanced global border controls should be collapsed by default')

  const fileInput = page.locator('.figure-composer__left input[type="file"]')
  if (await page.locator('.figure-composer__layer-main').count() === 0) {
    await fileInput.setInputFiles({ name: 'workbench-panel.svg', mimeType: 'image/svg+xml', buffer: svg })
    await page.locator('.figure-composer__layer-main').first().waitFor({ state: 'visible', timeout: 10000 })
  }
  const firstLayer = page.locator('.figure-composer__layer-main').first()
  await firstLayer.click()
  await page.waitForTimeout(50)
  const inspector = page.locator('.figure-composer__inspector')
  const inspectorBox = await inspector.boundingBox()
  if (!inspectorBox) throw new Error('panel inspector is not measurable')
  if (inspectorBox.height > 165) fail(`selected panel inspector is still too tall before advanced controls (${inspectorBox.height.toFixed(1)}px)`)
  const panelAdvanced = inspector.locator('.figure-composer__panel-advanced')
  if (await panelAdvanced.count() !== 1 || await panelAdvanced.getAttribute('open') !== null) fail('grid/crop panel controls should be collapsed under advanced parameters by default')
  const panelLabelDetails = inspector.locator('.figure-composer__panel-label-details')
  const panelBorderDetails = inspector.locator('.figure-composer__panel-border-details')
  if (await panelLabelDetails.count() !== 1 || await panelLabelDetails.getAttribute('open') !== null) fail('per-panel label controls should be collapsed by default')
  if (await panelBorderDetails.count() !== 1 || await panelBorderDetails.getAttribute('open') !== null) fail('per-panel border controls should be collapsed by default')

  const preflight = page.locator('[aria-label="投稿尺寸检查"]')
  const issueHeights = await preflight.locator('.figure-composer__issue').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
  if (issueHeights.some(height => height > 36)) fail(`preflight reminders still consume multiple text rows (${issueHeights.map(value => value.toFixed(1)).join(', ')})`)
  const preflightBox = await preflight.boundingBox()
  if (preflightBox && preflightBox.height > 132) fail(`preflight panel remains too tall (${preflightBox.height.toFixed(1)}px)`)

  const exportPanel = page.locator('[aria-label="出版尺寸与导出"]')
  const exportBox = await exportPanel.boundingBox()
  if (!exportBox) throw new Error('export panel is not measurable')
  if (exportBox.height > 190) fail(`publication/export panel still wastes rail height (${exportBox.height.toFixed(1)}px)`)
  if (await exportPanel.locator('.figure-composer__export-actions').count() !== 1) fail('publication output summary and export action should share one compact action row')

  const railHeadings = await page.locator('.figure-composer__rail-heading').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
  if (railHeadings.some(height => height > 26)) fail(`rail group headings remain too tall (${railHeadings.map(value => value.toFixed(1)).join(', ')})`)

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
  if (sectionMetrics.paddingTop > 7 || sectionMetrics.paddingBottom > 7) fail(`side rail sections remain too loose (${sectionMetrics.paddingTop}/${sectionMetrics.paddingBottom}px)`)
  if (sectionMetrics.buttonHeight > 30) fail(`side rail primary control remains unnecessarily tall (${sectionMetrics.buttonHeight}px)`)

  console.log(JSON.stringify({ failures, headerBox, clusterGeometry, globalLayoutBox, inspectorBox, issueHeights, exportBox, railHeadings, zoomedViewport, maxScroll, beforePan, afterPan, sectionMetrics }, null, 2))
  await page.close()
} finally {
  await browser.close()
}

if (failures.length) throw new Error(failures.join(' | '))
