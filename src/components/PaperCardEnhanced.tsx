import { useState, type KeyboardEvent } from 'react'
import { mergePaperWithJournalProfile } from '../lib/journal-paper-sync'
import type { JournalProfile } from '../lib/preparation'
import type { Paper } from '../lib/types'
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
}

type RankBadge = { label: string; cls: string }

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

function oaLabel(value?: JournalProfile['oa_type']) {
  if (value === 'closed') return '订阅制'
  if (value === 'hybrid') return '混合 OA'
  if (value === 'gold') return '全开放获取'
  if (value === 'diamond') return '钻石 OA'
  return 'OA 未确认'
}

function JournalQuickView({ paper, profile, badges, onClose }: { paper: Paper; profile?: JournalProfile; badges: RankBadge[]; onClose: () => void }) {
  const website = profile?.website_url || paper.journal_url
  const submission = profile?.submission_url || paper.tracking_url
  const scope = profile?.scope
  const indexing = profile?.indexing || []
  return <div className="journal-quick-overlay" onClick={event => { event.stopPropagation(); onClose() }}>
    <div className="journal-quick-card" role="dialog" aria-modal="true" aria-label="期刊信息" onClick={event => event.stopPropagation()}>
      <div className="journal-quick-head">
        <div><span>期刊信息</span><h3>{profile?.name || paper.journal || '未填写期刊'}</h3>{profile?.publisher && <p>{profile.publisher}</p>}</div>
        <button type="button" onClick={onClose} aria-label="关闭">×</button>
      </div>
      {badges.length > 0 && <div className="journal-quick-ranks">{badges.map((badge, index) => <span key={`${badge.label}-${index}`} className={badge.cls}>{badge.label}</span>)}</div>}
      <div className="journal-quick-facts">
        <div><b>{profile?.impact_factor ?? '—'}</b><span>影响因子</span></div>
        <div><b>{profile?.first_decision_days ?? '—'}</b><span>首轮决定/天</span></div>
        <div><b>{profile?.total_review_days ?? '—'}</b><span>总审稿/天</span></div>
        <div><b>{oaLabel(profile?.oa_type)}</b><span>开放获取</span></div>
      </div>
      {indexing.length > 0 && <div className="journal-quick-indexing">{indexing.map(item => <span key={item}>{item}</span>)}</div>}
      {scope && <p className="journal-quick-scope">{scope}</p>}
      <div className="journal-quick-links">
        {isUrl(website) && <a href={website!} target="_blank" rel="noopener noreferrer">期刊官网 ↗</a>}
        {isUrl(profile?.author_guide_url) && <a href={profile!.author_guide_url!} target="_blank" rel="noopener noreferrer">作者指南 ↗</a>}
        {isUrl(submission) && <a href={submission!} target="_blank" rel="noopener noreferrer">投稿入口 ↗</a>}
      </div>
    </div>
  </div>
}

export default function PaperCardEnhanced({ paper, currentUsername, authorName, allPapers, journalProfile, index = 0, onClick }: Props) {
  const [journalOpen, setJournalOpen] = useState(false)
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
        <div className="paper-status-area" data-status={effectiveStatus}>
          <span className={`badge status-${effectiveStatus}`}>{status.emoji} {status.label}</span>
          {linkedPaper.system_status && <span className="paper-substatus" title={`${linkedPaper.system_status} · 已自动归类为${status.label}`}><span className="paper-substatus-dot" aria-hidden="true" /><span className="paper-substatus-text">{linkedPaper.system_status}</span></span>}
          {!!revisionRound && <span className="paper-revision-inline" title="根据审稿时间线自动识别">R{revisionRound}</span>}
        </div>
        <div className="paper-journal-slot">
          {linkedPaper.journal && <button type="button" className="journal-pill journal-pill-button" title="点击查看期刊信息" onClick={event => { event.stopPropagation(); setJournalOpen(true) }}><span className="journal-pill-icon" aria-hidden="true">📖</span><span className="journal-pill-text">{linkedPaper.journal}</span><span className="journal-pill-hint">详情</span></button>}
        </div>
      </div>

      {(linkedPaper.manuscript_no || linkedPaper.submission_system || isUrl(linkedPaper.published_url)) && <div className="paper-meta-row paper-meta-compact">
        {linkedPaper.manuscript_no && <span className="badge badge-sm badge-outline" title={linkedPaper.manuscript_no}>ID {linkedPaper.manuscript_no}</span>}
        {linkedPaper.submission_system && <span className="badge badge-sm badge-outline" title={linkedPaper.submission_system}>{linkedPaper.submission_system}</span>}
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
          {(linkedPaper.files || []).filter(file => file.p || file.n).map((file, fileIndex) => isUrl(file.p) ? <a key={fileIndex} className="file-dot" href={file.p} target="_blank" rel="noopener noreferrer" title={`${file.t ? `${file.t}｜` : ''}${file.n || file.p}`} onClick={event => event.stopPropagation()}>📎{file.t && <span className="file-type-pill">{file.t}</span>}</a> : <span key={fileIndex} className="file-dot file-dot-disabled" title={`${file.t ? `${file.t}｜` : ''}${file.n || '本地文件记录'}：未设置在线链接`}>📎{file.t && <span className="file-type-pill">{file.t}</span>}</span>)}
        </div>
        <span className="paper-date-info">{dateInfo}</span>
      </div>

      {journalOpen && <JournalQuickView paper={linkedPaper} profile={journalProfile} badges={badges} onClose={() => setJournalOpen(false)} />}
    </div>
  )
}
