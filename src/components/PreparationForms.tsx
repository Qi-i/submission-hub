import { useState, type ReactNode } from 'react'
import { Save, Trash2, X } from 'lucide-react'
import type {
  ExternalLink, JournalProfile, ManuscriptDraft, PreparationChecklistItem, ResearchTopic,
} from '../lib/preparation'
import {
  ARTICLE_TYPE_OPTIONS, DRAFT_STAGE_OPTIONS, INDEXING_OPTIONS, OA_OPTIONS,
  PRIORITY_OPTIONS, TOPIC_STATUS_OPTIONS, checklistProgress, createDefaultChecklist,
} from '../lib/preparation'

const toList = (value: string) => Array.from(new Set(value.split(/[，,;；、\n]+/).map(item => item.trim()).filter(Boolean)))
const fromList = (value?: string[] | null) => (value || []).join(', ')
const safeUrl = (value?: string | null) => !!value && /^https?:\/\//i.test(value)
const numberOrNull = (value: string) => value.trim() === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null
const integerOrNull = (value: string) => {
  const parsed = numberOrNull(value)
  return parsed === null ? null : Math.max(0, Math.round(parsed))
}
const percentageOrNull = (value: string) => {
  const parsed = numberOrNull(value)
  return parsed === null ? null : Math.max(0, Math.min(100, parsed))
}
const clampScore = (value: string) => Math.max(0, Math.min(5, Math.round(Number(value) || 0)))

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
  return <div className={`prep-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</div>
}

function ModalShell({ title, subtitle, saving, onClose, onSave, onDelete, children }: {
  title: string
  subtitle?: string
  saving: boolean
  onClose: () => void
  onSave: () => void
  onDelete?: () => void
  children: ReactNode
}) {
  return <div className="modal-overlay" onClick={() => !saving && onClose()}>
    <div className="modal prep-modal" onClick={event => event.stopPropagation()}>
      <div className="prep-modal-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="btn btn-ghost btn-icon" onClick={onClose} disabled={saving}><X size={18} /></button></div>
      <div className="prep-modal-body">{children}</div>
      <div className="prep-modal-footer">{onDelete ? <button type="button" className="btn btn-danger btn-sm" onClick={onDelete} disabled={saving}><Trash2 size={14} /> 删除</button> : <span />}<div><button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>取消</button><button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}><Save size={14} /> {saving ? '保存中...' : '保存'}</button></div></div>
    </div>
  </div>
}

async function execute(action: () => Promise<void>, message: string) {
  try {
    await action()
    return true
  } catch (error) {
    console.error(message, error)
    alert(error instanceof Error ? `${message}：${error.message}` : message)
    return false
  }
}

export function JournalForm({ value, onSave, onDelete, onClose }: {
  value: JournalProfile | 'new'
  onSave: (data: Partial<JournalProfile> & Pick<JournalProfile, 'name'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
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
  const [oaType, setOaType] = useState<string>(source?.oa_type || 'unknown')
  const [apc, setApc] = useState(source?.apc_amount?.toString() || '')
  const [currency, setCurrency] = useState(source?.apc_currency || 'USD')
  const [feeNotes, setFeeNotes] = useState(source?.fee_notes || '')
  const [firstDecision, setFirstDecision] = useState(source?.first_decision_days?.toString() || '')
  const [totalReview, setTotalReview] = useState(source?.total_review_days?.toString() || '')
  const [acceptanceRate, setAcceptanceRate] = useState(source?.acceptance_rate?.toString() || '')
  const [risk, setRisk] = useState<string>(source?.risk_level || 'normal')
  const [favorite, setFavorite] = useState(source?.is_favorite ?? true)
  const [priority, setPriority] = useState<string>(source?.priority || 'medium')
  const [notes, setNotes] = useState(source?.notes || '')

  const save = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const ok = await execute(() => onSave({
      ...(source || {}),
      name: name.trim(), publisher: publisher.trim() || null,
      website_url: website.trim() || null, author_guide_url: guide.trim() || null,
      submission_url: submission.trim() || null, third_party_links: parseLinks(thirdParty),
      issn: issn.trim() || null, eissn: eissn.trim() || null, scope: scope.trim() || null,
      subject_tags: toList(tags), indexing, jcr_quartile: jcr.trim() || null, cas_quartile: cas.trim() || null,
      impact_factor: numberOrNull(impactFactor), oa_type: oaType as JournalProfile['oa_type'],
      apc_amount: numberOrNull(apc), apc_currency: currency.trim().toUpperCase() || 'USD',
      fee_notes: feeNotes.trim() || null, first_decision_days: integerOrNull(firstDecision),
      total_review_days: integerOrNull(totalReview), acceptance_rate: percentageOrNull(acceptanceRate),
      risk_level: risk as JournalProfile['risk_level'], is_favorite: favorite,
      priority: priority as JournalProfile['priority'], notes: notes.trim() || null,
    }), '期刊档案保存失败')
    setSaving(false)
    if (ok) onClose()
  }

  const remove = async () => {
    if (!source || !confirm('确认删除该期刊档案？')) return
    setSaving(true)
    const ok = await execute(() => onDelete(source.id), '期刊档案删除失败')
    setSaving(false)
    if (ok) onClose()
  }

  return <ModalShell title={source ? '编辑期刊档案' : '收藏期刊'} subtitle="记录投稿入口、分区、费用、审稿速度和第三方介绍" saving={saving} onClose={onClose} onSave={() => void save()} onDelete={source ? () => void remove() : undefined}>
    <div className="prep-form-grid two"><Field label="期刊名称" wide><input className="input" value={name} onChange={event => setName(event.target.value)} autoFocus /></Field><Field label="出版社"><input className="input" value={publisher} onChange={event => setPublisher(event.target.value)} /></Field><Field label="收藏优先级"><select className="select" value={priority} onChange={event => setPriority(event.target.value)}>{PRIORITY_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field></div>
    <div className="prep-form-grid three"><Field label="期刊官网"><input className="input" value={website} onChange={event => setWebsite(event.target.value)} placeholder="https://..." /></Field><Field label="作者指南"><input className="input" value={guide} onChange={event => setGuide(event.target.value)} placeholder="https://..." /></Field><Field label="投稿入口"><input className="input" value={submission} onChange={event => setSubmission(event.target.value)} placeholder="https://..." /></Field></div>
    <div className="prep-form-grid four"><Field label="ISSN"><input className="input" value={issn} onChange={event => setIssn(event.target.value)} /></Field><Field label="EISSN"><input className="input" value={eissn} onChange={event => setEissn(event.target.value)} /></Field><Field label="JCR 分区"><input className="input" value={jcr} onChange={event => setJcr(event.target.value)} placeholder="Q1" /></Field><Field label="中科院分区"><input className="input" value={cas} onChange={event => setCas(event.target.value)} placeholder="一区" /></Field></div>
    <div className="prep-form-grid four"><Field label="影响因子"><input type="number" step="0.001" min="0" className="input" value={impactFactor} onChange={event => setImpactFactor(event.target.value)} /></Field><Field label="开放获取"><select className="select" value={oaType} onChange={event => setOaType(event.target.value)}>{OA_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field><Field label="APC"><input type="number" min="0" className="input" value={apc} onChange={event => setApc(event.target.value)} /></Field><Field label="币种"><input className="input" value={currency} onChange={event => setCurrency(event.target.value)} maxLength={8} /></Field></div>
    <div className="prep-form-grid three"><Field label="首轮决定（天）"><input type="number" min="0" step="1" className="input" value={firstDecision} onChange={event => setFirstDecision(event.target.value)} /></Field><Field label="总审稿周期（天）"><input type="number" min="0" step="1" className="input" value={totalReview} onChange={event => setTotalReview(event.target.value)} /></Field><Field label="接收率（%）"><input type="number" min="0" max="100" className="input" value={acceptanceRate} onChange={event => setAcceptanceRate(event.target.value)} /></Field></div>
    <Field label="收录情况" wide><div className="prep-check-row">{INDEXING_OPTIONS.map(option => <label key={option}><input type="checkbox" checked={indexing.includes(option)} onChange={event => setIndexing(previous => event.target.checked ? Array.from(new Set([...previous, option])) : previous.filter(item => item !== option))} /> {option}</label>)}</div></Field>
    <div className="prep-form-grid two"><Field label="研究领域标签"><input className="input" value={tags} onChange={event => setTags(event.target.value)} placeholder="地质灾害, 滑坡, 遥感" /></Field><Field label="风险状态"><select className="select" value={risk} onChange={event => setRisk(event.target.value)}><option value="normal">正常</option><option value="watch">关注</option><option value="warning">预警 / 谨慎</option></select></Field></div>
    <Field label="期刊范围与适配说明" wide><textarea className="textarea" value={scope} onChange={event => setScope(event.target.value)} /></Field>
    <Field label="第三方介绍链接" wide><textarea className="textarea" value={thirdParty} onChange={event => setThirdParty(event.target.value)} placeholder={'每行：LetPub|https://...\nMedSci|https://...'} /></Field>
    <div className="prep-form-grid two"><Field label="费用与开放获取备注"><textarea className="textarea" value={feeNotes} onChange={event => setFeeNotes(event.target.value)} /></Field><Field label="其它备注"><textarea className="textarea" value={notes} onChange={event => setNotes(event.target.value)} /></Field></div>
    <label className="prep-switch"><input type="checkbox" checked={favorite} onChange={event => setFavorite(event.target.checked)} /><span>加入收藏期刊</span></label>
  </ModalShell>
}

export function TopicForm({ value, onSave, onDelete, onClose }: {
  value: ResearchTopic | 'new'
  onSave: (data: Partial<ResearchTopic> & Pick<ResearchTopic, 'title'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
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
  const [status, setStatus] = useState<string>(source?.status || 'idea')
  const [priority, setPriority] = useState<string>(source?.priority || 'medium')
  const [deadline, setDeadline] = useState(source?.deadline || '')
  const [links, setLinks] = useState(formatLinks(source?.links))
  const [notes, setNotes] = useState(source?.notes || '')
  const [scores, setScores] = useState({ novelty: source?.novelty_score ?? 3, feasibility: source?.feasibility_score ?? 3, data: source?.data_score ?? 3, method: source?.method_score ?? 3, timeline: source?.timeline_score ?? 3 })

  const save = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    const ok = await execute(() => onSave({
      ...(source || {}), title: title.trim(), research_question: question.trim() || null,
      objective: objective.trim() || null, novelty: novelty.trim() || null,
      background: background.trim() || null, keywords: toList(keywords), methods: toList(methods),
      data_sources: toList(dataSources), target_audience: audience.trim() || null,
      expected_output: output.trim() || null, status: status as ResearchTopic['status'],
      priority: priority as ResearchTopic['priority'], novelty_score: scores.novelty,
      feasibility_score: scores.feasibility, data_score: scores.data, method_score: scores.method,
      timeline_score: scores.timeline, deadline: deadline || null, links: parseLinks(links), notes: notes.trim() || null,
    }), '研究选题保存失败')
    setSaving(false)
    if (ok) onClose()
  }

  const remove = async () => {
    if (!source || !confirm('确认删除该选题？关联草稿将保留但解除关联。')) return
    setSaving(true)
    const ok = await execute(() => onDelete(source.id), '研究选题删除失败')
    setSaving(false)
    if (ok) onClose()
  }

  const scoreField = (label: string, key: keyof typeof scores) => <Field label={label}><input type="number" min="0" max="5" step="1" className="input" value={scores[key]} onChange={event => setScores(previous => ({ ...previous, [key]: clampScore(event.target.value) }))} /></Field>

  return <ModalShell title={source ? '编辑研究选题' : '新增研究选题'} subtitle="先判断问题是否值得做、能否做完，再决定是否进入写作" saving={saving} onClose={onClose} onSave={() => void save()} onDelete={source ? () => void remove() : undefined}>
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

export function DraftForm({ value, topics, journals, onSave, onDelete, onClose }: {
  value: ManuscriptDraft | 'new'
  topics: ResearchTopic[]
  journals: JournalProfile[]
  onSave: (data: Partial<ManuscriptDraft> & Pick<ManuscriptDraft, 'title'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}) {
  const source = value === 'new' ? null : value
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(source?.title || '')
  const [topicId, setTopicId] = useState(source?.topic_id || '')
  const [articleType, setArticleType] = useState(source?.article_type || 'Research Article')
  const [language, setLanguage] = useState(source?.language || 'en')
  const [stage, setStage] = useState<string>(source?.stage || 'outline')
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
    const selectedTargets = primaryJournal && !targetJournals.includes(primaryJournal) ? [primaryJournal, ...targetJournals] : targetJournals
    const ok = await execute(() => onSave({
      ...(source || {}), title: title.trim(), topic_id: topicId || null, article_type: articleType,
      language, stage: stage as ManuscriptDraft['stage'], abstract: abstract.trim() || null,
      keywords: toList(keywords), outline: outline.trim() || null, authors: toList(authors),
      target_word_count: integerOrNull(targetWords), current_word_count: integerOrNull(currentWords) || 0,
      figure_count: integerOrNull(figures) || 0, table_count: integerOrNull(tables) || 0,
      reference_count: integerOrNull(references) || 0, deadline: deadline || null,
      external_links: parseLinks(links), target_journal_ids: Array.from(new Set(selectedTargets)),
      primary_journal_id: primaryJournal || null, checklist, notes: notes.trim() || null,
    }), '草稿准备保存失败')
    setSaving(false)
    if (ok) onClose()
  }

  const remove = async () => {
    if (!source || !confirm('确认删除该草稿准备记录？')) return
    setSaving(true)
    const ok = await execute(() => onDelete(source.id), '草稿准备删除失败')
    setSaving(false)
    if (ok) onClose()
  }

  return <ModalShell title={source ? '编辑草稿准备' : '新建草稿准备'} subtitle="统一管理正文进度、目标期刊、投稿材料和合规检查" saving={saving} onClose={onClose} onSave={() => void save()} onDelete={source ? () => void remove() : undefined}>
    <Field label="工作标题" wide><input className="input" value={title} onChange={event => setTitle(event.target.value)} autoFocus /></Field>
    <div className="prep-form-grid four"><Field label="关联选题"><select className="select" value={topicId} onChange={event => setTopicId(event.target.value)}><option value="">不关联</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></Field><Field label="论文类型"><select className="select" value={articleType} onChange={event => setArticleType(event.target.value)}>{ARTICLE_TYPE_OPTIONS.map(option => <option key={option}>{option}</option>)}</select></Field><Field label="语言"><select className="select" value={language} onChange={event => setLanguage(event.target.value)}><option value="en">英文</option><option value="zh">中文</option></select></Field><Field label="准备阶段"><select className="select" value={stage} onChange={event => setStage(event.target.value)}>{DRAFT_STAGE_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field></div>
    <Field label="摘要 / 核心论证" wide><textarea className="textarea" value={abstract} onChange={event => setAbstract(event.target.value)} /></Field>
    <div className="prep-form-grid two"><Field label="关键词"><input className="input" value={keywords} onChange={event => setKeywords(event.target.value)} /></Field><Field label="作者顺序"><input className="input" value={authors} onChange={event => setAuthors(event.target.value)} /></Field></div>
    <Field label="论文提纲" wide><textarea className="textarea prep-outline" value={outline} onChange={event => setOutline(event.target.value)} placeholder={'1. Introduction\n2. Materials and Methods\n3. Results\n4. Discussion\n5. Conclusions'} /></Field>
    <div className="prep-form-grid six"><Field label="目标字数"><input type="number" min="0" step="1" className="input" value={targetWords} onChange={event => setTargetWords(event.target.value)} /></Field><Field label="当前字数"><input type="number" min="0" step="1" className="input" value={currentWords} onChange={event => setCurrentWords(event.target.value)} /></Field><Field label="图"><input type="number" min="0" step="1" className="input" value={figures} onChange={event => setFigures(event.target.value)} /></Field><Field label="表"><input type="number" min="0" step="1" className="input" value={tables} onChange={event => setTables(event.target.value)} /></Field><Field label="参考文献"><input type="number" min="0" step="1" className="input" value={references} onChange={event => setReferences(event.target.value)} /></Field><Field label="计划投稿"><input type="date" className="input" value={deadline} onChange={event => setDeadline(event.target.value)} /></Field></div>
    <div className="prep-form-grid two"><Field label="主投期刊"><select className="select" value={primaryJournal} onChange={event => setPrimaryJournal(event.target.value)}><option value="">暂未确定</option>{journals.map(journal => <option key={journal.id} value={journal.id}>{journal.name}</option>)}</select></Field><Field label="备选期刊"><div className="prep-journal-select">{journals.map(journal => <label key={journal.id}><input type="checkbox" checked={targetJournals.includes(journal.id)} onChange={event => setTargetJournals(previous => event.target.checked ? Array.from(new Set([...previous, journal.id])) : previous.filter(id => id !== journal.id))} /> {journal.name}</label>)}</div></Field></div>
    <div className="prep-checklist-head"><div><b>投稿前检查</b><span>必需项完成度 {checklistProgress(checklist)}%</span></div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setChecklist(createDefaultChecklist())}>恢复默认</button></div>
    <div className="prep-checklist">{checklist.map((item, index) => <label key={item.id} className={item.done ? 'done' : ''}><input type="checkbox" checked={item.done} onChange={event => setChecklist(previous => previous.map((entry, itemIndex) => itemIndex === index ? { ...entry, done: event.target.checked } : entry))} /><span>{item.label}{item.required && <em>必需</em>}</span></label>)}</div>
    <Field label="外部文件与协作链接" wide><textarea className="textarea" value={links} onChange={event => setLinks(event.target.value)} placeholder={'每行：Word 主稿|https://...\n数据文件夹|https://...'} /></Field>
    <Field label="写作备注 / 当前阻碍" wide><textarea className="textarea" value={notes} onChange={event => setNotes(event.target.value)} /></Field>
  </ModalShell>
}
