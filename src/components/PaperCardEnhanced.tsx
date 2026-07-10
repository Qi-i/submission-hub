import type { KeyboardEvent } from 'react'
import type { Paper } from '../lib/types'
import { daysBetweenDates, daysUntilDate, getStatus, getWorkflowSignal } from '../lib/types'

interface Props {
  paper: Paper
  currentUsername: string
  authorName: string
  allPapers: Paper[]
  index?: number
  onClick?: () => void
}

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

export default function PaperCardEnhanced({ paper, currentUsername, authorName, allPapers, index = 0, onClick }: Props) {
  const status = getStatus(paper.status)
  const deadline = getDeadlineInfo(paper.deadline, paper.status)
  const rawSignal = getWorkflowSignal(paper)
  const chain = previousChain(paper, allPapers)
  const nextCount = allPapers.filter(item => item.prev_id === paper.id).length
  const signal = shouldSuppressSignal(paper, rawSignal, nextCount) ? null : rawSignal
  const authors = authorItems(paper, currentUsername, authorName)
  const authorTitle = (paper.authors || []).join('、')

  let dateInfo = ''
  if (paper.submitted_date) {
    dateInfo = `投: ${formatDate(paper.submitted_date)}`
    const endDate = paper.resolve_date || localDateString()
    const days = daysBetweenDates(paper.submitted_date, endDate)
    if (paper.resolve_date) dateInfo += ` · 终: ${formatDate(paper.resolve_date)}`
    if (paper.status !== 'preparing' && days !== null && days >= 0) dateInfo += ` · ${days}天`
  }

  const badges: { label: string; cls: string }[] = []
  if (paper.lang === 'en') {
    if (paper.quartile_jcr && paper.quartile_jcr !== '未定') badges.push({ label: `JCR ${paper.quartile_jcr}`, cls: 'q-jcr' })
    if (paper.quartile_cas && paper.quartile_cas !== '未定') badges.push({ label: `中科院 ${paper.quartile_cas}`, cls: 'q-cas' })
    if (paper.quartile_new && paper.quartile_new !== '无') badges.push({ label: `新锐 ${paper.quartile_new}`, cls: 'q-new' })
    if (paper.quartile_cust && paper.quartile_cust !== '无') badges.push({ label: paper.quartile_cust, cls: 'q-jcr' })
  } else {
    ;(paper.quartile_zh || []).filter(Boolean).forEach(item => badges.push({ label: item, cls: 'q-zh' }))
  }

  const signalColors = signal ? signalStyle(signal.level) : null
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className="card glass-card paper-card-v3 animate-in"
      style={{ ['--paper-status-color' as any]: status.color, animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="paper-card-head">
        <div className="paper-status-area" data-status={paper.status}>
          <span className={`badge status-${paper.status}`}>{status.emoji} {status.label}</span>
          {paper.system_status && (
            <span className="paper-substatus" title={paper.system_status}>
              <span className="paper-substatus-dot" aria-hidden="true" />
              <span className="paper-substatus-text">{paper.system_status}</span>
            </span>
          )}
        </div>
        {paper.journal && (
          <span className="journal-pill" title={paper.journal}>
            <span className="journal-pill-icon" aria-hidden="true">📖</span>
            <span className="journal-pill-text">{paper.journal}</span>
          </span>
        )}
      </div>

      {(paper.manuscript_no || paper.submission_system || paper.revision_round || paper.apc_amount || isUrl(paper.published_url)) && <div className="paper-meta-row paper-meta-compact">
        {paper.manuscript_no && <span className="badge badge-sm badge-outline" title={paper.manuscript_no}>ID {paper.manuscript_no}</span>}
        {paper.submission_system && <span className="badge badge-sm badge-outline" title={paper.submission_system}>{paper.submission_system}</span>}
        {!!paper.revision_round && <span className="badge badge-sm badge-outline">R{paper.revision_round}</span>}
        {!!paper.apc_amount && <span className="badge badge-sm badge-outline">APC {paper.apc_amount} {paper.apc_currency || ''}</span>}
        {isUrl(paper.published_url) && <a className="badge badge-sm badge-outline paper-publication-link" href={paper.published_url!} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>见刊 ↗</a>}
      </div>}

      {(paper.journal_url || paper.journal_apc_note) && <div className="journal-profile-row">{isUrl(paper.journal_url) && <a href={paper.journal_url!} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>期刊档案 ↗</a>}{paper.journal_apc_note && <span title={paper.journal_apc_note}>APC / 期刊备注</span>}</div>}

      <div className="title-block" title={paper.title || '（未命名）'}>
        <div className="card-title">{paper.lang === 'en' && <span className="lang-tag lang-en">EN</span>}{paper.lang === 'zh' && <span className="lang-tag lang-zh">ZH</span>}{paper.title || '（未命名）'}</div>
        {paper.lang === 'en' && paper.title_zh && <div className="card-subtitle" title={paper.title_zh}>{paper.title_zh}</div>}
      </div>

      {(paper.doi || paper.publication_info || paper.citation) && <div className="archive-chip-row">{paper.doi && <a className="archive-chip doi" href={doiHref(paper.doi)} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>DOI ↗</a>}{paper.publication_info && <span className="archive-chip pub" title={paper.publication_info}>{paper.publication_info}</span>}{paper.citation && <button type="button" className="archive-chip cite archive-copy-chip" title="点击复制引用格式" onClick={event => { event.stopPropagation(); void copyText(paper.citation) }}>复制引用</button>}</div>}

      {badges.length > 0 && <div className="paper-meta-row">{badges.map((badge, badgeIndex) => <span key={badgeIndex} className={`badge badge-sm badge-outline ${badge.cls}`} title={badge.label}>{badge.label}</span>)}</div>}

      <div className="author-list-v2" title={authorTitle}><span className="author-prefix">👥</span>{authors.map(({ name, index: authorIndex, first, matched, corresponding }) => { const classes = ['author-badge-v2', first ? 'first-author' : '', matched ? 'matched-author' : '', corresponding ? 'corresponding-author' : ''].filter(Boolean).join(' '); return <span key={`${name}-${authorIndex}`} className={classes}><span className="author-name-v2">{name}</span><span className="author-tags-v2">{first && <span className="author-tag-v2 tag-first">一作</span>}{!first && matched && <span className="author-tag-v2 tag-rank">第{authorIndex + 1}作</span>}{corresponding && <span className="author-tag-v2 tag-corresponding">通讯</span>}</span></span> })}{authors.length === 0 && <span style={{ color: 'var(--text-muted)' }}>--</span>}</div>

      {(chain.length > 0 || nextCount > 0) && <div className="paper-history" title={`版本链：${chain.map(item => item.journal || '未知期刊').join(' → ')}${chain.length > 0 ? ' → ' : ''}${paper.journal || '当前稿'}${nextCount > 0 ? ` → 后续 ${nextCount} 条` : ''}`}>↳ 版本链：{chain.map(item => item.journal || '未知期刊').join(' → ')}{chain.length > 0 ? ' → ' : ''}{paper.journal || '当前稿'}{nextCount > 0 ? ` → 后续 ${nextCount} 条` : ''}</div>}
      {signal && signalColors && signal.level !== 'success' && <div className="workflow-signal workflow-signal-inline" title={signal.detail} style={{ color: signalColors.color, background: signalColors.background }}><span>下一步：{signal.text}</span></div>}

      <div className="paper-card-footer"><div className="paper-footer-left">{deadline && <span className={`deadline-badge ${deadline.cls}`}>{deadline.text}</span>}{(paper.files || []).filter(file => file.p || file.n).map((file, fileIndex) => isUrl(file.p) ? <a key={fileIndex} className="file-dot" href={file.p} target="_blank" rel="noopener noreferrer" title={`${file.t ? `${file.t}｜` : ''}${file.n || file.p}`} onClick={event => event.stopPropagation()}>📎{file.t && <span className="file-type-pill">{file.t}</span>}</a> : <span key={fileIndex} className="file-dot file-dot-disabled" title={`${file.t ? `${file.t}｜` : ''}${file.n || '本地文件记录'}：未设置在线链接`}>📎{file.t && <span className="file-type-pill">{file.t}</span>}</span>)}</div><span className="paper-date-info">{dateInfo}</span></div>
    </div>
  )
}
