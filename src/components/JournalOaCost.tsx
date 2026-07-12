import type { JournalProfile } from '../lib/preparation'
import CurrencyCny from './CurrencyCny'

interface Props {
  journal: Pick<JournalProfile, 'oa_type' | 'apc_amount' | 'apc_currency'>
  compact?: boolean
  className?: string
}

export default function JournalOaCost({ journal, compact = false, className = '' }: Props) {
  const amount = journal.apc_amount
  const currency = journal.apc_currency || 'USD'

  if (journal.oa_type === 'hybrid') {
    return <span className={`journal-oa-cost hybrid ${compact ? 'compact' : ''} ${className}`.trim()}>
      <span className="journal-oa-route subscription"><b>订阅路径</b><em>无 APC</em></span>
      <span className="journal-oa-separator">或</span>
      <span className="journal-oa-route open">
        <b>OA 路径</b>
        {amount == null
          ? <em>费用待核实</em>
          : amount === 0
            ? <em>无 APC</em>
            : <CurrencyCny amount={amount} currency={currency} compact={compact} />}
      </span>
    </span>
  }

  if (journal.oa_type === 'diamond') {
    return <span className={`journal-oa-cost diamond ${compact ? 'compact' : ''} ${className}`.trim()}>
      <span className="journal-oa-route open"><b>开放获取</b><em>无 APC</em></span>
    </span>
  }

  if (journal.oa_type === 'closed') {
    return <span className={`journal-oa-cost closed ${compact ? 'compact' : ''} ${className}`.trim()}>
      <span className="journal-oa-route subscription"><b>订阅制</b><em>通常无 APC</em></span>
    </span>
  }

  if (journal.oa_type === 'gold') {
    return <span className={`journal-oa-cost gold ${compact ? 'compact' : ''} ${className}`.trim()}>
      <span className="journal-oa-route open">
        <b>全 OA</b>
        {amount == null
          ? <em>费用待核实</em>
          : amount === 0
            ? <em>无 APC</em>
            : <CurrencyCny amount={amount} currency={currency} compact={compact} />}
      </span>
    </span>
  }

  return <span className={`journal-oa-cost unknown ${compact ? 'compact' : ''} ${className}`.trim()}>
    <span className="journal-oa-route"><b>OA / APC</b><em>{amount == null ? '待核实' : amount === 0 ? '无 APC' : ''}</em>{amount != null && amount > 0 && <CurrencyCny amount={amount} currency={currency} compact={compact} />}</span>
  </span>
}
