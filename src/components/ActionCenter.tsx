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

const levelMeta: Record<ActionLevel, { label: string; icon: string }> = {
  urgent: { label: '紧急', icon: '🔴' },
  warn: { label: '建议处理', icon: '🟠' },
  watch: { label: '持续关注', icon: '🔵' },
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
    const score =
      (level === 'urgent' ? 3000 : level === 'warn' ? 2000 : 1000) +
      (deadlineDays !== null ? Math.max(0, 100 - deadlineDays) : 0) +
      (ageDays || 0)

    return [{
      paper,
      level,
      title: signal.text,
      detail: signal.detail,
      score,
      deadlineDays,
      ageDays,
    }]
  }).sort((left, right) => right.score - left.score)
}

export default function ActionCenter({ papers, onOpen, limit = 8 }: Props) {
  const items = buildItems(papers)
  if (!items.length) return null

  const visible = items.slice(0, limit)
  const counts = {
    urgent: items.filter(item => item.level === 'urgent').length,
    warn: items.filter(item => item.level === 'warn').length,
    watch: items.filter(item => item.level === 'watch').length,
  }

  return (
    <section className="action-center" aria-label="投稿待办中心">
      <div className="action-center-head">
        <div>
          <h2>投稿待办中心</h2>
          <p>根据稿件状态、时间线和截止日期自动整理</p>
        </div>
        <div className="action-center-counts">
          {counts.urgent > 0 && <span data-level="urgent">🔴 {counts.urgent} 紧急</span>}
          {counts.warn > 0 && <span data-level="warn">🟠 {counts.warn} 建议处理</span>}
          {counts.watch > 0 && <span data-level="watch">🔵 {counts.watch} 关注</span>}
        </div>
      </div>

      <div className="action-center-list">
        {visible.map(item => {
          const status = getStatus(item.paper.status)
          const meta = levelMeta[item.level]
          const timing = item.deadlineDays !== null
            ? item.deadlineDays < 0 ? `已逾期 ${Math.abs(item.deadlineDays)} 天` : item.deadlineDays === 0 ? '今天截止' : `距截止 ${item.deadlineDays} 天`
            : item.ageDays !== null ? `当前阶段 ${item.ageDays} 天` : ''

          return (
            <button
              type="button"
              key={item.paper.id}
              className="action-center-item"
              data-level={item.level}
              onClick={() => onOpen?.(item.paper)}
              disabled={!onOpen}
            >
              <span className="action-level-marker" aria-hidden="true">{meta.icon}</span>
              <span className="action-item-main">
                <span className="action-item-title-row">
                  <strong>{item.title}</strong>
                  <em style={{ color: status.color }}>{status.emoji} {status.label}</em>
                </span>
                <span className="action-item-paper" title={item.paper.title}>{item.paper.title || '未命名稿件'}</span>
                <span className="action-item-detail">{item.detail}</span>
              </span>
              <span className="action-item-side">
                {item.paper.journal && <span title={item.paper.journal}>{item.paper.journal}</span>}
                {timing && <b>{timing}</b>}
              </span>
            </button>
          )
        })}
      </div>

      {items.length > visible.length && <div className="action-center-more">另有 {items.length - visible.length} 条事项，可在稿件卡片中继续查看。</div>}
    </section>
  )
}
