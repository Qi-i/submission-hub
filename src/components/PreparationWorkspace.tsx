import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight, BookOpen, CheckCircle2, CircleAlert, Clock3, ExternalLink,
  FilePenLine, LayoutDashboard, Lightbulb, Plus, Scale, Search, Star, Target,
} from 'lucide-react'
import type { JournalRankLookupResult } from '../lib/journal-rank'
import { journalPrimaryRankItems, journalRankTone, type RankedJournalProfile } from '../lib/journal-display'
import type { JournalProfile, ManuscriptDraft, PreparationSnapshot, ResearchTopic } from '../lib/preparation'
import {
  DRAFT_STAGE_OPTIONS, OA_OPTIONS, PRIORITY_OPTIONS, TOPIC_STATUS_OPTIONS,
  checklistProgress, createDefaultChecklist, draftReadiness, journalFitSummary, topicCompositeScore,
} from '../lib/preparation'
import { daysUntilDate } from '../lib/types'
import { DraftForm, TopicForm } from './PreparationForms'
import JournalFormEnhanced from './JournalFormEnhanced'
import JournalComparison from './JournalComparison'
import { useTheme } from '../lib/theme'
import { useTheme } from '../lib/theme'

type SectionKey = 'overview' | 'topics' | 'drafts' | 'journals' | 'compare'
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
  onLookupJournalRanks?: (publicationName: string) => Promise<JournalRankLookupResult>
}

const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }
const safeUrl = (value?: string | null) => !!value && /^https?:\/\//i.test(value)

export default function PreparationWorkspace({
  snapshot, loading,
  onSaveJournal, onDeleteJournal,
  onSaveTopic, onDeleteTopic,
  onSaveDraft, onDeleteDraft,
  onPromoteDraft, onLookupJournalRanks,
}: Props) {
  const [section, setSection] = useState<SectionKey>('overview')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Editor>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [creatingTopicId, setCreatingTopicId] = useState<string | null>(null)
  const { uiMode } = useTheme()
  const [luminousXActionSlot, setLuminousXActionSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setLuminousXActionSlot(uiMode === 'luminous-x' ? document.getElementById('lx-preparation-actions-slot') : null)
  }, [uiMode])

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
      checklist: Array.isArray(draft.checklist) ? draft.checklist : createDefaultChecklist(),
      current_word_count: Math.max(0, Number(draft.current_word_count) || 0),
      figure_count: Math.max(0, Number(draft.figure_count) || 0),
      table_count: Math.max(0, Number(draft.table_count) || 0),
      reference_count: Math.max(0, Number(draft.reference_count) || 0),
    })),
  }), [snapshot])

  const query = search.trim().toLocaleLowerCase()
  const journals = useMemo(
    () => normalized.journals.filter(item => !query || `${item.name} ${item.publisher || ''} ${item.scope || ''} ${item.subject_tags.join(' ')}`.toLocaleLowerCase().includes(query)),
    [normalized.journals, query],
  )
  const topics = useMemo(
    () => normalized.topics.filter(item => !query || `${item.title} ${item.research_question || ''} ${item.novelty || ''} ${item.keywords.join(' ')}`.toLocaleLowerCase().includes(query)),
    [normalized.topics, query],
  )
  const drafts = useMemo(
    () => normalized.drafts.filter(item => !query || `${item.title} ${item.abstract || ''} ${item.keywords.join(' ')}`.toLocaleLowerCase().includes(query)),
    [normalized.drafts, query],
  )
  const journalMap = useMemo(() => new Map(normalized.journals.map(item => [item.id, item])), [normalized.journals])
  const topicMap = useMemo(() => new Map(normalized.topics.map(item => [item.id, item])), [normalized.topics])

  const orderedJournals = [...journals].sort((left, right) =>
    Number(right.is_favorite) - Number(left.is_favorite)
    || priorityWeight[right.priority] - priorityWeight[left.priority]
    || left.name.localeCompare(right.name),
  )
  const orderedTopics = [...topics].sort((left, right) =>
    priorityWeight[right.priority] - priorityWeight[left.priority]
    || topicCompositeScore(right) - topicCompositeScore(left),
  )
  const orderedDrafts = [...drafts].sort((left, right) => {
    const leftDays = daysUntilDate(left.deadline) ?? 99999
    const rightDays = daysUntilDate(right.deadline) ?? 99999
    return leftDays - rightDays || draftReadiness(right).score - draftReadiness(left).score
  })

  const draftStates = normalized.drafts.map(draft => ({
    draft,
    readiness: draftReadiness(draft),
    days: daysUntilDate(draft.deadline),
  }))
  const readyDrafts = draftStates.filter(item => item.readiness.score >= 90).length
  const activeTopics = normalized.topics.filter(topic => !['paused', 'abandoned'].includes(topic.status)).length
  const favoriteJournals = normalized.journals.filter(journal => journal.is_favorite).length
  const averageReadiness = draftStates.length
    ? Math.round(draftStates.reduce((sum, item) => sum + item.readiness.score, 0) / draftStates.length)
    : 0
  const blockedDrafts = draftStates.filter(item => item.readiness.blockers.length > 0).length
  const dueSoonDrafts = draftStates.filter(item => item.days !== null && item.days >= 0 && item.days <= 14).length
  const overdueDrafts = draftStates.filter(item => item.days !== null && item.days < 0).length
  const missingJournalDrafts = normalized.drafts.filter(draft => !draft.primary_journal_id).length

  const nextMove = normalized.topics.length === 0
    ? {
        title: '先建立第一个研究选题',
        detail: '记录研究问题、创新点、数据与方法，再从选题直接建立草稿。',
        label: '新建选题',
        action: () => setEditor({ type: 'topic', value: 'new' } as const),
      }
    : normalized.drafts.length === 0
      ? {
          title: '把选题转为论文草稿',
          detail: '创建草稿后即可管理摘要、作者、图表、清单和目标期刊。',
          label: '新建草稿',
          action: () => setEditor({ type: 'draft', value: 'new' } as const),
        }
      : favoriteJournals === 0
        ? {
            title: '建立目标期刊库',
            detail: '收藏目标期刊并补充分区、收录、费用和审稿周期。',
            label: '收藏期刊',
            action: () => setEditor({ type: 'journal', value: 'new' } as const),
          }
        : readyDrafts > 0
          ? {
              title: `检查 ${readyDrafts} 篇接近投稿的草稿`,
              detail: '核对主投期刊、作者、投稿材料和必需检查项。',
              label: '查看草稿',
              action: () => setSection('drafts'),
            }
          : {
              title: '继续提高草稿就绪度',
              detail: blockedDrafts ? `当前有 ${blockedDrafts} 篇草稿仍存在阻碍项。` : '完善写作进度、检查清单和目标期刊。',
              label: '继续准备',
              action: () => setSection('drafts'),
            }

  const openContextNew = () => {
    if (section === 'topics') setEditor({ type: 'topic', value: 'new' })
    else setEditor({ type: 'draft', value: 'new' })
  }

  const promote = async (draft: ManuscriptDraft) => {
    if (!onPromoteDraft || promotingId) return
    if (!confirm(`确认“${draft.title}”已经正式投出？确认后会立即在投稿管理中创建一条“已投稿”记录，并写入今天的首投日期。`)) return
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

  const createDraftFromTopic = async (topic: ResearchTopic) => {
    if (creatingTopicId) return
    if (!confirm(`基于“${topic.title}”建立论文草稿？`)) return
    setCreatingTopicId(topic.id)
    try {
      await onSaveDraft({
        title: topic.title,
        topic_id: topic.id,
        article_type: 'Research Article',
        language: 'en',
        stage: 'outline',
        abstract: topic.objective || topic.research_question || null,
        keywords: topic.keywords,
        outline: topic.objective
          ? `研究目标\n${topic.objective}\n\n拟解决问题\n${topic.research_question || ''}\n\n创新点\n${topic.novelty || ''}`.trim()
          : null,
        authors: [],
        target_word_count: null,
        current_word_count: 0,
        figure_count: 0,
        table_count: 0,
        reference_count: 0,
        deadline: topic.deadline,
        external_links: topic.links,
        target_journal_ids: [],
        primary_journal_id: null,
        checklist: createDefaultChecklist(),
        notes: topic.notes,
        submitted_paper_id: null,
      })
      if (topic.status !== 'drafting') await onSaveTopic({ ...topic, status: 'drafting' })
      setSection('drafts')
    } catch (error) {
      console.error('Create draft from topic failed:', error)
      alert(error instanceof Error ? `建立草稿失败：${error.message}` : '建立草稿失败。')
    } finally {
      setCreatingTopicId(null)
    }
  }

  if (loading) return <div className="prep-loading"><div className="spinner" /> 加载投稿准备数据...</div>

  return <div className="preparation-workspace" data-section={section}>
    <div className="prep-topbar">
      <div className="prep-heading">
        <span className="prep-eyebrow">PRE-SUBMISSION WORKSPACE</span>
        <h1>投稿准备</h1>
        <p>把选题、草稿与目标期刊组织成一条清晰的投稿前流程。</p>
      </div>
      {(uiMode === 'luminous-x' && luminousXActionSlot ? createPortal(
        <div className="prep-top-actions prep-top-actions-portal">
          <div className="prep-search">
            <Search size={15} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索选题、草稿或期刊..." />
          </div>
          <button className="btn btn-journal-primary btn-sm" onClick={() => setEditor({ type: 'journal', value: 'new' })}>
            <Star size={14} /> 收藏期刊
          </button>
          {!['journals', 'compare'].includes(section) && <button className="btn btn-context-new btn-sm" onClick={openContextNew}>
            <Plus size={14} /> {section === 'topics' ? '新增选题' : '新建草稿'}
          </button>}
        </div>,
        luminousXActionSlot,
      ) :
        <div className="prep-top-actions">
          <div className="prep-search">
            <Search size={15} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索选题、草稿或期刊..." />
          </div>
          <button className="btn btn-journal-primary btn-sm" onClick={() => setEditor({ type: 'journal', value: 'new' })}>
            <Star size={14} /> 收藏期刊
          </button>
          {!['journals', 'compare'].includes(section) && <button className="btn btn-context-new btn-sm" onClick={openContextNew}>
            <Plus size={14} /> {section === 'topics' ? '新增选题' : '新建草稿'}
          </button>}
        </div>)}
    </div>

    <div className="prep-nav">
      <button data-tone="overview" className={section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}>
        <LayoutDashboard size={14} /> 总览
      </button>
      <button data-tone="topic" className={section === 'topics' ? 'active' : ''} onClick={() => setSection('topics')}>
        <Lightbulb size={14} /> 选题池 <span>{normalized.topics.length}</span>
      </button>
      <button data-tone="draft" className={section === 'drafts' ? 'active' : ''} onClick={() => setSection('drafts')}>
        <FilePenLine size={14} /> 草稿准备 <span>{normalized.drafts.length}</span>
      </button>
      <button data-tone="journal" className={section === 'journals' ? 'active' : ''} onClick={() => setSection('journals')}>
        <BookOpen size={14} /> 期刊库 <span>{normalized.journals.length}</span>
      </button>
      <button data-tone="compare" className={section === 'compare' ? 'active' : ''} onClick={() => setSection('compare')}>
        <Scale size={14} /> 期刊比较
      </button>
    </div>

    {section === 'overview' && <>
      <section className="prep-dashboard">
        <div className="prep-dashboard-head">
          <div>
            <span><LayoutDashboard size={15} /> 投稿前仪表盘</span>
            <h2>当前准备状态</h2>
            <p>所有指标均由你的选题、草稿和期刊数据实时计算。</p>
          </div>
          <button onClick={() => setSection('drafts')}>查看全部草稿 <ArrowRight size={13} /></button>
        </div>

        <div className="prep-dashboard-grid">
          <div className="prep-dashboard-score-card">
            <div className="prep-score-main">
              <div className="prep-score-number"><b>{averageReadiness}</b><span>%</span></div>
              <div><strong>平均投稿就绪度</strong><small>{normalized.drafts.length ? `基于 ${normalized.drafts.length} 篇草稿` : '尚无草稿数据'}</small></div>
            </div>
            <div className="prep-score-progress"><span style={{ width: `${averageReadiness}%` }} /></div>
            <div className="prep-pipeline">
              <button onClick={() => setSection('topics')}><Lightbulb size={14} /><span>选题</span><b>{activeTopics}</b></button>
              <button onClick={() => setSection('drafts')}><FilePenLine size={14} /><span>草稿</span><b>{normalized.drafts.length}</b></button>
              <button onClick={() => setSection('journals')}><Star size={14} /><span>期刊</span><b>{favoriteJournals}</b></button>
              <button onClick={() => setSection('drafts')}><CheckCircle2 size={14} /><span>就绪</span><b>{readyDrafts}</b></button>
            </div>
          </div>

          <div className="prep-dashboard-attention-card">
            <div className="prep-dashboard-card-title">
              <span><CircleAlert size={15} /> 需要处理</span>
              <b>{blockedDrafts + dueSoonDrafts + overdueDrafts + missingJournalDrafts}</b>
            </div>
            <div className="prep-attention-grid">
              <button data-tone="blocked" onClick={() => setSection('drafts')}><b>{blockedDrafts}</b><span>存在阻碍项</span></button>
              <button data-tone="due" onClick={() => setSection('drafts')}><b>{dueSoonDrafts}</b><span>14天内截止</span></button>
              <button data-tone="overdue" onClick={() => setSection('drafts')}><b>{overdueDrafts}</b><span>计划已逾期</span></button>
              <button data-tone="journal" onClick={() => setSection('drafts')}><b>{missingJournalDrafts}</b><span>未选主投期刊</span></button>
            </div>
          </div>

          <div className="prep-dashboard-next-card">
            <span className="prep-next-label"><Target size={14} /> 建议下一步</span>
            <h3>{nextMove.title}</h3>
            <p>{nextMove.detail}</p>
            <button className="prep-next-primary" onClick={nextMove.action}>{nextMove.label} <ArrowRight size={13} /></button>
            <div className="prep-quick-actions">
              <button onClick={() => setEditor({ type: 'topic', value: 'new' })}><Lightbulb size={13} /> 新建选题</button>
              <button onClick={() => setEditor({ type: 'draft', value: 'new' })}><FilePenLine size={13} /> 新建草稿</button>
              <button onClick={() => setEditor({ type: 'journal', value: 'new' })}><Star size={13} /> 收藏期刊</button>
              <button onClick={() => setSection('compare')}><Scale size={13} /> 期刊比较</button>
            </div>
          </div>
        </div>
      </section>

      <div className="prep-metrics">
        <div data-tone="topic"><span>选题</span><b>{activeTopics}</b><small>推进中</small></div>
        <div data-tone="draft"><span>草稿</span><b>{normalized.drafts.length}</b><small>准备记录</small></div>
        <div data-tone="ready"><span>就绪</span><b>{readyDrafts}</b><small>接近投稿</small></div>
        <div data-tone="journal"><span>期刊</span><b>{favoriteJournals}</b><small>已收藏</small></div>
      </div>

      <div className="prep-overview-grid">
        <section className="prep-panel prep-panel-draft prep-overview-drafts">
          <PanelHead title="草稿推进" subtitle="按截止时间与投稿就绪度排序" onClick={() => setSection('drafts')} />
          <div className="prep-overview-draft-list">
            {orderedDrafts.slice(0, 4).map(draft => <DraftCard
              key={draft.id}
              draft={draft}
              topic={draft.topic_id ? topicMap.get(draft.topic_id) : undefined}
              journals={draft.target_journal_ids.map(id => journalMap.get(id)).filter(Boolean) as JournalProfile[]}
              primaryJournal={draft.primary_journal_id ? journalMap.get(draft.primary_journal_id) : undefined}
              onEdit={() => setEditor({ type: 'draft', value: draft })}
              onPromote={onPromoteDraft ? () => promote(draft) : undefined}
              promoting={promotingId === draft.id}
              compact
            />)}
            {!orderedDrafts.length && <Empty text="尚无草稿准备记录" action="新建草稿" onClick={() => setEditor({ type: 'draft', value: 'new' })} />}
          </div>
        </section>

        <section className="prep-panel prep-panel-journal prep-overview-journals">
          <PanelHead title="收藏期刊" subtitle="按期刊类型突出主要分区、核心收录、费用与审稿速度" onClick={() => setSection('journals')} />
          <div className="prep-overview-journal-list">
            {orderedJournals.slice(0, 4).map(journal => <JournalRow key={journal.id} journal={journal} onClick={() => setEditor({ type: 'journal', value: journal })} />)}
          </div>
          {!orderedJournals.length && <Empty text="尚未收藏期刊" action="收藏期刊" onClick={() => setEditor({ type: 'journal', value: 'new' })} />}
        </section>
      </div>

      <section className="prep-panel prep-panel-topic prep-topic-overview">
        <PanelHead title="选题推进" subtitle="综合创新性、数据、方法、可行性与时间条件" onClick={() => setSection('topics')} />
        <div className="prep-topic-strip">
          {orderedTopics.slice(0, 5).map(topic => <TopicCard
            key={topic.id}
            topic={topic}
            onClick={() => setEditor({ type: 'topic', value: topic })}
            onCreateDraft={() => void createDraftFromTopic(topic)}
            creating={creatingTopicId === topic.id}
            compact
          />)}
          {!orderedTopics.length && <Empty text="尚无研究选题" action="新增选题" onClick={() => setEditor({ type: 'topic', value: 'new' })} />}
        </div>
      </section>
    </>}

    {section === 'topics' && <div className="prep-card-grid">
      {orderedTopics.map(topic => <TopicCard
        key={topic.id}
        topic={topic}
        onClick={() => setEditor({ type: 'topic', value: topic })}
        onCreateDraft={() => void createDraftFromTopic(topic)}
        creating={creatingTopicId === topic.id}
      />)}
      {!orderedTopics.length && <Empty text={query ? '没有匹配的选题' : '尚无研究选题'} action="新增选题" onClick={() => setEditor({ type: 'topic', value: 'new' })} />}
    </div>}

    {section === 'drafts' && <div className="prep-draft-list">
      {orderedDrafts.map(draft => <DraftCard
        key={draft.id}
        draft={draft}
        topic={draft.topic_id ? topicMap.get(draft.topic_id) : undefined}
        journals={draft.target_journal_ids.map(id => journalMap.get(id)).filter(Boolean) as JournalProfile[]}
        primaryJournal={draft.primary_journal_id ? journalMap.get(draft.primary_journal_id) : undefined}
        onEdit={() => setEditor({ type: 'draft', value: draft })}
        onPromote={onPromoteDraft ? () => promote(draft) : undefined}
        promoting={promotingId === draft.id}
      />)}
      {!orderedDrafts.length && <Empty text={query ? '没有匹配的草稿' : '尚无草稿准备记录'} action="新建草稿" onClick={() => setEditor({ type: 'draft', value: 'new' })} />}
    </div>}

    {section === 'journals' && <div className="prep-card-grid journal-grid">
      {orderedJournals.map(journal => <JournalCard key={journal.id} journal={journal} onClick={() => setEditor({ type: 'journal', value: journal })} />)}
      {!orderedJournals.length && <Empty text={query ? '没有匹配的期刊' : '尚未收藏期刊'} action="收藏期刊" onClick={() => setEditor({ type: 'journal', value: 'new' })} />}
    </div>}

    {section === 'compare' && <JournalComparison journals={orderedJournals} onEdit={journal => setEditor({ type: 'journal', value: journal })} />}

    {editor?.type === 'journal' && <JournalFormEnhanced
      value={editor.value}
      onSave={onSaveJournal}
      onDelete={onDeleteJournal}
      onClose={() => setEditor(null)}
      onLookupRanks={onLookupJournalRanks}
    />}
    {editor?.type === 'topic' && <TopicForm value={editor.value} onSave={onSaveTopic} onDelete={onDeleteTopic} onClose={() => setEditor(null)} />}
    {editor?.type === 'draft' && <DraftForm
      value={editor.value}
      topics={normalized.topics}
      journals={normalized.journals}
      onSave={onSaveDraft}
      onDelete={onDeleteDraft}
      onClose={() => setEditor(null)}
    />}
  </div>
}

function PanelHead({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return <div className="prep-panel-head">
    <div><h2>{title}</h2><p>{subtitle}</p></div>
    <button onClick={onClick}>查看全部 <ArrowRight size={13} /></button>
  </div>
}

function Empty({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return <div className="prep-empty">
    <span>{text}</span>
    <button className="btn btn-ghost btn-sm" onClick={onClick}><Plus size={13} /> {action}</button>
  </div>
}

function TopicCard({
  topic, onClick, onCreateDraft, creating, compact,
}: {
  topic: ResearchTopic
  onClick: () => void
  onCreateDraft: () => void
  creating?: boolean
  compact?: boolean
}) {
  const score = topicCompositeScore(topic)
  const status = TOPIC_STATUS_OPTIONS.find(item => item.key === topic.status)?.label || topic.status
  const days = daysUntilDate(topic.deadline)

  return <article className={`prep-topic-card ${compact ? 'compact' : ''}`}>
    <button className="prep-topic-main" onClick={onClick}>
      <div className="prep-card-top">
        <span className={`prep-priority ${topic.priority}`}>{PRIORITY_OPTIONS.find(item => item.key === topic.priority)?.label || topic.priority}</span>
        <b>{score}</b>
      </div>
      <h3>{topic.title}</h3>
      {!compact && topic.research_question && <p>{topic.research_question}</p>}
      <div className="prep-tags">{topic.keywords.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div>
      <div className="prep-card-foot">
        <span>{status}</span>
        {days !== null && <span className={days < 0 ? 'danger' : days <= 14 ? 'warn' : ''}>{days < 0 ? `逾期 ${-days} 天` : `${days} 天`}</span>}
      </div>
    </button>
    {topic.status !== 'abandoned' && <button className="btn btn-ghost btn-sm prep-topic-draft" onClick={onCreateDraft} disabled={creating}>
      {creating ? '建立中...' : <>建立草稿 <ArrowRight size={12} /></>}
    </button>}
  </article>
}

function DraftCard({
  draft, topic, journals, primaryJournal, onEdit, onPromote, promoting, compact,
}: {
  draft: ManuscriptDraft
  topic?: ResearchTopic
  journals: JournalProfile[]
  primaryJournal?: JournalProfile
  onEdit: () => void
  onPromote?: () => void
  promoting?: boolean
  compact?: boolean
}) {
  const readiness = draftReadiness(draft)
  const checkProgress = checklistProgress(draft.checklist)
  const wordProgress = draft.target_word_count ? Math.min(100, Math.round(draft.current_word_count / draft.target_word_count * 100)) : 0
  const stage = DRAFT_STAGE_OPTIONS.find(item => item.key === draft.stage)?.label || draft.stage
  const days = daysUntilDate(draft.deadline)

  return <article className={`prep-draft-card ${compact ? 'compact' : ''}`}>
    <button className="prep-draft-main" onClick={onEdit}>
      <div className="prep-draft-head"><div><span>{stage}</span>{topic && <em>{topic.title}</em>}</div><b>{readiness.score}%</b></div>
      <h3 title={draft.title}>{draft.title}</h3>
      <div className="prep-progress"><span style={{ width: `${readiness.score}%` }} /></div>
      <div className="prep-draft-meta">
        {!compact && <span>就绪度 {readiness.score}%</span>}
        <span>必需检查 {checkProgress}%</span>
        {draft.target_word_count
          ? <span>写作 {draft.current_word_count}/{draft.target_word_count}（{wordProgress}%）</span>
          : <span>字数 {draft.current_word_count}</span>}
        <span>图 {draft.figure_count} · 表 {draft.table_count} · 文献 {draft.reference_count}</span>
      </div>
      <div className={`prep-readiness-note ${readiness.blockers.length ? 'blocked' : readiness.score >= 90 ? 'ready' : ''}`}>
        <strong>{readiness.nextAction}</strong>{readiness.blockers[0] && <span>{readiness.blockers[0]}</span>}
      </div>
      <div className="prep-draft-foot">
        <span>{primaryJournal ? `主投：${primaryJournal.name}` : journals.length ? `备选 ${journals.length} 本` : '未选期刊'}</span>
        {days !== null && <span className={days < 0 ? 'danger' : days <= 14 ? 'warn' : ''}>{days < 0 ? `计划已逾期 ${-days} 天` : `计划 ${days} 天后投稿`}</span>}
      </div>
    </button>
    {onPromote && !draft.submitted_paper_id && <button className="btn btn-primary btn-sm prep-promote" onClick={onPromote} disabled={promoting}>
      {promoting ? '转入中...' : <>确认已投出 <ArrowRight size={13} /></>}
    </button>}
  </article>
}

function RankBlocks({ journal, limit = 6, className = '' }: { journal: JournalProfile; limit?: number; className?: string }) {
  const ranks = journalPrimaryRankItems(journal as RankedJournalProfile, limit)
  if (!ranks.length) return <div className={`prep-journal-rank-blocks empty ${className}`}>主要分区与收录未记录</div>
  return <div className={`prep-journal-rank-blocks ${className}`}>
    {ranks.map(item => <span key={`${item.key}-${item.value}`} data-tone={journalRankTone(item.key)}><b>{item.label}</b><em>{item.value}</em></span>)}
  </div>
}

function JournalRow({ journal, onClick }: { journal: JournalProfile; onClick: () => void }) {
  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'
  const indexing = journal.indexing.slice(0, 3).join('、') || '收录未记录'
  return <button className="prep-journal-overview-card" onClick={onClick}>
    <div className="prep-overview-journal-head">
      <div className="prep-overview-journal-title">
        <span className="prep-journal-star">{journal.is_favorite ? '★' : '☆'}</span>
        <span><b>{journal.name}</b><small>{journal.publisher || journal.scope || '未填写出版社或范围'}</small></span>
      </div>
      <span className={`prep-risk ${journal.risk_level}`}>{journal.risk_level === 'warning' ? '预警' : journal.risk_level === 'watch' ? '关注' : '正常'}</span>
    </div>
    <RankBlocks journal={journal} limit={6} />
    <div className="prep-overview-journal-meta">
      <span data-tone="fit">{journalFitSummary(journal)}</span>
      <span data-tone="oa">{oa}</span>
      <span data-tone="speed">首轮 {journal.first_decision_days ?? '—'} 天</span>
      <span data-tone="index">{indexing}</span>
    </div>
  </button>
}

function JournalCard({ journal, onClick }: { journal: JournalProfile; onClick: () => void }) {
  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'
  return <article className="prep-journal-card">
    <button className="prep-journal-card-main" onClick={onClick}>
      <div className="prep-card-top">
        <span className={`prep-priority ${journal.priority}`}>{journal.is_favorite ? <Star size={13} fill="currentColor" /> : '未收藏'}</span>
        <span className={`prep-risk ${journal.risk_level}`}>{journal.risk_level === 'warning' ? '预警' : journal.risk_level === 'watch' ? '关注' : '正常'}</span>
      </div>
      <h3>{journal.name}</h3>
      <p>{journal.publisher || journal.scope || '尚未填写出版社与期刊范围'}</p>
      <RankBlocks journal={journal} limit={7} className="full" />
      <div className="prep-journal-facts">
        <span data-tone="oa">{oa}</span>
        {journal.indexing.slice(0, 4).map(item => <span key={item} data-tone="index">{item}</span>)}
      </div>
      <div className="prep-journal-numbers">
        <div><b>{journal.first_decision_days ?? '—'}</b><small>首轮决定/天</small></div>
        <div><b>{journal.total_review_days ?? '—'}</b><small>总审稿/天</small></div>
        <div><b>{journal.acceptance_rate != null ? `${journal.acceptance_rate}%` : '—'}</b><small>接收率</small></div>
        <div><b>{journal.apc_amount != null ? journal.apc_amount : '—'}</b><small>{journal.apc_currency || 'APC'}</small></div>
      </div>
    </button>
    <div className="prep-journal-links">
      {safeUrl(journal.website_url) && <a href={journal.website_url!} target="_blank" rel="noopener noreferrer">官网 <ExternalLink size={11} /></a>}
      {safeUrl(journal.author_guide_url) && <a href={journal.author_guide_url!} target="_blank" rel="noopener noreferrer">指南 <ExternalLink size={11} /></a>}
      {safeUrl(journal.submission_url) && <a href={journal.submission_url!} target="_blank" rel="noopener noreferrer">投稿 <ExternalLink size={11} /></a>}
      {journal.third_party_links.slice(0, 2).map(link => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <ExternalLink size={11} /></a>)}
    </div>
  </article>
}
