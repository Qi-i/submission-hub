import type { Paper } from './types'

const STORAGE_KEY = 'submission-hub-papers'

export function getPapers(): Paper[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function savePapers(papers: Paper[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(papers))
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
  const papers = data.map((d: any) => ({
    id: d.id || crypto.randomUUID(),
    user_id: 'offline',
    title: d.title || '未命名',
    title_zh: d.title_zh || null,
    journal: d.journal || null,
    status: d.status || 'preparing',
    lang: d.lang || 'zh',
    quartile_jcr: d.quartile_jcr || null,
    quartile_cas: d.quartile_cas || null,
    quartile_new: d.quartile_new || null,
    quartile_cust: d.quartile_cust || null,
    quartile_zh: d.quartile_zh || null,
    authors: d.authors || [],
    corresponding_author: d.corresponding_author || null,
    submitted_date: d.submittedDate || d.submitted_date || null,
    resolve_date: d.resolveDate || d.resolve_date || null,
    deadline: d.deadline || null,
    tracking_url: d.trackingUrl || d.tracking_url || null,
    timeline: d.timeline || null,
    notes: d.notes || null,
    prev_id: d.prevId || d.prev_id || null,
    files: d.files || null,
    created_at: d.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
  const existing = getPapers()
  savePapers([...papers, ...existing])
  return getPapers()
}
