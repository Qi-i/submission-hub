import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight, BookOpen, CheckCircle2, Circle, DollarSign, ExternalLink,
  FilePenLine, Lightbulb, Plus, Save, Search, Star, Trash2, X,
} from 'lucide-react'
import type {
  ExternalLink, JournalProfile, ManuscriptDraft, PreparationChecklistItem,
  PreparationSnapshot, ResearchTopic,
} from '../lib/preparation'
import {
  ARTICLE_TYPE_OPTIONS, DRAFT_STAGE_OPTIONS, INDEXING_OPTIONS, OA_OPTIONS,
  PRIORITY_OPTIONS, TOPIC_STATUS_OPTIONS, checklistProgress, createDefaultChecklist,
  journalFitSummary, topicCompositeScore,
} from '../lib/preparation'
import { daysUntilDate } from '../lib/types'

type SectionKey = 'overview' | 'topics' | 'drafts' | 'journals'
type Editor =
  | { type: 'journal'; value: JournalProfile | 'new' }
  | { type: 'topic'; value: ResearchTopic | 'new' }
  | { type: 'draft'; value: ManuscriptDraft | 'new' }
  | null

interface Props {
  snapshot: PreparationSnapshot
  loading?: boolean
  onSaveJournal: (data: Partial<JournalProfile> & Pick<JournalProfile, 'name'>) => Promise<void>
  onDeleteJournal: (id: string) => Promise<void>
  onSaveTopic: (data: Partial<ResearchTopic> & Pick<ResearchTopic, 'title'>) => Promise<void>
  onDeleteTopic: (id: string) => Promise<void>
  onSaveDraft: (data: Partial<ManuscriptDraft> & Pick<ManuscriptDraft, 'title'>) => Promise<void>
  onDeleteDraft: (id: string) => Promise<void>
  onPromoteDraft?: (draft: ManuscriptDraft) => Promise<void>
}

const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }
const toList = (value: string) => Array.from(new Set(value.split(/[，,;；、\n]+/).map(item => item.trim()).filter(Boolean)))
const fromList = (value?: string[] | null) => (value || []).join(', ')
const numberOrNull = (value: string) => value.trim() === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null
const clampScore = (value: string) => Math.max(0, Math.min(5, Math.round(Number(value) || 0)))
const safeUrl = (value?: string | null) => !!value && /^https?:\/\//i.test(value)

function parseLinks(value: string): ExternalLink[] {
  return value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const [label, ...urlParts] = line.split('|')
    const url = (urlParts.join('|') || label).trim()
    return { label: urlParts.length ? label.trim() : '链接', url }
  }).filter(link => safeUrl(link.url))
}

function formatLinks(links?: ExternalLink[] | null) {
  return (links || []).map(link => `${link.label}|${link.url}`).join('\n')
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`prep-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>
}

function ModalShell({ title, subtitle, saving, onClose, onSave, onDelete, children }: {
  title: string; subtitle?: string; saving: boolean; onClose: () => void; onSave: () => void; onDelete?: () => void; children: ReactNode
}) {
  return <div className="modal-overlay" onClick={() => !saving && onClose()}>
    <div className="modal prep-modal" onClick={event => event.stopPropagation()}>
      <div className="prep-modal-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div><button className="btn btn-ghost btn-icon" onClick={onClose} disabled={saving}><X size={18} /></button></div>
      <div className="prep-modal-body">{children}</div>
      <div className="prep-modal-footer">{onDelete ? <button className="btn btn-danger btn-sm" onClick={onDelete} disabled={saving}><Trash2 size={14} /> 删除</button> : <span />}<div><button className="btn btn-ghost" onClick={onClose} disabled={saving}>取消</button><button className="btn btn-primary" onClick={onSave} disabled={saving}><Save size={14} /> {saving ? '保存中...' : '保存'}</button></div></div>
    </div>
  </div>
}

function JournalForm({ value, onSave, onDelete, onClose }: {
  value: JournalProfile | 'new'; onSave: Props['onSaveJournal']; onDelete: Props['onDeleteJournal']; onClose: () => void
}) {
  const source = value === 'new' ? null : value
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(source?.name || '')
  const [publisher, setPublisher] = useState(source?.publisher || '')
  const [website, setWebsite] = useState(source?.website_url || '')
  const [guide, setGuide] = useState(source?.author_guide_url || '')
  const [submission, setSubmission] = useState(source?.submission_url || '')
  const [thirdParty, setThirdParty] = useState(formatLinks(source?.third_party_links))
  const [issn, setIssn] = useState(source?.issn || '')
  const [eissn, setEissn] = useState(source?.eissn || '')
  const [scope, setScope] = useState(source?.scope || '')
  const [tags, setTags] = useState(fromList(source?.subject_tags))
  const [indexing, setIndexing] = useState<string[]>(source?.indexing || [])
  const [jcr, setJcr] = useState(source?.jcr_quartile || '')
  const [cas, setCas] = useState(source?.cas_quartile || '')
  const [impactFactor, setImpactFactor] = useState(source?.impact_factor?.toString() || '')
  const [oaType, setOaType] = useState(source?.oa_type || 'unknown')
  const [apc, setApc] = useState(source?.apc_amount?.toString() || '')
  const [currency, setCurrency] = useState(source?.apc_currency || 'USD')
  const [feeNotes, setFeeNotes] = useState(source?.fee_notes || '')
  const [firstDecision, setFirstDecision] = useState(source?.first_decision_days?.toString() || '')
  const [totalReview, setTotalReview] = useState(source?.total_review_days?.toString() || '')
  const [acceptanceRate, setAcceptanceRate] = useState(source?.acceptance_rate?.toString() || '')
  const [risk, setRisk] = useState(source?.risk_level || 'normal')
  const [favorite, setFavorite] = useState(source?.is_favorite ?? true)
  const [priority, setPriority] = useState(source?.priority || 'medium')
  const [notes, setNotes] = useState(source?.notes || '')

  const save = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await onSave({
        ...(source || {}), name: name.trim(), publisher: publisher.trim() || null,
        website_url: website.trim() || null, author_guide_url: guide.trim() || null,
        submission_url: submission.trim() || null, third_party_links: parseLinks(thirdParty),
        issn: issn.trim() || null, eissn: eissn.trim() || null, scope: scope.trim() || null,
        subject_tags: toList(tags), indexing, jcr_quartile: jcr || null, cas_quartile: cas || null,
        impact_factor: numberOrNull(impactFactor), oa_type: oaType as JournalProfile['oa_type'],
        apc_amount: numberOrNull(apc), apc_currency: currency.trim().toUpperCase() || 'USD',
        fee_notes: feeNotes.trim() || null, first_decision_days: numberOrNull(firstDecision),
        total_review_days: numberOrNull(totalReview), acceptance_rate: numberOrNull(acceptanceRate),
        risk_level: risk as JournalProfile['risk_level'], is_favorite: favorite,
        priority: priority as JournalProfile['priority'], notes: notes.trim() || null,
      })
      onClose()
    } finally { setSaving(false) }
  }

  return <ModalShell title={source ? '编辑期刊档案' : '收藏期刊'} subtitle="记录投稿入口、分区、费用、审稿速度和第三方介绍" saving={saving} onClose={onClose} onSave={save} onDelete={source ? async () => { if (confirm('确认删除该期刊档案？')) { await onDelete(source.id); onClose() } } : undefined}>
    <div className="prep-form-grid two"><Field label="期刊名称" wide><input className="input" value={name} onChange={event => setName(event.target.value)} autoFocus /></Field><Field label="出版社"><input className="input" value={publisher} onChange={event => setPublisher(event.target.value)} /></Field><Field label="收藏优先级"><select className="select" value={priority} onChange={event => setPriority(event.target.value)}>{PRIORITY_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field></div>
    <div className="prep-form-grid three"><Field label="期刊官网"><input className="input" value={website} onChange={event => setWebsite(event.target.value)} placeholder="https://..." /></Field><Field label="作者指南"><input className="input" value={guide} onChange={event => setGuide(event.target.value)} placeholder="https://..." /></Field><Field label="投稿入口"><input className="input" value={submission} onChange={event => setSubmission(event.target.value)} placeholder="https://..." /></Field></div>
    <div className="prep-form-grid four"><Field label="ISSN"><input className="input" value={issn} onChange={event => setIssn(event.target.value)} /></Field><Field label="EISSN"><input className="input" value={eissn} onChange={event => setEissn(event.target.value)} /></Field><Field label="JCR 分区"><input className="input" value={jcr} onChange={event => setJcr(event.target.value)} placeholder="Q1" /></Field><Field label="中科院分区"><input className="input" value={cas} onChange={event => setCas(event.target.value)} placeholder="一区" /></Field></div>
    <div className="prep-form-grid four"><Field label="影响因子"><input type="number" step="0.001" min="0" className="input" value={impactFactor} onChange={event => setImpactFactor(event.target.value)} /></Field><Field label="开放获取"><select className="select" value={oaType} onChange={event => setOaType(event.target.value)}>{OA_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field><Field label="APC"><input type="number" min="0" className="input" value={apc} onChange={event => setApc(event.target.value)} /></Field><Field label="币种"><input className="input" value={currency} onChange={event => setCurrency(event.target.value)} maxLength={8} /></Field></div>
    <div className="prep-form-grid three"><Field label="首轮决定（天）"><input type="number" min="0" className="input" value={firstDecision} onChange={event => setFirstDecision(event.target.value)} /></Field><Field label="总审稿周期（天）"><input type="number" min="0" className="input" value={totalReview} onChange={event => setTotalReview(event.target.value)} /></Field><Field label="接收率（%）"><input type="number" min="0" max="100" className="input" value={acceptanceRate} onChange={event => setAcceptanceRate(event.target.value)} /></Field></div>
    <Field label="收录情况" wide><div className="prep-check-row">{INDEXING_OPTIONS.map(option => <label key={option}><input type="checkbox" checked={indexing.includes(option)} onChange={event => setIndexing(previous => event.target.checked ? [...previous, option] : previous.filter(item => item !== option))} /> {option}</label>)}</div></Field>
    <div className="prep-form-grid two"><Field label="研究领域标签"><input className="input" value={tags} onChange={event => setTags(event.target.value)} placeholder="地质灾害, 滑坡, 遥感" /></Field><Field label="风险状态"><select className="select" value={risk} onChange={event => setRisk(event.target.value)}><option value="normal">正常</option><option value="watch">关注</option><option value="warning">预警 / 谨慎</option></select></Field></div>
    <Field label="期刊范围与适配说明" wide><textarea className="textarea" value={scope} onChange={event => setScope(event.target.value)} /></Field>
    <Field label="第三方介绍链接" wide><textarea className="textarea" value={thirdParty} onChange={event => setThirdParty(event.target.value)} placeholder={'每行：LetPub|https://...\nMedSci|https://...'} /></Field>
    <div className="prep-form-grid two"><Field label="费用与开放获取备注"><textarea className="textarea" value={feeNotes} onChange={event => setFeeNotes(event.target.value)} /></Field><Field label="其它备注"><textarea className="textarea" value={notes} onChange={event => setNotes(event.target.value)} /></Field></div>
    <label className="prep-switch"><input type="checkbox" checked={favorite} onChange={event => setFavorite(event.target.checked)} /><span>加入收藏期刊</span></label>
  </ModalShell>
}

function TopicForm({ value, onSave, onDelete, onClose }: {
  value: ResearchTopic | 'new'; onSave: Props['onSaveTopic']; onDelete: Props['onDeleteTopic']; onClose: () => void
}) {
  const source = value === 'new' ? null : value
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(source?.title || '')
  const [question, setQuestion] = useState(source?.research_question || '')
  const [objective, setObjective] = useState(source?.objective || '')
  const [novelty, setNovelty] = useState(source?.novelty || '')
  const [background, setBackground] = useState(source?.background || '')
  const [keywords, setKeywords] = useState(fromList(source?.keywords))
  const [methods, setMethods] = useState(fromList(source?.methods))
  const [dataSources, setDataSources] = useState(fromList(source?.data_sources))
  const [audience, setAudience] = useState(source?.target_audience || '')
  const [output, setOutput] = useState(source?.expected_output || '')
  const [status, setStatus] = useState(source?.status || 'idea')
  const [priority, setPriority] = useState(source?.priority || 'medium')
  const [deadline, setDeadline] = useState(source?.deadline || '')
  const [links, setLinks] = useState(formatLinks(source?.links))
  const [notes, setNotes] = useState(source?.notes || '')
  const [scores, setScores] = useState({ novelty: source?.novelty_score ?? 3, feasibility: source?.feasibility_score ?? 3, data: source?.data_score ?? 3, method: source?.method_score ?? 3, timeline: source?.timeline_score ?? 3 })

  const save = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onSave({
        ...(source || {}), title: title.trim(), research_question: question.trim() || null,
        objective: objective.trim() || null, novelty: novelty.trim() || null,
        background: background.trim() || null, keywords: toList(keywords), methods: toList(methods),
        data_sources: toList(dataSources), target_audience: audience.trim() || null,
        expected_output: output.trim() || null, status: status as ResearchTopic['status'],
        priority: priority as ResearchTopic['priority'], novelty_score: scores.novelty,
        feasibility_score: scores.feasibility, data_score: scores.data, method_score: scores.method,
        timeline_score: scores.timeline, deadline: deadline || null, links: parseLinks(links), notes: notes.trim() || null,
      })
      onClose()
    } finally { setSaving(false) }
  }

  const scoreField = (label: string, key: keyof typeof scores) => <Field label={label}><input type="number" min="0" max="5" className="input" value={scores[key]} onChange={event => setScores(previous => ({ ...previous, [key]: clampScore(event.target.value) }))} /></Field>

  return <ModalShell title={source ? '编辑研究选题' : '新增研究选题'} subtitle="先判断问题是否值得做、能否做完，再决定是否进入写作" saving={saving} onClose={onClose} onSave={save} onDelete={source ? async () => { if (confirm('确认删除该选题？关联草稿将保留但解除关联。')) { await onDelete(source.id); onClose() } } : undefined}>
    <Field label="选题名称" wide><input className="input" value={title} onChange={event => setTitle(event.target.value)} autoFocus /></Field>
    <div className="prep-form-grid three"><Field label="阶段"><select className="select" value={status} onChange={event => setStatus(event.target.value)}>{TOPIC_STATUS_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field><Field label="优先级"><select className="select" value={priority} onChange={event => setPriority(event.target.value)}>{PRIORITY_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field><Field label="计划节点"><input type="date" className="input" value={deadline} onChange={event => setDeadline(event.target.value)} /></Field></div>
    <Field label="核心研究问题" wide><textarea className="textarea" value={question} onChange={event => setQuestion(event.target.value)} placeholder="具体、可检验的问题，而不是宽泛研究方向" /></Field>
    <div className="prep-form-grid two"><Field label="研究目标"><textarea className="textarea" value={objective} onChange={event => setObjective(event.target.value)} /></Field><Field label="创新点 / 与已有研究的差异"><textarea className="textarea" value={novelty} onChange={event => setNovelty(event.target.value)} /></Field></div>
    <Field label="背景与文献缺口" wide><textarea className="textarea" value={background} onChange={event => setBackground(event.target.value)} /></Field>
    <div className="prep-form-grid three"><Field label="关键词"><input className="input" value={keywords} onChange={event => setKeywords(event.target.value)} /></Field><Field label="拟用方法"><input className="input" value={methods} onChange={event => setMethods(event.target.value)} /></Field><Field label="数据与样本来源"><input className="input" value={dataSources} onChange={event => setDataSources(event.target.value)} /></Field></div>
    <div className="prep-form-grid two"><Field label="目标读者 / 学科群体"><input className="input" value={audience} onChange={event => setAudience(event.target.value)} /></Field><Field label="预期成果"><input className="input" value={output} onChange={event => setOutput(event.target.value)} placeholder="SCI 论文、中文核心、方法论文等" /></Field></div>
    <div className="prep-form-grid five">{scoreField('创新性 0–5', 'novelty')}{scoreField('总体可行性', 'feasibility')}{scoreField('数据条件', 'data')}{scoreField('方法成熟度', 'method')}{scoreField('时间可控性', 'timeline')}</div>
    <Field label="相关链接" wide><textarea className="textarea" value={links} onChange={event => setLinks(event.target.value)} placeholder={'每行：文献综述|https://...\n项目文件夹|https://...'} /></Field>
    <Field label="补充备注" wide><textarea className="textarea" value={notes} onChange={event => setNotes(event.target.value)} /></Field>
  </ModalShell>
}

function DraftForm({ value, topics, journals, onSave, onDelete, onClose }: {
  value: ManuscriptDraft | 'new'; topics: ResearchTopic[]; journals: JournalProfile[];
  onSave: Props['onSaveDraft']; onDelete: Props['onDeleteDraft']; onClose: () => void
}) {
  const source = value === 'new' ? null : value
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(source?.title || '')
  const [topicId, setTopicId] = useState(source?.topic_id || '')
  const [articleType, setArticleType] = useState(source?.article_type || 'Research Article')
  const [language, setLanguage] = useState(source?.language || 'en')
  const [stage, setStage] = useState(source?.stage || 'outline')
  const [abstract, setAbstract] = useState(source?.abstract || '')
  const [keywords, setKeywords] = useState(fromList(source?.keywords))
  const [outline, setOutline] = useState(source?.outline || '')
  const [authors, setAuthors] = useState(fromList(source?.authors))
  const [targetWords, setTargetWords] = useState(source?.target_word_count?.toString() || '')
  const [currentWords, setCurrentWords] = useState(source?.current_word_count?.toString() || '0')
  const [figures, setFigures] = useState(source?.figure_count?.toString() || '0')
  const [tables, setTables] = useState(source?.table_count?.toString() || '0')
  const [references, setReferences] = useState(source?.reference_count?.toString() || '0')
  const [deadline, setDeadline] = useState(source?.deadline || '')
  const [links, setLinks] = useState(formatLinks(source?.external_links))
  const [targetJournals, setTargetJournals] = useState<string[]>(source?.target_journal_ids || [])
  const [primaryJournal, setPrimaryJournal] = useState(source?.primary_journal_id || '')
  const [checklist, setChecklist] = useState<PreparationChecklistItem[]>(source?.checklist?.length ? source.checklist : createDefaultChecklist())
  const [notes, setNotes] = useState(source?.notes || '')

  const save = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const selectedTargets = primaryJournal && !targetJournals.includes(primaryJournal) ? [primaryJournal, ...targetJournals] : targetJournals
      await onSave({
        ...(source || {}), title: title.trim(), topic_id: topicId || null, article_type: articleType,
        language, stage: stage as ManuscriptDraft['stage'], abstract: abstract.trim() || null,
        keywords: toList(keywords), outline: outline.trim() || null, authors: toList(authors),
        target_word_count: numberOrNull(targetWords), current_word_count: Math.max(0, Number(currentWords) || 0),
        figure_count: Math.max(0, Number(figures) || 0), table_count: Math.max(0, Number(tables) || 0),
        reference_count: Math.max(0, Number(references) || 0), deadline: deadline || null,
        external_links: parseLinks(links), target_journal_ids: selectedTargets,
        primary_journal_id: primaryJournal || null, checklist, notes: notes.trim() || null,
      })
      onClose()
    } finally { setSaving(false) }
  }

  return <ModalShell title={source ? '编辑草稿准备' : '新建草稿准备'} subtitle="统一管理正文进度、目标期刊、投稿材料和合规检查" saving={saving} onClose={onClose} onSave={save} onDelete={source ? async () => { if (confirm('确认删除该草稿准备记录？')) { await onDelete(source.id); onClose() } } : undefined}>
    <Field label="工作标题" wide><input className="input" value={title} onChange={event => setTitle(event.target.value)} autoFocus /></Field>
    <div className="prep-form-grid four"><Field label="关联选题"><select className="select" value={topicId} onChange={event => setTopicId(event.target.value)}><option value="">不关联</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></Field><Field label="论文类型"><select className="select" value={articleType} onChange={event => setArticleType(event.target.value)}>{ARTICLE_TYPE_OPTIONS.map(option => <option key={option}>{option}</option>)}</select></Field><Field label="语言"><select className="select" value={language} onChange={event => setLanguage(event.target.value)}><option value="en">英文</option><option value="zh">中文</option></select></Field><Field label="准备阶段"><select className="select" value={stage} onChange={event => setStage(event.target.value)}>{DRAFT_STAGE_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field></div>
    <Field label="摘要 / 核心论证" wide><textarea className="textarea" value={abstract} onChange={event => setAbstract(event.target.value)} /></Field>
    <div className="prep-form-grid two"><Field label="关键词"><input className="input" value={keywords} onChange={event => setKeywords(event.target.value)} /></Field><Field label="作者顺序"><input className="input" value={authors} onChange={event => setAuthors(event.target.value)} /></Field></div>
    <Field label="论文提纲" wide><textarea className="textarea prep-outline" value={outline} onChange={event => setOutline(event.target.value)} placeholder={'1. Introduction\n2. Materials and Methods\n3. Results\n4. Discussion\n5. Conclusions'} /></Field>
    <div className="prep-form-grid six"><Field label="目标字数"><input type="number" min="0" className="input" value={targetWords} onChange={event => setTargetWords(event.target.value)} /></Field><Field label="当前字数"><input type="number" min="0" className="input" value={currentWords} onChange={event => setCurrentWords(event.target.value)} /></Field><Field label="图"><input type="number" min="0" className="input" value={figures} onChange={event => setFigures(event.target.value)} /></Field><Field label="表"><input type="number" min="0" className="input" value={tables} onChange={event => setTables(event.target.value)} /></Field><Field label="参考文献"><input type="number" min="0" className="input" value={references} onChange={event => setReferences(event.target.value)} /></Field><Field label="计划投稿"><input type="date" className="input" value={deadline} onChange={event => setDeadline(event.target.value)} /></Field></div>
    <div className="prep-form-grid two"><Field label="主投期刊"><select className="select" value={primaryJournal} onChange={event => setPrimaryJournal(event.target.value)}><option value="">暂未确定</option>{journals.map(journal => <option key={journal.id} value={journal.id}>{journal.name}</option>)}</select></Field><Field label="备选期刊"><div className="prep-journal-select">{journals.map(journal => <label key={journal.id}><input type="checkbox" checked={targetJournals.includes(journal.id)} onChange={event => setTargetJournals(previous => event.target.checked ? [...previous, journal.id] : previous.filter(id => id !== journal.id))} /> {journal.name}</label>)}</div></Field></div>
    <div className="prep-checklist-head"><div><b>投稿前检查</b><span>必需项完成度 {checklistProgress(checklist)}%</span></div><button className="btn btn-ghost btn-sm" onClick={() => setChecklist(createDefaultChecklist())}>恢复默认</button></div>
    <div className="prep-checklist">{checklist.map((item, index) => <label key={item.id} className={item.done ? 'done' : ''}><input type="checkbox" checked={item.done} onChange={event => setChecklist(previous => previous.map((entry, itemIndex) => itemIndex === index ? { ...entry, done: event.target.checked } : entry))} /><span>{item.label}{item.required && <em>必需</em>}</span></label>)}</div>
    <Field label="外部文件与协作链接" wide><textarea className="textarea" value={links} onChange={event => setLinks(event.target.value)} placeholder={'每行：Word 主稿|https://...\n数据文件夹|https://...'} /></Field>
    <Field label="写作备注 / 当前阻碍" wide><textarea className="textarea" value={notes} onChange={event => setNotes(event.target.value)} /></Field>
  </ModalShell>
}

export default function PreparationWorkspace({ snapshot, loading, onSaveJournal, onDeleteJournal, onSaveTopic, onDeleteTopic, onSaveDraft, onDeleteDraft, onPromoteDraft }: Props) {
  const [section, setSection] = useState<SectionKey>('overview')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Editor>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)

  const query = search.trim().toLocaleLowerCase()
  const journals = useMemo(() => snapshot.journals.filter(item => !query || `${item.name} ${item.publisher || ''} ${item.scope || ''} ${(item.subject_tags || []).join(' ')}`.toLocaleLowerCase().includes(query)), [snapshot.journals, query])
  const topics = useMemo(() => snapshot.topics.filter(item => !query || `${item.title} ${item.research_question || ''} ${item.novelty || ''} ${(item.keywords || []).join(' ')}`.toLocaleLowerCase().includes(query)), [snapshot.topics, query])
  const drafts = useMemo(() => snapshot.drafts.filter(item => !query || `${item.title} ${item.abstract || ''} ${(item.keywords || []).join(' ')}`.toLocaleLowerCase().includes(query)), [snapshot.drafts, query])
  const journalMap = useMemo(() => new Map(snapshot.journals.map(item => [item.id, item])), [snapshot.journals])
  const topicMap = useMemo(() => new Map(snapshot.topics.map(item => [item.id, item])), [snapshot.topics])

  const orderedJournals = [...journals].sort((left, right) => Number(right.is_favorite) - Number(left.is_favorite) || priorityWeight[right.priority] - priorityWeight[left.priority] || left.name.localeCompare(right.name))
  const orderedTopics = [...topics].sort((left, right) => priorityWeight[right.priority] - priorityWeight[left.priority] || topicCompositeScore(right) - topicCompositeScore(left))
  const orderedDrafts = [...drafts].sort((left, right) => {
    const leftDays = daysUntilDate(left.deadline) ?? 99999
    const rightDays = daysUntilDate(right.deadline) ?? 99999
    return leftDays - rightDays || checklistProgress(right.checklist || []) - checklistProgress(left.checklist || [])
  })

  const readyDrafts = snapshot.drafts.filter(draft => draft.stage === 'submission_ready' || checklistProgress(draft.checklist || []) >= 90).length
  const activeTopics = snapshot.topics.filter(topic => !['paused', 'abandoned'].includes(topic.status)).length
  const favoriteJournals = snapshot.journals.filter(journal => journal.is_favorite).length

  const promote = async (draft: ManuscriptDraft) => {
    if (!onPromoteDraft || promotingId) return
    if (!confirm(`将“${draft.title}”转入正式投稿管理？系统会创建一条准备中投稿记录。`)) return
    setPromotingId(draft.id)
    try { await onPromoteDraft(draft) } finally { setPromotingId(null) }
  }

  if (loading) return <div className="prep-loading"><div className="spinner" /> 加载投稿准备数据...</div>

  return <div className="preparation-workspace">
    <div className="prep-topbar">
      <div><h1>投稿准备</h1><p>从选题判断、论文写作、期刊筛选到投稿材料检查的一体化工作区</p></div>
      <div className="prep-top-actions"><div className="prep-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索选题、草稿或期刊..." /></div><button className="btn btn-primary btn-sm" onClick={() => setEditor({ type: section === 'journals' ? 'journal' : section === 'topics' ? 'topic' : 'draft', value: 'new' } as Editor)}><Plus size={14} /> 新建</button></div>
    </div>

    <div className="prep-nav">
      <button className={section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}>总览</button>
      <button className={section === 'topics' ? 'active' : ''} onClick={() => setSection('topics')}><Lightbulb size={14} /> 选题池 <span>{snapshot.topics.length}</span></button>
      <button className={section === 'drafts' ? 'active' : ''} onClick={() => setSection('drafts')}><FilePenLine size={14} /> 草稿准备 <span>{snapshot.drafts.length}</span></button>
      <button className={section === 'journals' ? 'active' : ''} onClick={() => setSection('journals')}><BookOpen size={14} /> 期刊库 <span>{snapshot.journals.length}</span></button>
    </div>

    {section === 'overview' && <>
      <div className="prep-metrics"><div><b>{activeTopics}</b><span>推进中的选题</span></div><div><b>{snapshot.drafts.length}</b><span>论文草稿</span></div><div><b>{readyDrafts}</b><span>接近可投稿</span></div><div><b>{favoriteJournals}</b><span>收藏期刊</span></div></div>
      <div className="prep-overview-grid">
        <section className="prep-panel"><div className="prep-panel-head"><div><h2>优先草稿</h2><p>按投稿日期和准备完成度排序</p></div><button onClick={() => setSection('drafts')}>查看全部 <ArrowRight size={13} /></button></div>{orderedDrafts.slice(0, 4).map(draft => <DraftCard key={draft.id} draft={draft} topic={draft.topic_id ? topicMap.get(draft.topic_id) : undefined} journals={draft.target_journal_ids.map(id => journalMap.get(id)).filter(Boolean) as JournalProfile[]} primaryJournal={draft.primary_journal_id ? journalMap.get(draft.primary_journal_id) : undefined} onEdit={() => setEditor({ type: 'draft', value: draft })} onPromote={onPromoteDraft ? () => promote(draft) : undefined} promoting={promotingId === draft.id} compact />)}{!orderedDrafts.length && <Empty text="尚无草稿准备记录" action="新建草稿" onClick={() => setEditor({ type: 'draft', value: 'new' })} />}</section>
        <section className="prep-panel"><div className="prep-panel-head"><div><h2>优先期刊</h2><p>收藏、分区、费用与审稿速度</p></div><button onClick={() => setSection('journals')}>查看全部 <ArrowRight size={13} /></button></div>{orderedJournals.slice(0, 5).map(journal => <JournalRow key={journal.id} journal={journal} onClick={() => setEditor({ type: 'journal', value: journal })} />)}{!orderedJournals.length && <Empty text="尚未收藏期刊" action="收藏期刊" onClick={() => setEditor({ type: 'journal', value: 'new' })} />}</section>
      </div>
      <section className="prep-panel prep-topic-overview"><div className="prep-panel-head"><div><h2>选题推进</h2><p>综合创新性、数据、方法、可行性与时间条件</p></div><button onClick={() => setSection('topics')}>查看全部 <ArrowRight size={13} /></button></div><div className="prep-topic-strip">{orderedTopics.slice(0, 5).map(topic => <TopicCard key={topic.id} topic={topic} onClick={() => setEditor({ type: 'topic', value: topic })} compact />)}{!orderedTopics.length && <Empty text="尚无研究选题" action="新增选题" onClick={() => setEditor({ type: 'topic', value: 'new' })} />}</div></section>
    </>}

    {section === 'topics' && <div className="prep-card-grid">{orderedTopics.map(topic => <TopicCard key={topic.id} topic={topic} onClick={() => setEditor({ type: 'topic', value: topic })} />)}{!orderedTopics.length && <Empty text={query ? '没有匹配的选题' : '尚无研究选题'} action="新增选题" onClick={() => setEditor({ type: 'topic', value: 'new' })} />}</div>}

    {section === 'drafts' && <div className="prep-draft-list">{orderedDrafts.map(draft => <DraftCard key={draft.id} draft={draft} topic={draft.topic_id ? topicMap.get(draft.topic_id) : undefined} journals={draft.target_journal_ids.map(id => journalMap.get(id)).filter(Boolean) as JournalProfile[]} primaryJournal={draft.primary_journal_id ? journalMap.get(draft.primary_journal_id) : undefined} onEdit={() => setEditor({ type: 'draft', value: draft })} onPromote={onPromoteDraft ? () => promote(draft) : undefined} promoting={promotingId === draft.id} />)}{!orderedDrafts.length && <Empty text={query ? '没有匹配的草稿' : '尚无草稿准备记录'} action="新建草稿" onClick={() => setEditor({ type: 'draft', value: 'new' })} />}</div>}

    {section === 'journals' && <div className="prep-card-grid journal-grid">{orderedJournals.map(journal => <JournalCard key={journal.id} journal={journal} onClick={() => setEditor({ type: 'journal', value: journal })} />)}{!orderedJournals.length && <Empty text={query ? '没有匹配的期刊' : '尚未收藏期刊'} action="收藏期刊" onClick={() => setEditor({ type: 'journal', value: 'new' })} />}</div>}

    {editor?.type === 'journal' && <JournalForm value={editor.value} onSave={onSaveJournal} onDelete={onDeleteJournal} onClose={() => setEditor(null)} />}
    {editor?.type === 'topic' && <TopicForm value={editor.value} onSave={onSaveTopic} onDelete={onDeleteTopic} onClose={() => setEditor(null)} />}
    {editor?.type === 'draft' && <DraftForm value={editor.value} topics={snapshot.topics} journals={snapshot.journals} onSave={onSaveDraft} onDelete={onDeleteDraft} onClose={() => setEditor(null)} />}
  </div>
}

function Empty({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return <div className="prep-empty"><span>{text}</span><button className="btn btn-ghost btn-sm" onClick={onClick}><Plus size={13} /> {action}</button></div>
}

function TopicCard({ topic, onClick, compact }: { topic: ResearchTopic; onClick: () => void; compact?: boolean }) {
  const score = topicCompositeScore(topic)
  const status = TOPIC_STATUS_OPTIONS.find(item => item.key === topic.status)?.label || topic.status
  const days = daysUntilDate(topic.deadline)
  return <button className={`prep-topic-card ${compact ? 'compact' : ''}`} onClick={onClick}><div className="prep-card-top"><span className={`prep-priority ${topic.priority}`}>{PRIORITY_OPTIONS.find(item => item.key === topic.priority)?.label}</span><b>{score}</b></div><h3>{topic.title}</h3>{!compact && topic.research_question && <p>{topic.research_question}</p>}<div className="prep-tags">{topic.keywords.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div><div className="prep-card-foot"><span>{status}</span>{days !== null && <span className={days < 0 ? 'danger' : days <= 14 ? 'warn' : ''}>{days < 0 ? `逾期 ${-days} 天` : `${days} 天`}</span>}</div></button>
}

function DraftCard({ draft, topic, journals, primaryJournal, onEdit, onPromote, promoting, compact }: { draft: ManuscriptDraft; topic?: ResearchTopic; journals: JournalProfile[]; primaryJournal?: JournalProfile; onEdit: () => void; onPromote?: () => void; promoting?: boolean; compact?: boolean }) {
  const progress = checklistProgress(draft.checklist || [])
  const wordProgress = draft.target_word_count ? Math.min(100, Math.round(draft.current_word_count / draft.target_word_count * 100)) : 0
  const stage = DRAFT_STAGE_OPTIONS.find(item => item.key === draft.stage)?.label || draft.stage
  const days = daysUntilDate(draft.deadline)
  return <article className={`prep-draft-card ${compact ? 'compact' : ''}`}><button className="prep-draft-main" onClick={onEdit}><div className="prep-draft-head"><div><span>{stage}</span>{topic && <em>{topic.title}</em>}</div><b>{progress}%</b></div><h3>{draft.title}</h3><div className="prep-progress"><span style={{ width: `${progress}%` }} /></div><div className="prep-draft-meta"><span>检查 {progress}%</span>{draft.target_word_count ? <span>写作 {draft.current_word_count}/{draft.target_word_count}（{wordProgress}%）</span> : <span>字数 {draft.current_word_count}</span>}<span>图 {draft.figure_count} · 表 {draft.table_count} · 文献 {draft.reference_count}</span></div><div className="prep-draft-foot"><span>{primaryJournal ? `主投：${primaryJournal.name}` : journals.length ? `备选 ${journals.length} 本` : '未选期刊'}</span>{days !== null && <span className={days < 0 ? 'danger' : days <= 14 ? 'warn' : ''}>{days < 0 ? `计划已逾期 ${-days} 天` : `计划 ${days} 天后投稿`}</span>}</div></button>{onPromote && !draft.submitted_paper_id && <button className="btn btn-primary btn-sm prep-promote" onClick={onPromote} disabled={promoting}>{promoting ? '转入中...' : <>转入投稿 <ArrowRight size={13} /></>}</button>}</article>
}

function JournalRow({ journal, onClick }: { journal: JournalProfile; onClick: () => void }) {
  return <button className="prep-journal-row" onClick={onClick}><span className="prep-journal-star">{journal.is_favorite ? '★' : '☆'}</span><span><b>{journal.name}</b><small>{journal.publisher || journal.scope || '未填写出版社或范围'}</small></span><em>{journal.jcr_quartile || 'JCR 未定'} · {journal.cas_quartile || '中科院未定'}</em><strong>{journalFitSummary(journal)}</strong></button>
}

function JournalCard({ journal, onClick }: { journal: JournalProfile; onClick: () => void }) {
  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'
  return <article className="prep-journal-card"><button className="prep-journal-card-main" onClick={onClick}><div className="prep-card-top"><span className={`prep-priority ${journal.priority}`}>{journal.is_favorite ? <Star size={13} fill="currentColor" /> : '未收藏'}</span><span className={`prep-risk ${journal.risk_level}`}>{journal.risk_level === 'warning' ? '预警' : journal.risk_level === 'watch' ? '关注' : '正常'}</span></div><h3>{journal.name}</h3><p>{journal.publisher || journal.scope || '尚未填写出版社与期刊范围'}</p><div className="prep-journal-facts"><span>{journal.jcr_quartile || 'JCR 未定'}</span><span>{journal.cas_quartile || '中科院未定'}</span>{journal.impact_factor !== null && <span>IF {journal.impact_factor}</span>}<span>{oa}</span></div><div className="prep-journal-numbers"><div><b>{journal.first_decision_days ?? '—'}</b><small>首轮决定/天</small></div><div><b>{journal.total_review_days ?? '—'}</b><small>总审稿/天</small></div><div><b>{journal.acceptance_rate !== null ? `${journal.acceptance_rate}%` : '—'}</b><small>接收率</small></div><div><b>{journal.apc_amount !== null ? journal.apc_amount : '—'}</b><small>{journal.apc_currency || 'APC'}</small></div></div></button><div className="prep-journal-links">{safeUrl(journal.website_url) && <a href={journal.website_url!} target="_blank" rel="noopener noreferrer">官网 <ExternalLink size={11} /></a>}{safeUrl(journal.author_guide_url) && <a href={journal.author_guide_url!} target="_blank" rel="noopener noreferrer">指南 <ExternalLink size={11} /></a>}{safeUrl(journal.submission_url) && <a href={journal.submission_url!} target="_blank" rel="noopener noreferrer">投稿 <ExternalLink size={11} /></a>}{journal.third_party_links.slice(0, 2).map(link => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <ExternalLink size={11} /></a>)}</div></article>
}
