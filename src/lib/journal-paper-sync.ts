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

const terminalStatePattern = /(accepted|accept|published|online|proof|录用|接收|见刊|在线发表|校样|rejected|reject|declined|拒稿|被拒|退稿|withdrawn|withdraw|撤稿)/i

function normalizeTimelineDate(value: string) {
  const match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (!match) return value
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function inferResolveDate(paper: Paper) {
  if (paper.resolve_date) return paper.resolve_date

  const terminalByMainStatus = ['accepted', 'rejected', 'withdrawn'].includes(paper.status)
  const terminalBySystemStatus = terminalStatePattern.test(paper.system_status || '')
  if (!terminalByMainStatus && !terminalBySystemStatus) return null

  const timelineRows = (paper.timeline || '').split('\n').map(row => row.trim()).filter(Boolean)
  for (let index = timelineRows.length - 1; index >= 0; index -= 1) {
    const match = timelineRows[index].match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*(.*)$/)
    if (!match || !terminalStatePattern.test(match[2] || '')) continue
    return normalizeTimelineDate(match[1])
  }

  // 旧数据可能只有主状态/系统状态与“最新状态日期”，没有单独填写终审日期。
  // 此时用最后状态日期作为终态日期，避免 Accepted 稿件继续按“今天”累加处理天数。
  return paper.last_status_date || null
}

export function mergePaperWithJournalProfile(paper: Paper, profile?: JournalProfile): Paper {
  const resolvedPaper: Paper = {
    ...paper,
    resolve_date: inferResolveDate(paper),
  }

  if (!profile) return resolvedPaper
  const ranked = profile as RankedJournalProfile
  const zhRanks = domesticRanks(ranked)
  return {
    ...resolvedPaper,
    journal_url: profile.website_url || resolvedPaper.journal_url,
    quartile_jcr: profile.jcr_quartile || resolvedPaper.quartile_jcr,
    quartile_cas: profile.cas_quartile || resolvedPaper.quartile_cas,
    quartile_new: newRank(ranked) || resolvedPaper.quartile_new,
    quartile_zh: zhRanks.length ? zhRanks : resolvedPaper.quartile_zh,
  }
}
