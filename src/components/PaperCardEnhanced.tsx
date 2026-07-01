import type { Paper } from '../lib/types'
import { getStatus, getWorkflowSignal } from '../lib/types'

interface Props {
  paper: Paper
  currentUsername: string
  authorName: string
  allPapers: Paper[]
  index?: number
  onClick?: () => void
}

function formatDate(d?: string | null) {
  if (!d) return ''
  const parts = d.split('-')
  return parts.length === 3 ? `${parts[0]}/${parts[1]}/${parts[2]}` : d
}

function isUrl(path?: string | null) {
  return !!path && /^https?:\/\//i.test(path)
}

function doiHref(doi?: string | null) {
  if (!doi) return ''
  if (/^https?:\/\//i.test(doi)) return doi
  return `https://doi.org/${doi.replace(/^doi:\s*/i, '').trim()}`
}

function copyText(text?: string | null) {
  if (!text) return
  navigator.clipboard?.writeText(text).catch(() => undefined)
}

function getDeadlineInfo(deadline: string | null, status: string) {
  if (!deadline) return null
  if (status !== 'revision') return null
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (days < 0) return { text: `逾期 ${-days} 天`, cls: 'deadline-overdue' }
  if (days === 0) return { text: '今天截止', cls: 'deadline-danger' }
  if (days <= 3) return { text: `仅剩 ${days} 天`, cls: 'deadline-danger' }
  if (days <= 10) return { text: `剩 ${days} 天`, cls: 'deadline-warn' }
  return { text: `修回剩 ${days} 天`, cls: 'deadline-ok' }
}

function signalStyle(level: string) {
  if (level === 'danger') return { color: '#ef4444', background: 'rgba(239,68,68,0.12)' }
  if (level === 'warn') return { color: '#d97706', background: 'rgba(245,158,11,0.14)' }
  return { color: 'var(--accent)', background: 'var(--accent-bg)' }
}

function previousChain(paper: Paper, allPapers: Paper[]) {
  const chain: Paper[] = []
  let cursor: Paper | undefined = paper
  const seen = new Set<string>()
  while (cursor?.prev_id && !seen.has(cursor.prev_id)) {
    seen.add(cursor.prev_id)
    const prev = allPapers.find(p => p.id === cursor!.prev_id)
    if (!prev) break
    chain.unshift(prev)
    cursor = prev
  }
  return chain
}

function shouldSuppressSignal(paper: Paper, signal: ReturnType<typeof getWorkflowSignal>, nextCount: number) {
  if (!signal) return false
  const alreadyResubmitted = nextCount > 0 && ['rejected', 'withdrawn'].includes(paper.status)
  const isResubmitAdvice = signal.text === '准备改投' || paper.next_action === '准备改投'
  return alreadyResubmitted && isResubmitAdvice
}

export default function PaperCardEnhanced({ paper, currentUsername, authorName, allPapers, index = 0, onClick }: Props) {
  const st = getStatus(paper.status)
  const deadline = getDeadlineInfo(paper.deadline, paper.status)
  const rawSignal = getWorkflowSignal(paper)
  const chain = previousChain(paper, allPapers)
  const nextCount = allPapers.filter(p => p.prev_id === paper.id).length
  const signal = shouldSuppressSignal(paper, rawSignal, nextCount) ? null : rawSignal

  let dateInfo = ''
  if (paper.submitted_date) {
    dateInfo = `投: ${formatDate(paper.submitted_date)}`
    const start = new Date(paper.submitted_date).getTime()
    const end = paper.resolve_date ? new Date(paper.resolve_date).getTime() : Date.now()
    const days = Math.round((end - start) / 86400000)
    if (paper.resolve_date) dateInfo += ` | 终: ${formatDate(paper.resolve_date)}`
    if (paper.status !== 'preparing' && days >= 0) dateInfo += ` | ${days}天`
  }

  const badges: { label: string; cls: string }[] = []
  if (paper.lang === 'en') {
    if (paper.quartile_jcr && paper.quartile_jcr !== '未定') badges.push({ label: `JCR ${paper.quartile_jcr}`, cls: 'q-jcr' })
    if (paper.quartile_cas && paper.quartile_cas !== '未定') badges.push({ label: `中科院 ${paper.quartile_cas}`, cls: 'q-cas' })
    if (paper.quartile_new && paper.quartile_new !== '无') badges.push({ label: `新锐 ${paper.quartile_new}`, cls: 'q-new' })
    if (paper.quartile_cust && paper.quartile_cust !== '无') badges.push({ label: paper.quartile_cust, cls: 'q-jcr' })
  } else {
    ;(paper.quartile_zh || []).filter(Boolean).forEach(z => badges.push({ label: z, cls: 'q-zh' }))
  }

  const signalColors = signal ? signalStyle(signal.level) : null

  return (
    <div className="card glass-card animate-in" style={{ animationDelay: `${Math.min(index * 0.06, 0.6)}s` }} onClick={onClick}>
      <div className="card-top-bar" style={{ background: st.color }} />

      <div className="paper-card-head">
        <div className="paper-status-stack">
          <span className={`badge status-${paper.status}`}>{st.emoji} {st.label}</span>
          {paper.system_status && <span className="system-status-inline">{paper.system_status}</span>}
        </div>
        {paper.journal && <span className="journal-pill">📖 {paper.journal}</span>}
      </div>

      {(paper.manuscript_no || paper.submission_system || paper.revision_round || paper.apc_amount || isUrl(paper.published_url)) && (
        <div className="paper-meta-row paper-meta-compact">
          {paper.manuscript_no && <span className="badge badge-sm badge-outline">ID {paper.manuscript_no}</span>}
          {paper.submission_system && <span className="badge badge-sm badge-outline">{paper.submission_system}</span>}
          {!!paper.revision_round && <span className="badge badge-sm badge-outline">R{paper.revision_round}</span>}
          {!!paper.apc_amount && <span className="badge badge-sm badge-outline">APC {paper.apc_amount} {paper.apc_currency || ''}</span>}
          {isUrl(paper.published_url) && <a className="badge badge-sm badge-outline paper-publication-link" href={paper.published_url!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>见刊 ↗</a>}
        </div>
      )}

      {(paper.journal_url || paper.journal_apc_note) && <div className="journal-profile-row">
        {isUrl(paper.journal_url) && <a href={paper.journal_url!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>期刊档案 ↗</a>}
        {paper.journal_apc_note && <span title={paper.journal_apc_note}>APC / 期刊备注</span>}
      </div>}

      <div>
        <div className="card-title">
          {paper.lang === 'en' && <span className="lang-tag lang-en">EN</span>}
          {paper.lang === 'zh' && <span className="lang-tag lang-zh">ZH</span>}
          {paper.title || '（未命名）'}
        </div>
        {paper.lang === 'en' && paper.title_zh && <div className="card-subtitle">{paper.title_zh}</div>}
      </div>

      {(paper.doi || paper.publication_info || paper.citation) && <div className="archive-chip-row">
        {paper.doi && <a className="archive-chip doi" href={doiHref(paper.doi)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>DOI ↗</a>}
        {paper.publication_info && <span className="archive-chip pub" title={paper.publication_info}>{paper.publication_info}</span>}
        {paper.citation && <button type="button" className="archive-chip cite archive-copy-chip" title="点击复制引用格式" onClick={e => { e.stopPropagation(); copyText(paper.citation) }}>复制引用</button>}
      </div>}

      {badges.length > 0 && <div className="paper-meta-row">{badges.map((b, i) => <span key={i} className={`badge badge-sm badge-outline ${b.cls}`}>{b.label}</span>)}</div>}

      <div className="author-list-v2">
        <span className="author-prefix">👥</span>
        {(paper.authors || []).map((a, i) => {
          const matched = authorName ? a === authorName : a === currentUsername
          const first = i === 0
          const corresponding = paper.corresponding_author === a
          const classes = ['author-badge-v2', first ? 'first-author' : '', matched ? 'matched-author' : '', corresponding ? 'corresponding-author' : ''].filter(Boolean).join(' ')
          return <span key={`${a}-${i}`} className={classes}><span className="author-name-v2">{a}</span><span className="author-tags-v2">{first && <span className="author-tag-v2 tag-first">一作</span>}{!first && matched && <span className="author-tag-v2 tag-rank">第{i + 1}作</span>}{corresponding && <span className="author-tag-v2 tag-corresponding">通讯</span>}</span></span>
        })}
        {(!paper.authors || paper.authors.length === 0) && <span style={{ color: 'var(--text-muted)' }}>--</span>}
      </div>

      {(chain.length > 0 || nextCount > 0) && <div className="paper-history">↳ 版本链：{chain.map(p => p.journal || '未知期刊').join(' → ')}{chain.length > 0 ? ' → ' : ''}{paper.journal || '当前稿'}{nextCount > 0 ? ` → 后续 ${nextCount} 条` : ''}</div>}

      {signal && signalColors && signal.level !== 'success' && <div className="workflow-signal workflow-signal-inline" title={signal.detail} style={{ color: signalColors.color, background: signalColors.background }}><span>下一步：{signal.text}{signal.detail ? ` · ${signal.detail}` : ''}</span></div>}

      <div className="paper-card-footer">
        <div className="paper-footer-left">
          {deadline && <span className={`deadline-badge ${deadline.cls}`}>{deadline.text}</span>}
          {(paper.files || []).filter(f => f.p).map((f, i) => isUrl(f.p) ? <a key={i} className="file-dot" href={f.p} target="_blank" rel="noopener noreferrer" title={`${f.t ? `${f.t}｜` : ''}${f.n || f.p}`} onClick={e => e.stopPropagation()}>📎{f.t && <span className="file-type-pill">{f.t}</span>}</a> : <span key={i} className="file-dot file-dot-disabled" title={`${f.n || f.p}：文件链接不可用`}>📎</span>)}
        </div>
        <span className="paper-date-info">{dateInfo}</span>
      </div>
    </div>
  )
}
