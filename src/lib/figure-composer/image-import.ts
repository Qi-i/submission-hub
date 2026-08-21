import type { ImportedFigureAsset, RuntimeFigureAsset } from './types'

export const FIGURE_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/tiff,application/pdf,.png,.jpg,.jpeg,.webp,.svg,.tif,.tiff,.pdf'

const SCRIPT_TIMEOUT = 20_000
const loadedScripts = new Map<string, Promise<void>>()
const cdn = {
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  tiff: 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js',
}

declare global {
  interface Window {
    pdfjsLib?: any
    UTIF?: any
  }
}

function loadScript(src: string) {
  if (loadedScripts.has(src)) return loadedScripts.get(src)!
  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-figure-composer-src="${src}"]`)
    if (existing?.dataset.loaded === '1') return resolve()
    const script = existing || document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.figureComposerSrc = src
    const timer = window.setTimeout(() => reject(new Error(`兼容组件加载超时：${src}`)), SCRIPT_TIMEOUT)
    script.addEventListener('load', () => {
      window.clearTimeout(timer)
      script.dataset.loaded = '1'
      resolve()
    }, { once: true })
    script.addEventListener('error', () => {
      window.clearTimeout(timer)
      loadedScripts.delete(src)
      reject(new Error(`兼容组件加载失败：${src}`))
    }, { once: true })
    if (!existing) document.head.appendChild(script)
  })
  loadedScripts.set(src, promise)
  return promise
}

function decodeImageDimensions(objectUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('浏览器无法解码图片'))
    image.src = objectUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('画布编码失败')), type, quality))
}

async function makeRuntimeAsset(name: string, mime: string, blob: Blob, svgText?: string): Promise<ImportedFigureAsset> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const dimensions = await decodeImageDimensions(objectUrl)
    return {
      id: crypto.randomUUID(),
      sourceFileName: name,
      name,
      mime,
      blob,
      objectUrl,
      naturalWidth: dimensions.width,
      naturalHeight: dimensions.height,
      svgText,
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

async function importRaster(file: File) {
  return [await makeRuntimeAsset(file.name, file.type || 'image/png', file)]
}

async function importSvg(file: File) {
  const svgText = await file.text()
  const blob = new Blob([svgText], { type: 'image/svg+xml' })
  return [await makeRuntimeAsset(file.name, 'image/svg+xml', blob, svgText)]
}

async function importPdf(file: File) {
  await loadScript(cdn.pdf)
  const pdfjs = window.pdfjsLib
  if (!pdfjs) throw new Error('PDF 解析组件未初始化')
  pdfjs.GlobalWorkerOptions.workerSrc = cdn.pdfWorker
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const result: ImportedFigureAsset[] = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(viewport.width))
    canvas.height = Math.max(1, Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法创建 PDF 渲染画布')
    await page.render({ canvasContext: context, viewport }).promise
    const blob = await canvasToBlob(canvas, 'image/png')
    const base = file.name.replace(/\.pdf$/i, '')
    result.push(await makeRuntimeAsset(`${base}-p${pageNo}.png`, 'application/pdf', blob))
  }
  return result
}

async function importTiff(file: File) {
  await loadScript(cdn.tiff)
  const UTIF = window.UTIF
  if (!UTIF) throw new Error('TIFF 解析组件未初始化')
  const buffer = await file.arrayBuffer()
  const pages = UTIF.decode(buffer)
  UTIF.decodeImages(buffer, pages)
  const result: ImportedFigureAsset[] = []
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    const rgba = UTIF.toRGBA8(page)
    const canvas = document.createElement('canvas')
    canvas.width = page.width
    canvas.height = page.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法创建 TIFF 渲染画布')
    const pixels = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength)
    context.putImageData(new ImageData(pixels, page.width, page.height), 0, 0)
    const blob = await canvasToBlob(canvas, 'image/png')
    const name = pages.length > 1 ? `${file.name}-p${index + 1}.png` : file.name
    result.push(await makeRuntimeAsset(name, 'image/tiff', blob))
  }
  return result
}

export async function importFigureFile(file: File): Promise<ImportedFigureAsset[]> {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return importPdf(file)
  if (file.type === 'image/tiff' || name.endsWith('.tif') || name.endsWith('.tiff')) return importTiff(file)
  if (file.type === 'image/svg+xml' || name.endsWith('.svg')) return importSvg(file)
  if (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp' || /\.(png|jpe?g|webp)$/i.test(name)) return importRaster(file)
  throw new Error(`不支持的组图文件：${file.name}`)
}

export async function importFigureFiles(files: FileList | File[]) {
  const assets: ImportedFigureAsset[] = []
  const errors: { file: string; message: string }[] = []
  for (const file of Array.from(files)) {
    try {
      assets.push(...await importFigureFile(file))
    } catch (error) {
      errors.push({ file: file.name, message: error instanceof Error ? error.message : '导入失败' })
    }
  }
  return { assets, errors }
}

export function revokeFigureAsset(asset: Pick<RuntimeFigureAsset, 'objectUrl'>) {
  if (asset.objectUrl.startsWith('blob:')) URL.revokeObjectURL(asset.objectUrl)
}

export function revokeFigureAssets(assets: Iterable<Pick<RuntimeFigureAsset, 'objectUrl'>>) {
  for (const asset of assets) revokeFigureAsset(asset)
}
