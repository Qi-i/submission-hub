import { useEffect, useState } from 'react'
import { convertToCny, formatCny, formatForeignAmount, type CnyConversion } from '../lib/exchange-rate'

interface Props {
  amount?: number | null
  currency?: string | null
  showOriginal?: boolean
  compact?: boolean
  className?: string
}

export default function CurrencyCny({ amount, currency, showOriginal = true, compact = false, className = '' }: Props) {
  const [conversion, setConversion] = useState<CnyConversion | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setConversion(null)
    if (amount == null || !Number.isFinite(amount) || amount < 0 || !(currency || '').trim()) return () => { active = false }
    setLoading(true)
    void convertToCny(amount, currency).then(result => {
      if (active) setConversion(result)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [amount, currency])

  if (amount == null || !Number.isFinite(amount) || amount < 0) return null
  const normalized = (currency || '').trim().toUpperCase()
  const original = formatForeignAmount(amount, normalized)

  return <span className={`currency-cny ${compact ? 'compact' : ''} ${className}`.trim()}>
    {showOriginal && <span className="currency-original">{original}</span>}
    {loading && normalized !== 'CNY' && <span className="currency-loading">换算中…</span>}
    {!loading && conversion && normalized !== 'CNY' && <span className="currency-estimate" title={`参考汇率：1 ${conversion.currency} = ${conversion.rate.toFixed(4)} CNY；汇率日期 ${conversion.date}${conversion.stale ? '；当前使用离线缓存' : ''}`}>
      ≈ {formatCny(conversion.cny)}
      {!compact && <small>{conversion.date}{conversion.stale ? ' 缓存' : ''}</small>}
    </span>}
    {!loading && conversion && normalized === 'CNY' && !showOriginal && <span className="currency-estimate">{formatCny(conversion.cny)}</span>}
    {!loading && !conversion && normalized && normalized !== 'CNY' && <span className="currency-unavailable" title="当前无法获取汇率，原始 APC 金额仍保留">人民币换算暂不可用</span>}
  </span>
}
