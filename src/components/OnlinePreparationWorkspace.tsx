import { useCallback, useEffect, useRef, useState } from 'react'
import { lookupJournalRanks } from '../lib/journal-rank-client'
import { supabase } from '../lib/supabase'
import type { JournalProfile, ManuscriptDraft, PreparationSnapshot, ResearchTopic } from '../lib/preparation'
import { createDefaultChecklist } from '../lib/preparation'
import { invalidateOnlineJournalProfileCache } from './OnlinePaperCard'
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

function localDateString() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function readableError(error: unknown, fallback: string) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback
}

export default function OnlinePreparationWorkspace({ userId, onPaperCreated }: Props) {
  const [snapshot, setSnapshot] = useState<PreparationSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loadVersion = useRef(0)

  const load = useCallback(async () => {
    const version = ++loadVersion.current
    setLoading(true)
    setError('')

    try {
      const [journalResult, topicResult, draftResult] = await Promise.all([
        (supabase.from('journal_profiles') as any).select('*').order('updated_at', { ascending: false }),
        (supabase.from('research_topics') as any).select('*').order('updated_at', { ascending: false }),
        (supabase.from('manuscript_drafts') as any).select('*').order('updated_at', { ascending: false }),
      ])

      if (version !== loadVersion.current) return
      const firstError = journalResult.error || topicResult.error || draftResult.error
      if (firstError) throw firstError

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
    } catch (caught) {
      if (version !== loadVersion.current) return
      console.error('Load preparation workspace failed:', caught)
      setError(readableError(caught, '投稿准备数据加载失败'))
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => { loadVersion.current += 1 }
  }, [load])

  const saveJournal = async (data: Partial<JournalProfile> & Pick<JournalProfile, 'name'>) => {
    const now = new Date().toISOString()
    if (data.id) {
      const { error } = await (supabase.from('journal_profiles') as any).update({ ...cleanPayload(data), updated_at: now }).eq('id', data.id)
      if (error) throw error
    } else {
      const { error } = await (supabase.from('journal_profiles') as any).insert({ ...cleanPayload(data), id: crypto.randomUUID(), user_id: userId, created_at: now, updated_at: now })
      if (error) throw error
    }
    invalidateOnlineJournalProfileCache()
    await load()
  }

  const deleteJournal = async (journalId: string) => {
    const affectedDrafts = snapshot.drafts.filter(draft => draft.primary_journal_id === journalId || draft.target_journal_ids.includes(journalId))
    await Promise.all(affectedDrafts.map(async draft => {
      const { error } = await (supabase.from('manuscript_drafts') as any).update({
        primary_journal_id: draft.primary_journal_id === journalId ? null : draft.primary_journal_id,
        target_journal_ids: draft.target_journal_ids.filter(id => id !== journalId),
        updated_at: new Date().toISOString(),
      }).eq('id', draft.id)
      if (error) throw error
    }))

    const { error } = await (supabase.from('journal_profiles') as any).delete().eq('id', journalId)
    if (error) throw error
    invalidateOnlineJournalProfileCache()
    await load()
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
    const submittedDate = localDateString()
    const paperId = crypto.randomUUID()
    const { error: paperError } = await (supabase.from('papers') as any).insert({
      id: paperId,
      user_id: userId,
      title: draft.title,
      title_zh: null,
      journal: journal?.name || null,
      manuscript_no: null,
      submission_system: null,
      system_status: 'Submitted',
      last_status_date: submittedDate,
      next_action: '等待编辑处理',
      reminder_level: 'watch',
      apc_amount: journal?.apc_amount ?? null,
      apc_currency: journal?.apc_currency || 'USD',
      revision_round: 0,
      followup_log: null,
      doi: null,
      publication_info: null,
      citation: null,
      journal_url: journal?.website_url || null,
      journal_apc_note: journal?.fee_notes || null,
      status: 'submitted',
      lang: draft.language,
      quartile_jcr: journal?.jcr_quartile || '未定',
      quartile_cas: journal?.cas_quartile || '未定',
      quartile_new: '无',
      quartile_cust: '无',
      quartile_zh: [],
      authors: draft.authors || [],
      corresponding_author: null,
      submitted_date: submittedDate,
      resolve_date: null,
      deadline: null,
      tracking_url: journal?.submission_url || null,
      published_url: null,
      timeline: `${submittedDate} Submitted`,
      notes: draft.notes || '由投稿准备模块确认投出并转入投稿管理。',
      prev_id: null,
      files: [],
      created_at: now,
      updated_at: now,
    })
    if (paperError) throw paperError

    const { data: updatedDrafts, error: draftError } = await (supabase.from('manuscript_drafts') as any).update({
      stage: 'submitted',
      submitted_paper_id: paperId,
      updated_at: now,
    }).eq('id', draft.id).is('submitted_paper_id', null).select('id')

    if (draftError || !updatedDrafts?.length) {
      const { error: rollbackError } = await (supabase.from('papers') as any).delete().eq('id', paperId)
      if (rollbackError) console.error('Rollback promoted paper failed:', rollbackError)
      if (draftError) throw draftError
      throw new Error('该草稿已被转入投稿管理，请刷新后查看。')
    }

    await load()
    onPaperCreated?.()
  }

  if (error) return <div className="prep-load-error"><h3>投稿准备数据暂时无法加载</h3><p>请检查网络连接后重试；若问题持续，请查看浏览器控制台中的错误详情。</p><button className="btn btn-primary btn-sm" onClick={() => void load()}>重新加载</button></div>

  return <PreparationWorkspace snapshot={snapshot} loading={loading} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} onLookupJournalRanks={lookupJournalRanks} />
}
