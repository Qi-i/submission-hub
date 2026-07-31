import { useState } from 'react'
import { ArrowLeftRight, Calendar, Check, Clock3, Edit3, Plus, Trash2, X } from 'lucide-react'
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

type RowInsight = {
  label: string
  kind: 'start' | 'result' | 'waiting'
  title?: string
}

type ReviewRound = {
  number: number
  startIndex: number
  endIndex: number | null
  startEvent: string
  endEvent: string
  days: number
  kind: 'completed' | 'waiting'
  breakdown: string
}

type IntervalCandidate = {
  key: string
  index: number
  date: string
  event: string
  time: number
}

type ActiveRound = {
  number: number
  startIndex: number
  startTime: number
  startEvent: string
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
  const time = timeValue(parseLine(line).date)
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

function sortLines(lines: string[]) {
  return [...lines].sort((left, right) => lineSortValue(left) - lineSortValue(right))
}

function normalizedEvent(event: string) {
  return event.toLocaleLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function isSubmissionEvent(event: string) {
  return /(submitted|submission received|new submission|resubmitted|resubmission|revised manuscript submitted|revision submitted|revised submission|投稿成功|已投稿|首投|修回提交|修订稿提交|返修提交|重新提交)/.test(normalizedEvent(event))
}

function isResponseEvent(event: string) {
  if (isSubmissionEvent(event)) return false
  return /(major revision|minor revision|revision required|revise and resubmit|reviews? returned|decision made|accepted|acceptance|rejected|reject|declined|desk reject|大修|小修|退修|修回意见|返修意见|审稿意见|录用|接收|拒稿|退稿)/.test(normalizedEvent(event))
}

function isRevisionOutcomeEvent(event: string) {
  if (isSubmissionEvent(event)) return false
  return /(major revision|minor revision|revision required|revise and resubmit|大修|小修|退修|修回意见|返修意见)/.test(normalizedEvent(event))
}

function isTerminalEvent(event: string) {
  return /(accepted|accept|published|online published|rejected|reject|withdrawn|withdraw|录用|接收|见刊|在线发表|拒稿|被拒|退稿|撤稿)/.test(normalizedEvent(event))
}

function roundName(number: number) {
  return number === 1 ? '首轮' : `第${number}轮`
}

function stageBreakdown(items: TimelineDraft[], startIndex: number, endIndex: number) {
  const parts: string[] = []
  let previousIndex: number | null = null
  for (let index = startIndex; index <= endIndex; index += 1) {
    const time = timeValue(items[index]?.date)
    if (!Number.isFinite(time)) continue
    if (previousIndex !== null) {
      const previousTime = timeValue(items[previousIndex]?.date)
      if (Number.isFinite(previousTime)) {
        parts.push(`${items[previousIndex].event || '未命名事件'} → ${items[index].event || '终点'}：${daysBetween(previousTime, time)} 天`)
      }
    }
    previousIndex = index
  }
  return parts.join('；')
}

function analyseTimeline(items: TimelineDraft[], todayTime: number, includeToday: boolean) {
  const rowInsights = new Map<number, RowInsight>()
  const completedRounds: ReviewRound[] = []
  let activeRound: ActiveRound | null = null
  let nextRoundNumber = 1

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const time = timeValue(item.date)
    if (!Number.isFinite(time)) continue

    if (isSubmissionEvent(item.event)) {
      activeRound = { number: nextRoundNumber, startIndex: index, startTime: time, startEvent: item.event }
      rowInsights.set(index, { label: `${roundName(nextRoundNumber)}起点`, kind: 'start' })
      nextRoundNumber += 1
      continue
    }

    if (activeRound && isResponseEvent(item.event)) {
      const days = Math.max(0, daysBetween(activeRound.startTime, time))
      const breakdown = stageBreakdown(items, activeRound.startIndex, index)
      const round: ReviewRound = {
        number: activeRound.number,
        startIndex: activeRound.startIndex,
        endIndex: index,
        startEvent: activeRound.startEvent,
        endEvent: item.event,
        days,
        kind: 'completed',
        breakdown,
      }
      completedRounds.push(round)
      rowInsights.set(index, {
        label: `${roundName(round.number)}返意见 ${days} 天`,
        kind: 'result',
        title: breakdown || `${round.startEvent} → ${round.endEvent}：${days} 天`,
      })
      activeRound = null
    }
  }

  let currentRound: ReviewRound | null = null
  if (activeRound && Number.isFinite(todayTime) && todayTime >= activeRound.startTime) {
    const datedPoints = items
      .map((item, index) => ({ item, index, time: timeValue(item.date) }))
      .filter(point => point.index >= activeRound!.startIndex && Number.isFinite(point.time))
    const lastPoint = datedPoints[datedPoints.length - 1]
    const breakdownParts = stageBreakdown(items, activeRound.startIndex, lastPoint?.index ?? activeRound.startIndex)
    const tail = includeToday && lastPoint
      ? `${lastPoint.item.event || activeRound.startEvent} → 距今：${Math.max(0, daysBetween(lastPoint.time, todayTime))} 天`
      : ''
    currentRound = {
      number: activeRound.number,
      startIndex: activeRound.startIndex,
      endIndex: null,
      startEvent: activeRound.startEvent,
      endEvent: '距今',
      days: Math.max(0, daysBetween(activeRound.startTime, todayTime)),
      kind: 'waiting',
      breakdown: [breakdownParts, tail].filter(Boolean).join('；'),
    }
  }

  const validItems = items
    .map((item, index) => ({ item, index, time: timeValue(item.date) }))
    .filter(point => Number.isFinite(point.time))

  const firstTime = validItems[0]?.time
  const lastPoint = validItems[validItems.length - 1]
  const totalEndTime = includeToday && Number.isFinite(todayTime) ? todayTime : lastPoint?.time
  const totalDays = Number.isFinite(firstTime) && Number.isFinite(totalEndTime) ? Math.max(0, daysBetween(firstTime, totalEndTime)) : null

  let longestStage: { days: number; label: string } | null = null
  for (let index = 1; index < validItems.length; index += 1) {
    const previous = validItems[index - 1]
    const current = validItems[index]
    const days = Math.max(0, daysBetween(previous.time, current.time))
    if (!longestStage || days > longestStage.days) longestStage = { days, label: `${previous.item.event} → ${current.item.event}` }
  }
  if (includeToday && lastPoint && Number.isFinite(todayTime)) {
    const days = Math.max(0, daysBetween(lastPoint.time, todayTime))
    if (!longestStage || days > longestStage.days) longestStage = { days, label: `${lastPoint.item.event} → 距今` }
  }

  return {
    rowInsights,
    completedRounds,
    currentRound,
    firstResponseDays: completedRounds[0]?.days ?? null,
    revisionCount: items.filter(item => isRevisionOutcomeEvent(item.event)).length,
    totalDays,
    longestStage,
  }
}

export default function Timeline({ value, onChange, customOpts, onAddCustomOpt }: Props) {
  const lines = sortLines(parseLines(value))
  const allOpts = Array.from(new Set([...TIMELINE_PRESETS, ...customOpts]))
  const [draft, setDraft] = useState<TimelineDraft>({ date: today(), event: '', note: '' })
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<TimelineDraft>({ date: '', event: '', note: '' })
  const [showRaw, setShowRaw] = useState(false)
  const [showIntervalAnalysis, setShowIntervalAnalysis] = useState(false)
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

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
  const finiteTimes = parsedItems.map(item => timeValue(item.date)).filter(time => Number.isFinite(time))
  const firstFiniteTime = finiteTimes[0]
  const lastItem = parsedItems[parsedItems.length - 1]
  const lastTime = timeValue(lastItem?.date)
  const todayDate = today()
  const todayTime = timeValue(todayDate)
  const gapToToday = Number.isFinite(lastTime) && Number.isFinite(todayTime) ? daysBetween(lastTime, todayTime) : null
  const showTodayGap = !!lastItem && gapToToday !== null && gapToToday > 0 && !isTerminalEvent(lastItem.event)
  const cumulativeToToday = showTodayGap && Number.isFinite(firstFiniteTime) ? daysBetween(firstFiniteTime, todayTime) : null
  const analysis = analyseTimeline(parsedItems, todayTime, showTodayGap)
  const todayIndex = parsedItems.length

  const intervalCandidates: IntervalCandidate[] = parsedItems
    .map((item, index) => ({ key: String(index), index, date: item.date, event: item.event || '未命名事件', time: timeValue(item.date) }))
    .filter(item => Number.isFinite(item.time))
  if (showTodayGap && Number.isFinite(todayTime)) {
    intervalCandidates.push({ key: 'today', index: todayIndex, date: todayDate, event: '距今', time: todayTime })
  }

  const startCandidate = intervalCandidates.find(item => item.key === rangeStart) || null
  const endCandidate = intervalCandidates.find(item => item.key === rangeEnd) || null
  const selectedIntervalDays = startCandidate && endCandidate ? daysBetween(startCandidate.time, endCandidate.time) : null
  const rangeBounds = startCandidate && endCandidate
    ? { start: Math.min(startCandidate.index, endCandidate.index), end: Math.max(startCandidate.index, endCandidate.index) }
    : null

  const openIntervalAnalysis = () => {
    if (showIntervalAnalysis) {
      setShowIntervalAnalysis(false)
      return
    }
    if (!rangeStart || !rangeEnd) {
      const preferredRound = analysis.completedRounds[0] || analysis.currentRound
      if (preferredRound) {
        setRangeStart(String(preferredRound.startIndex))
        setRangeEnd(preferredRound.endIndex === null ? 'today' : String(preferredRound.endIndex))
      } else if (intervalCandidates.length > 1) {
        setRangeStart(intervalCandidates[0].key)
        setRangeEnd(intervalCandidates[intervalCandidates.length - 1].key)
      }
    }
    setShowIntervalAnalysis(true)
  }

  const swapRange = () => {
    setRangeStart(rangeEnd)
    setRangeEnd(rangeStart)
  }

  const rangeRowClass = (index: number) => {
    if (!showIntervalAnalysis || !rangeBounds || index < rangeBounds.start || index > rangeBounds.end) return ''
    const classes = ['timeline-range-row']
    if (index === startCandidate?.index) classes.push('timeline-range-start')
    if (index === endCandidate?.index) classes.push('timeline-range-end')
    return classes.join(' ')
  }

  let previousTime: number | null = null

  return (
    <div className="timeline-editor">
      {lines.length > 0 && !showRaw && (
        <div className="timeline timeline-editable timeline-table-mode">
          <div className="timeline-title">
            <span className="timeline-title-main"><Calendar size={13} /> 审稿时间线</span>
            <span className="timeline-title-actions">
              <span className="timeline-auto-sort-hint">按日期自动排序</span>
              <button type="button" className={`timeline-interval-toggle ${showIntervalAnalysis ? 'active' : ''}`} onClick={openIntervalAnalysis}>
                <ArrowLeftRight size={12} /> 间隔分析
              </button>
            </span>
          </div>

          <div className="timeline-insights" aria-label="审稿周期统计">
            <span className="timeline-insight-pill" data-kind="first-response"><small>首轮返意见</small><b>{analysis.firstResponseDays === null ? '未返回' : `${analysis.firstResponseDays} 天`}</b></span>
            <span className="timeline-insight-pill" data-kind="current-wait"><small>当前轮等待</small><b>{analysis.currentRound ? `${analysis.currentRound.days} 天` : '—'}</b></span>
            <span className="timeline-insight-pill" data-kind="revisions"><small>返修次数</small><b>{analysis.revisionCount} 次</b></span>
            <span className="timeline-insight-pill" data-kind="longest" title={analysis.longestStage?.label || undefined}><small>最长阶段</small><b>{analysis.longestStage ? `${analysis.longestStage.days} 天` : '—'}</b></span>
            <span className="timeline-insight-pill" data-kind="total"><small>总历时</small><b>{analysis.totalDays === null ? '—' : `${analysis.totalDays} 天`}</b></span>
          </div>

          {showIntervalAnalysis && (
            <div className="timeline-custom-analysis">
              <label><span>起点事件</span><select className="select" value={rangeStart} onChange={event => setRangeStart(event.target.value)}>{intervalCandidates.map(item => <option key={`start-${item.key}`} value={item.key}>{toDisplayDate(item.date)} · {item.event}</option>)}</select></label>
              <button type="button" className="timeline-range-swap" onClick={swapRange} title="交换起点和终点"><ArrowLeftRight size={14} /></button>
              <label><span>终点事件</span><select className="select" value={rangeEnd} onChange={event => setRangeEnd(event.target.value)}>{intervalCandidates.map(item => <option key={`end-${item.key}`} value={item.key}>{toDisplayDate(item.date)} · {item.event}</option>)}</select></label>
              <div className={`timeline-custom-result ${selectedIntervalDays !== null && selectedIntervalDays < 0 ? 'reverse' : ''}`}>
                <Clock3 size={14} />
                <span>{startCandidate && endCandidate ? `${startCandidate.event} → ${endCandidate.event}` : '请选择两个事件'}</span>
                <b>{selectedIntervalDays === null ? '—' : `${Math.abs(selectedIntervalDays)} 天${selectedIntervalDays < 0 ? '（反向）' : ''}`}</b>
              </div>
            </div>
          )}

          <div className="timeline-table-head">
            <span>日期</span><span>审稿状态</span><span>间隔</span><span>累计</span><span>轮次分析</span><span>操作</span>
          </div>

          {lines.map((line, index) => {
            const item = parsedItems[index]
            const isLast = index === lines.length - 1 && !showTodayGap
            const currentTime = timeValue(item.date)
            const intervalDays = Number.isFinite(currentTime) && previousTime !== null ? daysBetween(previousTime, currentTime) : null
            const cumulativeDays = Number.isFinite(currentTime) && Number.isFinite(firstFiniteTime) ? daysBetween(firstFiniteTime, currentTime) : null
            if (Number.isFinite(currentTime)) previousTime = currentTime
            const editing = editingIndex === index
            const insight = analysis.rowInsights.get(index)

            return (
              <div key={`${line}-${index}`} className={`timeline-item timeline-row-editable timeline-table-row ${rangeRowClass(index)}`.trim()}>
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
                      <span className={`timeline-round-cell ${insight ? `is-${insight.kind}` : ''}`} data-kind={insight?.kind || 'none'} title={insight?.title}>{insight?.label || '—'}</span>
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
            <div className={`timeline-item timeline-row-editable timeline-table-row timeline-today-row ${rangeRowClass(todayIndex)}`.trim()}>
              <div className="timeline-dot-col"><div className="timeline-dot active today-dot" /></div>
              <div className="timeline-content timeline-content-editable">
                <span className="timeline-date">{toDisplayDate(todayDate)}</span>
                <span className="timeline-event-cell"><b>距今</b></span>
                <span className="timeline-duration-cell">{gapToToday} 天</span>
                <span className="timeline-duration-cell timeline-total-cell">{cumulativeToToday === null ? '—' : `${cumulativeToToday} 天`}</span>
                <span className={`timeline-round-cell ${analysis.currentRound ? 'is-waiting' : ''}`} data-kind={analysis.currentRound ? 'waiting' : 'none'} title={analysis.currentRound?.breakdown}>{analysis.currentRound ? `${roundName(analysis.currentRound.number)}已等待 ${analysis.currentRound.days} 天` : '—'}</span>
                <span className="timeline-actions timeline-actions-muted">自动</span>
              </div>
            </div>
          )}
        </div>
      )}

      <datalist id="timeline-event-options">{allOpts.map(option => <option key={option} value={option} />)}</datalist>

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
