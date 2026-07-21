import {
  Archive,
  BadgeCheck,
  FileCode2,
  FileImage,
  FilePenLine,
  FileSpreadsheet,
  FileText,
  MailCheck,
  Presentation,
  ReceiptText,
  type LucideIcon,
} from 'lucide-react'
import type { PaperFile } from '../lib/types'

type Tone = 'pdf' | 'document' | 'sheet' | 'slides' | 'image' | 'archive' | 'code' | 'proof' | 'receipt' | 'response' | 'generic'

type IconMeta = {
  Icon: LucideIcon
  tone: Tone
  label: string
}

function extension(name?: string | null) {
  const clean = (name || '').split(/[?#]/)[0].trim().toLowerCase()
  const match = clean.match(/\.([a-z0-9]{1,8})$/)
  return match?.[1] || ''
}

export function fileIconMeta(file: Pick<PaperFile, 'n' | 'p' | 't'>): IconMeta {
  const ext = extension(file.n || file.p)
  const type = (file.t || '').toLowerCase()

  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) return { Icon: FileSpreadsheet, tone: 'sheet', label: '表格文件' }
  if (['pptx', 'ppt', 'odp'].includes(ext)) return { Icon: Presentation, tone: 'slides', label: '演示文稿' }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'svg'].includes(ext)) return { Icon: FileImage, tone: 'image', label: '图片文件' }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { Icon: Archive, tone: 'archive', label: '压缩文件' }
  if (['json', 'xml', 'html', 'htm', 'md', 'txt', 'log'].includes(ext)) return { Icon: FileCode2, tone: 'code', label: '文本或代码文件' }
  if (ext === 'pdf') {
    if (/检索证明|录用通知|proof/.test(type)) return { Icon: BadgeCheck, tone: 'proof', label: '证明文件' }
    return { Icon: FileText, tone: 'pdf', label: 'PDF 文件' }
  }
  if (['docx', 'doc', 'odt', 'rtf'].includes(ext)) return { Icon: FilePenLine, tone: 'document', label: '文档文件' }
  if (/response|审稿意见|回复/.test(type)) return { Icon: MailCheck, tone: 'response', label: '审稿回复文件' }
  if (/apc|发票|版权协议/.test(type)) return { Icon: ReceiptText, tone: 'receipt', label: '费用或协议文件' }
  if (/检索证明|录用通知|见刊文章|proof/.test(type)) return { Icon: BadgeCheck, tone: 'proof', label: '成果归档文件' }
  return { Icon: FileText, tone: 'generic', label: '附件' }
}

export default function FileTypeIcon({ file, size = 15, className = '' }: { file: Pick<PaperFile, 'n' | 'p' | 't'>; size?: number; className?: string }) {
  const { Icon, tone, label } = fileIconMeta(file)
  return <span className={`semantic-file-icon semantic-file-icon-${tone} ${className}`.trim()} title={label} aria-hidden="true"><Icon size={size} strokeWidth={1.9} /></span>
}
