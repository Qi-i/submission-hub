import { useEffect, useMemo, useState } from 'react'
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
type StatsModule = 'overview' | 'process' | 'trend' | 'charts'

const chartColors = ['#6366f1', '#0ea5e9', '#f59e0b', '#a855f7', '#22c55e', '#ef4444', '#64748b', '#ec4899', '#14b8a6', '#f97316']
const moduleStorageKey = 'submission-hub-stats-modules'
const defaultModules: Record<StatsModule, boolean> = { overview: true, process: true, trend: true, charts: true }
const series = [
  { key: 'cumSubmitted' as TrendKey, label: '累积投稿', color: '#0891b2' },
  { key: 'cumAccepted' as TrendKey, label: '累积接收', color: '#22c55e' },
  { key: 'inProgress' as TrendKey, label: '进行中', color: '#f59e0b' },
  { key: 'submitted' as TrendKey, label: '当期投稿', color: '#3b82f6' },
  { key: 'accepted' as TrendKey, label: '当期接收', color: '#10b981' },
  { key: 'rejected' as TrendKey, label: '当期被拒', color: '#ef4444' },
]

function readModulePrefs(): Record<StatsModule, boolean> {
  try {
    const saved = localStorage.getItem(moduleStorageKey)
    if (!saved) return defaultModules
    return { ...defaultModules, ...JSON.parse(saved) }
  } catch {
    return defaultModules
  }
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isFinite(date.getTime()) ? date : null
}

function daysBetween(start?: string | null, end?: string | null) {
  const a = parseDate(start)
  const b = parseDate(end)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function daysSince(start?: string | null) {
  const a = parseDate(start)
  if (!a) return null
  return Math.max(0, Math.floor((Date.now() - a.getTime()) / 86400000))
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

function InsightCard({ label, value, hint, tone }: { label: string; value: string | number; hint: string; tone: string }) {
  return <div className="insight-card" data-tone={tone}><b>{value}</b><span>{label}</span><small>{hint}</small></div>
}

export default function PersonalStatsStable({ papers, currentUsername, authorName }: Props) {
  const [scale, setScale] = useState<Scale>('month')
  const [range, setRange] = useState<Range>('all')
  const [modules, setModules] = useState<Record<StatsModule, boolean>>(() => readModulePrefs())
  const [visible, setVisible] = useState<Record<TrendKey, boolean>>({
    cumSubmitted: true,
    cumAccepted: true,
    inProgress: true,
    submitted: false,
    accepted: false,
    rejected: false,
  })

  useEffect(() => {
    localStorage.setItem(moduleStorageKey, JSON.stringify(modules))
  }, [modules])

  const toggleModule = (key: StatsModule) => setModules(prev => ({ ...prev, [key]: !prev[key] }))
  const resetModules = () => setModules(defaultModules)

  const summary = useMemo(() => {
    const total = papers.length
    const accepted = papers.filter(p => p.status === 'accepted').length
    const rejected = papers.filter(p => p.status === 'rejected').length
    const revision = papers.filter(p => p.status === 'revision').length
    const inProgress = papers.filter(p => ['submitted', 'under_review', 'revision'].includes(p.status)).length
    const matchName = authorName || currentUsername
    const firstAuthor = papers.filter(p => p.authors?.[0] === matchName).length
    const corrAuthor = papers.filter(p => p.corresponding_author === matchName).length
    const acceptedRate = total ? Math.round(accepted / total * 100) : 0
    const rejectionRate = total ? Math.round(rejected / total * 100) : 0
    return { total, accepted, rejected, revision, inProgress, firstAuthor, corrAuthor, acceptedRate, rejectionRate }
  }, [papers, currentUsername, authorName])

  const processInsights = useMemo(() => {
    const resolvedDurations = papers.map(p => daysBetween(p.submitted_date, p.resolve_date)).filter((d): d is number => d !== null && d >= 0)
    const avgResolved = resolvedDurations.length ? Math.round(resolvedDurations.reduce((a, b) => a + b, 0) / resolvedDurations.length) : 0
    const maxResolved = resolvedDurations.length ? Math.max(...resolvedDurations) : 0
    const activePapers = papers.filter(p => ['submitted', 'under_review', 'revision'].includes(p.status))
    const activeDurations = activePapers.map(p => daysSince(p.submitted_date)).filter((d): d is number => d !== null)
    const avgActive = activeDurations.length ? Math.round(activeDurations.reduce((a, b) => a + b, 0) / activeDurations.length) : 0
    const longActive = activeDurations.filter(d => d >= 90).length
    const urgentRevision = papers.filter(p => p.status === 'revision' && p.deadline && (daysBetween(new Date().toISOString().slice(0, 10), p.deadline) ?? 999) <= 7).length
    return { avgResolved, maxResolved, avgActive, longActive, urgentRevision }
  }, [papers])

  const riskData = useMemo(() => {
    const buckets = [
      { name: '0–30天', value: 0, fill: '#22c55e' },
      { name: '31–90天', value: 0, fill: '#f59e0b' },
      { name: '90天以上', value: 0, fill: '#ef4444' },
    ]
    papers.filter(p => ['submitted', 'under_review', 'revision'].includes(p.status)).forEach(p => {
      const d = daysSince(p.submitted_date) || 0
      if (d <= 30) buckets[0].value++
      else if (d <= 90) buckets[1].value++
      else buckets[2].value++
    })
    return buckets.filter(b => b.value > 0)
  }, [papers])

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

  if (papers.length === 0) return <div className="stats-panel"><div className="empty-state"><div className="empty-icon">📊</div><div className="empty-text">还没有投稿数据</div><div className="empty-sub">添加论文后即可查看投稿统计</div></div></div>

  const cards = [
    { icon: '📄', bg: 'var(--accent-bg)', color: 'var(--accent)', value: summary.total, label: '投稿总数' },
    { icon: '✅', bg: 'rgba(34,197,94,0.1)', color: '#22c55e', value: summary.accepted, label: '已接收' },
    { icon: '⏳', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', value: summary.inProgress, label: '进行中' },
    { icon: '🔧', bg: 'rgba(168,85,247,0.1)', color: '#a855f7', value: summary.revision, label: '修回中' },
    { icon: '🚫', bg: 'rgba(239,68,68,0.1)', color: '#ef4444', value: summary.rejected, label: '被拒' },
    { icon: '👤', bg: 'var(--purple-bg)', color: 'var(--purple)', value: summary.firstAuthor, label: '第一作者' },
    { icon: '✉', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', value: summary.corrAuthor, label: '通讯作者' },
    { icon: '🎯', bg: summary.acceptedRate >= 50 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: summary.acceptedRate >= 50 ? '#22c55e' : '#f59e0b', value: `${summary.acceptedRate}%`, label: '接收率' },
    { icon: '⚠️', bg: 'rgba(239,68,68,0.1)', color: '#ef4444', value: `${summary.rejectionRate}%`, label: '拒稿率' },
  ]

  return (
    <div className="stats-panel stats-panel-refined">
      <div className="stats-visibility-bar">
        <div className="stats-visibility-title"><b>个人投稿统计</b><span>投稿过程、审稿周期、结果状态与作者角色</span></div>
        <div className="stats-visibility-controls">
          <button className={`stats-toggle-chip ${modules.overview ? 'active' : ''}`} onClick={() => toggleModule('overview')}>核心概览</button>
          <button className={`stats-toggle-chip ${modules.process ? 'active' : ''}`} onClick={() => toggleModule('process')}>过程指标</button>
          <button className={`stats-toggle-chip ${modules.trend ? 'active' : ''}`} onClick={() => toggleModule('trend')}>趋势图</button>
          <button className={`stats-toggle-chip ${modules.charts ? 'active' : ''}`} onClick={() => toggleModule('charts')}>分布图</button>
          <button className="stats-toggle-chip reset" onClick={resetModules}>恢复默认</button>
        </div>
      </div>

      {modules.overview && <div className="stats-summary refined-summary">
        {cards.map((item, i) => <div key={item.label} className="summary-card glass-panel animate-in" style={{ animationDelay: `${i * 0.04}s` }}><div className="summary-icon" style={{ background: item.bg, color: item.color }}>{item.icon}</div><div><div className="summary-value" style={{ color: item.color }}>{item.value}</div><div className="summary-label">{item.label}</div></div></div>)}
      </div>}

      {modules.process && <div className="process-insight-grid">
        <InsightCard label="已完结平均周期" value={`${processInsights.avgResolved}天`} hint="投稿至终审/接收/拒稿" tone="blue" />
        <InsightCard label="最长完结周期" value={`${processInsights.maxResolved}天`} hint="历史最长审稿链路" tone="purple" />
        <InsightCard label="进行中平均周期" value={`${processInsights.avgActive}天`} hint="当前未完结稿件" tone="orange" />
        <InsightCard label="90天以上进行中" value={processInsights.longActive} hint="建议重点跟踪" tone="red" />
        <InsightCard label="修回7天内截止" value={processInsights.urgentRevision} hint="需要优先处理" tone="red" />
      </div>}

      {modules.trend && trendData.length > 0 && <div className="chart-card chart-card-hero trend-card-refined glass-panel animate-in">
        <div className="chart-header refined-chart-header">
          <div><h3 className="chart-title">投稿时间趋势</h3><p className="chart-subtitle">按投稿、接收、拒稿和进行中数量统计。</p></div>
          <div className="trend-controls"><div className="segmented-control"><button className={scale === 'month' ? 'active' : ''} onClick={() => setScale('month')}>月</button><button className={scale === 'quarter' ? 'active' : ''} onClick={() => setScale('quarter')}>季度</button><button className={scale === 'year' ? 'active' : ''} onClick={() => setScale('year')}>年</button></div><div className="segmented-control"><button className={range === 'all' ? 'active' : ''} onClick={() => setRange('all')}>全部</button><button className={range === '1y' ? 'active' : ''} onClick={() => setRange('1y')}>1年</button><button className={range === '3y' ? 'active' : ''} onClick={() => setRange('3y')}>3年</button><button className={range === '5y' ? 'active' : ''} onClick={() => setRange('5y')}>5年</button></div></div>
        </div>
        <div className="series-toggle-row">{series.map(s => <button key={s.key} className={visible[s.key] ? 'series-chip active' : 'series-chip'} onClick={() => setVisible(prev => ({ ...prev, [s.key]: !prev[s.key] }))}><span style={{ background: s.color }} />{s.label}</button>)}</div>
        <StatsTrendChart data={trendData} visible={visible} />
      </div>}

      {modules.charts && <div className="charts-grid refined-charts-grid">
        {statusData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">投稿状态分布</h3><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>{statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip content={<PieTooltip />} /></PieChart></ResponsiveContainer></div>}
        {riskData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">进行中周期分布</h3><ResponsiveContainer width="100%" height={260}><BarChart data={riskData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip content={<BarTooltip />} /><Bar dataKey="value" name="论文数" radius={[6, 6, 0, 0]} barSize={42}>{riskData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>}
        {journalData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">投稿期刊分布 Top {journalData.length}</h3><ResponsiveContainer width="100%" height={260}><BarChart data={journalData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} /><XAxis type="number" allowDecimals={false} axisLine={false} /><YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false} /><Tooltip content={<BarTooltip />} /><Bar dataKey="value" name="论文数" radius={[0, 4, 4, 0]} barSize={18}>{journalData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>}
      </div>}
    </div>
  )
}
