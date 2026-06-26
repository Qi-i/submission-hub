import { useMemo, useState } from 'react'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import StatsTrendChart from './StatsTrendChart'

interface Props {
  papers: Paper[]
  currentUsername: string
  authorName: string
}

type Scale = 'month' | 'quarter' | 'year'
type Range = 'all' | '1y' | '3y' | '5y'
type TrendKey = 'cumSubmitted' | 'cumAccepted' | 'inProgress' | 'submitted' | 'accepted' | 'rejected'

const chartColors = ['#6366f1', '#0ea5e9', '#f59e0b', '#a855f7', '#22c55e', '#ef4444', '#64748b', '#ec4899', '#14b8a6', '#f97316']
const series = [
  { key: 'cumSubmitted' as TrendKey, label: '累积投稿', color: '#0891b2' },
  { key: 'cumAccepted' as TrendKey, label: '累积接收', color: '#22c55e' },
  { key: 'inProgress' as TrendKey, label: '进行中', color: '#f59e0b' },
  { key: 'submitted' as TrendKey, label: '当期投稿', color: '#3b82f6' },
  { key: 'accepted' as TrendKey, label: '当期接收', color: '#10b981' },
  { key: 'rejected' as TrendKey, label: '当期被拒', color: '#ef4444' },
]

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isFinite(date.getTime()) ? date : null
}

function pad(n: number) { return String(n).padStart(2, '0') }

function periodKey(date: Date, scale: Scale) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  if (scale === 'year') return `${y}`
  if (scale === 'quarter') return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
  return `${y}-${pad(m)}`
}

function periodStart(key: string, scale: Scale) {
  if (scale === 'year') return new Date(Number(key), 0, 1)
  if (scale === 'quarter') {
    const [y, q] = key.split('-Q')
    return new Date(Number(y), (Number(q) - 1) * 3, 1)
  }
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
}

function nextPeriod(date: Date, scale: Scale) {
  const next = new Date(date)
  if (scale === 'year') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + (scale === 'quarter' ? 3 : 1))
  return next
}

function cutoff(range: Range) {
  if (range === 'all') return null
  const d = new Date()
  d.setFullYear(d.getFullYear() - (range === '1y' ? 1 : range === '3y' ? 3 : 5))
  d.setHours(0, 0, 0, 0)
  return d
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip glass-panel"><span className="chart-tooltip-title">{label}</span><b style={{ marginLeft: 10 }}>{payload[0]?.value} 篇</b></div>
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip glass-panel"><span className="chart-tooltip-title">{payload[0]?.name}</span><b style={{ marginLeft: 10 }}>{payload[0]?.value} 篇</b></div>
}

export default function PersonalStatsStable({ papers, currentUsername, authorName }: Props) {
  const [scale, setScale] = useState<Scale>('month')
  const [range, setRange] = useState<Range>('all')
  const [visible, setVisible] = useState<Record<TrendKey, boolean>>({
    cumSubmitted: true,
    cumAccepted: true,
    inProgress: true,
    submitted: false,
    accepted: false,
    rejected: false,
  })

  const summary = useMemo(() => {
    const total = papers.length
    const accepted = papers.filter(p => p.status === 'accepted').length
    const rejected = papers.filter(p => p.status === 'rejected').length
    const inProgress = papers.filter(p => ['submitted', 'under_review', 'revision'].includes(p.status)).length
    const matchName = authorName || currentUsername
    const firstAuthor = papers.filter(p => p.authors?.[0] === matchName).length
    const corrAuthor = papers.filter(p => p.corresponding_author === matchName).length
    const collaborators = new Set(papers.flatMap(p => p.authors || [])).size
    const resolved = papers.filter(p => p.submitted_date && p.resolve_date)
    const avgDays = resolved.length ? Math.round(resolved.reduce((sum, p) => sum + Math.round((new Date(p.resolve_date!).getTime() - new Date(p.submitted_date!).getTime()) / 86400000), 0) / resolved.length) : 0
    const rate = total ? Math.round(accepted / total * 100) : 0
    return { total, accepted, rejected, inProgress, firstAuthor, corrAuthor, collaborators, avgDays, rate }
  }, [papers, currentUsername, authorName])

  const trendData = useMemo(() => {
    const dates = papers.flatMap(p => [parseDate(p.submitted_date), parseDate(p.resolve_date)]).filter(Boolean) as Date[]
    if (!dates.length) return []
    let cursor = periodStart(periodKey(new Date(Math.min(...dates.map(d => d.getTime()))), scale), scale)
    const end = periodStart(periodKey(new Date(Math.max(Date.now(), ...dates.map(d => d.getTime()))), scale), scale)
    const buckets: Record<string, { submitted: number; accepted: number; rejected: number }> = {}
    while (cursor <= end) {
      buckets[periodKey(cursor, scale)] = { submitted: 0, accepted: 0, rejected: 0 }
      cursor = nextPeriod(cursor, scale)
    }
    papers.forEach(p => {
      const submitted = parseDate(p.submitted_date)
      if (submitted) buckets[periodKey(submitted, scale)].submitted++
      const resolved = parseDate(p.resolve_date)
      if (resolved && (p.status === 'accepted' || p.status === 'rejected')) {
        const key = periodKey(resolved, scale)
        if (p.status === 'accepted') buckets[key].accepted++
        if (p.status === 'rejected') buckets[key].rejected++
      }
    })
    let cumSubmitted = 0, cumAccepted = 0, cumRejected = 0
    const startCut = cutoff(range)
    return Object.entries(buckets).map(([period, item]) => {
      cumSubmitted += item.submitted
      cumAccepted += item.accepted
      cumRejected += item.rejected
      return { period, periodDate: periodStart(period, scale), ...item, cumSubmitted, cumAccepted, cumRejected, inProgress: Math.max(0, cumSubmitted - cumAccepted - cumRejected) }
    }).filter(row => !startCut || row.periodDate >= startCut)
  }, [papers, scale, range])

  const statusData = useMemo(() => STATUSES.map(s => ({ name: `${s.emoji} ${s.label}`, value: papers.filter(p => p.status === s.key).length, color: s.color })).filter(d => d.value > 0), [papers])
  const journalData = useMemo(() => {
    const counts: Record<string, number> = {}
    papers.forEach(p => { if (p.journal) counts[p.journal] = (counts[p.journal] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, value], i) => ({ name, value, fill: chartColors[i % chartColors.length] }))
  }, [papers])

  if (papers.length === 0) return <div className="stats-panel"><div className="empty-state"><div className="empty-icon">📊</div><div className="empty-text">还没有投稿数据</div><div className="empty-sub">添加论文后即可查看统计分析</div></div></div>

  const cards = [
    { icon: '📄', bg: 'var(--accent-bg)', color: 'var(--accent)', value: summary.total, label: '论文总数' },
    { icon: '✅', bg: 'rgba(34,197,94,0.1)', color: '#22c55e', value: summary.accepted, label: '已接收' },
    { icon: '⏳', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', value: summary.inProgress, label: '进行中' },
    { icon: '🚫', bg: 'rgba(239,68,68,0.1)', color: '#ef4444', value: summary.rejected, label: '被拒' },
    { icon: '👤', bg: 'var(--purple-bg)', color: 'var(--purple)', value: summary.firstAuthor, label: '第一作者' },
    { icon: '✉', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', value: summary.corrAuthor, label: '通讯作者' },
    { icon: '👥', bg: 'var(--info-bg)', color: 'var(--info)', value: summary.collaborators, label: '合作者' },
    { icon: '⏱', bg: 'rgba(168,85,247,0.1)', color: '#a855f7', value: summary.avgDays, label: '平均审稿天数' },
    { icon: '🎯', bg: summary.rate >= 50 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: summary.rate >= 50 ? '#22c55e' : '#f59e0b', value: `${summary.rate}%`, label: '接收率' },
  ]

  return (
    <div className="stats-panel stats-panel-refined">
      <div className="stats-summary refined-summary">
        {cards.map((item, i) => <div key={item.label} className="summary-card glass-panel animate-in" style={{ animationDelay: `${i * 0.04}s` }}><div className="summary-icon" style={{ background: item.bg, color: item.color }}>{item.icon}</div><div><div className="summary-value" style={{ color: item.color }}>{item.value}</div><div className="summary-label">{item.label}</div></div></div>)}
      </div>

      {trendData.length > 0 && <div className="chart-card chart-card-hero trend-card-refined glass-panel animate-in">
        <div className="chart-header refined-chart-header">
          <div><h3 className="chart-title">投稿时间趋势</h3><p className="chart-subtitle">按统一时间尺度统计；累计线用平滑曲线，辅助线用虚线区分。</p></div>
          <div className="trend-controls"><div className="segmented-control"><button className={scale === 'month' ? 'active' : ''} onClick={() => setScale('month')}>月</button><button className={scale === 'quarter' ? 'active' : ''} onClick={() => setScale('quarter')}>季度</button><button className={scale === 'year' ? 'active' : ''} onClick={() => setScale('year')}>年</button></div><div className="segmented-control"><button className={range === 'all' ? 'active' : ''} onClick={() => setRange('all')}>全部</button><button className={range === '1y' ? 'active' : ''} onClick={() => setRange('1y')}>1年</button><button className={range === '3y' ? 'active' : ''} onClick={() => setRange('3y')}>3年</button><button className={range === '5y' ? 'active' : ''} onClick={() => setRange('5y')}>5年</button></div></div>
        </div>
        <div className="series-toggle-row">{series.map(s => <button key={s.key} className={visible[s.key] ? 'series-chip active' : 'series-chip'} onClick={() => setVisible(prev => ({ ...prev, [s.key]: !prev[s.key] }))}><span style={{ background: s.color }} />{s.label}</button>)}</div>
        <StatsTrendChart data={trendData} visible={visible} />
      </div>}

      <div className="charts-grid refined-charts-grid">
        {statusData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">状态分布</h3><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>{statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip content={<PieTooltip />} /></PieChart></ResponsiveContainer></div>}
        {journalData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">期刊分布 Top {journalData.length}</h3><ResponsiveContainer width="100%" height={260}><BarChart data={journalData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} /><XAxis type="number" allowDecimals={false} axisLine={false} /><YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false} /><Tooltip content={<BarTooltip />} /><Bar dataKey="value" name="论文数" radius={[0, 4, 4, 0]} barSize={18}>{journalData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>}
      </div>
    </div>
  )
}
