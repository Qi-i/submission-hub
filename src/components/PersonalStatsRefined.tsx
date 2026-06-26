import { useMemo, useState } from 'react'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line, ResponsiveContainer, Brush,
} from 'recharts'

interface Props {
  papers: Paper[]
  currentUsername: string
  authorName: string
}

type TrendScale = 'month' | 'quarter' | 'year'
type TrendRange = 'all' | '1y' | '3y' | '5y'
type TrendKey = 'cumSubmitted' | 'cumAccepted' | 'inProgress' | 'submitted' | 'accepted' | 'rejected'

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const CHART_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#a855f7', '#22c55e', '#ef4444', '#64748b', '#ec4899', '#14b8a6', '#f97316']
const SERIES: { key: TrendKey; label: string; color: string; cumulative?: boolean }[] = [
  { key: 'cumSubmitted', label: '累积投稿', color: '#0891b2', cumulative: true },
  { key: 'cumAccepted', label: '累积接收', color: '#22c55e', cumulative: true },
  { key: 'inProgress', label: '进行中', color: '#f59e0b', cumulative: true },
  { key: 'submitted', label: '当期投稿', color: '#3b82f6' },
  { key: 'accepted', label: '当期接收', color: '#10b981' },
  { key: 'rejected', label: '当期被拒', color: '#ef4444' },
]

function parseDate(d?: string | null) {
  if (!d) return null
  const dt = new Date(`${d}T00:00:00`)
  return Number.isFinite(dt.getTime()) ? dt : null
}

function pad(n: number) { return String(n).padStart(2, '0') }
function periodKey(date: Date, scale: TrendScale) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  if (scale === 'year') return `${y}`
  if (scale === 'quarter') return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
  return `${y}-${pad(m)}`
}
function periodStart(key: string, scale: TrendScale) {
  if (scale === 'year') return new Date(Number(key), 0, 1)
  if (scale === 'quarter') {
    const [y, q] = key.split('-Q')
    return new Date(Number(y), (Number(q) - 1) * 3, 1)
  }
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
}
function nextPeriod(date: Date, scale: TrendScale) {
  const d = new Date(date)
  if (scale === 'year') d.setFullYear(d.getFullYear() + 1)
  else if (scale === 'quarter') d.setMonth(d.getMonth() + 3)
  else d.setMonth(d.getMonth() + 1)
  return d
}
function rangeCutoff(range: TrendRange) {
  if (range === 'all') return null
  const d = new Date()
  const years = range === '1y' ? 1 : range === '3y' ? 3 : 5
  d.setFullYear(d.getFullYear() - years)
  d.setHours(0, 0, 0, 0)
  return d
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip glass-panel">
      <div className="chart-tooltip-title">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="chart-tooltip-row"><span style={{ color: p.color }}>{p.name}</span><b>{p.value}</b></div>
      ))}
    </div>
  )
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip glass-panel"><span className="chart-tooltip-title">{label}</span><b style={{ marginLeft: 10 }}>{payload[0]?.value} 篇</b></div>
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip glass-panel"><span className="chart-tooltip-title">{payload[0]?.name}</span><b style={{ marginLeft: 10 }}>{payload[0]?.value} 篇</b></div>
}

export default function PersonalStatsRefined({ papers, currentUsername, authorName }: Props) {
  const [trendScale, setTrendScale] = useState<TrendScale>('month')
  const [trendRange, setTrendRange] = useState<TrendRange>('all')
  const [visibleSeries, setVisibleSeries] = useState<Record<TrendKey, boolean>>({
    cumSubmitted: true,
    cumAccepted: true,
    inProgress: true,
    submitted: false,
    accepted: false,
    rejected: false,
  })

  const toggleSeries = (key: TrendKey) => setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }))

  const statusData = useMemo(() => STATUSES.map(s => ({ name: `${s.emoji} ${s.label}`, value: papers.filter(p => p.status === s.key).length, color: s.color })).filter(d => d.value > 0), [papers])

  const jcrData = useMemo(() => {
    const counts: Record<string, number> = {}
    papers.filter(p => p.lang === 'en' && p.quartile_jcr && p.quartile_jcr !== '未定').forEach(p => { counts[p.quartile_jcr!] = (counts[p.quartile_jcr!] || 0) + 1 })
    return ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({ name: q, value: counts[q] || 0, fill: q === 'Q1' ? '#ef4444' : q === 'Q2' ? '#f59e0b' : q === 'Q3' ? '#0ea5e9' : '#64748b' })).filter(d => d.value > 0)
  }, [papers])

  const casData = useMemo(() => {
    const counts: Record<string, number> = {}
    papers.filter(p => p.lang === 'en' && p.quartile_cas && p.quartile_cas !== '未定').forEach(p => { counts[p.quartile_cas!] = (counts[p.quartile_cas!] || 0) + 1 })
    return ['一区', '二区', '三区', '四区', '预警'].map(q => ({ name: q, value: counts[q] || 0, fill: q === '一区' ? '#ef4444' : q === '二区' ? '#f59e0b' : q === '三区' ? '#0ea5e9' : q === '四区' ? '#64748b' : '#dc2626' })).filter(d => d.value > 0)
  }, [papers])

  const authorData = useMemo(() => {
    const matchName = authorName || currentUsername
    const counts: Record<string, number> = {}
    papers.forEach(p => (p.authors || []).forEach(a => { counts[a] = (counts[a] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count], i) => ({ name, value: count, fill: name === matchName ? cssVar('--accent') || '#0891b2' : CHART_COLORS[i % CHART_COLORS.length] }))
  }, [papers, currentUsername, authorName])

  const journalData = useMemo(() => {
    const counts: Record<string, number> = {}
    papers.forEach(p => { if (p.journal) counts[p.journal] = (counts[p.journal] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count], i) => ({ name, value: count, fill: CHART_COLORS[i % CHART_COLORS.length] }))
  }, [papers])

  const zhCategoryData = useMemo(() => {
    const counts: Record<string, number> = {}
    papers.filter(p => p.lang === 'zh' && p.quartile_zh).forEach(p => (p.quartile_zh || []).filter(Boolean).forEach(c => { counts[c] = (counts[c] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count], i) => ({ name, value: count, fill: CHART_COLORS[i % CHART_COLORS.length] }))
  }, [papers])

  const trendData = useMemo(() => {
    const activityDates = papers.flatMap(p => [parseDate(p.submitted_date), parseDate(p.resolve_date)]).filter(Boolean) as Date[]
    if (!activityDates.length) return []
    const min = new Date(Math.min(...activityDates.map(d => d.getTime())))
    const max = new Date(Math.max(Date.now(), ...activityDates.map(d => d.getTime())))
    let cursor = periodStart(periodKey(min, trendScale), trendScale)
    const end = periodStart(periodKey(max, trendScale), trendScale)
    const buckets: Record<string, { submitted: number; accepted: number; rejected: number }> = {}
    while (cursor <= end) {
      buckets[periodKey(cursor, trendScale)] = { submitted: 0, accepted: 0, rejected: 0 }
      cursor = nextPeriod(cursor, trendScale)
    }
    papers.forEach(p => {
      const submitted = parseDate(p.submitted_date)
      if (submitted) buckets[periodKey(submitted, trendScale)].submitted++
      const resolved = parseDate(p.resolve_date)
      if (resolved && (p.status === 'accepted' || p.status === 'rejected')) {
        const key = periodKey(resolved, trendScale)
        if (p.status === 'accepted') buckets[key].accepted++
        if (p.status === 'rejected') buckets[key].rejected++
      }
    })
    let cumSubmitted = 0, cumAccepted = 0, cumRejected = 0
    const cutoff = rangeCutoff(trendRange)
    return Object.entries(buckets).map(([period, entry]) => {
      cumSubmitted += entry.submitted
      cumAccepted += entry.accepted
      cumRejected += entry.rejected
      return { period, periodDate: periodStart(period, trendScale), ...entry, cumSubmitted, cumAccepted, cumRejected, inProgress: Math.max(0, cumSubmitted - cumAccepted - cumRejected) }
    }).filter(row => !cutoff || row.periodDate >= cutoff)
  }, [papers, trendScale, trendRange])

  const summary = useMemo(() => {
    const total = papers.length
    const accepted = papers.filter(p => p.status === 'accepted').length
    const rejected = papers.filter(p => p.status === 'rejected').length
    const inProgress = papers.filter(p => ['submitted', 'under_review', 'revision'].includes(p.status)).length
    const matchName = authorName || currentUsername
    const firstAuthor = papers.filter(p => p.authors?.[0] === matchName).length
    const corrAuthor = papers.filter(p => p.corresponding_author === matchName).length
    const collaborators = new Set(papers.flatMap(p => p.authors || [])).size
    const journals = new Set(papers.map(p => p.journal).filter(Boolean)).size
    const avgDays = (() => {
      const resolved = papers.filter(p => p.submitted_date && p.resolve_date)
      if (!resolved.length) return 0
      return Math.round(resolved.reduce((sum, p) => sum + Math.round((new Date(p.resolve_date!).getTime() - new Date(p.submitted_date!).getTime()) / 86400000), 0) / resolved.length)
    })()
    const rate = total > 0 ? Math.round(accepted / total * 100) : 0
    return { total, accepted, rejected, inProgress, firstAuthor, corrAuthor, collaborators, journals, avgDays, rate }
  }, [papers, currentUsername, authorName])

  const gridColor = cssVar('--border-subtle') || '#eee'
  const mutedColor = cssVar('--text-muted') || '#999'

  if (papers.length === 0) {
    return <div className="stats-panel"><div className="empty-state"><div className="empty-icon">📊</div><div className="empty-text">还没有投稿数据</div><div className="empty-sub">添加论文后即可查看统计分析</div></div></div>
  }

  return (
    <div className="stats-panel stats-panel-refined">
      <div className="stats-summary refined-summary">
        {[
          { icon: '📄', bg: 'var(--accent-bg)', color: 'var(--accent)', value: summary.total, label: '论文总数' },
          { icon: '✅', bg: 'rgba(34,197,94,0.1)', color: '#22c55e', value: summary.accepted, label: '已接收' },
          { icon: '⏳', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', value: summary.inProgress, label: '进行中' },
          { icon: '🚫', bg: 'rgba(239,68,68,0.1)', color: '#ef4444', value: summary.rejected, label: '被拒' },
          { icon: '👤', bg: 'var(--purple-bg)', color: 'var(--purple)', value: summary.firstAuthor, label: '第一作者' },
          { icon: '✉', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', value: summary.corrAuthor, label: '通讯作者' },
          { icon: '👥', bg: 'var(--info-bg)', color: 'var(--info)', value: summary.collaborators, label: '合作者' },
          { icon: '📰', bg: 'rgba(8,145,178,0.1)', color: '#0891b2', value: summary.journals, label: '涉及期刊' },
          { icon: '⏱', bg: 'rgba(168,85,247,0.1)', color: '#a855f7', value: summary.avgDays, label: '平均审稿天数' },
          { icon: '🎯', bg: summary.rate >= 50 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: summary.rate >= 50 ? '#22c55e' : '#f59e0b', value: summary.total > 0 ? `${summary.rate}%` : '—', label: '接收率' },
        ].map((item, i) => <div key={item.label} className="summary-card glass-panel animate-in" style={{ animationDelay: `${i * 0.04}s` }}><div className="summary-icon" style={{ background: item.bg, color: item.color }}>{item.icon}</div><div><div className="summary-value" style={{ color: item.color }}>{item.value}</div><div className="summary-label">{item.label}</div></div></div>)}
      </div>

      {trendData.length > 0 && <div className="chart-card chart-card-hero trend-card-refined glass-panel animate-in">
        <div className="chart-header refined-chart-header">
          <div><h3 className="chart-title">投稿时间趋势</h3><p className="chart-subtitle">按统一时间尺度统计，折线采用直线连接，避免自然曲线造成异常折点。</p></div>
          <div className="trend-controls">
            <div className="segmented-control"><button className={trendScale === 'month' ? 'active' : ''} onClick={() => setTrendScale('month')}>月</button><button className={trendScale === 'quarter' ? 'active' : ''} onClick={() => setTrendScale('quarter')}>季度</button><button className={trendScale === 'year' ? 'active' : ''} onClick={() => setTrendScale('year')}>年</button></div>
            <div className="segmented-control"><button className={trendRange === 'all' ? 'active' : ''} onClick={() => setTrendRange('all')}>全部</button><button className={trendRange === '1y' ? 'active' : ''} onClick={() => setTrendRange('1y')}>1年</button><button className={trendRange === '3y' ? 'active' : ''} onClick={() => setTrendRange('3y')}>3年</button><button className={trendRange === '5y' ? 'active' : ''} onClick={() => setTrendRange('5y')}>5年</button></div>
          </div>
        </div>
        <div className="series-toggle-row">{SERIES.map(s => <button key={s.key} className={visibleSeries[s.key] ? 'series-chip active' : 'series-chip'} onClick={() => toggleSeries(s.key)}><span style={{ background: s.color }} />{s.label}</button>)}</div>
        <ResponsiveContainer width="100%" height={390}>
          <LineChart data={trendData} margin={{ top: 12, right: 22, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: mutedColor }} axisLine={false} tickLine={false} minTickGap={18} />
            <YAxis tick={{ fontSize: 11, fill: mutedColor }} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip content={<TrendTooltip />} />
            <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
            {SERIES.filter(s => visibleSeries[s.key]).map(s => <Line key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={s.cumulative ? 2.8 : 2} dot={false} activeDot={{ r: 5, stroke: s.color, strokeWidth: 2, fill: '#fff' }} />)}
            <Brush dataKey="period" height={30} stroke="#0891b2" fill="var(--bg-glass)" travellerWidth={10} />
          </LineChart>
        </ResponsiveContainer>
      </div>}

      <div className="charts-grid refined-charts-grid">
        {statusData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">状态分布</h3><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>{statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip content={<PieTooltip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>}
        {journalData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">期刊分布 Top {journalData.length}</h3><ResponsiveContainer width="100%" height={260}><BarChart data={journalData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} /><XAxis type="number" tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: mutedColor }} width={120} axisLine={false} tickLine={false} /><Tooltip content={<BarTooltip />} /><Bar dataKey="value" name="论文数" radius={[0, 4, 4, 0]} barSize={18}>{journalData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>}
        {jcrData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">JCR 分区分布</h3><ResponsiveContainer width="100%" height={260}><BarChart data={jcrData}><CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: mutedColor }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip content={<BarTooltip />} /><Bar dataKey="value" name="论文数" radius={[6, 6, 0, 0]} barSize={36}>{jcrData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>}
        {casData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">中科院分区分布</h3><ResponsiveContainer width="100%" height={260}><BarChart data={casData}><CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: mutedColor }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip content={<BarTooltip />} /><Bar dataKey="value" name="论文数" radius={[6, 6, 0, 0]} barSize={36}>{casData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>}
        {authorData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">作者合作分布</h3><ResponsiveContainer width="100%" height={300}><BarChart data={authorData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} /><XAxis type="number" tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: mutedColor }} width={100} axisLine={false} tickLine={false} /><Tooltip content={<BarTooltip />} /><Bar dataKey="value" name="论文数" radius={[0, 4, 4, 0]} barSize={18}>{authorData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>}
        {zhCategoryData.length > 0 && <div className="chart-card glass-panel"><h3 className="chart-title">中文期刊分类</h3><ResponsiveContainer width="100%" height={260}><BarChart data={zhCategoryData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} /><XAxis type="number" tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: mutedColor }} width={120} axisLine={false} tickLine={false} /><Tooltip content={<BarTooltip />} /><Bar dataKey="value" name="论文数" radius={[0, 4, 4, 0]} barSize={18}>{zhCategoryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>}
      </div>
    </div>
  )
}
