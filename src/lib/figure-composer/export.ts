import { automaticPanelLabel, type FigureExportFormat, type FigurePanel, type FigureProject, type RuntimeFigureAsset } from './types'
import { physicalToOutputPx } from './units'

const scriptCache = new Map<string, Promise<void>>()
const cdn = {
  tiff: 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js',
  pdf: 'https://cdn.jsdelivr.net/npm/jspdf@3.0.1/dist/jspdf.umd.min.js',
}

declare global {
  interface Window {
    UTIF?: any
    jspdf?: { jsPDF?: new (options: any) => any }
  }
}

function ensureScript(src: string) {
  if (scriptCache.has(src)) return scriptCache.get(src)!
  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-figure-export-src="${src}"]`)
    if (existing?.dataset.loaded === '1') return resolve()
    const script = existing || document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.figureExportSrc = src
    script.onload = () => { script.dataset.loaded = '1'; resolve() }
    script.onerror = () => { scriptCache.delete(src); reject(new Error(`导出组件加载失败：${src}`)) }
    if (!existing) document.head.appendChild(script)
  })
  scriptCache.set(src, promise)
  return promise
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/>/g, '&gt;')
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取导出资源失败'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('导出时无法解码图片'))
    image.src = src
  })
}

function panelLabelPoint(panel: FigurePanel, textWidth = 0) {
  const right = panel.label.position.endsWith('right')
  const bottom = panel.label.position.startsWith('bottom')
  return {
    x: right ? panel.x + panel.width - textWidth - panel.label.offsetX : panel.x + panel.label.offsetX,
    y: bottom ? panel.y + panel.height - panel.label.fontSize - panel.label.offsetY : panel.y + panel.label.offsetY,
  }
}

function drawContained(context: CanvasRenderingContext2D, image: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }, panel: FigurePanel) {
  const naturalWidth = Number(image.naturalWidth || image.width || panel.naturalWidth)
  const naturalHeight = Number(image.naturalHeight || image.height || panel.naturalHeight)
  const sourceRatio = naturalWidth / Math.max(1, naturalHeight)
  const boxRatio = panel.width / Math.max(1, panel.height)

  if (panel.fit === 'cover') {
    if (sourceRatio > boxRatio) {
      const sourceWidth = naturalHeight * boxRatio
      context.drawImage(image, (naturalWidth - sourceWidth) / 2, 0, sourceWidth, naturalHeight, panel.x, panel.y, panel.width, panel.height)
    } else {
      const sourceHeight = naturalWidth / boxRatio
      context.drawImage(image, 0, (naturalHeight - sourceHeight) / 2, naturalWidth, sourceHeight, panel.x, panel.y, panel.width, panel.height)
    }
    return
  }

  let width = panel.width
  let height = panel.height
  if (sourceRatio > boxRatio) height = width / sourceRatio
  else width = height * sourceRatio
  context.drawImage(image, panel.x + (panel.width - width) / 2, panel.y + (panel.height - height) / 2, width, height)
}

export async function renderFigureCanvas(project: FigureProject, assets: Map<string, RuntimeFigureAsset>, outputWidth?: number) {
  const width = outputWidth || physicalToOutputPx(project.exportSettings.physicalWidth, project.exportSettings.unit, project.exportSettings.dpi)
  const scale = width / Math.max(1, project.canvas.width)
  const desiredHeight = project.exportSettings.physicalHeight
    ? physicalToOutputPx(project.exportSettings.physicalHeight, project.exportSettings.unit, project.exportSettings.dpi)
    : Math.max(1, Math.round(project.canvas.height * scale))

  if (width * desiredHeight > 120_000_000) throw new Error('目标 DPI 与版面尺寸会生成超过 1.2 亿像素的画布，请降低 DPI 或尺寸后重试。')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = desiredHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法创建导出画布')
  context.fillStyle = project.canvas.background || '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.scale(scale, scale)

  for (let index = 0; index < project.panels.length; index += 1) {
    const panel = project.panels[index]
    const asset = assets.get(panel.assetId)
    if (!asset) continue
    const image = await loadImage(asset.objectUrl)
    context.save()
    context.beginPath()
    context.rect(panel.x, panel.y, panel.width, panel.height)
    context.clip()
    drawContained(context, image, panel)
    context.restore()

    if (panel.border.enabled) {
      context.save()
      context.strokeStyle = panel.border.color
      context.lineWidth = panel.border.width
      context.setLineDash(panel.border.style === 'dashed' ? [panel.border.width * 4, panel.border.width * 3] : [])
      context.strokeRect(panel.x, panel.y, panel.width, panel.height)
      context.restore()
    }

    if (panel.label.visible) {
      const label = panel.label.textOverride || automaticPanelLabel(index, panel.label.style)
      context.save()
      context.fillStyle = panel.label.color
      context.font = `${panel.label.fontWeight} ${panel.label.fontSize}px "${panel.label.fontFamily}", serif`
      context.textBaseline = 'top'
      const metrics = context.measureText(label)
      const point = panelLabelPoint(panel, metrics.width)
      context.fillText(label, point.x, point.y)
      context.restore()
    }
  }

  for (const text of project.texts) {
    context.save()
    context.fillStyle = text.color
    context.font = `${text.fontWeight} ${text.fontSize}px "${text.fontFamily}", sans-serif`
    context.textBaseline = 'top'
    context.fillText(text.text, text.x, text.y)
    context.restore()
  }

  context.restore()
  return canvas
}

export async function buildFigureSvg(project: FigureProject, assets: Map<string, RuntimeFigureAsset>) {
  const physicalHeight = project.exportSettings.physicalHeight
    ?? project.exportSettings.physicalWidth * project.canvas.height / Math.max(1, project.canvas.width)
  const unit = project.exportSettings.unit
  const imageElements: string[] = []

  for (let index = 0; index < project.panels.length; index += 1) {
    const panel = project.panels[index]
    const asset = assets.get(panel.assetId)
    if (!asset) continue
    const href = asset.svgText
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svgText)}`
      : await blobToDataUrl(asset.blob)
    const preserveAspectRatio = panel.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'
    imageElements.push(`<image href="${escapeXml(href)}" x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" preserveAspectRatio="${preserveAspectRatio}"/>`)
    if (panel.border.enabled) {
      const dash = panel.border.style === 'dashed' ? ` stroke-dasharray="${panel.border.width * 4} ${panel.border.width * 3}"` : ''
      imageElements.push(`<rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" fill="none" stroke="${escapeXml(panel.border.color)}" stroke-width="${panel.border.width}"${dash}/>`)
    }
    if (panel.label.visible) {
      const label = panel.label.textOverride || automaticPanelLabel(index, panel.label.style)
      const right = panel.label.position.endsWith('right')
      const bottom = panel.label.position.startsWith('bottom')
      const x = right ? panel.x + panel.width - panel.label.offsetX : panel.x + panel.label.offsetX
      const y = bottom ? panel.y + panel.height - panel.label.offsetY : panel.y + panel.label.fontSize + panel.label.offsetY
      imageElements.push(`<text x="${x}" y="${y}" font-family="${escapeXml(panel.label.fontFamily)}" font-size="${panel.label.fontSize}" font-weight="${panel.label.fontWeight}" text-anchor="${right ? 'end' : 'start'}" fill="${escapeXml(panel.label.color)}">${escapeXml(label)}</text>`)
    }
  }

  const textElements = project.texts.map(text => `<text x="${text.x}" y="${text.y + text.fontSize}" font-family="${escapeXml(text.fontFamily)}" font-size="${text.fontSize}" font-weight="${text.fontWeight}" fill="${escapeXml(text.color)}">${escapeXml(text.text)}</text>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${project.exportSettings.physicalWidth}${unit}" height="${physicalHeight}${unit}" viewBox="0 0 ${project.canvas.width} ${project.canvas.height}" preserveAspectRatio="xMidYMid meet"><rect width="100%" height="100%" fill="${escapeXml(project.canvas.background || '#ffffff')}"/>${imageElements.join('')}${textElements.join('')}</svg>`
}

export function triggerFigureDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('浏览器无法编码导出文件')), mime, quality))
}

export async function exportFigureProject(project: FigureProject, assets: Map<string, RuntimeFigureAsset>, format: FigureExportFormat = project.exportSettings.format) {
  const baseName = project.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'figure'
  if (format === 'svg') {
    const svg = await buildFigureSvg(project, assets)
    triggerFigureDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${baseName}.svg`)
    return
  }

  const canvas = await renderFigureCanvas(project, assets)
  if (format === 'pdf') {
    await ensureScript(cdn.pdf)
    const PDF = window.jspdf?.jsPDF
    if (!PDF) throw new Error('PDF 导出组件未初始化')
    const pdf = new PDF({ orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height], hotfixes: ['px_scaling'] })
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, canvas.width, canvas.height)
    pdf.save(`${baseName}.pdf`)
    return
  }
  if (format === 'tiff') {
    await ensureScript(cdn.tiff)
    const UTIF = window.UTIF
    if (!UTIF) throw new Error('TIFF 导出组件未初始化')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法读取 TIFF 导出画布')
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const encoded = UTIF.encodeImage(pixels.buffer, canvas.width, canvas.height)
    triggerFigureDownload(new Blob([encoded], { type: 'image/tiff' }), `${baseName}.tiff`)
    return
  }

  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
  const blob = await canvasToBlob(canvas, mime, format === 'jpeg' || format === 'webp' ? 0.96 : undefined)
  triggerFigureDownload(blob, `${baseName}.${format === 'jpeg' ? 'jpg' : format}`)
}
