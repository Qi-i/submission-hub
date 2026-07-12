export type SelfCitationBasis = 'official-jcr' | 'official-scopus' | 'open-estimate' | 'manual'

export interface JournalPublicMetrics {
  annualPublicationCount: number | null
  annualPublicationYear: number | null
  annualPublicationSource: string | null
  selfCitationRate: number | null
  selfCitationBasis: SelfCitationBasis
  selfCitationSource: string | null
  reviewSource: string | null
  metricsUpdatedAt: string | null
}

const KEYS = {
  annualPublicationCount: 'metric_annual_publication_count',
  annualPublicationYear: 'metric_annual_publication_year',
  annualPublicationSource: 'metric_annual_publication_source',
  selfCitationRate: 'metric_self_citation_rate',
  selfCitationBasis: 'metric_self_citation_basis',
  selfCitationSource: 'metric_self_citation_source',
  reviewSource: 'metric_review_source',
  metricsUpdatedAt: 'metric_updated_at',
} as const

export const SELF_CITATION_BASIS_OPTIONS: { key: SelfCitationBasis; label: string }[] = [
  { key: 'official-jcr', label: 'JCR 正式值' },
  { key: 'official-scopus', label: 'Scopus 正式值' },
  { key: 'open-estimate', label: '开放数据估算' },
  { key: 'manual', label: '人工录入' },
]

const numberValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const textValue = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null

export function readJournalPublicMetrics(rankData?: Record<string, string> | null): JournalPublicMetrics {
  const data = rankData || {}
  const basis = textValue(data[KEYS.selfCitationBasis]) as SelfCitationBasis | null
  return {
    annualPublicationCount: numberValue(data[KEYS.annualPublicationCount]),
    annualPublicationYear: numberValue(data[KEYS.annualPublicationYear]),
    annualPublicationSource: textValue(data[KEYS.annualPublicationSource]),
    selfCitationRate: numberValue(data[KEYS.selfCitationRate]),
    selfCitationBasis: SELF_CITATION_BASIS_OPTIONS.some(option => option.key === basis) ? basis! : 'manual',
    selfCitationSource: textValue(data[KEYS.selfCitationSource]),
    reviewSource: textValue(data[KEYS.reviewSource]),
    metricsUpdatedAt: textValue(data[KEYS.metricsUpdatedAt]),
  }
}

function setOrDelete(target: Record<string, string>, key: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') delete target[key]
  else target[key] = String(value)
}

export function writeJournalPublicMetrics(
  rankData: Record<string, string> | null | undefined,
  metrics: Partial<JournalPublicMetrics>,
): Record<string, string> {
  const next = { ...(rankData || {}) }
  if ('annualPublicationCount' in metrics) setOrDelete(next, KEYS.annualPublicationCount, metrics.annualPublicationCount)
  if ('annualPublicationYear' in metrics) setOrDelete(next, KEYS.annualPublicationYear, metrics.annualPublicationYear)
  if ('annualPublicationSource' in metrics) setOrDelete(next, KEYS.annualPublicationSource, metrics.annualPublicationSource)
  if ('selfCitationRate' in metrics) setOrDelete(next, KEYS.selfCitationRate, metrics.selfCitationRate)
  if ('selfCitationBasis' in metrics) setOrDelete(next, KEYS.selfCitationBasis, metrics.selfCitationBasis)
  if ('selfCitationSource' in metrics) setOrDelete(next, KEYS.selfCitationSource, metrics.selfCitationSource)
  if ('reviewSource' in metrics) setOrDelete(next, KEYS.reviewSource, metrics.reviewSource)
  if ('metricsUpdatedAt' in metrics) setOrDelete(next, KEYS.metricsUpdatedAt, metrics.metricsUpdatedAt)
  return next
}

function normalizeIssn(value?: string | null) {
  const compact = (value || '').replace(/[^\dXx]/g, '').toUpperCase()
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : null
}

type CrossrefCountResponse = {
  message?: {
    'total-results'?: number
  }
}

async function fetchCrossrefCount(issn: string, year: number) {
  const filter = `from-pub-date:${year}-01-01,until-pub-date:${year}-12-31,type:journal-article`
  const url = `https://api.crossref.org/journals/${encodeURIComponent(issn)}/works?filter=${encodeURIComponent(filter)}&rows=0&mailto=submission-hub@example.invalid`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 9000)
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    if (!response.ok) throw new Error(`Crossref 返回 ${response.status}`)
    const payload = await response.json() as CrossrefCountResponse
    const count = Number(payload.message?.['total-results'])
    if (!Number.isFinite(count) || count < 0) throw new Error('Crossref 未返回可用的发文量统计')
    return { count: Math.round(count), sourceUrl: url }
  } finally {
    clearTimeout(timeout)
  }
}

export async function lookupAnnualPublicationVolume(input: {
  issn?: string | null
  eissn?: string | null
  year?: number | null
}) {
  const currentYear = new Date().getFullYear()
  const year = Math.max(1900, Math.min(currentYear, Math.round(input.year || currentYear - 1)))
  const candidates = Array.from(new Set([normalizeIssn(input.issn), normalizeIssn(input.eissn)].filter(Boolean))) as string[]
  if (!candidates.length) throw new Error('请先填写 ISSN 或 EISSN，再获取公开年发文量。')

  let lastError: unknown = null
  for (const issn of candidates) {
    try {
      const result = await fetchCrossrefCount(issn, year)
      return {
        annualPublicationCount: result.count,
        annualPublicationYear: year,
        annualPublicationSource: result.sourceUrl,
        metricsUpdatedAt: new Date().toISOString(),
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('公开年发文量获取失败，请稍后重试。')
}

export function selfCitationBasisLabel(value: SelfCitationBasis) {
  return SELF_CITATION_BASIS_OPTIONS.find(option => option.key === value)?.label || '人工录入'
}
