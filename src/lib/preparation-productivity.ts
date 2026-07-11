import type { JournalProfile, ManuscriptDraft, PreparationSnapshot } from './preparation'
import { DRAFT_STAGE_OPTIONS, draftReadiness, topicCompositeScore } from './preparation'
import { daysUntilDate } from './types'

export type JournalMatch = {
  journal: JournalProfile
  score: number
  reasons: string[]
}

export type DraftActionItem = {
  id: string
  tone: 'danger' | 'warning' | 'info' | 'success'
  title: string
  detail: string
  draft: ManuscriptDraft
  action: 'outline' | 'journal' | 'stage' | 'manual'
  suggestedStage?: ManuscriptDraft['stage']
  suggestedJournal?: JournalProfile
}

const priorityPoints: Record<JournalProfile['priority'], number> = {
  critical: 12,
  high: 9,
  medium: 5,
  low: 2,
}

function normalizedTerms(values: Array<string | null | undefined>) {
  return Array.from(new Set(values
    .filter(Boolean)
    .flatMap(value => String(value).toLocaleLowerCase().split(/[\s,，;；、/|:：()（）\[\]【】]+/))
    .map(value => value.trim())
    .filter(value => value.length >= 2)))
}

function journalLanguageFit(draft: ManuscriptDraft, journal: JournalProfile) {
  const indexing = journal.indexing || []
  const chinese = indexing.some(item => ['北大核心', '科技核心', 'CSCD', 'CSSCI'].includes(item))
  const international = indexing.some(item => ['SCIE', 'SSCI', 'ESCI', 'Scopus', 'EI'].includes(item))
  if (draft.language === 'zh') return chinese ? 16 : international ? 5 : 0
  return international ? 16 : chinese ? -6 : 0
}

export function journalMatchScore(draft: ManuscriptDraft, journal: JournalProfile): JournalMatch {
  const draftTerms = normalizedTerms([
    draft.title,
    draft.abstract,
    draft.article_type,
    ...(draft.keywords || []),
  ])
  const journalTerms = normalizedTerms([
    journal.name,
    journal.scope,
    ...(journal.subject_tags || []),
  ])

  const matched = draftTerms.filter(term => journalTerms.some(target => target.includes(term) || term.includes(target)))
  let score = 18
  const reasons: string[] = []

  if (matched.length) {
    score += Math.min(34, matched.length * 9)
    reasons.push(`主题匹配：${matched.slice(0, 3).join('、')}`)
  } else if (journal.subject_tags?.length || journal.scope) {
    reasons.push('主题重合度较低，建议人工核对期刊范围')
  } else {
    reasons.push('期刊范围信息不足')
  }

  const languageFit = journalLanguageFit(draft, journal)
  score += languageFit
  if (languageFit >= 10) reasons.push(draft.language === 'zh' ? '中文核心收录方向匹配' : '国际数据库收录方向匹配')
  else if (languageFit < 0) reasons.push('语言与主要收录方向可能不匹配')

  if (journal.is_favorite) {
    score += 6
    reasons.push('已收藏')
  }
  score += priorityPoints[journal.priority] || 0
  if (journal.priority === 'critical' || journal.priority === 'high') reasons.push('收藏优先级较高')

  if (journal.risk_level === 'warning') {
    score -= 24
    reasons.push('存在预警标记')
  } else if (journal.risk_level === 'watch') {
    score -= 9
    reasons.push('需要持续关注')
  }

  if (journal.first_decision_days != null) {
    if (journal.first_decision_days <= 30) {
      score += 8
      reasons.push('首轮决定较快')
    } else if (journal.first_decision_days <= 60) {
      score += 4
      reasons.push('首轮周期可控')
    } else if (journal.first_decision_days > 120) {
      score -= 5
      reasons.push('首轮周期偏长')
    }
  }

  if (journal.author_guide_url) score += 2
  if (journal.submission_url) score += 2
  if (draft.target_journal_ids?.includes(journal.id)) {
    score += 7
    reasons.push('已列入备选')
  }

  return {
    journal,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: Array.from(new Set(reasons)).slice(0, 4),
  }
}

export function recommendJournals(draft: ManuscriptDraft, journals: JournalProfile[], limit = 3) {
  return journals
    .map(journal => journalMatchScore(draft, journal))
    .sort((left, right) => right.score - left.score || left.journal.name.localeCompare(right.journal.name))
    .slice(0, limit)
}

export function suggestDraftStage(draft: ManuscriptDraft): ManuscriptDraft['stage'] {
  if (draft.submitted_paper_id || draft.stage === 'submitted') return 'submitted'
  const readiness = draftReadiness(draft)
  const target = draft.target_word_count || 0
  const ratio = target > 0 ? (draft.current_word_count || 0) / target : 0

  if (!draft.outline?.trim() || !draft.abstract?.trim()) return 'outline'
  if ((draft.current_word_count || 0) === 0 || (target > 0 && ratio < 0.7)) return 'writing'
  if (readiness.score >= 90 && readiness.requiredIncomplete === 0 && draft.primary_journal_id) return 'submission_ready'
  if (draft.primary_journal_id && ratio >= 0.75) return 'journal_adaptation'
  return 'internal_review'
}

export function buildStandardOutline(draft: Pick<ManuscriptDraft, 'article_type' | 'language'>) {
  const zh = draft.language === 'zh'
  const type = (draft.article_type || '').toLocaleLowerCase()

  const templates = type.includes('review')
    ? zh
      ? ['1 引言', '2 文献检索与筛选方法', '3 主题研究进展', '4 关键争议与知识空白', '5 未来研究方向', '6 结论']
      : ['1. Introduction', '2. Literature Search and Selection', '3. Thematic Synthesis', '4. Controversies and Knowledge Gaps', '5. Future Research Directions', '6. Conclusions']
    : type.includes('method')
      ? zh
        ? ['1 引言', '2 方法原理与设计', '3 数据与试验方案', '4 方法验证与对比', '5 应用结果', '6 讨论', '7 结论']
        : ['1. Introduction', '2. Method Development', '3. Data and Experimental Design', '4. Validation and Benchmarking', '5. Applications and Results', '6. Discussion', '7. Conclusions']
      : type.includes('data')
        ? zh
          ? ['1 数据背景', '2 数据来源', '3 数据处理方法', '4 数据记录与结构', '5 技术验证', '6 使用说明']
          : ['1. Background and Summary', '2. Data Sources', '3. Data Processing Methods', '4. Data Records', '5. Technical Validation', '6. Usage Notes']
        : type.includes('case')
          ? zh
            ? ['1 引言', '2 研究区与背景', '3 数据与方法', '4 结果', '5 讨论', '6 结论']
            : ['1. Introduction', '2. Study Area and Background', '3. Data and Methods', '4. Results', '5. Discussion', '6. Conclusions']
          : zh
            ? ['1 引言', '2 研究区与数据', '3 方法', '4 结果', '5 讨论', '6 结论']
            : ['1. Introduction', '2. Study Area and Data', '3. Materials and Methods', '4. Results', '5. Discussion', '6. Conclusions']

  return templates.map(item => `${item}\n${zh ? '（填写本节核心内容与证据）' : '(Add the core argument, evidence, and required figures/tables.)'}`).join('\n\n')
}

export function buildDraftActionItems(snapshot: PreparationSnapshot): DraftActionItem[] {
  const items: DraftActionItem[] = []

  snapshot.drafts.forEach(draft => {
    if (draft.stage === 'submitted' || draft.submitted_paper_id) return
    const readiness = draftReadiness(draft)
    const days = daysUntilDate(draft.deadline)
    const suggestedStage = suggestDraftStage(draft)
    const bestJournal = !draft.primary_journal_id ? recommendJournals(draft, snapshot.journals, 1)[0]?.journal : undefined

    if (days != null && days < 0) {
      items.push({ id: `${draft.id}-overdue`, tone: 'danger', title: `“${draft.title}”计划已逾期 ${-days} 天`, detail: '请调整计划投稿日期，或集中完成剩余阻碍项。', draft, action: 'manual' })
    } else if (days != null && days <= 14) {
      items.push({ id: `${draft.id}-due`, tone: 'warning', title: `“${draft.title}”距计划投稿仅 ${days} 天`, detail: readiness.nextAction, draft, action: 'manual' })
    }

    if (!draft.outline?.trim()) {
      items.push({ id: `${draft.id}-outline`, tone: 'info', title: `为“${draft.title}”生成标准论文提纲`, detail: `根据${draft.language === 'zh' ? '中文' : '英文'} ${draft.article_type || 'Research Article'} 模板生成，可继续手工修改。`, draft, action: 'outline' })
    }

    if (!draft.primary_journal_id) {
      items.push({ id: `${draft.id}-journal`, tone: bestJournal ? 'warning' : 'info', title: `“${draft.title}”尚未确定主投期刊`, detail: bestJournal ? `当前推荐：${bestJournal.name}` : '请先完善期刊库的范围与学科标签。', draft, action: bestJournal ? 'journal' : 'manual', suggestedJournal: bestJournal })
    }

    if (suggestedStage !== draft.stage) {
      const label = DRAFT_STAGE_OPTIONS.find(item => item.key === suggestedStage)?.label || suggestedStage
      items.push({ id: `${draft.id}-stage`, tone: readiness.score >= 90 ? 'success' : 'info', title: `建议将“${draft.title}”推进至“${label}”`, detail: `当前就绪度 ${readiness.score}%，系统根据提纲、写作进度、主投期刊与检查清单判断。`, draft, action: 'stage', suggestedStage })
    }

    readiness.blockers.slice(0, 2).forEach((blocker, index) => {
      items.push({ id: `${draft.id}-blocker-${index}`, tone: 'danger', title: blocker, detail: `关联草稿：${draft.title}`, draft, action: 'manual' })
    })
  })

  const weight = { danger: 4, warning: 3, info: 2, success: 1 }
  return items.sort((left, right) => weight[right.tone] - weight[left.tone]).slice(0, 12)
}

function dateLabel(value?: string | null) {
  if (!value) return '未设置'
  return value
}

export function buildPreparationReport(snapshot: PreparationSnapshot) {
  const activeTopics = snapshot.topics.filter(topic => !['paused', 'abandoned'].includes(topic.status))
  const draftStates = snapshot.drafts.map(draft => ({ draft, readiness: draftReadiness(draft) }))
  const average = draftStates.length ? Math.round(draftStates.reduce((sum, item) => sum + item.readiness.score, 0) / draftStates.length) : 0
  const actions = buildDraftActionItems(snapshot)
  const lines: string[] = [
    '# Submission Hub 论文准备报告',
    '',
    `生成时间：${new Date().toLocaleString()}`,
    '',
    '## 总览',
    '',
    `- 推进中选题：${activeTopics.length}`,
    `- 草稿准备记录：${snapshot.drafts.length}`,
    `- 收藏期刊：${snapshot.journals.filter(item => item.is_favorite).length}`,
    `- 平均投稿就绪度：${average}%`,
    '',
    '## 优先行动',
    '',
  ]

  if (!actions.length) lines.push('- 暂无明确待办。')
  actions.forEach(item => lines.push(`- [ ] ${item.title}：${item.detail}`))

  lines.push('', '## 草稿状态', '')
  draftStates.forEach(({ draft, readiness }) => {
    const journal = snapshot.journals.find(item => item.id === draft.primary_journal_id)
    const stage = DRAFT_STAGE_OPTIONS.find(item => item.key === draft.stage)?.label || draft.stage
    const recommendations = recommendJournals(draft, snapshot.journals, 3)
    lines.push(`### ${draft.title}`)
    lines.push(`- 阶段：${stage}`)
    lines.push(`- 就绪度：${readiness.score}%`)
    lines.push(`- 计划投稿：${dateLabel(draft.deadline)}`)
    lines.push(`- 主投期刊：${journal?.name || '未确定'}`)
    lines.push(`- 下一步：${readiness.nextAction}`)
    if (readiness.blockers.length) lines.push(`- 阻碍：${readiness.blockers.join('；')}`)
    if (recommendations.length) lines.push(`- 期刊建议：${recommendations.map(item => `${item.journal.name}（${item.score}）`).join('；')}`)
    lines.push('')
  })

  lines.push('## 选题池', '')
  snapshot.topics.forEach(topic => lines.push(`- ${topic.title}｜综合评分 ${topicCompositeScore(topic)}｜阶段 ${topic.status}｜节点 ${dateLabel(topic.deadline)}`))

  lines.push('', '## 期刊库', '')
  snapshot.journals.forEach(journal => lines.push(`- ${journal.name}｜${journal.indexing?.join('/') || '收录未记录'}｜JCR ${journal.jcr_quartile || '—'}｜中科院 ${journal.cas_quartile || '—'}｜首轮 ${journal.first_decision_days ?? '—'} 天`))

  return lines.join('\n')
}
