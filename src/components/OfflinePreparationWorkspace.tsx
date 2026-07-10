import { useCallback, useEffect, useState } from 'react'
import type { Paper } from '../lib/types'
import type { JournalProfile, ManuscriptDraft, PreparationSnapshot, ResearchTopic } from '../lib/preparation'
import * as prepStore from '../lib/local-preparation-store'
import * as paperStore from '../lib/local-store'
import PreparationWorkspace from './PreparationWorkspace'

interface Props {
  authorName: string
  refreshToken?: number
  onPaperCreated?: () => void
}

const emptySnapshot: PreparationSnapshot = { journals: [], topics: [], drafts: [] }

export default function OfflinePreparationWorkspace({ authorName, refreshToken, onPaperCreated }: Props) {
  const [snapshot, setSnapshot] = useState<PreparationSnapshot>(emptySnapshot)

  const refresh = useCallback(() => {
    setSnapshot(prepStore.getPreparationSnapshot())
  }, [])

  useEffect(() => { refresh() }, [refresh, refreshToken])

  const saveJournal = async (data: Partial<JournalProfile> & Pick<JournalProfile, 'name'>) => {
    prepStore.upsertJournal(data)
    refresh()
  }

  const deleteJournal = async (id: string) => {
    prepStore.deleteJournal(id)
    refresh()
  }

  const saveTopic = async (data: Partial<ResearchTopic> & Pick<ResearchTopic, 'title'>) => {
    prepStore.upsertTopic(data)
    refresh()
  }

  const deleteTopic = async (id: string) => {
    prepStore.deleteTopic(id)
    refresh()
  }

  const saveDraft = async (data: Partial<ManuscriptDraft> & Pick<ManuscriptDraft, 'title'>) => {
    prepStore.upsertDraft(data)
    refresh()
  }

  const deleteDraft = async (id: string) => {
    prepStore.deleteDraft(id)
    refresh()
  }

  const promoteDraft = async (draft: ManuscriptDraft) => {
    if (draft.submitted_paper_id) return
    const journal = snapshot.journals.find(item => item.id === draft.primary_journal_id)
    const now = new Date().toISOString()
    const paperId = crypto.randomUUID()
    const paper: Paper = {
      id: paperId,
      user_id: 'offline',
      title: draft.title,
      title_zh: null,
      journal: journal?.name || null,
      manuscript_no: null,
      submission_system: null,
      system_status: null,
      last_status_date: null,
      next_action: '完成投稿材料并提交',
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
      status: 'preparing',
      lang: draft.language,
      quartile_jcr: journal?.jcr_quartile || '未定',
      quartile_cas: journal?.cas_quartile || '未定',
      quartile_new: '无',
      quartile_cust: '无',
      quartile_zh: [],
      authors: draft.authors.length ? draft.authors : authorName ? [authorName] : [],
      corresponding_author: null,
      submitted_date: null,
      resolve_date: null,
      deadline: draft.deadline || null,
      tracking_url: journal?.submission_url || null,
      published_url: null,
      timeline: '',
      notes: draft.notes || '由投稿准备模块转入。',
      prev_id: null,
      files: [],
      created_at: now,
      updated_at: now,
    }
    paperStore.addPaper(paper)
    prepStore.upsertDraft({ ...draft, stage: 'submitted', submitted_paper_id: paperId })
    refresh()
    onPaperCreated?.()
  }

  return <PreparationWorkspace snapshot={snapshot} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} />
}
