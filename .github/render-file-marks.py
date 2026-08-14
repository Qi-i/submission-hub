from pathlib import Path

p = Path('src/components/PaperCardEnhanced.tsx')
s = p.read_text(encoding='utf-8')
anchor = """function isUrl(path?: string | null) {
  return !!path && /^https?:\/\//i.test(path)
}

"""
insert = """function isUrl(path?: string | null) {
  return !!path && /^https?:\/\//i.test(path)
}

type CardFileDescriptor = { kind: string; mark: string }

function cardFileDescriptor(file: PaperFile): CardFileDescriptor {
  const normalized = `${file.t || ''} ${file.n || ''} ${file.p || ''}`.toLowerCase()
  if (/检索证明/.test(normalized)) return { kind: 'retrieval', mark: '检索' }
  if (/见刊文章|published article|final article/.test(normalized)) return { kind: 'published', mark: '见刊' }
  if (/录用通知|acceptance letter/.test(normalized)) return { kind: 'acceptance', mark: '录用' }
  if (/proof|校样/.test(normalized)) return { kind: 'proof', mark: '校样' }
  if (/response to reviewers|response|回复|审稿意见/.test(normalized)) return { kind: 'response', mark: '回复' }
  if (/cover letter/.test(normalized)) return { kind: 'document', mark: 'CL' }
  if (/初稿/.test(normalized)) return { kind: 'document', mark: '初稿' }
  if (/投稿稿/.test(normalized)) return { kind: 'document', mark: '投稿' }
  if (/修回稿/.test(normalized)) return { kind: 'document', mark: '修回' }
  if (/版权协议/.test(normalized)) return { kind: 'receipt', mark: '版权' }
  if (/apc|发票/.test(normalized)) return { kind: 'receipt', mark: '发票' }
  if (/投稿截图/.test(normalized)) return { kind: 'image', mark: '截图' }
  if (/\.pdf\b/.test(normalized)) return { kind: 'pdf', mark: 'PDF' }
  if (/\.(docx?|odt|rtf)\b/.test(normalized)) return { kind: 'document', mark: 'Word' }
  if (/\.(xlsx?|csv|ods)\b/.test(normalized)) return { kind: 'sheet', mark: '表格' }
  if (/\.(pptx?|odp)\b/.test(normalized)) return { kind: 'slides', mark: 'PPT' }
  if (/\.(png|jpe?g|webp|gif|bmp|tiff?|svg)\b/.test(normalized)) return { kind: 'image', mark: '图片' }
  if (/\.(zip|rar|7z|tar|gz)\b/.test(normalized)) return { kind: 'archive', mark: '压缩' }
  if (/\.(json|xml|html?|md|txt|log)\b/.test(normalized)) return { kind: 'code', mark: '文本' }
  return { kind: 'generic', mark: file.t?.trim() || '附件' }
}

"""
if anchor not in s:
    raise SystemExit('isUrl anchor not found')
s = s.replace(anchor, insert, 1)
old = """  const renderFile = (file: PaperFile, fileIndex: number) => {
    const title = `${file.t ? `${file.t}｜` : ''}${file.n || file.p || '附件'}`
    const content = <>📎{file.t && <span className=\"file-type-pill\">{file.t}</span>}</>
    if (isUrl(file.p)) {
      return <a key={fileIndex} className=\"file-dot\" href={file.p} target=\"_blank\" rel=\"noopener noreferrer\" title={title} onClick={event => event.stopPropagation()}>{content}</a>
    }
    if (isSupabaseStoragePath(file.p) && onOpenStoredFile) {
      return <button key={fileIndex} type=\"button\" className=\"file-dot file-dot-button\" title={title} aria-label={`打开附件 ${file.n || file.t || ''}`} onClick={event => { event.stopPropagation(); void onOpenStoredFile(file.p!) }}>{content}</button>
    }
    return <span key={fileIndex} className=\"file-dot file-dot-disabled\" title={`${title}：未设置可用的在线链接`}>{content}</span>
  }
"""
new = """  const renderFile = (file: PaperFile, fileIndex: number) => {
    const title = `${file.t ? `${file.t}｜` : ''}${file.n || file.p || '附件'}`
    const descriptor = cardFileDescriptor(file)
    const content = <>📎{file.t && <span className=\"file-type-pill\">{file.t}</span>}</>
    if (isUrl(file.p)) {
      return <a key={fileIndex} className=\"file-dot\" data-file-kind={descriptor.kind} data-file-mark={descriptor.mark} href={file.p} target=\"_blank\" rel=\"noopener noreferrer\" title={title} onClick={event => event.stopPropagation()}>{content}</a>
    }
    if (isSupabaseStoragePath(file.p) && onOpenStoredFile) {
      return <button key={fileIndex} type=\"button\" className=\"file-dot file-dot-button\" data-file-kind={descriptor.kind} data-file-mark={descriptor.mark} title={title} aria-label={`打开附件 ${file.n || file.t || ''}`} onClick={event => { event.stopPropagation(); void onOpenStoredFile(file.p!) }}>{content}</button>
    }
    return <span key={fileIndex} className=\"file-dot file-dot-disabled\" data-file-kind={descriptor.kind} data-file-mark={descriptor.mark} title={`${title}：未设置可用的在线链接`}>{content}</span>
  }
"""
if old not in s:
    raise SystemExit('renderFile block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
