import type { Paper } from '../lib/types'
import { getStatus } from '../lib/types'
import { isR2File } from '../lib/storage'

interface Props {
  paper: Paper
  currentUsername: string
  allPapers: Paper[]
  onClick?: () => void
}

function formatDate(d: string | null) {
  if (!d) return ''
  const parts = d.split('-')
  return parts.length === 3 ? `${parts[0]}/${parts[1]}/${parts[2]}` : d
}

function getDeadlineInfo(deadline: string | null, status: string) {
  if (!deadline) return null
  // Only show countdown when actively in revision status
  if (status !== 'revision') {
    return { text: `✅ 修回已提交`, cls: 'deadline-done' }
  }
  const dlDays = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (dlDays < 0) return { text: `🚨 逾期 ${-dlDays} 天`, cls: 'deadline-overdue' }
  if (dlDays === 0) return { text: `🚨 今天截止`, cls: 'deadline-danger' }
  if (dlDays <= 3) return { text: `🚨 仅剩 ${dlDays} 天`, cls: 'deadline-danger' }
  if (dlDays <= 10) return { text: `⏳ 剩 ${dlDays} 天`, cls: 'deadline-warn' }
  return { text: `📅 修回剩 ${dlDays} 天`, cls: 'deadline-ok' }
}

function getFileStyle(ext: string) {
  const e = ext.toLowerCase()
  if (e === 'pdf') return { icon: '📄', bg: '#fee2e2', c: '#ef4444' }
  if (['doc', 'docx'].includes(e)) return { icon: '📝', bg: '#dbeafe', c: '#3b82f6' }
  if (['xls', 'xlsx', 'csv'].includes(e)) return { icon: '📊', bg: '#d1fae5', c: '#10b981' }
  if (['jpg', 'png', 'jpeg', 'gif'].includes(e)) return { icon: '🖼️', bg: '#f3e8ff', c: '#a855f7' }
  if (['zip', 'rar', '7z'].includes(e)) return { icon: '📦', bg: '#e0e7ff', c: '#6366f1' }
  return { icon: '📎', bg: '#f3f4f6', c: '#6b7280' }
}

export default function PaperCard({ paper, currentUsername, allPapers, onClick }: Props) {
  const st = getStatus(paper.status)
  const deadline = getDeadlineInfo(paper.deadline, paper.status)

  // Duration
  let dateInfo = ''
  if (paper.submitted_date && paper.status !== 'preparing') {
    const dStart = new Date(paper.submitted_date).getTime()
    const dEnd = paper.resolve_date ? new Date(paper.resolve_date).getTime() : Date.now()
    const days = Math.round((dEnd - dStart) / 86400000)
    dateInfo = `投: ${formatDate(paper.submitted_date)}`
    if (paper.resolve_date) dateInfo += ` | 终: ${formatDate(paper.resolve_date)}`
    if (days >= 0) dateInfo += ` | 历时: ${days}天`
  } else if (paper.submitted_date) {
    dateInfo = `投: ${formatDate(paper.submitted_date)}`
  }

  // Previous submission link
  const prevPaper = paper.prev_id ? allPapers.find(p => p.id === paper.prev_id) : null

  // Quartile badges
  const badges: { label: string; cls: string }[] = []
  if (paper.lang === 'en') {
    if (paper.quartile_jcr && paper.quartile_jcr !== '未定') badges.push({ label: `JCR: ${paper.quartile_jcr}`, cls: 'q-jcr' })
    if (paper.quartile_cas && paper.quartile_cas !== '未定') badges.push({ label: `中科院: ${paper.quartile_cas}`, cls: 'q-cas' })
    if (paper.quartile_new && paper.quartile_new !== '无') badges.push({ label: `新锐: ${paper.quartile_new}`, cls: 'q-new' })
    if (paper.quartile_cust && paper.quartile_cust !== '无') badges.push({ label: paper.quartile_cust, cls: 'q-jcr' })
  } else {
    ;(paper.quartile_zh || []).filter(Boolean).forEach(z => badges.push({ label: z, cls: 'q-zh' }))
  }

  return (
    <div className="card" onClick={onClick}>
      <div className="card-top-bar" style={{ background: st.color }} />

      {/* Status + Journal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className={`badge status-${paper.status}`}>
          {st.emoji} {st.label}
        </span>
        {paper.journal && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: 6,
          }}>
            📖 {paper.journal}
          </span>
        )}
      </div>

      {/* Title */}
      <div>
        <div className="card-title">
          {paper.lang === 'en' && <span className="lang-tag lang-en">EN</span>}
          {paper.lang === 'zh' && <span className="lang-tag lang-zh">ZH</span>}
          {paper.title || '（未命名）'}
        </div>
        {paper.lang === 'en' && paper.title_zh && (
          <div className="card-subtitle">{paper.title_zh}</div>
        )}
      </div>

      {/* Quartile badges */}
      {badges.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {badges.map((b, i) => (
            <span key={i} className={`badge badge-sm badge-outline ${b.cls}`}>{b.label}</span>
          ))}
        </div>
      )}

      {/* Authors */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 11 }}>
        <span style={{ color: 'var(--text-muted)', marginRight: 2 }}>👥</span>
        {(paper.authors || []).map((a, i) => {
          const isMe = a === currentUsername
          const posLabel = isMe ? (i === 0 ? ' (一作)' : ` (第${i + 1}作)`) : ''
          return (
            <span key={a} className={`author-tag ${isMe ? 'is-me' : ''}`}>
              {a}{posLabel && <span style={{ opacity: 0.75, fontWeight: 400 }}>{posLabel}</span>}
            </span>
          )
        })}
        {(!paper.authors || paper.authors.length === 0) && <span style={{ color: 'var(--text-muted)' }}>--</span>}
      </div>

      {/* Previous submission link */}
      {prevPaper && (
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', marginTop: 4,
          paddingTop: 8, borderTop: '1px dashed var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>↳</span>
          <span style={{ opacity: 0.8 }}>前置历史:</span>
          <span style={{ textDecoration: 'underline', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prevPaper.journal || '未知期刊'} ({getStatus(prevPaper.status).emoji})
          </span>
        </div>
      )}

      {/* Bottom: deadline + files + date */}
      <div style={{
        fontSize: 10, color: 'var(--text-muted)', marginTop: 'auto',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {deadline && <span className={`deadline-badge ${deadline.cls}`}>{deadline.text}</span>}
          {(paper.files || []).filter(f => f.p).map((f, i) => {
            const ext = f.p.split('.').pop() || ''
            const fs = getFileStyle(ext)
            const isDownloadable = isR2File(f.p)
            return isDownloadable ? (
              <a key={i} href={f.p} target="_blank" rel="noopener noreferrer" title={f.n || f.p.split(/[\\/]/).pop()}
                onClick={e => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 20, height: 20, fontSize: 12, borderRadius: 4,
                  background: fs.bg, border: `1px solid ${fs.c}22`, color: fs.c,
                  textDecoration: 'none', cursor: 'pointer',
                }}>
                {fs.icon}
              </a>
            ) : (
              <span key={i} title={f.n || f.p.split(/[\\/]/).pop()} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, fontSize: 12, borderRadius: 4,
                background: fs.bg, border: `1px solid ${fs.c}22`, color: fs.c,
              }}>
                {fs.icon}
              </span>
            )
          })}
        </div>
        <span style={{ fontWeight: 600 }}>{dateInfo}</span>
      </div>
    </div>
  )
}
