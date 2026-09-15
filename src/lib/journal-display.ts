import type { JournalProfile } from './preparation'
import { isRankItemVisible, rankItemsFromValues, type JournalRankItem } from './journal-rank'

export type RankedJournalProfile = JournalProfile & {
  rank_data?: Record<string, string> | null
  rank_updated_at?: string | null
}

export type JournalSurfaceTier =
  | 'jcr-q1'
  | 'jcr-q2'
  | 'jcr-q3'
  | 'jcr-unranked'
  | 'cn-ei'
  | 'cn-pku'
  | 'cn-core'
  | 'cn-ordinary'

export type JournalSurfaceClassification = {
  tier: JournalSurfaceTier
  code: 'Q1' | 'Q2' | 'Q3' | '未分区' | 'EI' | '北核' | '核心' | '普通'
}

export const JOURNAL_STAR_RATING_KEY = 'ui_star_rating'

export function journalStarRating(journal?: RankedJournalProfile | null) {
  const explicit = Number(journal?.rank_data?.[JOURNAL_STAR_RATING_KEY])
  if (Number.isInteger(explicit) && explicit >= 1 && explicit <= 5) return explicit
  const legacy: Record<string, number> = { low: 2, medium: 3, high: 4, critical: 5 }
  return legacy[journal?.priority || ''] || 3
}

export function journalPriorityForStarRating(rating: number): JournalProfile['priority'] {
  const value = Math.max(1, Math.min(5, Math.round(rating)))
  if (value >= 5) return 'critical'
  if (value === 4) return 'high'
  if (value === 3) return 'medium'
  return 'low'
}

const DOMESTIC_KEYS = ['eii', 'pku', 'cscd', 'zhongguokejihexin', 'cssci']
const CHINESE_CORE_KEYS = new Set(['pku', 'cscd', 'zhongguokejihexin', 'cssci'])
const DOMESTIC_INDEXING = ['EI', '北大核心', 'CSCD', '科技核心', 'CSSCI']
const INTERNATIONAL_PRIMARY_KEYS = ['sci', 'ssci', 'sciUp', 'sciBase', 'sciif', 'xr']
const ALWAYS_VISIBLE_JCR_KEYS = new Set(['sci', 'ssci'])

function meaningful(value?: string | null) {
  if (!value) return false
  const normalized = value.trim().toLocaleLowerCase()
  return !['否', 'no', 'false', '0', 'none', '无', '未收录', '未知'].includes(normalized)
}

function fallbackItem(key: string, label: string, value: string): JournalRankItem {
  return { key, label, value, group: 'official' }
}

function uniquePush(target: JournalRankItem[], item?: JournalRankItem) {
  if (!item || target.some(existing => existing.key === item.key || (existing.label === item.label && existing.value === item.value))) return
  target.push(item)
}

export function isChineseJournalIdentity(journal: Pick<RankedJournalProfile, 'name'>) {
  return /[\u3400-\u9fff]/.test(journal.name || '')
}

function normalizeJcrQuartile(journal: RankedJournalProfile) {
  const values = journal.rank_data || {}
  const raw = journal.jcr_quartile || values.sci || values.ssci || ''
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, '')
  const qMatch = normalized.match(/Q([1-3])/) || normalized.match(/^([1-3])(?:区|QUARTILE)?$/)
  return qMatch ? `Q${qMatch[1]}` as 'Q1' | 'Q2' | 'Q3' : null
}

export function journalSurfaceClassification(journal: RankedJournalProfile): JournalSurfaceClassification {
  const values = journal.rank_data || {}
  const indexing = journal.indexing || []

  // JCR is the primary surface for any journal that has a valid JCR quartile.
  // Domestic/core indexing must never override a real JCR Q1-Q3 classification.
  const jcr = normalizeJcrQuartile(journal)
  if (jcr === 'Q1') return { tier: 'jcr-q1', code: 'Q1' }
  if (jcr === 'Q2') return { tier: 'jcr-q2', code: 'Q2' }
  if (jcr === 'Q3') return { tier: 'jcr-q3', code: 'Q3' }

  // Chinese-core surfaces are only meaningful for journals whose primary title is Chinese.
  // An English/SCI journal carrying CSCD/PKU metadata remains an international journal surface.
  if (isChineseJournalIdentity(journal)) {
    if (indexing.includes('EI') || meaningful(values.eii)) return { tier: 'cn-ei', code: 'EI' }
    if (indexing.includes('北大核心') || meaningful(values.pku)) return { tier: 'cn-pku', code: '北核' }
    if (
      indexing.some(item => ['CSCD', '科技核心', 'CSSCI'].includes(item)) ||
      ['cscd', 'zhongguokejihexin', 'cssci'].some(key => meaningful(values[key]))
    ) return { tier: 'cn-core', code: '核心' }
    return { tier: 'cn-ordinary', code: '普通' }
  }

  return { tier: 'jcr-unranked', code: '未分区' }
}

export function isDomesticJournal(journal: RankedJournalProfile) {
  return isChineseJournalIdentity(journal)
}

export function primaryJournalRankItems(journal: RankedJournalProfile, limit = 6) {
  const values = journal.rank_data || {}
  const allItems = rankItemsFromValues(values)
  const itemMap = new Map(allItems.map(item => [item.key, item]))
  const chinese = isChineseJournalIdentity(journal)
  const result: JournalRankItem[] = []

  // JCR always leads the rank rail when it exists.
  ;['sci', 'ssci'].forEach(key => uniquePush(result, itemMap.get(key)))
  if (!result.some(item => ['sci', 'ssci'].includes(item.key)) && journal.jcr_quartile) {
    uniquePush(result, fallbackItem('profile:jcr', 'JCR 分区', journal.jcr_quartile))
  }

  // Secondary international metrics follow JCR, never precede it.
  ;['sciUp', 'sciBase'].forEach(key => uniquePush(result, itemMap.get(key)))
  if (!result.some(item => ['sciUp', 'sciBase'].includes(item.key)) && journal.cas_quartile) {
    uniquePush(result, fallbackItem('profile:cas', '中科院分区', journal.cas_quartile))
  }
  uniquePush(result, itemMap.get('sciif'))
  if (!result.some(item => item.key === 'sciif') && journal.impact_factor != null) {
    uniquePush(result, fallbackItem('profile:if', '影响因子', String(journal.impact_factor)))
  }
  uniquePush(result, itemMap.get('xr'))

  // EI can be useful for either Chinese or English journals. Chinese-only core labels are
  // intentionally suppressed on English journal cards so an SCI title cannot surface as “核心”.
  uniquePush(result, itemMap.get('eii'))
  if (chinese) {
    ;['pku', 'cscd', 'zhongguokejihexin', 'cssci'].forEach(key => uniquePush(result, itemMap.get(key)))
    journal.indexing.forEach(index => {
      if (!DOMESTIC_INDEXING.includes(index)) return
      const key = `index:${index}`
      if (!result.some(item => item.label === index)) uniquePush(result, fallbackItem(key, index, '收录'))
    })
  }

  // Preserve custom/other ranks, but never leak Chinese-core keys back onto English cards.
  allItems.forEach(item => {
    if (!chinese && CHINESE_CORE_KEYS.has(item.key)) return
    if (INTERNATIONAL_PRIMARY_KEYS.includes(item.key) || DOMESTIC_KEYS.includes(item.key)) return
    uniquePush(result, item)
  })

  return result
    .filter(item => item.key.startsWith('profile:') || item.key.startsWith('index:') || ALWAYS_VISIBLE_JCR_KEYS.has(item.key) || isRankItemVisible(values, item.key))
    .slice(0, limit)
}

export const journalPrimaryRankItems = primaryJournalRankItems

export function journalRankTone(key: string) {
  if (key === 'xr' || key.startsWith('xr')) return 'xinkey'
  if (key === 'sciUp' || key === 'sciBase' || key.startsWith('profile:cas')) return 'cas'
  if (key === 'sci' || key === 'ssci' || key.startsWith('profile:jcr')) return 'jcr'
  if (key === 'sciif' || key.startsWith('profile:if')) return 'if'
  if (key === 'eii' || key === 'index:EI') return 'ei'
  if (key === 'pku' || key === 'index:北大核心') return 'pku'
  if (key === 'cscd' || key === 'index:CSCD') return 'cscd'
  if (key === 'zhongguokejihexin' || key === 'index:科技核心') return 'tech'
  if (key === 'cssci' || key === 'index:CSSCI') return 'cssci'
  return 'other'
}

export function journalPrimarySummary(journal: RankedJournalProfile, limit = 4) {
  const items = primaryJournalRankItems(journal, limit)
  return items.length ? items.map(item => `${item.label} ${item.value}`).join(' · ') : '主要分区与收录未记录'
}
