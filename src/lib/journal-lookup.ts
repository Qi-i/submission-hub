export interface JournalLookupResult {
  name?: string
  publisher?: string
  issn?: string
  eissn?: string
  websiteUrl?: string
  sourceUrl: string
  sourceLabel: string
  note: string
}

type CrossrefResponse = {
  status?: string
  message?: Record<string, any>
}

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i
const ISSN_PATTERN = /\b\d{4}-?\d{3}[\dXx]\b/

function normalizeIssn(value: string) {
  const compact = value.replace(/[^\dXx]/g, '').toUpperCase()
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : value.trim()
}

function extractDoi(value: string) {
  const match = decodeURIComponent(value.trim()).match(DOI_PATTERN)
  return match?.[0]?.replace(/[.,;]+$/, '') || null
}

function extractIssn(value: string) {
  const match = value.trim().match(ISSN_PATTERN)
  return match ? normalizeIssn(match[0]) : null
}

async function crossref(path: string) {
  const url = `https://api.crossref.org/${path}${path.includes('?') ? '&' : '?'}mailto=submission-hub@example.invalid`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Crossref 返回 ${response.status}`)
  const payload = await response.json() as CrossrefResponse
  if (!payload.message) throw new Error('Crossref 未返回可用元数据')
  return payload.message
}

function splitIssns(values: unknown): { issn?: string; eissn?: string } {
  const rows = Array.isArray(values) ? values.filter(item => typeof item === 'string').map(normalizeIssn) : []
  return { issn: rows[0], eissn: rows[1] }
}

async function lookupByIssn(issn: string): Promise<JournalLookupResult> {
  const normalized = normalizeIssn(issn)
  const message = await crossref(`journals/${encodeURIComponent(normalized)}`)
  const ids = splitIssns(message.ISSN)
  return {
    name: typeof message.title === 'string' ? message.title : undefined,
    publisher: typeof message.publisher === 'string' ? message.publisher : undefined,
    issn: ids.issn || normalized,
    eissn: ids.eissn,
    sourceUrl: `https://api.crossref.org/journals/${encodeURIComponent(normalized)}`,
    sourceLabel: 'Crossref ISSN',
    note: '已自动识别期刊名称、出版社和 ISSN。分区、费用、开放获取和审稿周期仍需人工核对。',
  }
}

async function lookupByDoi(doi: string): Promise<JournalLookupResult> {
  const message = await crossref(`works/${encodeURIComponent(doi)}`)
  const container = Array.isArray(message['container-title']) ? message['container-title'][0] : undefined
  const shortContainer = Array.isArray(message['short-container-title']) ? message['short-container-title'][0] : undefined
  const ids = splitIssns(message.ISSN)

  let journal: JournalLookupResult | null = null
  if (ids.issn) {
    try { journal = await lookupByIssn(ids.issn) } catch { journal = null }
  }

  return {
    name: journal?.name || (typeof container === 'string' ? container : typeof shortContainer === 'string' ? shortContainer : undefined),
    publisher: journal?.publisher || (typeof message.publisher === 'string' ? message.publisher : undefined),
    issn: journal?.issn || ids.issn,
    eissn: journal?.eissn || ids.eissn,
    sourceUrl: `https://doi.org/${doi}`,
    sourceLabel: 'Crossref DOI',
    note: '已从 DOI 识别所属期刊及基础出版信息。请核对期刊官网，并手动确认分区、APC 和审稿周期。',
  }
}

export function journalLookupHint(value: string) {
  if (extractDoi(value)) return '识别为 DOI'
  if (extractIssn(value)) return '识别为 ISSN'
  if (/^https?:\/\//i.test(value.trim())) return '普通网页无法可靠抓取；将作为期刊官网保存'
  return '请输入 DOI、doi.org 链接、ISSN 或期刊官网'
}

export async function lookupJournalMetadata(value: string): Promise<JournalLookupResult> {
  const input = value.trim()
  if (!input) throw new Error('请输入 DOI、ISSN 或期刊官网')

  const doi = extractDoi(input)
  if (doi) return lookupByDoi(doi)

  const issn = extractIssn(input)
  if (issn) return lookupByIssn(issn)

  if (/^https?:\/\//i.test(input)) {
    return {
      websiteUrl: input,
      sourceUrl: input,
      sourceLabel: '期刊官网',
      note: '已保存期刊官网。受浏览器跨域限制，普通网页不能可靠自动抓取；建议再粘贴该期刊 DOI 或 ISSN 识别基础信息。',
    }
  }

  throw new Error('未识别到有效 DOI、ISSN 或网址')
}