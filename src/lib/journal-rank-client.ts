import { supabase } from './supabase'
import { parseJournalRankResponse, type JournalRankLookupResult } from './journal-rank'

function statusMessage(status: number) {
  if (status === 401) return '登录状态已失效，请重新登录后查询。'
  if (status === 403) return '当前账户没有期刊等级查询权限。'
  if (status === 429) return '查询过于频繁，请稍后再试。'
  if (status === 503) return '期刊等级服务尚未配置完成。'
  if (status >= 500) return '期刊等级数据源暂时不可用，请稍后再试。'
  return '期刊等级查询失败。'
}

async function functionErrorMessage(error: any) {
  const response = error?.context
  if (response instanceof Response) {
    try {
      const payload = await response.clone().json()
      if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim()
    } catch {
      // Non-JSON response; use the status-specific message below.
    }
    return statusMessage(response.status)
  }
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : '期刊等级查询失败。'
}

export async function lookupJournalRanks(publicationName: string): Promise<JournalRankLookupResult> {
  const name = publicationName.trim()
  if (!name) throw new Error('请先填写期刊名称。')

  const { data, error } = await supabase.functions.invoke('journal-rank', {
    body: { publicationName: name },
  })

  if (error) throw new Error(await functionErrorMessage(error))
  if (data?.error) throw new Error(String(data.error))

  const result = parseJournalRankResponse(data)
  if (!result.items.length) throw new Error('未查询到该期刊的等级信息，请检查期刊名称或改为手动填写。')
  return result
}
