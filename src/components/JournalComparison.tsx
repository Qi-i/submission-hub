import { useMemo, useState } from 'react'
import { ExternalLink, Scale, X } from 'lucide-react'
import { journalPrimarySummary, type RankedJournalProfile } from '../lib/journal-display'
import type { JournalProfile } from '../lib/preparation'
import { OA_OPTIONS } from '../lib/preparation'

interface Props {
  journals: JournalProfile[]
  initialIds?: string[]
  onEdit: (journal: JournalProfile) => void
}

type Row = {
  label: string
  value: (journal: JournalProfile) => string
  numeric?: (journal: JournalProfile) => number | null
  preference?: 'lower' | 'higher'
}

const rows: Row[] = [
  { label: '主要分区 / 核心收录', value: journal => journalPrimarySummary(journal as RankedJournalProfile, 5) },
  { label: 'JCR 分区', value: journal => journal.jcr_quartile || '未定' },
  { label: '中科院分区', value: journal => journal.cas_quartile || '未定' },
  { label: '影响因子', value: journal => journal.impact_factor == null ? '未知' : String(journal.impact_factor), numeric: journal => journal.impact_factor, preference: 'higher' },
  { label: '开放获取', value: journal => OA_OPTIONS.find(option => option.key === journal.oa_type)?.label || '未确认' },
  { label: 'APC', value: journal => journal.oa_type === 'diamond' || journal.apc_amount === 0 ? '无 APC' : journal.apc_amount == null ? '未知' : `${journal.apc_amount} ${journal.apc_currency || ''}`.trim(), numeric: journal => journal.oa_type === 'diamond' ? 0 : journal.apc_amount, preference: 'lower' },
  { label: '首轮决定', value: journal => journal.first_decision_days == null ? '未知' : `${journal.first_decision_days} 天`, numeric: journal => journal.first_decision_days, preference: 'lower' },
  { label: '总审稿周期', value: journal => journal.total_review_days == null ? '未知' : `${journal.total_review_days} 天`, numeric: journal => journal.total_review_days, preference: 'lower' },
  { label: '接收率', value: journal => journal.acceptance_rate == null ? '未知' : `${journal.acceptance_rate}%`, numeric: journal => journal.acceptance_rate, preference: 'higher' },
  { label: '数据库收录', value: journal => journal.indexing.length ? journal.indexing.join('、') : '未记录' },
  { label: '风险状态', value: journal => journal.risk_level === 'warning' ? '预警 / 谨慎' : journal.risk_level === 'watch' ? '关注' : '正常' },
  { label: '学科标签', value: journal => journal.subject_tags.length ? journal.subject_tags.join('、') : '未记录' },
  { label: '期刊范围', value: journal => journal.scope || '未记录' },
]

function bestIds(selected: JournalProfile[], row: Row) {
  if (!row.numeric || !row.preference) return new Set<string>()
  const values = selected.map(journal => ({ id: journal.id, value: row.numeric!(journal) })).filter((item): item is { id: string; value: number } => item.value !== null && Number.isFinite(item.value))
  if (values.length < 2) return new Set<string>()
  const best = row.preference === 'lower' ? Math.min(...values.map(item => item.value)) : Math.max(...values.map(item => item.value))
  return new Set(values.filter(item => item.value === best).map(item => item.id))
}

export default function JournalComparison({ journals, initialIds, onEdit }: Props) {
  const defaultIds = initialIds?.filter(id => journals.some(journal => journal.id === id)).slice(0, 4)
    || journals.filter(journal => journal.is_favorite).slice(0, 3).map(journal => journal.id)
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds)
  const selected = useMemo(() => selectedIds.map(id => journals.find(journal => journal.id === id)).filter((journal): journal is JournalProfile => !!journal), [journals, selectedIds])

  const toggle = (id: string) => {
    setSelectedIds(previous => {
      if (previous.includes(id)) return previous.filter(item => item !== id)
      if (previous.length >= 4) {
        alert('最多同时比较 4 本期刊。')
        return previous
      }
      return [...previous, id]
    })
  }

  return <section className="journal-compare">
    <div className="journal-compare-head">
      <div><h2><Scale size={17} /> 期刊横向比较</h2><p>中文期刊优先比较核心与收录体系，英文期刊优先比较新锐、中科院、JCR 与影响因子。</p></div>
      {selectedIds.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>清空选择</button>}
    </div>

    <div className="journal-compare-picker">
      {journals.map(journal => <label key={journal.id} className={selectedIds.includes(journal.id) ? 'selected' : ''}><input type="checkbox" checked={selectedIds.includes(journal.id)} onChange={() => toggle(journal.id)} /><span>{journal.name}</span><em>{journalPrimarySummary(journal as RankedJournalProfile, 3)}</em></label>)}
      {!journals.length && <div className="prep-empty"><span>期刊库为空，请先收藏目标期刊。</span></div>}
    </div>

    {selected.length > 0 && <div className="journal-compare-table-wrap"><table className="journal-compare-table">
      <thead><tr><th>比较项目</th>{selected.map(journal => <th key={journal.id}><div><button onClick={() => onEdit(journal)}>{journal.name}</button><button className="compare-remove" onClick={() => toggle(journal.id)} title="移出比较"><X size={12} /></button></div><small>{journal.publisher || '未记录出版社'}</small><div className="compare-links">{journal.website_url && <a href={journal.website_url} target="_blank" rel="noopener noreferrer">官网 <ExternalLink size={10} /></a>}{journal.submission_url && <a href={journal.submission_url} target="_blank" rel="noopener noreferrer">投稿 <ExternalLink size={10} /></a>}</div></th>)}</tr></thead>
      <tbody>{rows.map(row => {
        const best = bestIds(selected, row)
        return <tr key={row.label}><th>{row.label}</th>{selected.map(journal => <td key={journal.id} className={best.has(journal.id) ? 'best' : ''}>{row.value(journal)}{best.has(journal.id) && <span className="compare-best">较优</span>}</td>)}</tr>
      })}</tbody>
    </table></div>}

    {selected.length === 0 && journals.length > 0 && <div className="journal-compare-empty"><Scale size={34} /><b>选择 2–4 本期刊开始比较</b><span>建议优先比较同一研究方向下的主投与备选期刊。</span></div>}
  </section>
}
