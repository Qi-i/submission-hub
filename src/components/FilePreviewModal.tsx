import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Download, ExternalLink, FileText, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import type { PaperFile } from '../lib/types'
import {
  downloadStoredFile,
  fetchStoredFile,
  getStoredFileAccess,
  openStoredFile,
  type StoredFileAccess,
} from '../lib/storage'

type PreviewKind = 'pdf' | 'image' | 'docx' | 'sheet' | 'slides' | 'text' | 'unsupported'

type PreviewState = {
  kind: PreviewKind
  access: StoredFileAccess
  html?: string
  text?: string
  sheets?: Array<{ name: string; html: string }>
  buffer?: ArrayBuffer
}

const MAMMOTH_MODULE = 'https://esm.sh/mammoth@1.10.0?bundle'
const SHEETJS_MODULE = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs'
const PPTX_MODULE = 'https://esm.sh/pptx-preview@1.0.7?bundle'

function remoteImport(url: string): Promise<any> {
  return import(/* @vite-ignore */ url)
}

function extensionOf(filename: string) {
  const clean = filename.split(/[?#]/)[0]
  const dot = clean.lastIndexOf('.')
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : ''
}

function previewKind(filename: string, contentType = ''): PreviewKind {
  const extension = extensionOf(filename)
  const mime = contentType.toLowerCase()
  if (extension === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tif', 'tiff'].includes(extension) || mime.startsWith('image/')) return 'image'
  if (extension === 'docx' || mime.includes('wordprocessingml')) return 'docx'
  if (['xlsx', 'xls', 'csv'].includes(extension) || mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return 'sheet'
  if (extension === 'pptx' || mime.includes('presentationml')) return 'slides'
  if (['txt', 'md', 'json', 'xml', 'log'].includes(extension) || mime.startsWith('text/') || mime === 'application/json') return 'text'
  return 'unsupported'
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '大小未知'
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 ** 2).toFixed(value >= 10 * 1024 ** 2 ? 0 : 1)} MB`
}

function sanitizeHtml(html: string) {
  const documentRoot = new DOMParser().parseFromString(`<div data-preview-root>${html}</div>`, 'text/html')
  documentRoot.querySelectorAll('script, iframe, object, embed, form, input, button, textarea, select, link, meta, base').forEach(element => element.remove())
  documentRoot.querySelectorAll<HTMLElement>('*').forEach(element => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on') || name === 'srcdoc') {
        element.removeAttribute(attribute.name)
        continue
      }
      if ((name === 'href' || name === 'src') && /^(javascript|vbscript|file):/i.test(value)) {
        element.removeAttribute(attribute.name)
      }
      if (name === 'style' && /url\s*\(|expression\s*\(/i.test(value)) element.removeAttribute(attribute.name)
    }
    if (element.tagName === 'A') {
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noopener noreferrer')
    }
  })
  return documentRoot.querySelector('[data-preview-root]')?.innerHTML || ''
}

function decodeText(buffer: ArrayBuffer, filename: string) {
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  if (extensionOf(filename) !== 'json') return decoded
  try {
    return JSON.stringify(JSON.parse(decoded), null, 2)
  } catch {
    return decoded
  }
}

function PptxSurface({ buffer }: { buffer: ArrayBuffer }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const host = hostRef.current
    if (!host) return () => { active = false }
    host.innerHTML = ''
    setLoading(true)
    setError('')

    void remoteImport(PPTX_MODULE)
      .then(async module => {
        if (!active || !hostRef.current) return
        const init = module.init || module.default?.init || (typeof module.default === 'function' ? module.default : undefined)
        if (typeof init !== 'function') throw new Error('PPTX 预览模块未提供初始化方法。')
        const viewer = init(hostRef.current, { width: 960, height: 540 })
        await viewer.preview(buffer.slice(0))
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'PPTX 解析失败。')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      if (host) host.innerHTML = ''
    }
  }, [buffer])

  return <div className="file-preview-pptx-shell">
    {loading && <div className="file-preview-loading compact"><LoaderCircle size={18} className="spinner" /> 正在解析演示文稿…</div>}
    {error && <div className="file-preview-error">PPTX 在线预览失败：{error}</div>}
    <div ref={hostRef} className="file-preview-pptx" />
  </div>
}

async function buildPreview(file: PaperFile): Promise<PreviewState> {
  const requestedName = file.n || 'attachment'
  const access = await getStoredFileAccess(file.p, requestedName, 'inline')
  const kind = previewKind(requestedName, access.contentType)
  if (kind === 'pdf' || kind === 'image' || kind === 'unsupported') return { kind, access }

  const payload = await fetchStoredFile(file.p, requestedName)
  const resolvedKind = previewKind(requestedName, payload.access.contentType)

  if (resolvedKind === 'text') {
    return { kind: 'text', access: payload.access, text: decodeText(payload.arrayBuffer, requestedName) }
  }

  if (resolvedKind === 'docx') {
    const module = await remoteImport(MAMMOTH_MODULE)
    const mammoth = module.default || module
    if (typeof mammoth.convertToHtml !== 'function') throw new Error('DOCX 预览模块加载失败。')
    const result = await mammoth.convertToHtml({ arrayBuffer: payload.arrayBuffer.slice(0) }, {
      includeDefaultStyleMap: true,
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => p.file-preview-subtitle:fresh",
      ],
    })
    return { kind: 'docx', access: payload.access, html: sanitizeHtml(result.value || '') }
  }

  if (resolvedKind === 'sheet') {
    const XLSX = await remoteImport(SHEETJS_MODULE)
    if (typeof XLSX.read !== 'function' || !XLSX.utils?.sheet_to_html) throw new Error('表格预览模块加载失败。')
    const workbook = XLSX.read(payload.arrayBuffer.slice(0), { type: 'array', cellDates: true })
    const sheets = (workbook.SheetNames || []).map((name: string) => ({
      name,
      html: sanitizeHtml(XLSX.utils.sheet_to_html(workbook.Sheets[name], { id: `sheet-${name}` })),
    }))
    return { kind: 'sheet', access: payload.access, sheets }
  }

  if (resolvedKind === 'slides') {
    return { kind: 'slides', access: payload.access, buffer: payload.arrayBuffer }
  }

  return { kind: 'unsupported', access: payload.access }
}

export default function FilePreviewModal({ file, onClose }: { file: PaperFile | null; onClose: () => void }) {
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [activeSheet, setActiveSheet] = useState(0)

  useEffect(() => {
    if (!file) return
    let active = true
    setPreview(null)
    setError('')
    setActiveSheet(0)
    void buildPreview(file)
      .then(result => { if (active) setPreview(result) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '附件预览失败。') })
    return () => { active = false }
  }, [file?.p, file?.n])

  useEffect(() => {
    if (!file) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [file, onClose])

  const activeSheetHtml = useMemo(() => preview?.sheets?.[activeSheet]?.html || '', [preview?.sheets, activeSheet])
  if (!file) return null

  const download = async () => {
    if (downloading) return
    setDownloading(true)
    setError('')
    try {
      await downloadStoredFile(file.p, file.n || 'attachment')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '附件下载失败。')
    } finally {
      setDownloading(false)
    }
  }

  const openOriginal = async () => {
    try {
      await openStoredFile(file.p, file.n || 'attachment')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法打开原文件。')
    }
  }

  return <div className="file-preview-overlay" onClick={onClose}>
    <div className="file-preview-modal" role="dialog" aria-modal="true" aria-label={`预览附件 ${file.n || ''}`} onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
      <header className="file-preview-header">
        <div className="file-preview-title-block">
          <div className="file-preview-icon"><FileText size={18} /></div>
          <div><h3>{file.n || '未命名附件'}</h3><p>{file.t || '其它'} · {preview ? formatBytes(preview.access.size) : '正在读取信息'}</p></div>
        </div>
        <div className="file-preview-actions">
          <span className="file-preview-private"><ShieldCheck size={13} /> {preview?.access.provider === 'supabase' ? '私有 Supabase' : '私有 R2'} · 临时授权</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void openOriginal()} disabled={!preview}><ExternalLink size={14} /> 原文件</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void download()} disabled={downloading}><Download size={14} /> {downloading ? '下载中' : '下载'}</button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="关闭附件预览"><X size={18} /></button>
        </div>
      </header>

      <div className="file-preview-body">
        {!preview && !error && <div className="file-preview-loading"><LoaderCircle size={22} className="spinner" /><span>正在获取临时访问权限并解析文件…</span></div>}
        {error && <div className="file-preview-error">{error}</div>}

        {preview?.kind === 'pdf' && <iframe className="file-preview-frame" src={preview.access.url} title={file.n || 'PDF 预览'} />}
        {preview?.kind === 'image' && <div className="file-preview-image-shell"><img src={preview.access.url} alt={file.n || '图片附件'} /></div>}
        {preview?.kind === 'docx' && <article className="file-preview-document" dangerouslySetInnerHTML={{ __html: preview.html || '' }} />}
        {preview?.kind === 'text' && <pre className="file-preview-text">{preview.text || ''}</pre>}
        {preview?.kind === 'sheet' && <div className="file-preview-sheet-shell">
          {(preview.sheets?.length || 0) > 1 && <div className="file-preview-sheet-tabs">{preview.sheets?.map((sheet, index) => <button type="button" key={`${sheet.name}-${index}`} className={index === activeSheet ? 'active' : ''} onClick={() => setActiveSheet(index)}>{sheet.name}</button>)}</div>}
          {preview.sheets?.length ? <div className="file-preview-sheet" dangerouslySetInnerHTML={{ __html: activeSheetHtml }} /> : <div className="file-preview-empty">工作簿中没有可显示的工作表。</div>}
        </div>}
        {preview?.kind === 'slides' && preview.buffer && <PptxSurface buffer={preview.buffer} />}
        {preview?.kind === 'unsupported' && <div className="file-preview-unsupported"><FileText size={38} /><h4>该格式暂不支持浏览器内解析</h4><p>原文件仍安全保存在私有 R2，可直接打开或下载。旧版 DOC、XLS、PPT 和压缩包采用此方式。</p></div>}
      </div>

      <footer className="file-preview-footer">
        <span>预览链接约 {Math.round((preview?.access.expiresIn || 600) / 60)} 分钟后失效</span>
        <span>Office 文件在当前浏览器本地解析，不上传至第三方预览服务</span>
      </footer>
    </div>
  </div>
}
