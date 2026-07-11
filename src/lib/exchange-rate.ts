const API_BASE = 'https://api.frankfurter.dev/v2/rate'
const CACHE_PREFIX = 'submission-hub:fx:v2:'
const CACHE_TTL = 24 * 60 * 60 * 1000

export type CnyConversion = {
  amount: number
  currency: string
  rate: number
  cny: number
  date: string
  stale: boolean
}

type CachedRate = {
  rate: number
  date: string
  fetchedAt: number
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
    return parsed
  } catch {
    return null
  }
}

function writeCache(currency: string, value: CachedRate) {
  try {
    localStorage.setItem(cacheKey(currency), JSON.stringify(value))
  } catch {
    // Storage may be unavailable in privacy mode. The current conversion still works.
  }
}

async function fetchRate(currency: string): Promise<CachedRate | null> {
  const cached = readCache(currency)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached

  const existing = requests.get(currency)
  if (existing) return existing

  const request = (async () => {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(currency)}/CNY`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`FX ${response.status}`)
      const payload = await response.json() as { rate?: number; date?: string }
      if (!Number.isFinite(payload.rate) || Number(payload.rate) <= 0) throw new Error('Invalid FX response')
      const next: CachedRate = {
        rate: Number(payload.rate),
        date: payload.date || new Date().toISOString().slice(0, 10),
        fetchedAt: Date.now(),
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
    }
  }

  const rate = await fetchRate(normalized)
  if (!rate) return null
  return {
    amount,
    currency: normalized,
    rate: rate.rate,
    cny: amount * rate.rate,
    date: rate.date,
    stale: Date.now() - rate.fetchedAt >= CACHE_TTL,
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
