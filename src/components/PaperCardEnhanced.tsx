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

function getDeadlineInfo(deadline: string | null, status: string) {
  if (!deadline) return null
  if (status !== 'revision') return { text: '✅ 修回已提交', cls: 'deadline-done' }
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (days < 0) return { text: `🚨 逾期 ${-days} 天`, cls: 'deadline-overdue' }
  if (days === 0) return { text: '🚨 今天截止', cls: 'deadline-danger' }
  if (days <= 3) return { text: `🚨 仅剩 ${days} 天`, cls: 'deadline-danger' }
  if (days <= 10) return { text: `⏳ 剩 ${days} 天`, cls: 'deadline-warn' }
  return { text: `📅 修回剩 ${days} 天`, cls: 'deadline-ok' }
}

function signalStyle(level: string) {
  if (level === 'danger') return { color: '#ef4444', background: '#fee2e2' }
  if (level === 'warn') return { color: '#d97706', background: '#fef3c7' }
  if (level === 'success') return { color: '#16a34a', background: '#dcfce7' }
  return { color: 'var(--accent)', background: 'var(--accent-bg)' }
}

export default function PaperCardEnhanced({ paper, currentUsername, authorName, allPapers, index = 0, onClick }: Props) {
  const st = getStatus(paper.status)
  const deadline = getDeadlineInfo(paper.deadline, paper.status)
  const signal = getWorkflowSignal(paper)
  const previous = paper.prev_id ? allPapers.find(p => p.id === paper.prev_id) : null

  let dateInfo = ''
  if (paper.submitted_date) {
    dateInfo = `投: ${formatDate(paper.submitted_date)}`
    const start = new Date(paper.submitted_date).getTime()
    const end = paper.resolve_date ? new Date(paper.resolve_date).getTime() : Date.now()
    const days = Math.round((end - start) / 86400000)
    if (paper.resolve_date) dateInfo += ` | 终: ${formatDate(paper.resolve_date)}`
    if (paper.status !== 'preparing' && days >= 0) dateInfo += ` | 历时: ${days}天`
  }

  const badges: { label: string; cls: string }[] = []
  if (paper.lang === 'en') {
    if (paper.quartile_jcr && paper.quartile_jcr !== '未定') badges.push({ label: `JCR: ${paper.quartile_jcr}`, cls: 'q-jcr' })
    if (paper.quartile_cas && paper.quartile_cas !== '未定') badges.push({ label: `中科院: ${paper.quartile_cas}`, cls: 'q-cas' })
    if (paper.quartile_new && paper.quartile_new !== '无') badges.push({ label: `新锐: ${paper.quartile_new}`, cls: 'q-new' })
    if (paper.quartile_cust && paper.quartile_cust !== '无') badges.push({ label: paper.quartile_cust, cls: 'q-jcr' })
  } else {
    ;(paper.quartile_zh || []).filter(Boolean).forEach(z => badges.push({ label: z, cls: 'q-zh' }))
  }

  const signalColors = signal ? signalStyle(signal.level) : null

  return (
    <div className="card animate-in" style={{ animationDelay: `${Math.min(index * 0.06, 0.6)}s` }} onClick={onClick}>
      <div className="card-top-bar" style={{ background: st.color }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className={`badge status-${paper.status}`}>{st.emoji} {st.label}</span>
        {paper.journal && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: 6 }}>📖 {paper.journal}</span>}
      </div>

      {(paper.manuscript_no || paper.submission_system || paper.system_status || paper.revision_round || paper.apc_amount) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
          {paper.manuscript_no && <span className="badge badge-sm badge-outline">ID: {paper.manuscript_no}</span>}
          {paper.submission_system && <span className="badge badge-sm badge-outline">{paper.submission_system}</span>}
          {paper.system_status && <span className="badge badge-sm badge-outline">{paper.system_status}</span>}
          {!!paper.revision_round && <span className="badge badge-sm badge-outline">R{paper.revision_round}</span>}
          {!!paper.apc_amount && <span className="badge badge-sm badge-outline">APC {paper.apc_amount} {paper.apc_currency || ''}</span>}
        </div>
      )}

      <div>
        <div className="card-title">
          {paper.lang === 'en' && <span className="lang-tag lang-en">EN</span>}
          {paper.lang === 'zh' && <span className="lang-tag lang-zh">ZH</span>}
          {paper.title || '（未命名）'}
        </div>
        {paper.lang === 'en' && paper.title_zh && <div className="card-subtitle">{paper.title_zh}</div>}
      </div>

      {badges.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{badges.map((b, i) => <span key={i} className={`badge badge-sm badge-outline ${b.cls}`}>{b.label}</span>)}</div>}

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 11 }}>
        <span style={{ color: 'var(--text-muted)', marginRight: 2 }}>👥</span>
        {(paper.authors || []).map((a, i) => {
          const isMe = authorName ? a === authorName : a === currentUsername
          const isCorresponding = paper.corresponding_author === a
          const posLabel = isMe ? (i === 0 ? ' (一作)' : ` (第${i + 1}作)`) : ''
          return <span key={`${a}-${i}`} className={`author-tag ${isMe ? 'is-me' : ''}`}>{a}{posLabel && <span style={{ opacity: 0.75, fontWeight: 400 }}>{posLabel}</span>}{isCorresponding && <span style={{ marginLeft: 2, opacity: 0.8 }} title="通讯作者">✉️</span>}</span>
        })}
        {(!paper.authors || paper.authors.length === 0) && <span style={{ color: 'var(--text-muted)' }}>--</span>}
      </div>

      {previous && <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 8, borderTop: '1px dashed var(--border-subtle)' }}>↳ 前置历史：{previous.journal || '未知期刊'} ({getStatus(previous.status).label})</div>}

      {signal && signalColors && <div title={signal.detail} style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.4, padding: '7px 9px', borderRadius: 8, color: signalColors.color, background: signalColors.background, border: '1px solid var(--border-subtle)' }}>下一步：{signal.text}<div style={{ fontSize: 10, fontWeight: 500, opacity: 0.78, marginTop: 2 }}>{signal.detail}</div></div>}

      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {deadline && <span className={`deadline-badge ${deadline.cls}`}>{deadline.text}</span>}
          {(paper.files || []).filter(f => f.p).map((f, i) => <span key={i} title={f.n || f.p} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, fontSize: 12, borderRadius: 4, background: '#f3f4f6', border: '1px solid #e5e7eb' }}>📎</span>)}
        </div>
        <span style={{ fontWeight: 600, textAlign: 'right' }}>{dateInfo}</span>
      </div>
    </div>
  )
}
