const API_V2 = 'https://api.frankfurter.dev/v2/rate'
const API_V1 = 'https://api.frankfurter.dev/v1/latest'
const CACHE_PREFIX = 'submission-hub:fx:v3:'
const CACHE_TTL = 24 * 60 * 60 * 1000
const REQUEST_TIMEOUT = 8000

export type CnyConversion = {
  amount: number
  currency: string
  rate: number
  cny: number
  date: string
  stale: boolean
  source: 'v2' | 'v1' | 'cache'
}

type CachedRate = {
  rate: number
  date: string
  fetchedAt: number
  source: 'v2' | 'v1'
}

const requests = new Map<string, Promise<CachedRate | null>>()

function normalizeCurrency(currency?: string | null) {
  const value = (currency || '').trim().toUpperCase()
  if (value === 'RMB' || value === 'CNH') return 'CNY'
  return value
}

function cacheKey(currency: string) {
  return `${CACHE_PREFIX}${currency}:CNY`
}

function readCache(currency: string): CachedRate | null {
  try {
    const raw = localStorage.getItem(cacheKey(currency))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRate
    if (!Number.isFinite(parsed.rate) || parsed.rate <= 0 || !parsed.date || !Number.isFinite(parsed.fetchedAt)) return null
    return { ...parsed, source: parsed.source === 'v1' ? 'v1' : 'v2' }
  } catch {
    return null
  }
}

function writeCache(currency: string, value: CachedRate) {
  try {
    localStorage.setItem(cacheKey(currency), JSON.stringify(value))
  } catch {
    // 隐私模式或存储受限时仅跳过缓存，不影响本次换算。
  }
}

async function fetchJson(url: string) {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`FX ${response.status}`)
    return await response.json() as any
  } finally {
    globalThis.clearTimeout(timer)
  }
}

async function fetchV2(currency: string): Promise<CachedRate> {
  const payload = await fetchJson(`${API_V2}/${encodeURIComponent(currency)}/CNY`)
  const rate = Number(payload?.rate)
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid v2 FX response')
  return {
    rate,
    date: String(payload?.date || new Date().toISOString().slice(0, 10)),
    fetchedAt: Date.now(),
    source: 'v2',
  }
}

async function fetchV1(currency: string): Promise<CachedRate> {
  const payload = await fetchJson(`${API_V1}?base=${encodeURIComponent(currency)}&symbols=CNY`)
  const rate = Number(payload?.rates?.CNY)
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid v1 FX response')
  return {
    rate,
    date: String(payload?.date || new Date().toISOString().slice(0, 10)),
    fetchedAt: Date.now(),
    source: 'v1',
  }
}

async function fetchRate(currency: string): Promise<CachedRate | null> {
  const cached = readCache(currency)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached

  const existing = requests.get(currency)
  if (existing) return existing

  const request = (async () => {
    try {
      let next: CachedRate
      try {
        next = await fetchV2(currency)
      } catch {
        next = await fetchV1(currency)
      }
      writeCache(currency, next)
      return next
    } catch {
      return cached
    } finally {
      requests.delete(currency)
    }
  })()

  requests.set(currency, request)
  return request
}

export async function convertToCny(amount?: number | null, currency?: string | null): Promise<CnyConversion | null> {
  if (amount == null || !Number.isFinite(amount) || amount < 0) return null
  const normalized = normalizeCurrency(currency)
  if (!normalized) return null
  if (normalized === 'CNY') {
    return {
      amount,
      currency: normalized,
      rate: 1,
      cny: amount,
      date: new Date().toISOString().slice(0, 10),
      stale: false,
      source: 'cache',
    }
  }

  const rate = await fetchRate(normalized)
  if (!rate) return null
  const stale = Date.now() - rate.fetchedAt >= CACHE_TTL
  return {
    amount,
    currency: normalized,
    rate: rate.rate,
    cny: amount * rate.rate,
    date: rate.date,
    stale,
    source: stale ? 'cache' : rate.source,
  }
}

export function formatCny(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value)
}

export function formatForeignAmount(amount: number, currency?: string | null) {
  const code = normalizeCurrency(currency) || ''
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(amount)}${code ? ` ${code}` : ''}`
}
