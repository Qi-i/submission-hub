import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { isSupabaseStoragePath } from '../lib/file-storage-path'
import { mergePaperWithJournalProfile } from '../lib/journal-paper-sync'
import type { JournalProfile } from '../lib/preparation'
import type { Paper, PaperFile } from '../lib/types'
import { daysBetweenDates, daysUntilDate, getStatus, getWorkflowSignal } from '../lib/types'
import { inferMainSubmissionStatus, inferRevisionRound } from '../lib/submission-intelligence'

interface Props {
  paper: Paper
  currentUsername: string
  authorName: string
  allPapers: Paper[]
  journalProfile?: JournalProfile
  index?: number
  onClick?: () => void
  onOpenStoredFile?: (path: string) => void | Promise<void>
}

type RankBadge = { label: string; cls: string }
type BackendAction = { url: string; label: string; hint: string; kind: 'manuscript' | 'journal' }
type PublisherIdentity = { name: string; mark: string; tone: string }

function formatDate(date?: string | null) {
  if (!date) return ''
  const parts = date.split('-')
  return parts.length === 3 ? `${parts[0]}/${parts[1]}/${parts[2]}` : date
}

function localDateString() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isUrl(path?: string | null) {
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
  if (/\.pdf/.test(normalized)) return { kind: 'pdf', mark: 'PDF' }
  if (/\.(docx?|odt|rtf)/.test(normalized)) return { kind: 'document', mark: 'Word' }
  if (/\.(xlsx?|csv|ods)/.test(normalized)) return { kind: 'sheet', mark: '表格' }
  if (/\.(pptx?|odp)/.test(normalized)) return { kind: 'slides', mark: 'PPT' }
  if (/\.(png|jpe?g|webp|gif|bmp|tiff?|svg)/.test(normalized)) return { kind: 'image', mark: '图片' }
  if (/\.(zip|rar|7z|tar|gz)/.test(normalized)) return { kind: 'archive', mark: '压缩' }
  if (/\.(json|xml|html?|md|txt|log)/.test(normalized)) return { kind: 'code', mark: '文本' }
  return { kind: 'generic', mark: file.t?.trim() || '附件' }
}

function doiHref(doi?: string | null) {
  if (!doi) return ''
  if (/^https?:\/\//i.test(doi)) return doi
  return `https://doi.org/${doi.replace(/^doi:\s*/i, '').trim()}`
}

async function copyText(text?: string | null) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
}

function getDeadlineInfo(deadline: string | null, status: string) {
  if (!deadline || status !== 'revision') return null
  const days = daysUntilDate(deadline)
  if (days === null) return null
  if (days < 0) return { text: `逾期 ${-days} 天`, cls: 'deadline-overdue' }
  if (days === 0) return { text: '今天截止', cls: 'deadline-danger' }
  if (days <= 3) return { text: `仅剩 ${days} 天`, cls: 'deadline-danger' }
  if (days <= 10) return { text: `剩 ${days} 天`, cls: 'deadline-warn' }
  return { text: `修回剩 ${days} 天`, cls: 'deadline-ok' }
}

function signalStyle(level: string) {
  if (level === 'danger') return { color: '#dc2626', background: 'rgba(239,68,68,0.1)' }
  if (level === 'warn') return { color: '#b45309', background: 'rgba(245,158,11,0.11)' }
  return { color: 'var(--accent)', background: 'var(--accent-bg)' }
}

function previousChain(paper: Paper, allPapers: Paper[]) {
  const chain: Paper[] = []
  let cursor: Paper | undefined = paper
  const seen = new Set<string>([paper.id])
  while (cursor?.prev_id && !seen.has(cursor.prev_id)) {
    seen.add(cursor.prev_id)
    const previous = allPapers.find(item => item.id === cursor!.prev_id)
    if (!previous) break
    chain.unshift(previous)
    cursor = previous
  }
  return chain
}

function shouldSuppressSignal(paper: Paper, signal: ReturnType<typeof getWorkflowSignal>, nextCount: number) {
  if (!signal) return false
  const alreadyResubmitted = nextCount > 0 && ['rejected', 'withdrawn'].includes(paper.status)
  const isResubmitAdvice = signal.text === '准备改投' || paper.next_action === '准备改投'
  return alreadyResubmitted && isResubmitAdvice
}

function authorItems(paper: Paper, currentUsername: string, authorName: string) {
  const authors = paper.authors || []
  const identity = (authorName || currentUsername).trim().toLocaleLowerCase()
  return authors.map((name, index) => ({
    name,
    index,
    first: index === 0,
    matched: !!identity && name.trim().toLocaleLowerCase() === identity,
    corresponding: !!paper.corresponding_author && paper.corresponding_author.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  }))
}

function oaLabel(value?: JournalProfile['oa_type']) {
  if (value === 'closed') return '订阅制'
  if (value === 'hybrid') return '混合 OA'
  if (value === 'gold') return '全开放获取'
  if (value === 'diamond') return '钻石 OA'
  return 'OA 未确认'
}

function resolveBackend(paper: Paper, profile?: JournalProfile): BackendAction | null {
  if (isUrl(paper.tracking_url)) {
    return {
      url: paper.tracking_url!,
      label: '稿件后台',
      hint: '打开该稿件在出版社后台中的处理页面',
      kind: 'manuscript',
    }
  }
  if (isUrl(profile?.submission_url)) {
    return {
      url: profile!.submission_url!,
      label: '投稿入口',
      hint: '尚未保存稿件专属链接，打开期刊通用投稿入口',
      kind: 'journal',
    }
  }
  return null
}

function publisherIdentity(value?: string | null): PublisherIdentity | null {
  const name = (value || '').trim()
  if (!name) return null
  const normalized = name.toLocaleLowerCase()
  const presets: Array<[RegExp, string, string]> = [
    [/elsevier/, 'E', 'elsevier'],
    [/springer nature/, 'SN', 'springer'],
    [/springer|birkh[aä]user|palgrave/, 'S', 'springer'],
    [/taylor\s*(?:&|and)\s*francis|informa/, 'T&F', 'taylor'],
    [/wiley/, 'W', 'wiley'],
    [/sage/, 'SAGE', 'sage'],
    [/mdpi/, 'MDPI', 'mdpi'],
    [/ieee/, 'IEEE', 'ieee'],
    [/copernicus/, 'C', 'copernicus'],
    [/emerald/, 'E', 'emerald'],
    [/oxford university press|\boup\b/, 'OUP', 'oup'],
    [/cambridge university press|\bcup\b/, 'CUP', 'cup'],
  ]
  const preset = presets.find(([pattern]) => pattern.test(normalized))
  if (preset) return { name, mark: preset[1], tone: preset[2] }

  const words = name.replace(/[()（）]/g, ' ').split(/\s+/).filter(Boolean)
  const mark = words.length > 1
    ? words.slice(0, 2).map(word => word[0]).join('').toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return { name, mark, tone: 'default' }
}

function JournalQuickView({ paper, profile, badges, pinned, onEnter, onLeave, onTogglePinned, onClose }: {
  paper: Paper
  profile?: JournalProfile
  badges: RankBadge[]
  pinned: boolean
  onEnter: () => void
  onLeave: () => void
  onTogglePinned: () => void
  onClose: () => void
}) {
  const website = profile?.website_url || paper.journal_url
  const backend = resolveBackend(paper, profile)
  const publisher = publisherIdentity(profile?.publisher)
  const scope = profile?.scope_zh || profile?.selection_notes || null
  const indexing = profile?.indexing || []
  return <div className={`journal-quick-overlay${pinned ? ' is-pinned' : ''}`} onClick={event => event.stopPropagation()}>
    <div
      className="journal-quick-card"
      role="dialog"
      aria-modal="false"
      aria-label="期刊信息"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onFocusCapture={onEnter}
      onBlurCapture={onLeave}
      onClick={event => event.stopPropagation()}
    >
      <div className="journal-quick-head">
        <div>
          <span>期刊信息</span>
          <h3>{profile?.name || paper.journal || '未填写期刊'}</h3>
          {publisher && <p className="journal-quick-publisher"><span>{publisher.mark}</span>{publisher.name}</p>}
        </div>
        <div className="journal-quick-head-tools">
          <button
            type="button"
            className="journal-quick-pin-button"
            aria-pressed={pinned}
            title={pinned ? '取消固定；鼠标移出后自动关闭' : '固定悬浮卡片，移开鼠标后仍保持打开'}
            onClick={event => { event.stopPropagation(); onTogglePinned() }}
          >{pinned ? '取消固定' : '固定'}</button>
          <button type="button" className="journal-quick-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
      </div>
      {badges.length > 0 && <div className="journal-quick-ranks">{badges.map((badge, index) => <span key={`${badge.label}-${index}`} className={badge.cls}>{badge.label}</span>)}</div>}
      <div className="journal-quick-facts">
        <div><b>{profile?.impact_factor ?? '—'}</b><span>影响因子</span></div>
        <div><b>{profile?.first_decision_days ?? '—'}</b><span>首轮决定/天</span></div>
        <div><b>{profile?.total_review_days ?? '—'}</b><span>总审稿/天</span></div>
        <div><b>{oaLabel(profile?.oa_type)}</b><span>开放获取</span></div>
      </div>
      {indexing.length > 0 && <div className="journal-quick-indexing">{indexing.map(item => <span key={item}>{item}</span>)}</div>}
      {scope && <p className="journal-quick-scope journal-quick-scope-zh">{scope}</p>}
      <div className="journal-quick-links">
        {backend && <a className="journal-quick-backend" href={backend.url} target="_blank" rel="noopener noreferrer" title={backend.hint}>{backend.label} ↗</a>}
        {isUrl(website) && <a href={website!} target="_blank" rel="noopener noreferrer">期刊官网 ↗</a>}
        {isUrl(profile?.author_guide_url) && <a href={profile!.author_guide_url!} target="_blank" rel="noopener noreferrer">作者指南 ↗</a>}
      </div>
    </div>
  </div>
}

export default function PaperCardEnhanced({ paper, currentUsername, authorName, allPapers, journalProfile, index = 0, onClick, onOpenStoredFile }: Props) {
  const [journalOpen, setJournalOpen] = useState(false)
  const [journalPinned, setJournalPinned] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const journalCloseTimerRef = useRef<number | null>(null)
  const journalPinnedRef = useRef(false)
  const linkedPaper = mergePaperWithJournalProfile(paper, journalProfile)
  const effectiveStatus = inferMainSubmissionStatus(linkedPaper.system_status, linkedPaper.status)
  const revisionRound = inferRevisionRound(linkedPaper.timeline, linkedPaper.system_status, Number(linkedPaper.revision_round || 0))
  const effectivePaper: Paper = { ...linkedPaper, status: effectiveStatus, revision_round: revisionRound }
  const status = getStatus(effectiveStatus)
  const deadline = getDeadlineInfo(linkedPaper.deadline, effectiveStatus)
  const rawSignal = getWorkflowSignal(effectivePaper)
  const chain = previousChain(paper, allPapers)
  const nextCount = allPapers.filter(item => item.prev_id === paper.id).length
  const signal = shouldSuppressSignal(effectivePaper, rawSignal, nextCount) ? null : rawSignal
  const authors = authorItems(linkedPaper, currentUsername, authorName)
  const authorTitle = (linkedPaper.authors || []).join('、')
  const backend = resolveBackend(linkedPaper, journalProfile)
  const publisher = publisherIdentity(journalProfile?.publisher)
  const statusBackend = effectiveStatus !== 'preparing' ? backend : null

  const clearJournalCloseTimer = () => {
    if (journalCloseTimerRef.current === null) return
    window.clearTimeout(journalCloseTimerRef.current)
    journalCloseTimerRef.current = null
  }

  const openJournalPreview = () => {
    clearJournalCloseTimer()
    setJournalOpen(true)
  }

  const closeJournal = () => {
    clearJournalCloseTimer()
    journalPinnedRef.current = false
    setJournalPinned(false)
    setJournalOpen(false)
  }

  const scheduleJournalClose = () => {
    clearJournalCloseTimer()
    if (journalPinnedRef.current) return
    journalCloseTimerRef.current = window.setTimeout(() => {
      journalCloseTimerRef.current = null
      if (journalPinnedRef.current) return
      const hoveredOrFocused = cardRef.current?.querySelector('.journal-pill-button:hover, .journal-quick-card:hover, .journal-pill-button:focus-visible, .journal-quick-card:focus-within')
      if (!hoveredOrFocused) setJournalOpen(false)
    }, 220)
  }

  const toggleJournalPinned = () => {
    clearJournalCloseTimer()
    const next = !journalPinnedRef.current
    journalPinnedRef.current = next
    setJournalPinned(next)
    setJournalOpen(true)
    if (!next) scheduleJournalClose()
  }

  const activateJournalLabel = () => {
    if (journalPinnedRef.current) closeJournal()
    else toggleJournalPinned()
  }

  useEffect(() => () => clearJournalCloseTimer(), [])

  useEffect(() => {
    if (!journalPinned) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      const card = cardRef.current
      const button = card?.querySelector('.journal-pill-button')
      const popover = card?.querySelector('.journal-quick-card')
      if (button?.contains(target) || popover?.contains(target)) return
      closeJournal()
    }
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeJournal()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [journalPinned])

  let dateInfo = ''
  if (linkedPaper.submitted_date) {
    dateInfo = `投: ${formatDate(linkedPaper.submitted_date)}`
    const endDate = linkedPaper.resolve_date || localDateString()
    const days = daysBetweenDates(linkedPaper.submitted_date, endDate)
    if (linkedPaper.resolve_date) dateInfo += ` · 终: ${formatDate(linkedPaper.resolve_date)}`
    if (effectiveStatus !== 'preparing' && days !== null && days >= 0) dateInfo += ` · ${days}天`
  }

  const badges: RankBadge[] = []
  if (linkedPaper.lang === 'en') {
    if (linkedPaper.quartile_new && linkedPaper.quartile_new !== '无') badges.push({ label: `新锐 ${linkedPaper.quartile_new}`, cls: 'q-new' })
    if (linkedPaper.quartile_cas && linkedPaper.quartile_cas !== '未定') badges.push({ label: `中科院 ${linkedPaper.quartile_cas}`, cls: 'q-cas' })
    if (linkedPaper.quartile_jcr && linkedPaper.quartile_jcr !== '未定') badges.push({ label: `JCR ${linkedPaper.quartile_jcr}`, cls: 'q-jcr' })
    if (linkedPaper.quartile_cust && linkedPaper.quartile_cust !== '无') badges.push({ label: linkedPaper.quartile_cust, cls: 'q-jcr' })
  } else {
    ;(linkedPaper.quartile_zh || []).filter(Boolean).forEach(item => badges.push({ label: item, cls: 'q-zh' }))
  }

  const signalColors = signal ? signalStyle(signal.level) : null
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  const renderFile = (file: PaperFile, fileIndex: number) => {
    const title = `${file.t ? `${file.t}｜` : ''}${file.n || file.p || '附件'}`
    const descriptor = cardFileDescriptor(file)
    const content = <>📎{file.t && <span className="file-type-pill">{file.t}</span>}</>
    if (isUrl(file.p)) {
      return <a key={fileIndex} className="file-dot" data-file-kind={descriptor.kind} data-file-mark={descriptor.mark} href={file.p} target="_blank" rel="noopener noreferrer" title={title} onClick={event => event.stopPropagation()}>{content}</a>
    }
    if (isSupabaseStoragePath(file.p) && onOpenStoredFile) {
      return <button key={fileIndex} type="button" className="file-dot file-dot-button" data-file-kind={descriptor.kind} data-file-mark={descriptor.mark} title={title} aria-label={`打开附件 ${file.n || file.t || ''}`} onClick={event => { event.stopPropagation(); void onOpenStoredFile(file.p!) }}>{content}</button>
    }
    return <span key={fileIndex} className="file-dot file-dot-disabled" data-file-kind={descriptor.kind} data-file-mark={descriptor.mark} title={`${title}：未设置可用的在线链接`}>{content}</span>
  }

  return (
    <div
      ref={cardRef}
      className="card glass-card paper-card-v3 animate-in"
      style={{ ['--paper-status-color' as any]: status.color, animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="paper-card-head">
        <div className="paper-status-area" data-status={effectiveStatus}>
          {statusBackend
            ? <a className={`badge status-${effectiveStatus} paper-status-backend`} href={statusBackend.url} target="_blank" rel="noopener noreferrer" title={`${status.label} · ${statusBackend.hint}`} onClick={event => event.stopPropagation()}>
                <span>{status.emoji} {status.label}</span>
                <span className="paper-status-backend-hint">{statusBackend.kind === 'manuscript' ? '后台' : '投稿'} ↗</span>
              </a>
            : <span className={`badge status-${effectiveStatus}`}>{status.emoji} {status.label}</span>}
          {linkedPaper.system_status && <span className="paper-substatus" title={`${linkedPaper.system_status} · 已自动归类为${status.label}`}><span className="paper-substatus-dot" aria-hidden="true" /><span className="paper-substatus-text">{linkedPaper.system_status}</span></span>}
          {!!revisionRound && <span className="paper-revision-inline" title="根据审稿时间线自动识别">R{revisionRound}</span>}
        </div>
        <div className="paper-journal-slot">
          {linkedPaper.journal && <button
            type="button"
            className="journal-pill journal-pill-button"
            title="悬停预览期刊信息；点击可固定或关闭"
            aria-haspopup="dialog"
            aria-expanded={journalOpen}
            onPointerEnter={event => { event.stopPropagation(); openJournalPreview() }}
            onPointerLeave={event => { event.stopPropagation(); scheduleJournalClose() }}
            onFocus={event => { event.stopPropagation(); openJournalPreview() }}
            onBlur={event => { event.stopPropagation(); scheduleJournalClose() }}
            onClick={event => { event.stopPropagation(); activateJournalLabel() }}
          ><span className="journal-pill-icon" aria-hidden="true">📖</span><span className="journal-pill-text">{linkedPaper.journal}</span><span className="journal-pill-hint">详情</span></button>}
        </div>
      </div>

      {(publisher || backend || isUrl(linkedPaper.published_url)) && <div className="paper-meta-row paper-meta-compact paper-action-rail">
        {publisher && <span className="publisher-mark" data-publisher={publisher.tone} title={`出版社：${publisher.name}`}><span className="publisher-mark-symbol">{publisher.mark}</span><span className="publisher-mark-name">{publisher.name}</span></span>}
        {backend && <a className={`badge badge-sm badge-outline paper-backend-link is-${backend.kind}`} href={backend.url} target="_blank" rel="noopener noreferrer" title={backend.hint} onClick={event => event.stopPropagation()}><span>{backend.label}</span><span aria-hidden="true">↗</span></a>}
        {isUrl(linkedPaper.published_url) && <a className="badge badge-sm badge-outline paper-publication-link" href={linkedPaper.published_url!} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>见刊 ↗</a>}
      </div>}

      <div className="title-block" title={linkedPaper.title || '（未命名）'}>
        <div className="card-title">{linkedPaper.lang === 'en' && <span className="lang-tag lang-en">EN</span>}{linkedPaper.lang === 'zh' && <span className="lang-tag lang-zh">ZH</span>}{linkedPaper.title || '（未命名）'}</div>
        {linkedPaper.lang === 'en' && linkedPaper.title_zh && <div className="card-subtitle" title={linkedPaper.title_zh}>{linkedPaper.title_zh}</div>}
      </div>

      {(linkedPaper.doi || linkedPaper.publication_info || linkedPaper.citation) && <div className="archive-chip-row">{linkedPaper.doi && <a className="archive-chip doi" href={doiHref(linkedPaper.doi)} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>DOI ↗</a>}{linkedPaper.publication_info && <span className="archive-chip pub" title={linkedPaper.publication_info}>{linkedPaper.publication_info}</span>}{linkedPaper.citation && <button type="button" className="archive-chip cite archive-copy-chip" title="点击复制引用格式" onClick={event => { event.stopPropagation(); void copyText(linkedPaper.citation) }}>复制引用</button>}</div>}

      {badges.length > 0 && <div className="paper-meta-row paper-rank-row">{badges.map((badge, badgeIndex) => <span key={badgeIndex} className={`badge badge-sm badge-outline ${badge.cls}`} title={badge.label}>{badge.label}</span>)}</div>}

      <div className="author-list-v2" title={authorTitle}><span className="author-prefix">👥</span>{authors.map(({ name, index: authorIndex, first, matched, corresponding }) => { const classes = ['author-badge-v2', first ? 'first-author' : '', matched ? 'matched-author' : '', corresponding ? 'corresponding-author' : ''].filter(Boolean).join(' '); return <span key={`${name}-${authorIndex}`} className={classes}><span className="author-name-v2">{name}</span><span className="author-tags-v2">{first && <span className="author-tag-v2 tag-first">一作</span>}{!first && matched && <span className="author-tag-v2 tag-rank">第{authorIndex + 1}作</span>}{corresponding && <span className="author-tag-v2 tag-corresponding">通讯</span>}</span></span> })}{authors.length === 0 && <span style={{ color: 'var(--text-muted)' }}>--</span>}</div>

      {(chain.length > 0 || nextCount > 0) && <div className="paper-history" title={`版本链：${chain.map(item => item.journal || '未知期刊').join(' → ')}${chain.length > 0 ? ' → ' : ''}${linkedPaper.journal || '当前稿'}${nextCount > 0 ? ` → 后续 ${nextCount} 条` : ''}`}>↳ 版本链：{chain.map(item => item.journal || '未知期刊').join(' → ')}{chain.length > 0 ? ' → ' : ''}{linkedPaper.journal || '当前稿'}{nextCount > 0 ? ` → 后续 ${nextCount} 条` : ''}</div>}

      <div className="paper-card-footer">
        <div className="paper-footer-left">
          {deadline && <span className={`deadline-badge ${deadline.cls}`}>{deadline.text}</span>}
          {signal && signalColors && signal.level !== 'success' && <span className="paper-next-action-chip" title={signal.detail} style={{ color: signalColors.color, background: signalColors.background }}>下一步 · {signal.text}</span>}
          {(linkedPaper.files || []).filter(file => file.p || file.n).map(renderFile)}
        </div>
        <span className="paper-date-info">{dateInfo}</span>
      </div>

      {journalOpen && <JournalQuickView
        paper={linkedPaper}
        profile={journalProfile}
        badges={badges}
        pinned={journalPinned}
        onEnter={openJournalPreview}
        onLeave={scheduleJournalClose}
        onTogglePinned={toggleJournalPinned}
        onClose={closeJournal}
      />}
    </div>
  )
}