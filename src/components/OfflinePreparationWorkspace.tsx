import { useCallback, useEffect, useState } from 'react'
import type { Paper } from '../lib/types'
import type { JournalProfile, ManuscriptDraft, PreparationSnapshot, ResearchTopic } from '../lib/preparation'
import * as prepStore from '../lib/local-preparation-store'
import * as paperStore from '../lib/local-store'
import PreparationWorkspaceSuite from './PreparationWorkspaceSuite'

interface Props {
  authorName: string
  refreshToken?: number
  onPaperCreated?: () => void
}

const emptySnapshot: PreparationSnapshot = { journals: [], topics: [], drafts: [] }

function localDateString() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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
    const submittedDate = localDateString()
    const paperId = crypto.randomUUID()
    const paper: Paper = {
      id: paperId,
      user_id: 'offline',
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
      authors: draft.authors.length ? draft.authors : authorName ? [authorName] : [],
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
    }
    paperStore.addPaper(paper)
    prepStore.upsertDraft({ ...draft, stage: 'submitted', submitted_paper_id: paperId })
    refresh()
    onPaperCreated?.()
  }

  return <PreparationWorkspaceSuite snapshot={snapshot} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} />
}
