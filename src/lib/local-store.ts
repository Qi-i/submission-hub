import type { Paper, PaperFile } from './types'
import { STATUSES } from './types'

const STORAGE_KEY = 'submission-hub-papers'
const validStatuses = new Set(STATUSES.map(status => status.key))

function newId() {
  return globalThis.crypto?.randomUUID?.() || `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) : []
}

function files(value: unknown): PaperFile[] | null {
  if (!Array.isArray(value)) return null
  const result = value.map((file: any) => ({
    n: text(file?.n ?? file?.name) || '',
    p: text(file?.p ?? file?.url) || '',
    t: text(file?.t ?? file?.type) || '其它',
  })).filter(file => file.n || file.p)
  return result.length ? result : null
}

export function getPapers(): Paper[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data.filter(item => item && typeof item === 'object') as Paper[] : []
  } catch {
    return []
  }
}

export function savePapers(papers: Paper[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(papers))
  } catch (error) {
    console.error('Save offline papers failed:', error)
    throw new Error('本地存储失败，可能是浏览器存储空间不足或隐私模式限制。')
  }
}

export function addPaper(paper: Paper) {
  const papers = getPapers()
  papers.unshift(paper)
  savePapers(papers)
}

export function updatePaper(updated: Paper) {
  const papers = getPapers().map(p => p.id === updated.id ? updated : p)
  savePapers(papers)
}

export function deletePaper(id: string) {
  const papers = getPapers().filter(p => p.id !== id)
  savePapers(papers)
}

export function exportPapers(): string {
  return JSON.stringify(getPapers(), null, 2)
}

export function importPapers(json: string): Paper[] {
  const data = JSON.parse(json)
  if (!Array.isArray(data)) throw new Error('Invalid format')

  const existing = getPapers()
  const existingIds = new Set(existing.map(paper => paper.id))
  const sourceRows = data.filter(row => row && typeof row === 'object' && !existingIds.has(String(row.id || '')))
  const idMap = new Map<string, string>()
  const reserved = new Set(existingIds)

  for (const row of sourceRows) {
    const sourceId = text(row.id)
    let targetId = sourceId || newId()
    while (reserved.has(targetId)) targetId = newId()
    reserved.add(targetId)
    if (sourceId) idMap.set(sourceId, targetId)
  }

  const now = new Date().toISOString()
  const imported = sourceRows.map((d: any, index): Paper => {
    const sourceId = text(d.id)
    const id = sourceId ? idMap.get(sourceId)! : Array.from(reserved)[existingIds.size + index] || newId()
    const oldPrevId = text(d.prevId ?? d.prev_id)
    const status = text(d.status) || 'preparing'
    const apcValue = d.apc_amount ?? d.apcAmount
    const revisionValue = d.revision_round ?? d.revisionRound

    return {
      id,
      user_id: 'offline',
      title: text(d.title) || '未命名',
      title_zh: text(d.title_zh ?? d.titleZh),
      journal: text(d.journal),
      manuscript_no: text(d.manuscript_no ?? d.manuscriptNo),
      submission_system: text(d.submission_system ?? d.submissionSystem),
      system_status: text(d.system_status ?? d.systemStatus),
      last_status_date: text(d.last_status_date ?? d.lastStatusDate),
      next_action: text(d.next_action ?? d.nextAction),
      reminder_level: text(d.reminder_level ?? d.reminderLevel) || 'none',
      apc_amount: apcValue === null || apcValue === undefined || apcValue === '' ? null : Number(apcValue),
      apc_currency: text(d.apc_currency ?? d.apcCurrency) || 'USD',
      revision_round: Number.isFinite(Number(revisionValue)) ? Number(revisionValue) : 0,
      followup_log: text(d.followup_log ?? d.followupLog),
      doi: text(d.doi),
      publication_info: text(d.publication_info ?? d.publicationInfo),
      citation: text(d.citation),
      journal_url: text(d.journal_url ?? d.journalUrl),
      journal_apc_note: text(d.journal_apc_note ?? d.journalApcNote),
      status: validStatuses.has(status as any) ? status : 'preparing',
      lang: text(d.lang) || 'zh',
      quartile_jcr: text(d.quartile_jcr ?? d.quartileJcr),
      quartile_cas: text(d.quartile_cas ?? d.quartileCas),
      quartile_new: text(d.quartile_new ?? d.quartileNew),
      quartile_cust: text(d.quartile_cust ?? d.quartileCust),
      quartile_zh: stringArray(d.quartile_zh ?? d.quartileZh),
      authors: stringArray(d.authors),
      corresponding_author: text(d.corresponding_author ?? d.correspondingAuthor),
      submitted_date: text(d.submittedDate ?? d.submitted_date),
      resolve_date: text(d.resolveDate ?? d.resolve_date),
      deadline: text(d.deadline),
      tracking_url: text(d.trackingUrl ?? d.tracking_url),
      published_url: text(d.publishedUrl ?? d.published_url),
      timeline: text(d.timeline),
      notes: text(d.notes),
      prev_id: oldPrevId ? idMap.get(oldPrevId) || (existingIds.has(oldPrevId) ? oldPrevId : null) : null,
      files: files(d.files),
      created_at: text(d.created_at ?? d.createdAt) || now,
      updated_at: now,
    }
  })

  savePapers([...imported, ...existing])
  return getPapers()
}
