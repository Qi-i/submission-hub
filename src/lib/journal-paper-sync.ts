import type { JournalProfile } from './preparation'
import { isDomesticJournal, primaryJournalRankItems, type RankedJournalProfile } from './journal-display'
import type { Paper } from './types'

export function normalizeJournalName(value?: string | null) {
  return (value || '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/[\s,，.。:：;；'"“”‘’()（）\[\]【】]+/g, '')
}

export function findJournalProfile(profiles: JournalProfile[], name?: string | null) {
  const key = normalizeJournalName(name)
  if (!key) return undefined
  return profiles.find(profile => normalizeJournalName(profile.name) === key)
}

function newRank(profile: RankedJournalProfile) {
  const values = profile.rank_data || {}
  return values.xrTop || values.xr || null
}

function domesticRanks(profile: RankedJournalProfile) {
  if (!isDomesticJournal(profile)) return []
  return primaryJournalRankItems(profile, 8)
    .filter(item => ['eii', 'pku', 'cscd', 'zhongguokejihexin', 'cssci'].includes(item.key) || item.key.startsWith('index:'))
    .map(item => item.value === '收录' ? item.label : `${item.label} ${item.value}`)
}

export function mergePaperWithJournalProfile(paper: Paper, profile?: JournalProfile): Paper {
  if (!profile) return paper
  const ranked = profile as RankedJournalProfile
  const zhRanks = domesticRanks(ranked)
  return {
    ...paper,
    journal_url: profile.website_url || paper.journal_url,
    quartile_jcr: profile.jcr_quartile || paper.quartile_jcr,
    quartile_cas: profile.cas_quartile || paper.quartile_cas,
    quartile_new: newRank(ranked) || paper.quartile_new,
    quartile_zh: zhRanks.length ? zhRanks : paper.quartile_zh,
  }
}

export function journalProfileAsPaper(profile: JournalProfile): Paper {
  const ranked = profile as RankedJournalProfile
  const domestic = isDomesticJournal(ranked)
  return {
    id: `journal-profile:${profile.id}`,
    user_id: profile.user_id,
    title: `[期刊库] ${profile.name}`,
    title_zh: null,
    journal: profile.name,
    manuscript_no: null,
    submission_system: null,
    system_status: null,
    last_status_date: null,
    next_action: null,
    reminder_level: 'none',
    apc_amount: profile.apc_amount,
    apc_currency: profile.apc_currency,
    revision_round: 0,
    followup_log: null,
    doi: null,
    publication_info: null,
    citation: null,
    journal_url: profile.website_url,
    journal_apc_note: profile.fee_notes,
    status: 'preparing',
    lang: domestic ? 'zh' : 'en',
    quartile_jcr: profile.jcr_quartile || '未定',
    quartile_cas: profile.cas_quartile || '未定',
    quartile_new: newRank(ranked) || '无',
    quartile_cust: '无',
    quartile_zh: domesticRanks(ranked),
    authors: [],
    corresponding_author: null,
    submitted_date: null,
    resolve_date: null,
    deadline: null,
    tracking_url: profile.submission_url,
    published_url: null,
    timeline: null,
    notes: '由期刊库自动关联，仅用于表单同步。',
    prev_id: null,
    files: null,
    created_at: profile.created_at,
    // 保证期刊库档案优先于同名历史投稿记录，且不写入数据库。
    updated_at: '9999-12-31T23:59:59.999Z',
  }
}

export function appendJournalProfiles(papers: Paper[], profiles: JournalProfile[]) {
  const synthetic = profiles.map(journalProfileAsPaper)
  return [...papers.filter(paper => !paper.id.startsWith('journal-profile:')), ...synthetic]
}
