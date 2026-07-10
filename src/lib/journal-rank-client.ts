import { supabase } from './supabase'
import { parseJournalRankResponse, type JournalRankLookupResult } from './journal-rank'

export async function lookupJournalRanks(publicationName: string): Promise<JournalRankLookupResult> {
  const name = publicationName.trim()
  if (!name) throw new Error('请先填写期刊名称。')
  const { data, error } = await supabase.functions.invoke('journal-rank', { body: { publicationName: name } })
  if (error) throw new Error(error.message || '期刊等级查询失败')
  if (data?.error) throw new Error(data.error)
  return parseJournalRankResponse(data)
}
