import type { JournalProfile } from './preparation'
import type { Paper } from './types'

const AUTO_TAG = '投稿历史自动收录'

export function normalizeJournalIdentity(value?: string | null) {
  return (value || '')
    .normalize('NFKC')
    .trim()
    .replace(/[\s·•]+/g, ' ')
    .replace(/\s*([:&-])\s*/g, '$1')
    .toLocaleLowerCase()
}

function usefulQuartile(value?: string | null) {
  const normalized = (value || '').trim()
  return normalized && !['未定', '无', '—', '-'].includes(normalized) ? normalized : null
}

function latestPaperFirst(left: Paper, right: Paper) {
  const leftDate = left.updated_at || left.last_status_date || left.submitted_date || ''
  const rightDate = right.updated_at || right.last_status_date || right.submitted_date || ''
  return rightDate.localeCompare(leftDate)
}

export function deriveAutomaticJournalProfiles(
  papers: Paper[],
  existing: JournalProfile[],
  userId: string,
) {
  const existingNames = new Set(existing.map(item => normalizeJournalIdentity(item.name)).filter(Boolean))
  const grouped = new Map<string, Paper[]>()

  papers.forEach(paper => {
    const key = normalizeJournalIdentity(paper.journal)
    const hasSubmissionHistory = !!paper.submitted_date || (paper.status && paper.status !== 'preparing')
    if (!key || !paper.journal?.trim() || !hasSubmissionHistory) return
    grouped.set(key, [...(grouped.get(key) || []), paper])
  })

  const now = new Date().toISOString()
  const additions: JournalProfile[] = []

  grouped.forEach((records, key) => {
    if (existingNames.has(key)) return
    const ordered = [...records].sort(latestPaperFirst)
    const primary = ordered[0]
    const firstWebsite = ordered.find(item => /^https?:\/\//i.test(item.journal_url || ''))?.journal_url || null
    const firstApc = ordered.find(item => item.apc_amount != null)
    const jcr = ordered.map(item => usefulQuartile(item.quartile_jcr)).find(Boolean) || null
    const cas = ordered.map(item => usefulQuartile(item.quartile_cas)).find(Boolean) || null

    additions.push({
      id: globalThis.crypto?.randomUUID?.() || `journal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      user_id: userId,
      name: primary.journal!.trim(),
      name_zh: null,
      official_abbreviation: null,
      publisher: null,
      website_url: firstWebsite,
      author_guide_url: null,
      submission_url: null,
      third_party_links: [],
      issn: null,
      eissn: null,
      scope: null,
      scope_zh: null,
      subject_tags: [],
      selection_tags: [AUTO_TAG],
      indexing: [],
      jcr_quartile: jcr,
      cas_quartile: cas,
      impact_factor: null,
      oa_type: 'unknown',
      apc_amount: firstApc?.apc_amount ?? null,
      apc_currency: firstApc?.apc_currency || 'USD',
      fee_notes: primary.journal_apc_note || null,
      first_decision_days: null,
      total_review_days: null,
      acceptance_rate: null,
      risk_level: 'normal',
      is_favorite: false,
      priority: 'low',
      selection_notes: `由 ${records.length} 条投稿记录自动收录，可补充完整信息或设为重点期刊。`,
      notes: '系统根据投稿历史自动建立的简易期刊档案。',
      created_at: now,
      updated_at: now,
    })
    existingNames.add(key)
  })

  return additions
}

export function isAutomaticallyCataloguedJournal(journal: Pick<JournalProfile, 'selection_tags'>) {
  return (journal.selection_tags || []).includes(AUTO_TAG)
}
