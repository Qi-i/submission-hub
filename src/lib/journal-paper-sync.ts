import { isDomesticJournal, primaryJournalRankItems, type RankedJournalProfile } from './journal-display'
import type { JournalProfile } from './preparation'
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
