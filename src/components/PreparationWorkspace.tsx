import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, ExternalLink, FilePenLine, Lightbulb, Plus, Search, Star } from 'lucide-react'
import type { JournalProfile, ManuscriptDraft, PreparationSnapshot, ResearchTopic } from '../lib/preparation'
import {
  DRAFT_STAGE_OPTIONS, OA_OPTIONS, PRIORITY_OPTIONS, TOPIC_STATUS_OPTIONS,
  checklistProgress, journalFitSummary, topicCompositeScore,
} from '../lib/preparation'
import { daysUntilDate } from '../lib/types'
import { DraftForm, JournalForm, TopicForm } from './PreparationForms'

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
const safeUrl = (value?: string | null) => !!value && /^https?:\/\//i.test(value)

export default function PreparationWorkspace({ snapshot, loading, onSaveJournal, onDeleteJournal, onSaveTopic, onDeleteTopic, onSaveDraft, onDeleteDraft, onPromoteDraft }: Props) {
  const [section, setSection] = useState<SectionKey>('overview')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Editor>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)

  const normalized = useMemo<PreparationSnapshot>(() => ({
    journals: (snapshot.journals || []).map(journal => ({
      ...journal,
      third_party_links: Array.isArray(journal.third_party_links) ? journal.third_party_links : [],
      subject_tags: Array.isArray(journal.subject_tags) ? journal.subject_tags : [],
      indexing: Array.isArray(journal.indexing) ? journal.indexing : [],
    })),
    topics: (snapshot.topics || []).map(topic => ({
      ...topic,
      keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
      methods: Array.isArray(topic.methods) ? topic.methods : [],
      data_sources: Array.isArray(topic.data_sources) ? topic.data_sources : [],
      links: Array.isArray(topic.links) ? topic.links : [],
    })),
    drafts: (snapshot.drafts || []).map(draft => ({
      ...draft,
      keywords: Array.isArray(draft.keywords) ? draft.keywords : [],
      authors: Array.isArray(draft.authors) ? draft.authors : [],
      external_links: Array.isArray(draft.external_links) ? draft.external_links : [],
      target_journal_ids: Array.isArray(draft.target_journal_ids) ? draft.target_journal_ids : [],
      checklist: Array.isArray(draft.checklist) ? draft.checklist : [],
    })),
  }), [snapshot])

  const query = search.trim().toLocaleLowerCase()
  const journals = useMemo(() => normalized.journals.filter(item => !query || `${item.name} ${item.publisher || ''} ${item.scope || ''} ${item.subject_tags.join(' ')}`.toLocaleLowerCase().includes(query)), [normalized.journals, query])
  const topics = useMemo(() => normalized.topics.filter(item => !query || `${item.title} ${item.research_question || ''} ${item.novelty || ''} ${item.keywords.join(' ')}`.toLocaleLowerCase().includes(query)), [normalized.topics, query])
  const drafts = useMemo(() => normalized.drafts.filter(item => !query || `${item.title} ${item.abstract || ''} ${item.keywords.join(' ')}`.toLocaleLowerCase().includes(query)), [normalized.drafts, query])
  const journalMap = useMemo(() => new Map(normalized.journals.map(item => [item.id, item])), [normalized.journals])
  const topicMap = useMemo(() => new Map(normalized.topics.map(item => [item.id, item])), [normalized.topics])

  const orderedJournals = [...journals].sort((left, right) => Number(right.is_favorite) - Number(left.is_favorite) || priorityWeight[right.priority] - priorityWeight[left.priority] || left.name.localeCompare(right.name))
  const orderedTopics = [...topics].sort((left, right) => priorityWeight[right.priority] - priorityWeight[left.priority] || topicCompositeScore(right) - topicCompositeScore(left))
  const orderedDrafts = [...drafts].sort((left, right) => {
    const leftDays = daysUntilDate(left.deadline) ?? 99999
    const rightDays = daysUntilDate(right.deadline) ?? 99999
    return leftDays - rightDays || checklistProgress(right.checklist) - checklistProgress(left.checklist)
  })

  const readyDrafts = normalized.drafts.filter(draft => draft.stage === 'submission_ready' || checklistProgress(draft.checklist) >= 90).length
  const activeTopics = normalized.topics.filter(topic => !['paused', 'abandoned'].includes(topic.status)).length
  const favoriteJournals = normalized.journals.filter(journal => journal.is_favorite).length

  const openNew = () => {
    if (section === 'journals') setEditor({ type: 'journal', value: 'new' })
    else if (section === 'topics') setEditor({ type: 'topic', value: 'new' })
    else setEditor({ type: 'draft', value: 'new' })
  }

  const promote = async (draft: ManuscriptDraft) => {
    if (!onPromoteDraft || promotingId) return
    if (!confirm(`将“${draft.title}”转入正式投稿管理？系统会创建一条准备中投稿记录。`)) return
    setPromotingId(draft.id)
    try {
      await onPromoteDraft(draft)
    } catch (error) {
      console.error('Promote draft failed:', error)
      alert(error instanceof Error ? `转入投稿失败：${error.message}` : '转入投稿失败。')
    } finally {
      setPromotingId(null)
    }
  }

  if (loading) return <div className="prep-loading"><div className="spinner" /> 加载投稿准备数据...</div>

  return <div className="preparation-workspace">
    <div className="prep-topbar">
      <div><h1>投稿准备</h1><p>从选题判断、论文写作、期刊筛选到投稿材料检查的一体化工作区</p></div>
      <div className="prep-top-actions"><div className="prep-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索选题、草稿或期刊..." /></div><button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={14} /> 新建</button></div>
    </div>

    <div className="prep-nav">
      <button className={section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}>总览</button>
      <button className={section === 'topics' ? 'active' : ''} onClick={() => setSection('topics')}><Lightbulb size={14} /> 选题池 <span>{normalized.topics.length}</span></button>
      <button className={section === 'drafts' ? 'active' : ''} onClick={() => setSection('drafts')}><FilePenLine size={14} /> 草稿准备 <span>{normalized.drafts.length}</span></button>
      <button className={section === 'journals' ? 'active' : ''} onClick={() => setSection('journals')}><BookOpen size={14} /> 期刊库 <span>{normalized.journals.length}</span></button>
    </div>

    {section === 'overview' && <>
      <div className="prep-metrics"><div><b>{activeTopics}</b><span>推进中的选题</span></div><div><b>{normalized.drafts.length}</b><span>论文草稿</span></div><div><b>{readyDrafts}</b><span>接近可投稿</span></div><div><b>{favoriteJournals}</b><span>收藏期刊</span></div></div>
      <div className="prep-overview-grid">
        <section className="prep-panel"><PanelHead title="优先草稿" subtitle="按投稿日期和准备完成度排序" onClick={() => setSection('drafts')} />{orderedDrafts.slice(0, 4).map(draft => <DraftCard key={draft.id} draft={draft} topic={draft.topic_id ? topicMap.get(draft.topic_id) : undefined} journals={draft.target_journal_ids.map(id => journalMap.get(id)).filter(Boolean) as JournalProfile[]} primaryJournal={draft.primary_journal_id ? journalMap.get(draft.primary_journal_id) : undefined} onEdit={() => setEditor({ type: 'draft', value: draft })} onPromote={onPromoteDraft ? () => promote(draft) : undefined} promoting={promotingId === draft.id} compact />)}{!orderedDrafts.length && <Empty text="尚无草稿准备记录" action="新建草稿" onClick={() => setEditor({ type: 'draft', value: 'new' })} />}</section>
        <section className="prep-panel"><PanelHead title="优先期刊" subtitle="收藏、分区、费用与审稿速度" onClick={() => setSection('journals')} />{orderedJournals.slice(0, 5).map(journal => <JournalRow key={journal.id} journal={journal} onClick={() => setEditor({ type: 'journal', value: journal })} />)}{!orderedJournals.length && <Empty text="尚未收藏期刊" action="收藏期刊" onClick={() => setEditor({ type: 'journal', value: 'new' })} />}</section>
      </div>
      <section className="prep-panel prep-topic-overview"><PanelHead title="选题推进" subtitle="综合创新性、数据、方法、可行性与时间条件" onClick={() => setSection('topics')} /><div className="prep-topic-strip">{orderedTopics.slice(0, 5).map(topic => <TopicCard key={topic.id} topic={topic} onClick={() => setEditor({ type: 'topic', value: topic })} compact />)}{!orderedTopics.length && <Empty text="尚无研究选题" action="新增选题" onClick={() => setEditor({ type: 'topic', value: 'new' })} />}</div></section>
    </>}

    {section === 'topics' && <div className="prep-card-grid">{orderedTopics.map(topic => <TopicCard key={topic.id} topic={topic} onClick={() => setEditor({ type: 'topic', value: topic })} />)}{!orderedTopics.length && <Empty text={query ? '没有匹配的选题' : '尚无研究选题'} action="新增选题" onClick={() => setEditor({ type: 'topic', value: 'new' })} />}</div>}
    {section === 'drafts' && <div className="prep-draft-list">{orderedDrafts.map(draft => <DraftCard key={draft.id} draft={draft} topic={draft.topic_id ? topicMap.get(draft.topic_id) : undefined} journals={draft.target_journal_ids.map(id => journalMap.get(id)).filter(Boolean) as JournalProfile[]} primaryJournal={draft.primary_journal_id ? journalMap.get(draft.primary_journal_id) : undefined} onEdit={() => setEditor({ type: 'draft', value: draft })} onPromote={onPromoteDraft ? () => promote(draft) : undefined} promoting={promotingId === draft.id} />)}{!orderedDrafts.length && <Empty text={query ? '没有匹配的草稿' : '尚无草稿准备记录'} action="新建草稿" onClick={() => setEditor({ type: 'draft', value: 'new' })} />}</div>}
    {section === 'journals' && <div className="prep-card-grid journal-grid">{orderedJournals.map(journal => <JournalCard key={journal.id} journal={journal} onClick={() => setEditor({ type: 'journal', value: journal })} />)}{!orderedJournals.length && <Empty text={query ? '没有匹配的期刊' : '尚未收藏期刊'} action="收藏期刊" onClick={() => setEditor({ type: 'journal', value: 'new' })} />}</div>}

    {editor?.type === 'journal' && <JournalForm value={editor.value} onSave={onSaveJournal} onDelete={onDeleteJournal} onClose={() => setEditor(null)} />}
    {editor?.type === 'topic' && <TopicForm value={editor.value} onSave={onSaveTopic} onDelete={onDeleteTopic} onClose={() => setEditor(null)} />}
    {editor?.type === 'draft' && <DraftForm value={editor.value} topics={normalized.topics} journals={normalized.journals} onSave={onSaveDraft} onDelete={onDeleteDraft} onClose={() => setEditor(null)} />}
  </div>
}

function PanelHead({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return <div className="prep-panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClick}>查看全部 <ArrowRight size={13} /></button></div>
}

function Empty({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return <div className="prep-empty"><span>{text}</span><button className="btn btn-ghost btn-sm" onClick={onClick}><Plus size={13} /> {action}</button></div>
}

function TopicCard({ topic, onClick, compact }: { topic: ResearchTopic; onClick: () => void; compact?: boolean }) {
  const score = topicCompositeScore(topic)
  const status = TOPIC_STATUS_OPTIONS.find(item => item.key === topic.status)?.label || topic.status
  const days = daysUntilDate(topic.deadline)
  return <button className={`prep-topic-card ${compact ? 'compact' : ''}`} onClick={onClick}><div className="prep-card-top"><span className={`prep-priority ${topic.priority}`}>{PRIORITY_OPTIONS.find(item => item.key === topic.priority)?.label || topic.priority}</span><b>{score}</b></div><h3>{topic.title}</h3>{!compact && topic.research_question && <p>{topic.research_question}</p>}<div className="prep-tags">{topic.keywords.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div><div className="prep-card-foot"><span>{status}</span>{days !== null && <span className={days < 0 ? 'danger' : days <= 14 ? 'warn' : ''}>{days < 0 ? `逾期 ${-days} 天` : `${days} 天`}</span>}</div></button>
}

function DraftCard({ draft, topic, journals, primaryJournal, onEdit, onPromote, promoting, compact }: { draft: ManuscriptDraft; topic?: ResearchTopic; journals: JournalProfile[]; primaryJournal?: JournalProfile; onEdit: () => void; onPromote?: () => void; promoting?: boolean; compact?: boolean }) {
  const progress = checklistProgress(draft.checklist)
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
  return <article className="prep-journal-card"><button className="prep-journal-card-main" onClick={onClick}><div className="prep-card-top"><span className={`prep-priority ${journal.priority}`}>{journal.is_favorite ? <Star size={13} fill="currentColor" /> : '未收藏'}</span><span className={`prep-risk ${journal.risk_level}`}>{journal.risk_level === 'warning' ? '预警' : journal.risk_level === 'watch' ? '关注' : '正常'}</span></div><h3>{journal.name}</h3><p>{journal.publisher || journal.scope || '尚未填写出版社与期刊范围'}</p><div className="prep-journal-facts"><span>{journal.jcr_quartile || 'JCR 未定'}</span><span>{journal.cas_quartile || '中科院未定'}</span>{journal.impact_factor != null && <span>IF {journal.impact_factor}</span>}<span>{oa}</span></div><div className="prep-journal-numbers"><div><b>{journal.first_decision_days ?? '—'}</b><small>首轮决定/天</small></div><div><b>{journal.total_review_days ?? '—'}</b><small>总审稿/天</small></div><div><b>{journal.acceptance_rate != null ? `${journal.acceptance_rate}%` : '—'}</b><small>接收率</small></div><div><b>{journal.apc_amount != null ? journal.apc_amount : '—'}</b><small>{journal.apc_currency || 'APC'}</small></div></div></button><div className="prep-journal-links">{safeUrl(journal.website_url) && <a href={journal.website_url!} target="_blank" rel="noopener noreferrer">官网 <ExternalLink size={11} /></a>}{safeUrl(journal.author_guide_url) && <a href={journal.author_guide_url!} target="_blank" rel="noopener noreferrer">指南 <ExternalLink size={11} /></a>}{safeUrl(journal.submission_url) && <a href={journal.submission_url!} target="_blank" rel="noopener noreferrer">投稿 <ExternalLink size={11} /></a>}{journal.third_party_links.slice(0, 2).map(link => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <ExternalLink size={11} /></a>)}</div></article>
}
