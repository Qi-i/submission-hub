import { useState } from 'react'
import { Calendar, Plus, Trash2, RefreshCw } from 'lucide-react'
import { TIMELINE_PRESETS } from '../lib/types'

interface Props {
  value: string
  onChange: (val: string) => void
  customOpts: string[]
  onAddCustomOpt: (opt: string) => void
}

function parseLines(text: string): string[] {
  if (!text) return []
  return text.split('\n').map(l => l.trim()).filter(Boolean)
}

function parseDate(line: string) {
  const m = line.match(/^(\d{4}[-/.](\d{1,2})[-/.](\d{1,2}))\s*(.*)/)
  if (!m) return null
  return { dateStr: m[1].replace(/[-.]/g, '/'), rest: m[4] || '', raw: m[1] }
}

export default function Timeline({ value, onChange, customOpts, onAddCustomOpt }: Props) {
  const [tlDate, setTlDate] = useState(new Date().toISOString().slice(0, 10))
  const [tlEvt, setTlEvt] = useState(TIMELINE_PRESETS[0])
  const [tlNote, setTlNote] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  const lines = parseLines(value)
  const allOpts = [...TIMELINE_PRESETS, ...customOpts]

  const addNode = () => {
    if (!tlEvt) return
    const dStr = tlDate ? tlDate.replace(/-/g, '/') : new Date().toISOString().slice(0, 10).replace(/-/g, '/')
    const evtText = tlNote ? `${tlEvt} - ${tlNote}` : tlEvt
    const newLine = `${dStr} ${evtText}`
    const newLines = [...lines, newLine]
    onChange(newLines.join('\n'))
    setTlNote('')
  }

  const deleteNode = (idx: number) => {
    const newLines = lines.filter((_, i) => i !== idx)
    onChange(newLines.join('\n'))
  }

  const syncDates = (submittedDate?: string, resolveDate?: string) => {
    let newLines = [...lines]
    if (submittedDate && !newLines.some(l => l.includes('Submitted'))) {
      newLines.unshift(submittedDate.replace(/-/g, '/') + ' Submitted')
    }
    if (resolveDate && !newLines.some(l => l.includes('Accepted'))) {
      newLines.push(resolveDate.replace(/-/g, '/') + ' Accepted')
    }
    onChange(newLines.join('\n'))
  }

  const addCustomEvtType = () => {
    const v = prompt('输入新的自定义事件类型 (如：二审送出、校稿返回):')
    if (v?.trim() && !TIMELINE_PRESETS.includes(v.trim()) && !customOpts.includes(v.trim())) {
      onAddCustomOpt(v.trim())
    }
  }

  let prevDateObj: Date | null = null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Visual timeline */}
      {lines.length > 0 && !showRaw && (
        <div className="timeline">
          <div className="timeline-title">
            <Calendar size={14} /> 时间线概览
          </div>
          {lines.map((line, i) => {
            const parsed = parseDate(line)
            const dStr = parsed?.dateStr || (prevDateObj ? prevDateObj.toISOString().slice(0, 10).replace(/-/g, '/') : '未定日期')
            const txt = parsed?.rest || line
            let intervalStr = ''

            if (parsed) {
              const dObj = new Date(parsed.raw.replace(/\//g, '-'))
              if (!isNaN(dObj.getTime())) {
                if (prevDateObj && i > 0) {
                  const dd = Math.round((dObj.getTime() - prevDateObj.getTime()) / 86400000)
                  intervalStr = `间隔 ${dd} 天`
                }
                prevDateObj = dObj
              }
            }

            const isLast = i === lines.length - 1

            return (
              <div key={i} className="timeline-item">
                <div className="timeline-dot-col">
                  <div className={`timeline-dot ${isLast ? 'active' : ''}`} />
                  {!isLast && <div className="timeline-line" />}
                </div>
                <div className="timeline-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="timeline-date">{dStr}</span>
                    <button
                      onClick={() => deleteNode(i)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, opacity: 0.6 }}
                      title="删除"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div className="timeline-text">{txt}</div>
                  {intervalStr && <div className="timeline-interval">{intervalStr}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add node controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="date"
          className="input"
          style={{ width: 150, fontSize: 12, padding: '6px 10px' }}
          value={tlDate}
          onChange={e => setTlDate(e.target.value)}
        />
        <select
          className="select"
          style={{ width: 180, fontWeight: 700, padding: '6px 10px', color: 'var(--accent)' }}
          value={tlEvt}
          onChange={e => setTlEvt(e.target.value)}
        >
          {allOpts.map(o => (
            <option key={o} value={o}>{o}{customOpts.includes(o) ? ' (自定义)' : ''}</option>
          ))}
        </select>
        <input
          className="input"
          placeholder="备注 (可选)"
          style={{ flex: 1, padding: '6px 10px' }}
          value={tlNote}
          onChange={e => setTlNote(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={addNode}>
          <Plus size={13} /> 追加
        </button>
      </div>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11 }}>
        <span
          style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 700 }}
          onClick={addCustomEvtType}
        >
          [+ 新增自定义事件类型]
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{ color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => syncDates()}
        >
          🔄 同步日期字段
        </span>
        <span
          style={{ color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => setShowRaw(!showRaw)}
        >
          📝 {showRaw ? '可视化' : '原始文本'}
        </span>
      </div>

      {/* Raw text area */}
      {showRaw && (
        <textarea
          className="textarea"
          rows={4}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="每行一条记录，格式: YYYY/MM/DD 事件描述"
        />
      )}
    </div>
  )
}
