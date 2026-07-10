export type ExternalLink = {
  label: string
  url: string
}

export type JournalOaType = 'unknown' | 'closed' | 'hybrid' | 'gold' | 'diamond'
export type JournalRisk = 'normal' | 'watch' | 'warning'
export type TopicStatus = 'idea' | 'literature' | 'data' | 'analysis' | 'drafting' | 'paused' | 'abandoned'
export type DraftStage = 'outline' | 'writing' | 'internal_review' | 'journal_adaptation' | 'submission_ready' | 'submitted' | 'paused'
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical'

export interface JournalProfile {
  id: string
  user_id: string
  name: string
  publisher: string | null
  website_url: string | null
  author_guide_url: string | null
  submission_url: string | null
  third_party_links: ExternalLink[]
  issn: string | null
  eissn: string | null
  scope: string | null
  subject_tags: string[]
  indexing: string[]
  jcr_quartile: string | null
  cas_quartile: string | null
  impact_factor: number | null
  oa_type: JournalOaType
  apc_amount: number | null
  apc_currency: string | null
  fee_notes: string | null
  first_decision_days: number | null
  total_review_days: number | null
  acceptance_rate: number | null
  risk_level: JournalRisk
  is_favorite: boolean
  priority: PriorityLevel
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ResearchTopic {
  id: string
  user_id: string
  title: string
  research_question: string | null
  objective: string | null
  novelty: string | null
  background: string | null
  keywords: string[]
  methods: string[]
  data_sources: string[]
  target_audience: string | null
  expected_output: string | null
  status: TopicStatus
  priority: PriorityLevel
  novelty_score: number
  feasibility_score: number
  data_score: number
  method_score: number
  timeline_score: number
  deadline: string | null
  links: ExternalLink[]
  notes: string | null
  created_at: string
  updated_at: string
}

export type ChecklistCategory = 'manuscript' | 'authors' | 'data' | 'ethics' | 'submission'

export interface PreparationChecklistItem {
  id: string
  category: ChecklistCategory
  label: string
  required: boolean
  done: boolean
  note?: string
}

export interface ManuscriptDraft {
  id: string
  user_id: string
  topic_id: string | null
  title: string
  article_type: string
  language: string
  stage: DraftStage
  abstract: string | null
  keywords: string[]
  outline: string | null
  authors: string[]
  target_word_count: number | null
  current_word_count: number
  figure_count: number
  table_count: number
  reference_count: number
  deadline: string | null
  external_links: ExternalLink[]
  target_journal_ids: string[]
  primary_journal_id: string | null
  checklist: PreparationChecklistItem[]
  notes: string | null
  submitted_paper_id: string | null
  created_at: string
  updated_at: string
}

export interface PreparationSnapshot {
  journals: JournalProfile[]
  topics: ResearchTopic[]
  drafts: ManuscriptDraft[]
}

export const OA_OPTIONS: { key: JournalOaType; label: string }[] = [
  { key: 'unknown', label: '未确认' },
  { key: 'closed', label: '订阅制' },
  { key: 'hybrid', label: '混合开放获取' },
  { key: 'gold', label: '全开放获取' },
  { key: 'diamond', label: '钻石开放获取（无 APC）' },
]

export const PRIORITY_OPTIONS: { key: PriorityLevel; label: string }[] = [
  { key: 'low', label: '低' },
  { key: 'medium', label: '中' },
  { key: 'high', label: '高' },
  { key: 'critical', label: '最高' },
]

export const TOPIC_STATUS_OPTIONS: { key: TopicStatus; label: string }[] = [
  { key: 'idea', label: '想法池' },
  { key: 'literature', label: '文献论证' },
  { key: 'data', label: '数据准备' },
  { key: 'analysis', label: '分析验证' },
  { key: 'drafting', label: '进入写作' },
  { key: 'paused', label: '暂缓' },
  { key: 'abandoned', label: '放弃' },
]

export const DRAFT_STAGE_OPTIONS: { key: DraftStage; label: string }[] = [
  { key: 'outline', label: '提纲设计' },
  { key: 'writing', label: '正文写作' },
  { key: 'internal_review', label: '内部修改' },
  { key: 'journal_adaptation', label: '期刊适配' },
  { key: 'submission_ready', label: '待投稿' },
  { key: 'submitted', label: '已转投稿' },
  { key: 'paused', label: '暂缓' },
]

export const ARTICLE_TYPE_OPTIONS = [
  'Research Article', 'Review Article', 'Short Communication', 'Letter',
  'Methods Paper', 'Data Paper', 'Case Study', '中文核心论文', '学位论文成果', '其它',
]

export const INDEXING_OPTIONS = ['SCIE', 'SSCI', 'ESCI', 'EI', 'Scopus', 'CSCD', '北大核心', '科技核心']

export const DEFAULT_PREPARATION_CHECKLIST: PreparationChecklistItem[] = [
  { id: 'title', category: 'manuscript', label: '题名准确、简洁并符合期刊风格', required: true, done: false },
  { id: 'abstract', category: 'manuscript', label: '摘要结构、字数和核心结论完整', required: true, done: false },
  { id: 'keywords', category: 'manuscript', label: '关键词数量与格式符合要求', required: true, done: false },
  { id: 'structure', category: 'manuscript', label: '正文结构、字数和章节完整', required: true, done: false },
  { id: 'references', category: 'manuscript', label: '参考文献格式、DOI 与近年文献已核对', required: true, done: false },
  { id: 'authors', category: 'authors', label: '作者顺序、单位和通讯作者已确认', required: true, done: false },
  { id: 'orcid', category: 'authors', label: '作者 ORCID、邮箱和署名拼写已核对', required: false, done: false },
  { id: 'contributions', category: 'authors', label: 'CRediT 作者贡献声明已准备', required: false, done: false },
  { id: 'figures', category: 'data', label: '图件分辨率、字体、编号和图注合格', required: true, done: false },
  { id: 'tables', category: 'data', label: '表格格式、单位和交叉引用已核对', required: true, done: false },
  { id: 'data', category: 'data', label: '原始数据、代码与补充材料已归档', required: false, done: false },
  { id: 'availability', category: 'data', label: 'Data Availability Statement 已准备', required: false, done: false },
  { id: 'ethics', category: 'ethics', label: '伦理审批、知情同意或“不适用”已说明', required: false, done: false },
  { id: 'funding', category: 'ethics', label: '基金项目、利益冲突和致谢已核对', required: true, done: false },
  { id: 'similarity', category: 'ethics', label: '重复率、图片合规和引用规范已检查', required: true, done: false },
  { id: 'template', category: 'submission', label: '已按目标期刊模板和作者指南排版', required: true, done: false },
  { id: 'cover-letter', category: 'submission', label: 'Cover Letter 已准备', required: true, done: false },
  { id: 'highlights', category: 'submission', label: 'Highlights / Graphical Abstract 已按要求准备', required: false, done: false },
  { id: 'files', category: 'submission', label: '主文、图、表、补充材料和文件命名完整', required: true, done: false },
  { id: 'submission-questions', category: 'submission', label: '推荐审稿人、回避审稿人和投稿问答已准备', required: false, done: false },
]

export function createDefaultChecklist() {
  return DEFAULT_PREPARATION_CHECKLIST.map(item => ({ ...item }))
}

export function checklistProgress(items: PreparationChecklistItem[]) {
  if (!items.length) return 0
  const required = items.filter(item => item.required)
  const denominator = required.length || items.length
  const completed = (required.length ? required : items).filter(item => item.done).length
  return Math.round(completed / denominator * 100)
}

export function topicCompositeScore(topic: Pick<ResearchTopic, 'novelty_score' | 'feasibility_score' | 'data_score' | 'method_score' | 'timeline_score'>) {
  const values = [topic.novelty_score, topic.feasibility_score, topic.data_score, topic.method_score, topic.timeline_score]
  return Math.round(values.reduce((sum, value) => sum + Math.max(0, Math.min(5, value || 0)), 0) / values.length * 20)
}

export function journalFitSummary(journal: JournalProfile) {
  const speed = journal.first_decision_days ? (journal.first_decision_days <= 30 ? '快' : journal.first_decision_days <= 60 ? '中等' : '较慢') : '未知'
  const cost = journal.oa_type === 'diamond' || journal.apc_amount === 0 ? '无 APC' : journal.apc_amount ? `${journal.apc_amount} ${journal.apc_currency || ''}`.trim() : '费用未知'
  return `${speed}首轮 · ${cost}`
}
