import type { JournalProfile } from './preparation'
import { rankItemsFromValues, type JournalRankItem } from './journal-rank'

export type RankedJournalProfile = JournalProfile & {
  rank_data?: Record<string, string> | null
  rank_updated_at?: string | null
}

const DOMESTIC_KEYS = ['eii', 'pku', 'cscd', 'zhongguokejihexin', 'cssci']
const INTERNATIONAL_KEYS = ['xr', 'sciUp', 'sciBase', 'sci', 'ssci', 'sciif']
const DOMESTIC_INDEXING = ['EI', '北大核心', 'CSCD', '科技核心', 'CSSCI']

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

export function isDomesticJournal(journal: RankedJournalProfile) {
  const values = journal.rank_data || {}
  const hasDomesticRank = DOMESTIC_KEYS.some(key => meaningful(values[key]))
  const hasDomesticIndexing = journal.indexing.some(item => DOMESTIC_INDEXING.includes(item))
  const chineseName = /[\u3400-\u9fff]/.test(`${journal.name} ${journal.publisher || ''}`)
  return hasDomesticRank || hasDomesticIndexing || chineseName
}

export function primaryJournalRankItems(journal: RankedJournalProfile, limit = 6) {
  const values = journal.rank_data || {}
  const allItems = rankItemsFromValues(values)
  const itemMap = new Map(allItems.map(item => [item.key, item]))
  const domestic = isDomesticJournal(journal)
  const hasInternationalEvidence = INTERNATIONAL_KEYS.some(key => meaningful(values[key])) || !!journal.jcr_quartile || !!journal.cas_quartile || journal.impact_factor != null
  const order = domestic
    ? [...DOMESTIC_KEYS, ...(hasInternationalEvidence ? INTERNATIONAL_KEYS : [])]
    : [...INTERNATIONAL_KEYS, ...DOMESTIC_KEYS]
  const result: JournalRankItem[] = []

  order.forEach(key => uniquePush(result, itemMap.get(key)))

  if (domestic) {
    journal.indexing.forEach(index => {
      if (!DOMESTIC_INDEXING.includes(index)) return
      const key = `index:${index}`
      if (!result.some(item => item.label === index)) uniquePush(result, fallbackItem(key, index, '收录'))
    })
  }

  if (!result.some(item => ['sciUp', 'sciBase'].includes(item.key)) && journal.cas_quartile) {
    uniquePush(result, fallbackItem('profile:cas', '中科院分区', journal.cas_quartile))
  }
  if (!result.some(item => ['sci', 'ssci'].includes(item.key)) && journal.jcr_quartile) {
    uniquePush(result, fallbackItem('profile:jcr', 'JCR 分区', journal.jcr_quartile))
  }
  if (!result.some(item => item.key === 'sciif') && journal.impact_factor != null) {
    uniquePush(result, fallbackItem('profile:if', '影响因子', String(journal.impact_factor)))
  }

  allItems.forEach(item => uniquePush(result, item))
  return result.slice(0, limit)
}

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
