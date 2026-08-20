import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowLeft, ChevronDown, ChevronUp, Download, FileImage, Grid3X3, Layers3,
  Move, Plus, RotateCcw, Trash2, Type, ZoomIn, ZoomOut,
} from 'lucide-react'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/bmp,image/tiff,application/pdf,.tif,.tiff,.svg,.pdf'
const DEFAULT_SETTINGS = {
  canvasWidth: 2400,
  canvasHeight: 1800,
  gap: 32,
  layout: '2x2',
  arrangeMode: 'grid' as 'grid' | 'manual',
  fit: 'contain' as 'contain' | 'cover',
  labelStyle: 'parena' as LabelStyle,
  labelFont: 'Times New Roman',
  labelSize: 64,
  labelPosition: 'topleft' as LabelPosition,
  labelOffsetX: 0,
  labelOffsetY: 0,
  borderEnabled: false,
  borderColor: '#111827',
  borderWidth: 4,
  borderStyle: 'solid' as 'solid' | 'dashed',
  exportDpi: 300,
}

type LabelStyle = 'A' | 'parenA' | 'a' | 'parena'
type LabelPosition = 'topleft' | 'topright' | 'bottomleft' | 'bottomright'
type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'pdf' | 'tiff'

type FigurePanel = {
  id: string
  name: string
  sourceType: string
  src: string
  svgText?: string
  image: HTMLImageElement
  x: number
  y: number
  width: number
  height: number
}

type FigureText = {
  id: string
  text: string
  x: number
  y: number
  fontFamily: string
  fontSize: number
  color: string
}

type Settings = typeof DEFAULT_SETTINGS

type ImportedImage = Pick<FigurePanel, 'name' | 'sourceType' | 'src' | 'svgText' | 'image'>

type DragState = {
  kind: 'panel' | 'text'
  id: string
  dx: number
  dy: number
} | null

declare global {
  interface Window {
    pdfjsLib?: any
    UTIF?: any
    jspdf?: any
  }
}

const cdn = {
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  utif: 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@3.0.1/dist/jspdf.umd.min.js',
}

const loadedScripts = new Map<string, Promise<void>>()

function ensureScript(src: string) {
  if (!loadedScripts.has(src)) {
    loadedScripts.set(src, new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-figure-studio-src="${src}"]`)
      if (existing?.dataset.loaded === '1') return resolve()
      const script = existing || document.createElement('script')
      script.src = src
      script.async = true
      script.dataset.figureStudioSrc = src
      script.addEventListener('load', () => {
        script.dataset.loaded = '1'
        resolve()
      }, { once: true })
      script.addEventListener('error', () => reject(new Error(`无法加载兼容组件：${src}`)), { once: true })
      if (!existing) document.head.appendChild(script)
    }))
  }
  return loadedScripts.get(src)!
}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = src
  })
}

async function importRaster(file: File): Promise<ImportedImage[]> {
  const src = await fileToDataUrl(file)
  return [{ name: file.name, sourceType: file.type || 'image', src, image: await loadImage(src) }]
}

async function importSvg(file: File): Promise<ImportedImage[]> {
  const svgText = await file.text()
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
  return [{ name: file.name, sourceType: 'image/svg+xml', src, svgText, image: await loadImage(src) }]
}

async function importPdf(file: File): Promise<ImportedImage[]> {
  await ensureScript(cdn.pdf)
  const pdfjs = window.pdfjsLib
  if (!pdfjs) throw new Error('PDF 兼容组件未初始化')
  pdfjs.GlobalWorkerOptions.workerSrc = cdn.pdfWorker
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const result: ImportedImage[] = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法创建 PDF 画布')
    await page.render({ canvasContext: context, viewport }).promise
    const src = canvas.toDataURL('image/png')
    result.push({
      name: `${file.name.replace(/\.pdf$/i, '')}-p${pageNo}`,
      sourceType: 'application/pdf',
      src,
      image: await loadImage(src),
    })
  }
  return result
}

async function importTiff(file: File): Promise<ImportedImage[]> {
  await ensureScript(cdn.utif)
  const UTIF = window.UTIF
  if (!UTIF) throw new Error('TIFF 兼容组件未初始化')
  const buffer = await file.arrayBuffer()
  const pages = UTIF.decode(buffer)
  UTIF.decodeImages(buffer, pages)
  const result: ImportedImage[] = []
  pages.forEach((page: any, index: number) => {
    const rgba = UTIF.toRGBA8(page)
    const canvas = document.createElement('canvas')
    canvas.width = page.width
    canvas.height = page.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法创建 TIFF 画布')
    const pixels = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength)
    context.putImageData(new ImageData(pixels, page.width, page.height), 0, 0)
    const src = canvas.toDataURL('image/png')
    result.push({
      name: pages.length > 1 ? `${file.name}-p${index + 1}` : file.name,
      sourceType: 'image/tiff',
      src,
      image: new Image(),
    })
  })
  return Promise.all(result.map(async item => ({ ...item, image: await loadImage(item.src) })))
}

async function importFile(file: File): Promise<ImportedImage[]> {
  const lower = file.name.toLowerCase()
  if (file.type === 'application/pdf' || lower.endsWith('.pdf')) return importPdf(file)
  if (file.type === 'image/tiff' || lower.endsWith('.tif') || lower.endsWith('.tiff')) return importTiff(file)
  if (file.type === 'image/svg+xml' || lower.endsWith('.svg')) return importSvg(file)
  if (file.type.startsWith('image/')) return importRaster(file)
  throw new Error(`不支持的文件格式：${file.name}`)
}

function labelFor(index: number, style: LabelStyle) {
  const base = String.fromCharCode((style === 'a' || style === 'parena' ? 97 : 65) + (index % 26))
  return style === 'parenA' || style === 'parena' ? `(${base})` : base
}

function parseLayout(layout: string, count: number) {
  if (layout === 'auto') {
    const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))))
    return { columns, rows: Math.max(1, Math.ceil(count / columns)) }
  }
  const [rows, columns] = layout.split('x').map(value => Math.max(1, Number(value) || 1))
  return { rows, columns }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function extensionFor(format: ExportFormat) {
  return format === 'jpeg' ? 'jpg' : format
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

export default function FigureStudio({ onBack }: { onBack?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<DragState>(null)
  const [panels, setPanels] = useState<FigurePanel[]>([])
  const [texts, setTexts] = useState<FigureText[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png')
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('拖入图片或选择文件开始组图。所有图像处理默认在当前浏览器完成。')
  const [dragOver, setDragOver] = useState(false)
  const [textDraft, setTextDraft] = useState('')
  const [textFont, setTextFont] = useState('Times New Roman')
  const [textSize, setTextSize] = useState(48)
  const [textColor, setTextColor] = useState('#111827')

  const selectedPanel = useMemo(() => panels.find(panel => panel.id === selectedPanelId) || null, [panels, selectedPanelId])
  const selectedText = useMemo(() => texts.find(text => text.id === selectedTextId) || null, [texts, selectedTextId])

  const applyGrid = useCallback((source: FigurePanel[], current = settings) => {
    if (!source.length) return source
    const { rows, columns } = parseLayout(current.layout, source.length)
    const margin = current.gap
    const cellWidth = Math.max(20, (current.canvasWidth - margin * (columns + 1)) / columns)
    const cellHeight = Math.max(20, (current.canvasHeight - margin * (rows + 1)) / rows)
    return source.map((panel, index) => {
      const row = Math.floor(index / columns)
      const column = index % columns
      const naturalRatio = panel.image.naturalWidth / Math.max(1, panel.image.naturalHeight)
      const cellRatio = cellWidth / cellHeight
      let width = cellWidth
      let height = cellHeight
      if (current.fit === 'contain') {
        if (naturalRatio > cellRatio) height = width / naturalRatio
        else width = height * naturalRatio
      }
      return {
        ...panel,
        x: margin + column * (cellWidth + margin) + (cellWidth - width) / 2,
        y: margin + row * (cellHeight + margin) + (cellHeight - height) / 2,
        width,
        height,
      }
    })
  }, [settings])

  const renderCanvas = useCallback((target: HTMLCanvasElement, scale = 1, showSelection = false) => {
    const width = Math.max(1, Math.round(settings.canvasWidth * scale))
    const height = Math.max(1, Math.round(settings.canvasHeight * scale))
    if (target.width !== width) target.width = width
    if (target.height !== height) target.height = height
    const context = target.getContext('2d')
    if (!context) return
    context.setTransform(scale, 0, 0, scale, 0, 0)
    context.clearRect(0, 0, settings.canvasWidth, settings.canvasHeight)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, settings.canvasWidth, settings.canvasHeight)

    panels.forEach((panel, index) => {
      context.save()
      context.beginPath()
      context.rect(panel.x, panel.y, panel.width, panel.height)
      context.clip()
      const imageRatio = panel.image.naturalWidth / Math.max(1, panel.image.naturalHeight)
      const boxRatio = panel.width / Math.max(1, panel.height)
      let dx = panel.x
      let dy = panel.y
      let dw = panel.width
      let dh = panel.height
      if (settings.fit === 'contain') {
        if (imageRatio > boxRatio) {
          dh = panel.width / imageRatio
          dy = panel.y + (panel.height - dh) / 2
        } else {
          dw = panel.height * imageRatio
          dx = panel.x + (panel.width - dw) / 2
        }
      } else if (imageRatio > boxRatio) {
        const sourceWidth = panel.image.naturalHeight * boxRatio
        const sourceX = (panel.image.naturalWidth - sourceWidth) / 2
        context.drawImage(panel.image, sourceX, 0, sourceWidth, panel.image.naturalHeight, panel.x, panel.y, panel.width, panel.height)
        context.restore()
        context.save()
        context.beginPath()
        context.rect(panel.x, panel.y, panel.width, panel.height)
        context.clip()
        dx = Number.NaN
      } else {
        const sourceHeight = panel.image.naturalWidth / boxRatio
        const sourceY = (panel.image.naturalHeight - sourceHeight) / 2
        context.drawImage(panel.image, 0, sourceY, panel.image.naturalWidth, sourceHeight, panel.x, panel.y, panel.width, panel.height)
        context.restore()
        context.save()
        context.beginPath()
        context.rect(panel.x, panel.y, panel.width, panel.height)
        context.clip()
        dx = Number.NaN
      }
      if (Number.isFinite(dx)) context.drawImage(panel.image, dx, dy, dw, dh)
      context.restore()

      if (settings.borderEnabled) {
        context.save()
        context.strokeStyle = settings.borderColor
        context.lineWidth = settings.borderWidth
        context.setLineDash(settings.borderStyle === 'dashed' ? [settings.borderWidth * 3, settings.borderWidth * 2] : [])
        context.strokeRect(panel.x, panel.y, panel.width, panel.height)
        context.restore()
      }

      const label = labelFor(index, settings.labelStyle)
      context.save()
      context.fillStyle = '#111827'
      context.font = `700 ${settings.labelSize}px "${settings.labelFont}", serif`
      context.textBaseline = 'top'
      const metrics = context.measureText(label)
      const labelHeight = settings.labelSize * 1.05
      let x = panel.x + settings.labelOffsetX
      let y = panel.y + settings.labelOffsetY
      if (settings.labelPosition.includes('right')) x = panel.x + panel.width - metrics.width + settings.labelOffsetX
      if (settings.labelPosition.includes('bottom')) y = panel.y + panel.height - labelHeight + settings.labelOffsetY
      context.fillText(label, x, y)
      context.restore()

      if (showSelection && panel.id === selectedPanelId) {
        context.save()
        context.strokeStyle = '#2563eb'
        context.lineWidth = Math.max(2, 4 / scale)
        context.setLineDash([12 / scale, 8 / scale])
        context.strokeRect(panel.x - 3, panel.y - 3, panel.width + 6, panel.height + 6)
        context.restore()
      }
    })

    texts.forEach(text => {
      context.save()
      context.fillStyle = text.color
      context.font = `${text.fontSize}px "${text.fontFamily}", sans-serif`
      context.textBaseline = 'top'
      context.fillText(text.text, text.x, text.y)
      if (showSelection && text.id === selectedTextId) {
        const width = Math.max(28, context.measureText(text.text).width)
        context.strokeStyle = '#7c3aed'
        context.lineWidth = 3
        context.setLineDash([9, 6])
        context.strokeRect(text.x - 4, text.y - 4, width + 8, text.fontSize * 1.25 + 8)
      }
      context.restore()
    })
  }, [panels, selectedPanelId, selectedTextId, settings, texts])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) renderCanvas(canvas, 1, true)
  }, [renderCanvas])

  const relayout = useCallback((nextSettings = settings) => {
    setPanels(current => applyGrid(current, nextSettings))
  }, [applyGrid, settings])

  const updateSettings = <K extends keyof Settings>(key: K, value: Settings[K], shouldRelayout = false) => {
    setSettings(current => {
      const next = { ...current, [key]: value }
      if (shouldRelayout && next.arrangeMode === 'grid') setPanels(items => applyGrid(items, next))
      return next
    })
  }

  const addImported = useCallback((items: ImportedImage[]) => {
    setPanels(current => {
      const appended = [...current, ...items.map((item, index) => ({
        ...item,
        id: crypto.randomUUID(),
        x: 60 + (current.length + index) * 24,
        y: 60 + (current.length + index) * 24,
        width: Math.min(900, item.image.naturalWidth),
        height: Math.min(700, item.image.naturalHeight),
      }))]
      return settings.arrangeMode === 'grid' ? applyGrid(appended) : appended
    })
  }, [applyGrid, settings.arrangeMode])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const queue = Array.from(files)
    if (!queue.length) return
    setBusy(true)
    setStatus(`正在导入 ${queue.length} 个文件…`)
    const imported: ImportedImage[] = []
    const errors: string[] = []
    for (const file of queue) {
      try {
        imported.push(...await importFile(file))
      } catch (error) {
        errors.push(`${file.name}：${error instanceof Error ? error.message : '导入失败'}`)
      }
    }
    if (imported.length) addImported(imported)
    setStatus(errors.length
      ? `已导入 ${imported.length} 个图层；${errors.length} 个文件未导入：${errors.join('；')}`
      : `已导入 ${imported.length} 个图层。可直接拖动、调整标签并导出。`)
    setBusy(false)
  }, [addImported])

  const canvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * settings.canvasWidth / rect.width,
      y: (event.clientY - rect.top) * settings.canvasHeight / rect.height,
    }
  }

  const snapPosition = (panel: FigurePanel, x: number, y: number) => {
    const threshold = 18
    const xTargets = [0, settings.canvasWidth / 2 - panel.width / 2, settings.canvasWidth - panel.width]
    const yTargets = [0, settings.canvasHeight / 2 - panel.height / 2, settings.canvasHeight - panel.height]
    panels.forEach(other => {
      if (other.id === panel.id) return
      xTargets.push(other.x, other.x + other.width, other.x - panel.width, other.x + other.width - panel.width)
      yTargets.push(other.y, other.y + other.height, other.y - panel.height, other.y + other.height - panel.height)
    })
    const nearestX = xTargets.reduce((best, target) => Math.abs(target - x) < Math.abs(best - x) ? target : best, xTargets[0])
    const nearestY = yTargets.reduce((best, target) => Math.abs(target - y) < Math.abs(best - y) ? target : best, yTargets[0])
    return {
      x: Math.abs(nearestX - x) <= threshold ? nearestX : x,
      y: Math.abs(nearestY - y) <= threshold ? nearestY : y,
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event)
    const context = canvasRef.current?.getContext('2d')
    if (context) {
      const textHit = [...texts].reverse().find(text => {
        context.font = `${text.fontSize}px "${text.fontFamily}", sans-serif`
        const width = Math.max(28, context.measureText(text.text).width)
        return point.x >= text.x && point.x <= text.x + width && point.y >= text.y && point.y <= text.y + text.fontSize * 1.3
      })
      if (textHit) {
        setSelectedTextId(textHit.id)
        setSelectedPanelId(null)
        dragRef.current = { kind: 'text', id: textHit.id, dx: point.x - textHit.x, dy: point.y - textHit.y }
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }
    }
    const panel = [...panels].reverse().find(item => point.x >= item.x && point.x <= item.x + item.width && point.y >= item.y && point.y <= item.y + item.height)
    if (panel) {
      setSelectedPanelId(panel.id)
      setSelectedTextId(null)
      dragRef.current = { kind: 'panel', id: panel.id, dx: point.x - panel.x, dy: point.y - panel.y }
      event.currentTarget.setPointerCapture(event.pointerId)
    } else {
      setSelectedPanelId(null)
      setSelectedTextId(null)
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const point = canvasPoint(event)
    if (drag.kind === 'text') {
      setTexts(current => current.map(text => text.id === drag.id
        ? { ...text, x: clamp(point.x - drag.dx, 0, settings.canvasWidth - 20), y: clamp(point.y - drag.dy, 0, settings.canvasHeight - 20) }
        : text))
      return
    }
    setSettings(current => current.arrangeMode === 'grid' ? { ...current, arrangeMode: 'manual' } : current)
    setPanels(current => current.map(panel => {
      if (panel.id !== drag.id) return panel
      const snapped = snapPosition(panel, point.x - drag.dx, point.y - drag.dy)
      return {
        ...panel,
        x: clamp(snapped.x, 0, Math.max(0, settings.canvasWidth - panel.width)),
        y: clamp(snapped.y, 0, Math.max(0, settings.canvasHeight - panel.height)),
      }
    }))
  }

  const finishPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const scaleSelected = (factor: number) => {
    if (!selectedPanelId) return
    setSettings(current => current.arrangeMode === 'grid' ? { ...current, arrangeMode: 'manual' } : current)
    setPanels(current => current.map(panel => {
      if (panel.id !== selectedPanelId) return panel
      const width = clamp(panel.width * factor, 80, settings.canvasWidth)
      const height = clamp(panel.height * factor, 60, settings.canvasHeight)
      return {
        ...panel,
        x: clamp(panel.x - (width - panel.width) / 2, 0, Math.max(0, settings.canvasWidth - width)),
        y: clamp(panel.y - (height - panel.height) / 2, 0, Math.max(0, settings.canvasHeight - height)),
        width,
        height,
      }
    }))
  }

  const moveLayer = (direction: -1 | 1) => {
    if (!selectedPanelId) return
    setPanels(current => {
      const index = current.findIndex(panel => panel.id === selectedPanelId)
      if (index < 0) return current
      const target = clamp(index + direction, 0, current.length - 1)
      if (target === index) return current
      const next = [...current]
      const [panel] = next.splice(index, 1)
      next.splice(target, 0, panel)
      return next
    })
  }

  const removeSelected = () => {
    if (selectedTextId) {
      setTexts(current => current.filter(text => text.id !== selectedTextId))
      setSelectedTextId(null)
      return
    }
    if (!selectedPanelId) return
    setPanels(current => {
      const next = current.filter(panel => panel.id !== selectedPanelId)
      return settings.arrangeMode === 'grid' ? applyGrid(next) : next
    })
    setSelectedPanelId(null)
  }

  const addText = () => {
    const text = textDraft.trim()
    if (!text) return
    const item: FigureText = {
      id: crypto.randomUUID(),
      text,
      x: settings.canvasWidth * 0.08,
      y: settings.canvasHeight * 0.08,
      fontFamily: textFont,
      fontSize: textSize,
      color: textColor,
    }
    setTexts(current => [...current, item])
    setSelectedTextId(item.id)
    setSelectedPanelId(null)
  }

  const updateSelectedText = () => {
    if (!selectedText) return
    setTexts(current => current.map(text => text.id === selectedText.id ? {
      ...text,
      text: textDraft.trim() || text.text,
      fontFamily: textFont,
      fontSize: textSize,
      color: textColor,
    } : text))
  }

  useEffect(() => {
    if (!selectedText) return
    setTextDraft(selectedText.text)
    setTextFont(selectedText.fontFamily)
    setTextSize(selectedText.fontSize)
    setTextColor(selectedText.color)
  }, [selectedText])

  const exportCanvas = async () => {
    if (!panels.length && !texts.length) {
      setStatus('请先导入图片或添加文本。')
      return
    }
    setBusy(true)
    try {
      const scale = Math.max(1, settings.exportDpi / 96)
      const pixelCount = settings.canvasWidth * settings.canvasHeight * scale * scale
      if (pixelCount > 90_000_000 && !confirm('当前 DPI 会生成很大的像素画布，可能占用较多内存。仍然继续吗？')) return
      const canvas = document.createElement('canvas')
      renderCanvas(canvas, scale, false)
      const baseName = `submission-hub-figure-${new Date().toISOString().slice(0, 10)}`

      if (exportFormat === 'svg') {
        const body = panels.map((panel, index) => {
          const label = labelFor(index, settings.labelStyle)
          const imageHref = panel.svgText
            ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(panel.svgText)}`
            : panel.src
          const labelX = settings.labelPosition.includes('right') ? panel.x + panel.width + settings.labelOffsetX : panel.x + settings.labelOffsetX
          const labelY = settings.labelPosition.includes('bottom') ? panel.y + panel.height + settings.labelOffsetY : panel.y + settings.labelSize + settings.labelOffsetY
          const anchor = settings.labelPosition.includes('right') ? 'end' : 'start'
          return `<image href="${imageHref.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" preserveAspectRatio="${settings.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}"/><text x="${labelX}" y="${labelY}" font-family="${settings.labelFont}" font-size="${settings.labelSize}" font-weight="700" text-anchor="${anchor}" fill="#111827">${label}</text>`
        }).join('')
        const textBody = texts.map(text => `<text x="${text.x}" y="${text.y + text.fontSize}" font-family="${text.fontFamily}" font-size="${text.fontSize}" fill="${text.color}">${text.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</text>`).join('')
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.canvasWidth}" height="${settings.canvasHeight}" viewBox="0 0 ${settings.canvasWidth} ${settings.canvasHeight}"><rect width="100%" height="100%" fill="white"/>${body}${textBody}</svg>`
        download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${baseName}.svg`)
      } else if (exportFormat === 'pdf') {
        await ensureScript(cdn.jspdf)
        const jsPDF = window.jspdf?.jsPDF
        if (!jsPDF) throw new Error('PDF 导出组件未初始化')
        const orientation = settings.canvasWidth >= settings.canvasHeight ? 'landscape' : 'portrait'
        const pdf = new jsPDF({ orientation, unit: 'px', format: [settings.canvasWidth, settings.canvasHeight], hotfixes: ['px_scaling'] })
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, settings.canvasWidth, settings.canvasHeight)
        pdf.save(`${baseName}.pdf`)
      } else if (exportFormat === 'tiff') {
        await ensureScript(cdn.utif)
        const UTIF = window.UTIF
        if (!UTIF) throw new Error('TIFF 导出组件未初始化')
        const context = canvas.getContext('2d')
        if (!context) throw new Error('无法读取导出画布')
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        const encoded = UTIF.encodeImage(pixels.buffer, canvas.width, canvas.height)
        download(new Blob([encoded], { type: 'image/tiff' }), `${baseName}.tiff`)
      } else {
        const mime = exportFormat === 'jpeg' ? 'image/jpeg' : `image/${exportFormat}`
        const quality = exportFormat === 'jpeg' || exportFormat === 'webp' ? 0.96 : undefined
        const dataUrl = canvas.toDataURL(mime, quality)
        const blob = await (await fetch(dataUrl)).blob()
        download(blob, `${baseName}.${extensionFor(exportFormat)}`)
      }
      setStatus(`已生成 ${exportFormat.toUpperCase()} 文件（${settings.exportDpi} DPI 渲染）。`)
    } catch (error) {
      setStatus(error instanceof Error ? `导出失败：${error.message}` : '导出失败。')
    } finally {
      setBusy(false)
    }
  }

  const clearAll = () => {
    if ((panels.length || texts.length) && !confirm('清空当前组图中的全部图片和文本？')) return
    setPanels([])
    setTexts([])
    setSelectedPanelId(null)
    setSelectedTextId(null)
    setStatus('画布已清空。')
  }

  return <section className="figure-studio" aria-label="科研组图工作区">
    <header className="figure-studio__header">
      <div>
        <div className="figure-studio__eyebrow"><Layers3 size={14} /> FIGURE STUDIO</div>
        <h2>科研组图</h2>
        <p>多图排版、自由对齐、子图标签与投稿级导出。图像默认仅在浏览器内处理。</p>
      </div>
      <div className="figure-studio__header-actions">
        {onBack && <button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={14} /> 返回投稿准备</button>}
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void exportCanvas()}><Download size={14} /> {busy ? '处理中…' : '导出组图'}</button>
      </div>
    </header>

    <div className="figure-studio__layout">
      <aside className="figure-studio__sidebar">
        <section className="figure-studio__panel">
          <div
            className={`figure-studio__dropzone ${dragOver ? 'is-dragging' : ''}`}
            onDragOver={event => { event.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={event => {
              event.preventDefault()
              setDragOver(false)
              void handleFiles(event.dataTransfer.files)
            }}
          >
            <FileImage size={24} />
            <strong>拖入图片</strong>
            <span>PNG · JPG · WEBP · SVG · TIFF · PDF</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}><Plus size={13} /> 选择文件</button>
            <input ref={inputRef} hidden type="file" accept={ACCEPT} multiple onChange={event => event.target.files && void handleFiles(event.target.files)} />
          </div>
          <div className="figure-studio__status" aria-live="polite">{status}</div>
        </section>

        <section className="figure-studio__panel">
          <div className="figure-studio__panel-title"><Grid3X3 size={14} /><strong>画布与排版</strong></div>
          <div className="figure-studio__fields two">
            <label>模式<select value={settings.arrangeMode} onChange={event => updateSettings('arrangeMode', event.target.value as Settings['arrangeMode'])}><option value="grid">自动网格</option><option value="manual">自由拖拽</option></select></label>
            <label>网格<select value={settings.layout} onChange={event => updateSettings('layout', event.target.value, true)}><option value="auto">自动</option><option value="1x2">1×2</option><option value="1x3">1×3</option><option value="2x2">2×2</option><option value="2x3">2×3</option><option value="3x2">3×2</option><option value="3x3">3×3</option><option value="3x4">3×4</option><option value="4x4">4×4</option><option value="5x5">5×5</option></select></label>
            <label>宽度<input type="number" min="600" step="100" value={settings.canvasWidth} onChange={event => updateSettings('canvasWidth', Math.max(600, Number(event.target.value) || 600), true)} /></label>
            <label>高度<input type="number" min="500" step="100" value={settings.canvasHeight} onChange={event => updateSettings('canvasHeight', Math.max(500, Number(event.target.value) || 500), true)} /></label>
            <label>图间距<input type="number" min="0" max="300" value={settings.gap} onChange={event => updateSettings('gap', Math.max(0, Number(event.target.value) || 0), true)} /></label>
            <label>图片显示<select value={settings.fit} onChange={event => updateSettings('fit', event.target.value as Settings['fit'], true)}><option value="contain">完整显示</option><option value="cover">填满图框</option></select></label>
          </div>
          <button className="figure-studio__wide-button" type="button" onClick={() => relayout()}><RotateCcw size={13} /> 重新自动排版</button>
        </section>

        <section className="figure-studio__panel">
          <div className="figure-studio__panel-title"><Type size={14} /><strong>子图标签</strong></div>
          <div className="figure-studio__fields two">
            <label>样式<select value={settings.labelStyle} onChange={event => updateSettings('labelStyle', event.target.value as LabelStyle)}><option value="parena">(a), (b), (c)</option><option value="a">a, b, c</option><option value="parenA">(A), (B), (C)</option><option value="A">A, B, C</option></select></label>
            <label>字体<select value={settings.labelFont} onChange={event => updateSettings('labelFont', event.target.value)}><option value="Times New Roman">Times New Roman</option><option value="Arial">Arial</option><option value="Helvetica">Helvetica</option><option value="Georgia">Georgia</option><option value="Microsoft YaHei">微软雅黑</option><option value="SimSun">宋体</option></select></label>
            <label>字号<input type="number" min="12" max="240" value={settings.labelSize} onChange={event => updateSettings('labelSize', clamp(Number(event.target.value) || 12, 12, 240))} /></label>
            <label>位置<select value={settings.labelPosition} onChange={event => updateSettings('labelPosition', event.target.value as LabelPosition)}><option value="topleft">左上</option><option value="topright">右上</option><option value="bottomleft">左下</option><option value="bottomright">右下</option></select></label>
            <label>横向偏移<input type="number" step="4" value={settings.labelOffsetX} onChange={event => updateSettings('labelOffsetX', Number(event.target.value) || 0)} /></label>
            <label>纵向偏移<input type="number" step="4" value={settings.labelOffsetY} onChange={event => updateSettings('labelOffsetY', Number(event.target.value) || 0)} /></label>
          </div>
        </section>

        <section className="figure-studio__panel">
          <div className="figure-studio__panel-title"><Type size={14} /><strong>自由文本</strong></div>
          <label className="figure-studio__single-field">文本<input value={textDraft} placeholder="例如：Experiment 1" onChange={event => setTextDraft(event.target.value)} /></label>
          <div className="figure-studio__fields two">
            <label>字体<select value={textFont} onChange={event => setTextFont(event.target.value)}><option value="Times New Roman">Times New Roman</option><option value="Arial">Arial</option><option value="Helvetica">Helvetica</option><option value="Microsoft YaHei">微软雅黑</option><option value="SimSun">宋体</option></select></label>
            <label>字号<input type="number" min="12" max="240" value={textSize} onChange={event => setTextSize(clamp(Number(event.target.value) || 12, 12, 240))} /></label>
            <label>颜色<input type="color" value={textColor} onChange={event => setTextColor(event.target.value)} /></label>
          </div>
          <div className="figure-studio__button-row"><button onClick={addText}><Plus size={13} /> 添加文本</button><button disabled={!selectedText} onClick={updateSelectedText}>更新选中</button></div>
        </section>
      </aside>

      <main className="figure-studio__main">
        <div className="figure-studio__toolbar">
          <div className="figure-studio__tool-group">
            <button disabled={!selectedPanel} title="放大选中图片" onClick={() => scaleSelected(1.08)}><ZoomIn size={14} /> 放大</button>
            <button disabled={!selectedPanel} title="缩小选中图片" onClick={() => scaleSelected(0.92)}><ZoomOut size={14} /> 缩小</button>
            <button disabled={!selectedPanel} onClick={() => moveLayer(1)}><ChevronUp size={14} /> 上移一层</button>
            <button disabled={!selectedPanel} onClick={() => moveLayer(-1)}><ChevronDown size={14} /> 下移一层</button>
            <button disabled={!selectedPanel && !selectedText} onClick={removeSelected}><Trash2 size={14} /> 删除</button>
          </div>
          <div className="figure-studio__tool-group">
            <span><Move size={13} /> {settings.arrangeMode === 'manual' ? '自由拖拽' : '自动网格'}</span>
            <button onClick={() => setZoom(value => clamp(value - 0.1, 0.4, 1.6))}>−</button>
            <b>{Math.round(zoom * 100)}%</b>
            <button onClick={() => setZoom(value => clamp(value + 0.1, 0.4, 1.6))}>+</button>
          </div>
        </div>

        <div className="figure-studio__canvas-shell">
          <div className="figure-studio__canvas-stage" style={{ width: `${zoom * 100}%` }}>
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishPointer}
              onPointerCancel={finishPointer}
              aria-label="组图编辑画布"
            />
          </div>
        </div>

        <div className="figure-studio__bottom">
          <div className="figure-studio__layer-list">
            <div className="figure-studio__panel-title"><Layers3 size={14} /><strong>图层</strong><span>{panels.length} 图 · {texts.length} 文本</span></div>
            <div className="figure-studio__layer-scroll">
              {panels.map((panel, index) => <button key={panel.id} className={panel.id === selectedPanelId ? 'active' : ''} onClick={() => { setSelectedPanelId(panel.id); setSelectedTextId(null) }}><b>{labelFor(index, settings.labelStyle)}</b><span title={panel.name}>{panel.name}</span></button>)}
              {!panels.length && <div className="figure-studio__empty">尚未导入图片</div>}
            </div>
          </div>
          <div className="figure-studio__export">
            <div className="figure-studio__panel-title"><Download size={14} /><strong>导出</strong></div>
            <div className="figure-studio__fields two">
              <label>DPI<select value={settings.exportDpi} onChange={event => updateSettings('exportDpi', Number(event.target.value))}><option value={150}>150</option><option value={300}>300</option><option value={450}>450</option><option value={600}>600</option><option value={900}>900</option><option value={1200}>1200</option></select></label>
              <label>格式<select value={exportFormat} onChange={event => setExportFormat(event.target.value as ExportFormat)}><option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WEBP</option><option value="tiff">TIFF</option><option value="pdf">PDF</option><option value="svg">SVG</option></select></label>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={() => void exportCanvas()}><Download size={14} /> {busy ? '处理中…' : '导出当前组图'}</button>
            <button className="btn btn-ghost" onClick={clearAll}>清空画布</button>
          </div>
        </div>
      </main>
    </div>
  </section>
}
