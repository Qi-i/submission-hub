import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseJournalRankResponse } from '../lib/journal-rank'
import type { JournalProfile, ManuscriptDraft, PreparationSnapshot, ResearchTopic } from '../lib/preparation'
import { createDefaultChecklist } from '../lib/preparation'
import PreparationWorkspace from './PreparationWorkspace'

interface Props {
  userId: string
  onPaperCreated?: () => void
}

const emptySnapshot: PreparationSnapshot = { journals: [], topics: [], drafts: [] }

function cleanPayload<T extends Record<string, any>>(data: T) {
  const { id, user_id, created_at, updated_at, ...payload } = data
  return payload
}

export default function OnlinePreparationWorkspace({ userId, onPaperCreated }: Props) {
  const [snapshot, setSnapshot] = useState<PreparationSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [journalResult, topicResult, draftResult] = await Promise.all([
      (supabase.from('journal_profiles') as any).select('*').order('updated_at', { ascending: false }),
      (supabase.from('research_topics') as any).select('*').order('updated_at', { ascending: false }),
      (supabase.from('manuscript_drafts') as any).select('*').order('updated_at', { ascending: false }),
    ])

    const firstError = journalResult.error || topicResult.error || draftResult.error
    if (firstError) {
      console.error('Load preparation workspace failed:', firstError)
      setError(firstError.message || '投稿准备数据加载失败')
      setLoading(false)
      return
    }

    setSnapshot({
      journals: ((journalResult.data || []) as JournalProfile[]).map(journal => ({
        ...journal,
        third_party_links: Array.isArray(journal.third_party_links) ? journal.third_party_links : [],
        subject_tags: Array.isArray(journal.subject_tags) ? journal.subject_tags : [],
        indexing: Array.isArray(journal.indexing) ? journal.indexing : [],
      })),
      topics: ((topicResult.data || []) as ResearchTopic[]).map(topic => ({
        ...topic,
        keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
        methods: Array.isArray(topic.methods) ? topic.methods : [],
        data_sources: Array.isArray(topic.data_sources) ? topic.data_sources : [],
        links: Array.isArray(topic.links) ? topic.links : [],
      })),
      drafts: ((draftResult.data || []) as ManuscriptDraft[]).map(draft => ({
        ...draft,
        checklist: Array.isArray(draft.checklist) && draft.checklist.length ? draft.checklist : createDefaultChecklist(),
        target_journal_ids: Array.isArray(draft.target_journal_ids) ? draft.target_journal_ids : [],
        external_links: Array.isArray(draft.external_links) ? draft.external_links : [],
        keywords: Array.isArray(draft.keywords) ? draft.keywords : [],
        authors: Array.isArray(draft.authors) ? draft.authors : [],
      })),
    })
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const saveJournal = async (data: Partial<JournalProfile> & Pick<JournalProfile, 'name'>) => {
    const now = new Date().toISOString()
    if (data.id) {
      const { error } = await (supabase.from('journal_profiles') as any).update({ ...cleanPayload(data), updated_at: now }).eq('id', data.id)
      if (error) throw error
    } else {
      const { error } = await (supabase.from('journal_profiles') as any).insert({ ...cleanPayload(data), id: crypto.randomUUID(), user_id: userId, created_at: now, updated_at: now })
      if (error) throw error
    }
    await load()
  }

  const deleteJournal = async (journalId: string) => {
    const affectedDrafts = snapshot.drafts.filter(draft => draft.primary_journal_id === journalId || draft.target_journal_ids.includes(journalId))
    for (const draft of affectedDrafts) {
      const { error } = await (supabase.from('manuscript_drafts') as any).update({
        primary_journal_id: draft.primary_journal_id === journalId ? null : draft.primary_journal_id,
        target_journal_ids: draft.target_journal_ids.filter(id => id !== journalId),
        updated_at: new Date().toISOString(),
      }).eq('id', draft.id)
      if (error) throw error
    }
    const { error } = await (supabase.from('journal_profiles') as any).delete().eq('id', journalId)
    if (error) throw error
    await load()
  }

  const lookupJournalRanks = async (publicationName: string) => {
    const { data, error } = await supabase.functions.invoke('journal-rank', { body: { publicationName } })
    if (error) throw new Error(error.message || '期刊等级查询失败')
    if (data?.error) throw new Error(data.error)
    return parseJournalRankResponse(data)
  }

  const saveTopic = async (data: Partial<ResearchTopic> & Pick<ResearchTopic, 'title'>) => {
    const now = new Date().toISOString()
    if (data.id) {
      const { error } = await (supabase.from('research_topics') as any).update({ ...cleanPayload(data), updated_at: now }).eq('id', data.id)
      if (error) throw error
    } else {
      const { error } = await (supabase.from('research_topics') as any).insert({ ...cleanPayload(data), id: crypto.randomUUID(), user_id: userId, created_at: now, updated_at: now })
      if (error) throw error
    }
    await load()
  }

  const deleteTopic = async (topicId: string) => {
    const { error } = await (supabase.from('research_topics') as any).delete().eq('id', topicId)
    if (error) throw error
    await load()
  }

  const saveDraft = async (data: Partial<ManuscriptDraft> & Pick<ManuscriptDraft, 'title'>) => {
    const now = new Date().toISOString()
    const payload = {
      ...cleanPayload(data),
      checklist: data.checklist?.length ? data.checklist : createDefaultChecklist(),
      target_journal_ids: data.target_journal_ids || [],
      external_links: data.external_links || [],
      updated_at: now,
    }
    if (data.id) {
      const { error } = await (supabase.from('manuscript_drafts') as any).update(payload).eq('id', data.id)
      if (error) throw error
    } else {
      const { error } = await (supabase.from('manuscript_drafts') as any).insert({ ...payload, id: crypto.randomUUID(), user_id: userId, created_at: now })
      if (error) throw error
    }
    await load()
  }

  const deleteDraft = async (draftId: string) => {
    const { error } = await (supabase.from('manuscript_drafts') as any).delete().eq('id', draftId)
    if (error) throw error
    await load()
  }

  const promoteDraft = async (draft: ManuscriptDraft) => {
    if (draft.submitted_paper_id) return
    const journal = snapshot.journals.find(item => item.id === draft.primary_journal_id)
    const now = new Date().toISOString()
    const paperId = crypto.randomUUID()
    const { error: paperError } = await (supabase.from('papers') as any).insert({
      id: paperId, user_id: userId, title: draft.title, title_zh: null, journal: journal?.name || null,
      manuscript_no: null, submission_system: null, system_status: null, last_status_date: null,
      next_action: '完成投稿材料并提交', reminder_level: 'watch',
      apc_amount: journal?.apc_amount ?? null, apc_currency: journal?.apc_currency || 'USD', revision_round: 0,
      followup_log: null, doi: null, publication_info: null, citation: null,
      journal_url: journal?.website_url || null, journal_apc_note: journal?.fee_notes || null,
      status: 'preparing', lang: draft.language, quartile_jcr: journal?.jcr_quartile || '未定',
      quartile_cas: journal?.cas_quartile || '未定', quartile_new: '无', quartile_cust: '无', quartile_zh: [],
      authors: draft.authors || [], corresponding_author: null, submitted_date: null, resolve_date: null,
      deadline: draft.deadline || null, tracking_url: journal?.submission_url || null, published_url: null,
      timeline: '', notes: draft.notes || '由投稿准备模块转入。', prev_id: null, files: [], created_at: now, updated_at: now,
    })
    if (paperError) throw paperError

    const { error: draftError } = await (supabase.from('manuscript_drafts') as any).update({
      stage: 'submitted', submitted_paper_id: paperId, updated_at: now,
    }).eq('id', draft.id)
    if (draftError) throw draftError
    await load()
    onPaperCreated?.()
  }

  if (error) return <div className="prep-load-error"><h3>投稿准备模块尚未初始化</h3><p>{error}</p><p>请确认 Supabase 已执行 008–010 迁移。</p><button className="btn btn-primary btn-sm" onClick={() => void load()}>重新加载</button></div>

  return <PreparationWorkspace snapshot={snapshot} loading={loading} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} onLookupJournalRanks={lookupJournalRanks} />
}