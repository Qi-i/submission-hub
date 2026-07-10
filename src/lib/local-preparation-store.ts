import type { JournalProfile, ManuscriptDraft, PreparationSnapshot, ResearchTopic } from './preparation'
import { createDefaultChecklist } from './preparation'

const JOURNALS_KEY = 'submission-hub-prep-journals'
const TOPICS_KEY = 'submission-hub-prep-topics'
const DRAFTS_KEY = 'submission-hub-prep-drafts'

function id() {
  return globalThis.crypto?.randomUUID?.() || `prep-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : []
  } catch {
    return []
  }
}

function write<T>(key: string, rows: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(rows))
  } catch (error) {
    console.error(`Save local preparation data failed for ${key}:`, error)
    throw new Error('本地存储失败，可能是浏览器存储空间不足或隐私模式限制。')
  }
}

export function getPreparationSnapshot(): PreparationSnapshot {
  return {
    journals: read<JournalProfile>(JOURNALS_KEY),
    topics: read<ResearchTopic>(TOPICS_KEY),
    drafts: read<ManuscriptDraft>(DRAFTS_KEY).map(draft => ({
      ...draft,
      checklist: Array.isArray(draft.checklist) && draft.checklist.length ? draft.checklist : createDefaultChecklist(),
    })),
  }
}

export function replacePreparationSnapshot(snapshot: PreparationSnapshot) {
  write(JOURNALS_KEY, snapshot.journals || [])
  write(TOPICS_KEY, snapshot.topics || [])
  write(DRAFTS_KEY, snapshot.drafts || [])
}

export function upsertJournal(input: Partial<JournalProfile> & Pick<JournalProfile, 'name'>) {
  const rows = read<JournalProfile>(JOURNALS_KEY)
  const now = new Date().toISOString()
  const existing = input.id ? rows.find(item => item.id === input.id) : undefined
  const journal: JournalProfile = {
    id: input.id || id(),
    user_id: 'offline',
    name: input.name.trim() || '未命名期刊',
    publisher: input.publisher || null,
    website_url: input.website_url || null,
    author_guide_url: input.author_guide_url || null,
    submission_url: input.submission_url || null,
    third_party_links: input.third_party_links || [],
    issn: input.issn || null,
    eissn: input.eissn || null,
    scope: input.scope || null,
    subject_tags: input.subject_tags || [],
    indexing: input.indexing || [],
    jcr_quartile: input.jcr_quartile || null,
    cas_quartile: input.cas_quartile || null,
    impact_factor: input.impact_factor ?? null,
    oa_type: input.oa_type || 'unknown',
    apc_amount: input.apc_amount ?? null,
    apc_currency: input.apc_currency || 'USD',
    fee_notes: input.fee_notes || null,
    first_decision_days: input.first_decision_days ?? null,
    total_review_days: input.total_review_days ?? null,
    acceptance_rate: input.acceptance_rate ?? null,
    risk_level: input.risk_level || 'normal',
    is_favorite: input.is_favorite ?? true,
    priority: input.priority || 'medium',
    notes: input.notes || null,
    created_at: existing?.created_at || input.created_at || now,
    updated_at: now,
  }
  write(JOURNALS_KEY, existing ? rows.map(item => item.id === journal.id ? journal : item) : [journal, ...rows])
  return journal
}

export function deleteJournal(journalId: string) {
  write(JOURNALS_KEY, read<JournalProfile>(JOURNALS_KEY).filter(item => item.id !== journalId))
  write(DRAFTS_KEY, read<ManuscriptDraft>(DRAFTS_KEY).map(draft => ({
    ...draft,
    target_journal_ids: (draft.target_journal_ids || []).filter(id => id !== journalId),
    primary_journal_id: draft.primary_journal_id === journalId ? null : draft.primary_journal_id,
  })))
}

export function upsertTopic(input: Partial<ResearchTopic> & Pick<ResearchTopic, 'title'>) {
  const rows = read<ResearchTopic>(TOPICS_KEY)
  const now = new Date().toISOString()
  const existing = input.id ? rows.find(item => item.id === input.id) : undefined
  const topic: ResearchTopic = {
    id: input.id || id(),
    user_id: 'offline',
    title: input.title.trim() || '未命名选题',
    research_question: input.research_question || null,
    objective: input.objective || null,
    novelty: input.novelty || null,
    background: input.background || null,
    keywords: input.keywords || [],
    methods: input.methods || [],
    data_sources: input.data_sources || [],
    target_audience: input.target_audience || null,
    expected_output: input.expected_output || null,
    status: input.status || 'idea',
    priority: input.priority || 'medium',
    novelty_score: input.novelty_score ?? 3,
    feasibility_score: input.feasibility_score ?? 3,
    data_score: input.data_score ?? 3,
    method_score: input.method_score ?? 3,
    timeline_score: input.timeline_score ?? 3,
    deadline: input.deadline || null,
    links: input.links || [],
    notes: input.notes || null,
    created_at: existing?.created_at || input.created_at || now,
    updated_at: now,
  }
  write(TOPICS_KEY, existing ? rows.map(item => item.id === topic.id ? topic : item) : [topic, ...rows])
  return topic
}

export function deleteTopic(topicId: string) {
  write(TOPICS_KEY, read<ResearchTopic>(TOPICS_KEY).filter(item => item.id !== topicId))
  write(DRAFTS_KEY, read<ManuscriptDraft>(DRAFTS_KEY).map(draft => draft.topic_id === topicId ? { ...draft, topic_id: null } : draft))
}

export function upsertDraft(input: Partial<ManuscriptDraft> & Pick<ManuscriptDraft, 'title'>) {
  const rows = read<ManuscriptDraft>(DRAFTS_KEY)
  const now = new Date().toISOString()
  const existing = input.id ? rows.find(item => item.id === input.id) : undefined
  const draft: ManuscriptDraft = {
    id: input.id || id(),
    user_id: 'offline',
    topic_id: input.topic_id || null,
    title: input.title.trim() || '未命名草稿',
    article_type: input.article_type || 'Research Article',
    language: input.language || 'en',
    stage: input.stage || 'outline',
    abstract: input.abstract || null,
    keywords: input.keywords || [],
    outline: input.outline || null,
    authors: input.authors || [],
    target_word_count: input.target_word_count ?? null,
    current_word_count: Math.max(0, input.current_word_count || 0),
    figure_count: Math.max(0, input.figure_count || 0),
    table_count: Math.max(0, input.table_count || 0),
    reference_count: Math.max(0, input.reference_count || 0),
    deadline: input.deadline || null,
    external_links: input.external_links || [],
    target_journal_ids: input.target_journal_ids || [],
    primary_journal_id: input.primary_journal_id || null,
    checklist: input.checklist?.length ? input.checklist : createDefaultChecklist(),
    notes: input.notes || null,
    submitted_paper_id: input.submitted_paper_id || null,
    created_at: existing?.created_at || input.created_at || now,
    updated_at: now,
  }
  write(DRAFTS_KEY, existing ? rows.map(item => item.id === draft.id ? draft : item) : [draft, ...rows])
  return draft
}

export function deleteDraft(draftId: string) {
  write(DRAFTS_KEY, read<ManuscriptDraft>(DRAFTS_KEY).filter(item => item.id !== draftId))
}
