import { supabase } from './supabase'
import type { Paper } from './types'
import { STATUSES } from './types'
import type { PreparationSnapshot } from './preparation'
import { createBackup, parseBackupBundle } from './backup'
import { mergePreparationSnapshots } from './preparation-backup'

const validStatuses = new Set<string>(STATUSES.map(status => status.key))
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null

async function loadPreparation(): Promise<PreparationSnapshot> {
  const [journals, topics, drafts] = await Promise.all([
    (supabase.from('journal_profiles') as any).select('*'),
    (supabase.from('research_topics') as any).select('*'),
    (supabase.from('manuscript_drafts') as any).select('*'),
  ])
  const error = journals.error || topics.error || drafts.error
  if (error) throw new Error(`投稿准备数据读取失败：${error.message}`)
  return {
    journals: journals.data || [],
    topics: topics.data || [],
    drafts: drafts.data || [],
  }
}

export async function createOnlineBackup(papers: Paper[]) {
  const preparation = await loadPreparation()
  return createBackup(papers, 'online', preparation)
}

function normalizePaperRows(source: unknown[], userId: string, existingIds: Set<string>) {
  const rows = source.filter((row: any) => row && typeof row === 'object' && !existingIds.has(String(row.id || '')))
  const idMap = new Map<string, string>()
  const generatedIds = rows.map((row: any) => {
    const targetId = crypto.randomUUID()
    const sourceId = text(row.id)
    if (sourceId) idMap.set(sourceId, targetId)
    return targetId
  })
  const now = new Date().toISOString()

  const normalized = rows.map((source: any, index) => {
    const sourcePrevId = text(source.prevId ?? source.prev_id)
    const status = text(source.status) || 'preparing'
    const apcRaw = source.apc_amount ?? source.apcAmount
    const apcNumber = apcRaw === null || apcRaw === undefined || apcRaw === '' ? null : Number(apcRaw)
    const revisionNumber = Number(source.revision_round ?? source.revisionRound)
    return {
      id: generatedIds[index], user_id: userId, title: text(source.title) || '未命名',
      title_zh: text(source.title_zh ?? source.titleZh), journal: text(source.journal),
      manuscript_no: text(source.manuscript_no ?? source.manuscriptNo), submission_system: text(source.submission_system ?? source.submissionSystem),
      system_status: text(source.system_status ?? source.systemStatus), last_status_date: text(source.last_status_date ?? source.lastStatusDate),
      next_action: text(source.next_action ?? source.nextAction), reminder_level: text(source.reminder_level ?? source.reminderLevel) || 'none',
      apc_amount: apcNumber !== null && Number.isFinite(apcNumber) && apcNumber >= 0 ? apcNumber : null,
      apc_currency: text(source.apc_currency ?? source.apcCurrency) || 'USD',
      revision_round: Number.isFinite(revisionNumber) ? Math.max(0, Math.trunc(revisionNumber)) : 0,
      followup_log: text(source.followup_log ?? source.followupLog), doi: text(source.doi),
      publication_info: text(source.publication_info ?? source.publicationInfo), citation: text(source.citation),
      journal_url: text(source.journal_url ?? source.journalUrl), journal_apc_note: text(source.journal_apc_note ?? source.journalApcNote),
      status: validStatuses.has(status) ? status : 'preparing', lang: text(source.lang) || 'zh',
      quartile_jcr: text(source.quartile_jcr ?? source.quartileJcr), quartile_cas: text(source.quartile_cas ?? source.quartileCas),
      quartile_new: text(source.quartile_new ?? source.quartileNew), quartile_cust: text(source.quartile_cust ?? source.quartileCust),
      quartile_zh: Array.isArray(source.quartile_zh ?? source.quartileZh) ? (source.quartile_zh ?? source.quartileZh).filter((item: unknown) => typeof item === 'string') : [],
      authors: Array.isArray(source.authors) ? source.authors.filter((item: unknown) => typeof item === 'string') : [],
      corresponding_author: text(source.corresponding_author ?? source.correspondingAuthor),
      submitted_date: text(source.submittedDate ?? source.submitted_date), resolve_date: text(source.resolveDate ?? source.resolve_date),
      deadline: text(source.deadline), tracking_url: text(source.trackingUrl ?? source.tracking_url),
      published_url: text(source.publishedUrl ?? source.published_url), timeline: text(source.timeline), notes: text(source.notes),
      prev_id: sourcePrevId ? idMap.get(sourcePrevId) || (existingIds.has(sourcePrevId) ? sourcePrevId : null) : null,
      files: Array.isArray(source.files) ? source.files.map((item: any) => ({ n: text(item?.n ?? item?.name) || '', p: text(item?.p ?? item?.url) || '', t: text(item?.t ?? item?.type) || '其它' })).filter((item: any) => item.n || item.p) : null,
      created_at: now, updated_at: now,
    }
  })

  return { rows: normalized, idMap }
}

async function insertChunks(table: string, rows: any[]) {
  for (let index = 0; index < rows.length; index += 200) {
    const { error } = await (supabase.from(table) as any).insert(rows.slice(index, index + 200))
    if (error) throw error
  }
}

export async function importOnlineBackup(json: string, userId: string, existingPapers: Paper[]) {
  const bundle = parseBackupBundle(json)
  const existingPaperIds = new Set(existingPapers.map(paper => paper.id))
  const { rows: paperRows, idMap: paperIdMap } = normalizePaperRows(bundle.papers, userId, existingPaperIds)

  let existingPreparation: PreparationSnapshot = { journals: [], topics: [], drafts: [] }
  if (bundle.preparation) existingPreparation = await loadPreparation()

  const validPaperIds = new Set(existingPaperIds)
  paperRows.forEach(row => validPaperIds.add(row.id))
  const mappedPreparation = bundle.preparation ? {
    ...bundle.preparation,
    drafts: bundle.preparation.drafts.map(draft => ({
      ...draft,
      submitted_paper_id: draft.submitted_paper_id
        ? paperIdMap.get(draft.submitted_paper_id) || (existingPaperIds.has(draft.submitted_paper_id) ? draft.submitted_paper_id : null)
        : null,
    })),
  } : null
  const prepMerge = mappedPreparation
    ? mergePreparationSnapshots(existingPreparation, mappedPreparation, userId, validPaperIds)
    : { added: { journals: [], topics: [], drafts: [] } }

  await insertChunks('papers', paperRows)
  await insertChunks('journal_profiles', prepMerge.added.journals)
  await insertChunks('research_topics', prepMerge.added.topics)
  await insertChunks('manuscript_drafts', prepMerge.added.drafts)

  return {
    papers: paperRows.length,
    journals: prepMerge.added.journals.length,
    topics: prepMerge.added.topics.length,
    drafts: prepMerge.added.drafts.length,
  }
}
