import { useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Download, FileText, Sparkles, Target, Wand2 } from 'lucide-react'
import type { ManuscriptDraft, PreparationSnapshot } from '../lib/preparation'
import {
  buildDraftActionItems,
  buildPreparationReport,
  buildStandardOutline,
  recommendJournals,
  suggestDraftStage,
  type DraftActionItem,
} from '../lib/preparation-productivity'

interface Props {
  snapshot: PreparationSnapshot
  loading?: boolean
  onSaveDraft: (data: Partial<ManuscriptDraft> & Pick<ManuscriptDraft, 'title'>) => Promise<void>
}

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function copyText(content: string) {
  try {
    await navigator.clipboard.writeText(content)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
}

function dateStamp() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function PreparationProductivityPanel({ snapshot, loading, onSaveDraft }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const actions = useMemo(() => buildDraftActionItems(snapshot), [snapshot])
  const unassignedDrafts = useMemo(
    () => snapshot.drafts.filter(draft => !draft.primary_journal_id && draft.stage !== 'submitted' && !draft.submitted_paper_id),
    [snapshot.drafts],
  )
  const suggestedStages = useMemo(
    () => snapshot.drafts.filter(draft => suggestDraftStage(draft) !== draft.stage && draft.stage !== 'submitted'),
    [snapshot.drafts],
  )
  const report = useMemo(() => buildPreparationReport(snapshot), [snapshot])

  const applyAction = async (item: DraftActionItem) => {
    if (savingId || item.action === 'manual') return
    const draft = item.draft
    let patch: Partial<ManuscriptDraft> = {}
    let message = ''

    if (item.action === 'outline') {
      patch = { outline: buildStandardOutline(draft) }
      message = `为“${draft.title}”生成标准提纲？现有空提纲将被写入模板，之后仍可手工修改。`
    } else if (item.action === 'journal' && item.suggestedJournal) {
      patch = {
        primary_journal_id: item.suggestedJournal.id,
        target_journal_ids: Array.from(new Set([item.suggestedJournal.id, ...(draft.target_journal_ids || [])])),
      }
      message = `将“${item.suggestedJournal.name}”设为“${draft.title}”的主投期刊？`
    } else if (item.action === 'stage' && item.suggestedStage) {
      patch = { stage: item.suggestedStage }
      message = `按当前准备状态更新“${draft.title}”的阶段？`
    }

    if (!Object.keys(patch).length || !confirm(message)) return
    setSavingId(item.id)
    try {
      await onSaveDraft({ ...draft, ...patch, title: draft.title })
    } catch (error) {
      console.error('Apply preparation action failed:', error)
      alert(error instanceof Error ? `更新失败：${error.message}` : '更新失败。')
    } finally {
      setSavingId(null)
    }
  }

  const exportReport = () => downloadText(`SubmissionHub_论文准备报告_${dateStamp()}.md`, report)
  const copyTodayPlan = async () => {
    const text = actions.length
      ? ['今日论文准备任务', ...actions.slice(0, 8).map((item, index) => `${index + 1}. ${item.title}｜${item.detail}`)].join('\n')
      : '今日论文准备任务：暂无明确待办。'
    await copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  if (loading) return null

  return <section className={`prep-productivity ${expanded ? 'expanded' : 'collapsed'}`}>
    <div className="prep-productivity-head">
      <div className="prep-productivity-title">
        <span className="prep-productivity-icon"><Sparkles size={18} /></span>
        <div><b>论文准备助手</b><small>自动整理待办、生成提纲、推荐期刊并建议草稿阶段</small></div>
      </div>
      <div className="prep-productivity-actions">
        <button type="button" onClick={() => void copyTodayPlan()}><ClipboardList size={13} /> {copied ? '已复制' : '复制今日任务'}</button>
        <button type="button" onClick={exportReport}><Download size={13} /> 导出准备报告</button>
        <button type="button" className="prep-productivity-toggle" onClick={() => setExpanded(value => !value)}>{expanded ? '收起' : `展开（${actions.length}）`}</button>
      </div>
    </div>

    {expanded && <div className="prep-productivity-body">
      <div className="prep-productivity-summary">
        <div data-tone="task"><ClipboardList size={15} /><span>优先待办</span><b>{actions.length}</b></div>
        <div data-tone="journal"><Target size={15} /><span>待定主投</span><b>{unassignedDrafts.length}</b></div>
        <div data-tone="stage"><CheckCircle2 size={15} /><span>建议推进</span><b>{suggestedStages.length}</b></div>
        <div data-tone="report"><FileText size={15} /><span>可导出报告</span><b>{snapshot.drafts.length}</b></div>
      </div>

      <div className="prep-productivity-grid">
        <div className="prep-productivity-card prep-action-card">
          <div className="prep-productivity-card-head"><div><b>优先行动</b><small>按逾期、阻碍、期刊与阶段建议排序</small></div><span>{actions.length}</span></div>
          <div className="prep-action-list">
            {actions.slice(0, 7).map(item => <div key={item.id} className="prep-action-item" data-tone={item.tone}>
              <span className="prep-action-dot" />
              <div><b>{item.title}</b><small>{item.detail}</small></div>
              {item.action !== 'manual'
                ? <button type="button" disabled={savingId === item.id} onClick={() => void applyAction(item)}><Wand2 size={12} /> {savingId === item.id ? '处理中' : item.action === 'outline' ? '生成' : item.action === 'journal' ? '采用' : '更新'}</button>
                : <span className="prep-action-manual">手工完善</span>}
            </div>)}
            {!actions.length && <div className="prep-productivity-empty"><CheckCircle2 size={18} /> 当前没有明确阻碍，可继续完善内容并保持进度。</div>}
          </div>
        </div>

        <div className="prep-productivity-card prep-match-card">
          <div className="prep-productivity-card-head"><div><b>期刊匹配建议</b><small>基于题名、关键词、范围、收录、风险和审稿周期</small></div><Target size={16} /></div>
          <div className="prep-match-list">
            {unassignedDrafts.slice(0, 4).map(draft => {
              const matches = recommendJournals(draft, snapshot.journals, 2)
              return <div className="prep-match-item" key={draft.id}>
                <strong>{draft.title}</strong>
                {matches.length ? matches.map(match => <div key={match.journal.id} className="prep-match-option">
                  <span className="prep-match-score">{match.score}</span>
                  <div><b>{match.journal.name}</b><small>{match.reasons.slice(0, 2).join(' · ')}</small></div>
                </div>) : <small>期刊库信息不足，请补充期刊范围和学科标签。</small>}
              </div>
            })}
            {!unassignedDrafts.length && <div className="prep-productivity-empty">所有未投稿草稿均已设置主投期刊。</div>}
          </div>
        </div>
      </div>
    </div>}
  </section>
}
