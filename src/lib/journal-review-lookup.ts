export interface JournalReviewLookupInput {
  journalName?: string | null
  websiteUrl?: string | null
  authorGuideUrl?: string | null
  submissionUrl?: string | null
  reviewSourceUrl?: string | null
}

export interface JournalReviewLookupResult {
  firstDecisionDays: number | null
  totalReviewDays: number | null
  acceptanceRate: number | null
  sourceUrl: string
  fetchedAt: string
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^::1$/,
  /\.local$/i,
]

function publicHttpUrl(value?: string | null) {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.username || url.password) return null
    if (PRIVATE_HOST_PATTERNS.some(pattern => pattern.test(url.hostname))) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function publisherMetricCandidates(value?: string | null) {
  const sourceUrl = publicHttpUrl(value)
  if (!sourceUrl) return []

  const candidates: string[] = []
  try {
    const url = new URL(sourceUrl)
    const host = url.hostname.toLocaleLowerCase()
    const scienceDirectMatch = url.pathname.match(/^\/journal\/([^/]+)/i)

    if ((host === 'sciencedirect.com' || host.endsWith('.sciencedirect.com')) && scienceDirectMatch) {
      const slug = scienceDirectMatch[1]
      candidates.push(`${url.protocol}//${url.host}/journal/${slug}/about/insights`)
    }

    const elsevierMatch = url.pathname.match(/^\/journals\/([^/]+)(?:\/|$)/i)
    if ((host === 'elsevier.com' || host.endsWith('.elsevier.com')) && elsevierMatch) {
      candidates.push(`https://www.sciencedirect.com/journal/${elsevierMatch[1]}/about/insights`)
    }
  } catch {
    // The URL has already passed validation; publisher expansion is optional.
  }

  candidates.push(sourceUrl)
  return candidates
}

function durationToDays(value: number, unit: string) {
  const normalized = unit.toLocaleLowerCase()
  if (/week/.test(normalized)) return Math.round(value * 7)
  if (/month/.test(normalized)) return Math.round(value * 30.4)
  return Math.round(value)
}

function extractDuration(text: string, labels: string[]) {
  for (const label of labels) {
    const forward = new RegExp(`${label}[^\\d]{0,120}(\\d+(?:\\.\\d+)?)\\s*(days?|weeks?|months?)`, 'i')
    const forwardMatch = text.match(forward)
    if (forwardMatch) return durationToDays(Number(forwardMatch[1]), forwardMatch[2])

    // Publisher insight pages commonly render “2 days” before the label on the next line.
    // Excluding intervening digits ensures the nearest metric is selected from a timeline list.
    const reverse = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(days?|weeks?|months?)[^\\d]{0,120}${label}`, 'i')
    const reverseMatch = text.match(reverse)
    if (reverseMatch) return durationToDays(Number(reverseMatch[1]), reverseMatch[2])
  }
  return null
}

function extractAcceptanceRate(text: string) {
  const patterns = [
    /acceptance\s+rate[^\d]{0,80}(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%[^\d%]{0,80}acceptance\s+rate/i,
    /录用率[^\d]{0,50}(\d+(?:\.\d+)?)\s*%/i,
    /接收率[^\d]{0,50}(\d+(?:\.\d+)?)\s*%/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const value = Number(match[1])
    if (Number.isFinite(value) && value >= 0 && value <= 100) return value
  }
  return null
}

function parseReviewMetrics(text: string) {
  // Collapse Markdown/HTML-reader line breaks so adjacent value-label pairs remain parseable.
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  const firstDecisionDays = extractDuration(normalized, [
    'submission\\s+to\\s+first\\s+(?:editorial\\s+)?decision',
    'time\\s+to\\s+first\\s+(?:editorial\\s+)?decision',
    'first\\s+(?:editorial\\s+)?decision',
    'first\\s+decision\\s+after\\s+review',
    '首轮决定',
    '首次决定',
  ])
  const totalReviewDays = extractDuration(normalized, [
    // “总审稿周期” is defined as submission-to-acceptance when the publisher exposes it.
    'submission\\s+to\\s+acceptance',
    'time\\s+to\\s+acceptance',
    'submission\\s+to\\s+decision\\s+after\\s+review',
    'submission\\s+to\\s+(?:final\\s+)?decision',
    'total\\s+review\\s+time',
    'peer\\s+review\\s+time',
    'review\\s+time',
    '总审稿周期',
    '审稿周期',
  ])
  return {
    firstDecisionDays,
    totalReviewDays,
    acceptanceRate: extractAcceptanceRate(normalized),
  }
}

async function readPublicPage(sourceUrl: string) {
  const readerUrl = `https://r.jina.ai/${sourceUrl}`
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(readerUrl, {
      headers: { Accept: 'text/plain' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`公开页面读取服务返回 ${response.status}`)
    const text = await response.text()
    if (!text.trim()) throw new Error('公开页面没有返回可解析内容')
    return text
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function lookupJournalReviewMetrics(input: JournalReviewLookupInput): Promise<JournalReviewLookupResult> {
  const candidates = Array.from(new Set([
    ...publisherMetricCandidates(input.reviewSourceUrl),
    ...publisherMetricCandidates(input.websiteUrl),
    ...publisherMetricCandidates(input.authorGuideUrl),
    ...publisherMetricCandidates(input.submissionUrl),
  ]))

  if (!candidates.length) {
    throw new Error('请先填写期刊官网、作者指南或审稿周期来源，再自动获取审稿周期。')
  }

  let lastError: unknown = null
  let readablePageCount = 0
  for (const sourceUrl of candidates.slice(0, 10)) {
    try {
      const text = await readPublicPage(sourceUrl)
      readablePageCount += 1
      const metrics = parseReviewMetrics(text)
      if (metrics.firstDecisionDays === null && metrics.totalReviewDays === null && metrics.acceptanceRate === null) continue
      return {
        ...metrics,
        sourceUrl,
        fetchedAt: new Date().toISOString(),
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof DOMException && lastError.name === 'AbortError' && readablePageCount === 0) {
    throw new Error('公开页面读取超时。可填写更直接的期刊 Insights 或指标页面后重试。')
  }
  throw new Error('已尝试期刊主页及可识别的出版社 Insights 页面，但未解析到首轮决定、投稿至接收周期或接收率。请检查来源链接是否为公开指标页。')
}
