import { useState } from 'react'
import { Calendar, Plus, Trash2, Edit3, Check, X } from 'lucide-react'
import { TIMELINE_PRESETS } from '../lib/types'

interface Props {
  value: string
  onChange: (val: string) => void
  customOpts: string[]
  onAddCustomOpt: (opt: string) => void
}

type TimelineDraft = {
  date: string
  event: string
  note: string
}

const pad = (value: number) => String(value).padStart(2, '0')
const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseLines(text: string): string[] {
  if (!text) return []
  return text.split('\n').map(line => line.trim()).filter(Boolean)
}

function toDateInput(raw: string) {
  const normalized = raw.replace(/[/.]/g, '-')
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!match) return ''
  return `${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}`
}

function toDisplayDate(raw: string) {
  return raw.replace(/[-.]/g, '/')
}

function parseLine(line: string): TimelineDraft {
  const match = line.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*(.*)$/)
  const date = match ? toDateInput(match[1]) : ''
  const rest = (match ? match[2] : line).trim()
  const split = rest.split(/\s+-\s+/)
  return {
    date,
    event: split[0]?.trim() || '',
    note: split.slice(1).join(' - ').trim(),
  }
}

function formatLine(draft: TimelineDraft) {
  const date = draft.date ? toDisplayDate(draft.date) : toDisplayDate(today())
  const event = draft.event.trim() || '未命名事件'
  const note = draft.note.trim()
  return `${date} ${note ? `${event} - ${note}` : event}`
}

function timeValue(date?: string) {
  if (!date) return NaN
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return NaN
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isFinite(time) ? time : NaN
}

function daysBetween(start: number, end: number) {
  return Math.round((end - start) / 86400000)
}

function lineSortValue(line: string) {
  const parsed = parseLine(line)
  const time = timeValue(parsed.date)
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

function sortLines(lines: string[]) {
  return [...lines].sort((left, right) => lineSortValue(left) - lineSortValue(right))
}

function isTerminalEvent(event: string) {
  const normalized = event.toLowerCase()
  return /(accepted|accept|published|online published|rejected|reject|withdrawn|withdraw|录用|接收|见刊|在线发表|拒稿|被拒|退稿|撤稿)/.test(normalized)
}

export default function Timeline({ value, onChange, customOpts, onAddCustomOpt }: Props) {
  const lines = sortLines(parseLines(value))
  const allOpts = Array.from(new Set([...TIMELINE_PRESETS, ...customOpts]))
  const [draft, setDraft] = useState<TimelineDraft>({ date: today(), event: '', note: '' })
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<TimelineDraft>({ date: '', event: '', note: '' })
  const [showRaw, setShowRaw] = useState(false)

  const commitLines = (next: string[]) => onChange(sortLines(next).join('\n'))

  const addNode = () => {
    if (!draft.event.trim()) return
    commitLines([...lines, formatLine(draft)])
    setDraft({ date: today(), event: '', note: '' })
  }

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditDraft(parseLine(lines[index]))
  }

  const saveEdit = () => {
    if (editingIndex === null) return
    const next = [...lines]
    next[editingIndex] = formatLine(editDraft)
    commitLines(next)
    setEditingIndex(null)
  }

  const cancelEdit = () => setEditingIndex(null)

  const deleteNode = (index: number) => {
    if (!confirm('删除这条时间线记录？')) return
    commitLines(lines.filter((_, itemIndex) => itemIndex !== index))
    if (editingIndex === index) setEditingIndex(null)
  }

  const addCustomEvtType = () => {
    const value = prompt('输入新的自定义事件类型，例如：二审送出、校稿返回、缴纳 APC')
    const cleaned = value?.trim()
    if (cleaned && !allOpts.includes(cleaned)) onAddCustomOpt(cleaned)
  }

  const parsedItems = lines.map(parseLine)
  const firstFiniteTime = parsedItems.map(item => timeValue(item.date)).find(Number.isFinite)
  const lastItem = parsedItems[parsedItems.length - 1]
  const lastTime = timeValue(lastItem?.date)
  const todayDate = today()
  const todayTime = timeValue(todayDate)
  const gapToToday = Number.isFinite(lastTime) && Number.isFinite(todayTime) ? daysBetween(lastTime, todayTime) : null
  const showTodayGap = !!lastItem && gapToToday !== null && gapToToday > 0 && !isTerminalEvent(lastItem.event)
  const cumulativeToToday = showTodayGap && Number.isFinite(firstFiniteTime) ? daysBetween(firstFiniteTime as number, todayTime) : null
  let previousTime: number | null = null

  return (
    <div className="timeline-editor">
      {lines.length > 0 && !showRaw && (
        <div className="timeline timeline-editable timeline-table-mode">
          <div className="timeline-title">
            <Calendar size={13} /> 审稿时间线
            <span className="timeline-auto-sort-hint">按日期自动排序</span>
          </div>

          <div className="timeline-table-head">
            <span>日期</span>
            <span>审稿状态</span>
            <span>间隔</span>
            <span>累计</span>
            <span>操作</span>
          </div>

          {lines.map((line, index) => {
            const item = parsedItems[index]
            const isLast = index === lines.length - 1 && !showTodayGap
            const currentTime = timeValue(item.date)
            const intervalDays = Number.isFinite(currentTime) && previousTime !== null ? daysBetween(previousTime, currentTime) : null
            const cumulativeDays = Number.isFinite(currentTime) && Number.isFinite(firstFiniteTime) ? daysBetween(firstFiniteTime as number, currentTime) : null
            if (Number.isFinite(currentTime)) previousTime = currentTime
            const editing = editingIndex === index

            return (
              <div key={`${line}-${index}`} className="timeline-item timeline-row-editable timeline-table-row">
                <div className="timeline-dot-col">
                  <div className={`timeline-dot ${isLast ? 'active' : ''}`} />
                  {(!isLast || showTodayGap) && <div className="timeline-line" />}
                </div>

                <div className="timeline-content timeline-content-editable">
                  {editing ? (
                    <div className="timeline-edit-form">
                      <input type="date" className="input" value={editDraft.date} onChange={event => setEditDraft(previous => ({ ...previous, date: event.target.value }))} />
                      <input className="input" list="timeline-event-options" placeholder="状态 / 事件" value={editDraft.event} onChange={event => setEditDraft(previous => ({ ...previous, event: event.target.value }))} />
                      <input className="input" placeholder="备注，可空" value={editDraft.note} onChange={event => setEditDraft(previous => ({ ...previous, note: event.target.value }))} />
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}><Check size={13} /> 保存</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}><X size={13} /> 取消</button>
                    </div>
                  ) : (
                    <>
                      <span className="timeline-date">{item.date ? toDisplayDate(item.date) : '未定日期'}</span>
                      <span className="timeline-event-cell"><b>{item.event || '未命名事件'}</b>{item.note && <em>{item.note}</em>}</span>
                      <span className="timeline-duration-cell">{intervalDays === null ? '—' : `${intervalDays} 天`}</span>
                      <span className="timeline-duration-cell timeline-total-cell">{cumulativeDays === null ? '—' : `${cumulativeDays} 天`}</span>
                      <span className="timeline-actions">
                        <button type="button" onClick={() => startEdit(index)} title="编辑"><Edit3 size={12} /></button>
                        <button type="button" onClick={() => deleteNode(index)} title="删除" className="danger"><Trash2 size={12} /></button>
                      </span>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {showTodayGap && (
            <div className="timeline-item timeline-row-editable timeline-table-row timeline-today-row">
              <div className="timeline-dot-col"><div className="timeline-dot active today-dot" /></div>
              <div className="timeline-content timeline-content-editable">
                <span className="timeline-date">{toDisplayDate(todayDate)}</span>
                <span className="timeline-event-cell"><b>距今</b></span>
                <span className="timeline-duration-cell">{gapToToday} 天</span>
                <span className="timeline-duration-cell timeline-total-cell">{cumulativeToToday === null ? '—' : `${cumulativeToToday} 天`}</span>
                <span className="timeline-actions timeline-actions-muted">自动</span>
              </div>
            </div>
          )}
        </div>
      )}

      <datalist id="timeline-event-options">
        {allOpts.map(option => <option key={option} value={option} />)}
      </datalist>

      <div className="timeline-add-row">
        <input type="date" className="input" value={draft.date} onChange={event => setDraft(previous => ({ ...previous, date: event.target.value }))} />
        <input className="input" list="timeline-event-options" placeholder="选择或输入审稿状态" value={draft.event} onChange={event => setDraft(previous => ({ ...previous, event: event.target.value }))} />
        <input className="input" placeholder="备注，可空" value={draft.note} onChange={event => setDraft(previous => ({ ...previous, note: event.target.value }))} />
        <button type="button" className="btn btn-primary btn-sm" onClick={addNode} disabled={!draft.event.trim()}><Plus size={13} /> 添加记录</button>
      </div>

      <div className="timeline-tools-row">
        <button type="button" className="timeline-link-btn" onClick={addCustomEvtType}>新增自定义事件类型</button>
        <span />
        <button type="button" className="timeline-link-btn" onClick={() => setShowRaw(!showRaw)}>{showRaw ? '切回可视化编辑' : '原始文本编辑'}</button>
      </div>

      {showRaw && <textarea className="textarea" rows={5} value={value} onChange={event => onChange(sortLines(parseLines(event.target.value)).join('\n'))} placeholder="每行一条记录，例如：2026/05/14 With Editor - 修回稿进入编辑处理" />}
    </div>
  )
}
