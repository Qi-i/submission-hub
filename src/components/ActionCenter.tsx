import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Paper } from '../lib/types'
import { daysSinceDate, daysUntilDate, getStatus, getWorkflowSignal } from '../lib/types'

interface Props {
  papers: Paper[]
  onOpen?: (paper: Paper) => void
  limit?: number
}

type ActionLevel = 'urgent' | 'warn' | 'watch'

type ActionItem = {
  paper: Paper
  level: ActionLevel
  title: string
  detail: string
  score: number
  deadlineDays: number | null
  ageDays: number | null
}

const STORAGE_KEY = 'submission-hub-action-center-open'

const levelMeta: Record<ActionLevel, { label: string; icon: string }> = {
  urgent: { label: '紧急', icon: '🔴' },
  warn: { label: '建议处理', icon: '🟠' },
  watch: { label: '主动关注', icon: '🔵' },
}

function actionLevel(paper: Paper, signal: ReturnType<typeof getWorkflowSignal>, deadlineDays: number | null): ActionLevel {
  if (paper.reminder_level === 'urgent' || signal?.level === 'danger' || deadlineDays !== null && deadlineDays <= 3) return 'urgent'
  if (paper.reminder_level === 'warn' || signal?.level === 'warn' || deadlineDays !== null && deadlineDays <= 14) return 'warn'
  return 'watch'
}

function buildItems(papers: Paper[]): ActionItem[] {
  const resubmittedIds = new Set(papers.map(paper => paper.prev_id).filter((id): id is string => !!id))

  return papers.flatMap(paper => {
    const signal = getWorkflowSignal(paper)
    if (!signal) return []
    if (['rejected', 'withdrawn'].includes(paper.status) && resubmittedIds.has(paper.id) && signal.text === '准备改投') return []

    const deadlineDays = paper.status === 'revision' ? daysUntilDate(paper.deadline) : null
    const ageDays = daysSinceDate(paper.last_status_date || paper.submitted_date)
    const level = actionLevel(paper, signal, deadlineDays)

    // 自动“关注”不进入首页待办；只有用户主动标记为关注时才显示。
    if (level === 'watch' && paper.reminder_level !== 'watch') return []

    const score =
      (level === 'urgent' ? 3000 : level === 'warn' ? 2000 : 1000) +
      (deadlineDays !== null ? Math.max(0, 100 - deadlineDays) : 0) +
      (ageDays || 0)

    return [{ paper, level, title: signal.text, detail: signal.detail, score, deadlineDays, ageDays }]
  }).sort((left, right) => right.score - left.score)
}

function initialOpen(items: ActionItem[]) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) return saved === 'true'
  } catch {
    // Ignore unavailable local storage.
  }
  return items.some(item => item.level === 'urgent')
}

export default function ActionCenter({ papers, onOpen, limit = 5 }: Props) {
  const items = buildItems(papers)
  const [open, setOpen] = useState(() => initialOpen(items))

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(open)) } catch { /* ignore */ }
  }, [open])

  if (!items.length) return null

  const visible = items.slice(0, limit)
  const counts = {
    urgent: items.filter(item => item.level === 'urgent').length,
    warn: items.filter(item => item.level === 'warn').length,
    watch: items.filter(item => item.level === 'watch').length,
  }

  return (
    <section className={`action-center ${open ? 'open' : 'collapsed'}`} aria-label="需处理事项">
      <button type="button" className="action-center-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <span className="action-center-title">
          <span className="action-center-symbol">!</span>
          <span><strong>需处理</strong><small>仅显示截止、逾期和主动标记事项</small></span>
        </span>
        <span className="action-center-summary">
          {counts.urgent > 0 && <em data-level="urgent">{counts.urgent} 紧急</em>}
          {counts.warn > 0 && <em data-level="warn">{counts.warn} 建议</em>}
          {counts.watch > 0 && <em data-level="watch">{counts.watch} 关注</em>}
          <ChevronDown size={16} className="action-center-chevron" />
        </span>
      </button>

      {open && <div className="action-center-body">
        <div className="action-center-list">
          {visible.map(item => {
            const status = getStatus(item.paper.status)
            const meta = levelMeta[item.level]
            const timing = item.deadlineDays !== null
              ? item.deadlineDays < 0 ? `已逾期 ${Math.abs(item.deadlineDays)} 天` : item.deadlineDays === 0 ? '今天截止' : `距截止 ${item.deadlineDays} 天`
              : item.ageDays !== null ? `当前阶段 ${item.ageDays} 天` : ''

            return (
              <button type="button" key={item.paper.id} className="action-center-item" data-level={item.level} onClick={() => onOpen?.(item.paper)} disabled={!onOpen}>
                <span className="action-level-marker" aria-hidden="true">{meta.icon}</span>
                <span className="action-item-main">
                  <span className="action-item-title-row"><strong>{item.title}</strong><em style={{ color: status.color }}>{status.emoji} {status.label}</em></span>
                  <span className="action-item-paper" title={item.paper.title}>{item.paper.title || '未命名稿件'}</span>
                  <span className="action-item-detail">{item.detail}</span>
                </span>
                <span className="action-item-side">{item.paper.journal && <span title={item.paper.journal}>{item.paper.journal}</span>}{timing && <b>{timing}</b>}</span>
              </button>
            )
          })}
        </div>
        {items.length > visible.length && <div className="action-center-more">另有 {items.length - visible.length} 条事项，可在稿件卡片中查看。</div>}
      </div>}
    </section>
  )
}