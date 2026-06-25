import { useMemo } from 'react'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area, ResponsiveContainer, Brush,
} from 'recharts'

interface Props {
  papers: Paper[]
  currentUsername: string
  authorName: string
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const CHART_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#a855f7', '#22c55e', '#ef4444', '#64748b', '#ec4899', '#14b8a6', '#f97316']

// Custom tooltip for time trend chart
function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const bg = cssVar('--bg-card') || '#fff'
  const border = cssVar('--border-default') || '#eee'
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 10,
      padding: '10px 14px', fontSize: 12, minWidth: 140,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 800, marginBottom: 6, color: cssVar('--text-primary') }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '2px 0' }}>
          <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>
          <span style={{ fontWeight: 800, fontFamily: 'monospace' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// Custom tooltip for bar charts
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const bg = cssVar('--bg-card') || '#fff'
  const border = cssVar('--border-default') || '#eee'
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 8,
      padding: '6px 12px', fontSize: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      <span style={{ fontWeight: 700, color: cssVar('--text-primary') }}>{label}</span>
      <span style={{ fontWeight: 800, marginLeft: 10, fontFamily: 'monospace', color: payload[0]?.fill || cssVar('--accent') }}>
        {payload[0]?.value} 篇
      </span>
    </div>
  )
}

// Custom tooltip for pie chart
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const bg = cssVar('--bg-card') || '#fff'
  const border = cssVar('--border-default') || '#eee'
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 8,
      padding: '6px 12px', fontSize: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      <span style={{ fontWeight: 700 }}>{payload[0]?.name}</span>
      <span style={{ fontWeight: 800, marginLeft: 10, fontFamily: 'monospace' }}>{payload[0]?.value} 篇</span>
    </div>
  )
}

export default function PersonalStats({ papers, currentUsername, authorName }: Props) {
  // ── Status distribution for pie chart ──
  const statusData = useMemo(() => {
    return STATUSES.map(s => ({
      name: `${s.emoji} ${s.label}`,
      value: papers.filter(p => p.status === s.key).length,
      color: s.color,
    })).filter(d => d.value > 0)
  }, [papers])

  // ── JCR distribution ──
  const jcrData = useMemo(() => {
    const counts: Record<string, number> = {}
    papers.filter(p => p.lang === 'en' && p.quartile_jcr && p.quartile_jcr !== '未定').forEach(p => {
      counts[p.quartile_jcr!] = (counts[p.quartile_jcr!] || 0) + 1
    })
    return ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
      name: q,
      value: counts[q] || 0,
      fill: q === 'Q1' ? '#ef4444' : q === 'Q2' ? '#f59e0b' : q === 'Q3' ? '#0ea5e9' : '#64748b',
    })).filter(d => d.value > 0)
  }, [papers])

  // ── CAS distribution ──
  const casData = useMemo(() => {
    const counts: Record<string, number> = {}
    papers.filter(p => p.lang === 'en' && p.quartile_cas && p.quartile_cas !== '未定').forEach(p => {
      counts[p.quartile_cas!] = (counts[p.quartile_cas!] || 0) + 1
    })
    return ['一区', '二区', '三区', '四区', '预警'].map(q => ({
      name: q,
      value: counts[q] || 0,
      fill: q === '一区' ? '#ef4444' : q === '二区' ? '#f59e0b' : q === '三区' ? '#0ea5e9' : q === '四区' ? '#64748b' : '#dc2626',
    })).filter(d => d.value > 0)
  }, [papers])

  // ── Custom quartile distribution ──
  const custData = useMemo(() => {
    const counts: Record<string, number> = {}
    papers.forEach(p => {
      if (p.quartile_cust && p.quartile_cust !== '无') {
        counts[p.quartile_cust] = (counts[p.quartile_cust] || 0) + 1
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({ name, value: count, fill: CHART_COLORS[i % CHART_COLORS.length] }))
  }, [papers])

  // ── Author contribution ──
  const authorData = useMemo(() => {
    const matchName = authorName || currentUsername
    const counts: Record<string, number> = {}
    papers.forEach(p => {
      (p.authors || []).forEach(a => {
        counts[a] = (counts[a] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count], i) => ({
        name,
        value: count,
        fill: name === matchName ? cssVar('--accent') || '#0891b2' : CHART_COLORS[i % CHART_COLORS.length],
        isMe: name === matchName,
      }))
  }, [papers, currentUsername, authorName])

  // ── Time trend (daily) with cumulative ──
  const timeData = useMemo(() => {
    const daily: Record<string, { submitted: number; accepted: number; rejected: number }> = {}
    papers.forEach(p => {
      if (p.submitted_date) {
        const d = p.submitted_date
        if (!daily[d]) daily[d] = { submitted: 0, accepted: 0, rejected: 0 }
        daily[d].submitted++
      }
      if (p.resolve_date && (p.status === 'accepted' || p.status === 'rejected')) {
        const d = p.resolve_date
        if (!daily[d]) daily[d] = { submitted: 0, accepted: 0, rejected: 0 }
        if (p.status === 'accepted') daily[d].accepted++
        if (p.status === 'rejected') daily[d].rejected++
      }
    })
    // Fill gaps: generate all dates from first activity to today
    const dates = Object.keys(daily).sort()
    if (dates.length === 0) return []
    const start = new Date(dates[0])
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = today > new Date(dates[dates.length - 1]) ? today : new Date(dates[dates.length - 1])
    const filled: { date: string; submitted: number; accepted: number; rejected: number; cumSubmitted: number; cumAccepted: number; cumRejected: number; inProgress: number }[] = []
    let cumSubmitted = 0, cumAccepted = 0, cumRejected = 0
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10)
      const entry = daily[key] || { submitted: 0, accepted: 0, rejected: 0 }
      cumSubmitted += entry.submitted
      cumAccepted += entry.accepted
      cumRejected += entry.rejected
      filled.push({ date: key, ...entry, cumSubmitted, cumAccepted, cumRejected, inProgress: cumSubmitted - cumAccepted - cumRejected })
    }
    return filled
  }, [papers])

  // ── Journal distribution (top journals) ──
  const journalData = useMemo(() => {
    const counts: Record<string, number> = {}
    papers.forEach(p => {
      if (p.journal) counts[p.journal] = (counts[p.journal] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count], i) => ({ name, value: count, fill: CHART_COLORS[i % CHART_COLORS.length] }))
  }, [papers])

  // ── Chinese journal category distribution ──
  const zhCategoryData = useMemo(() => {
    const counts: Record<string, number> = {}
    papers.filter(p => p.lang === 'zh' && p.quartile_zh).forEach(p => {
      (p.quartile_zh || []).filter(Boolean).forEach(c => {
        counts[c] = (counts[c] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({ name, value: count, fill: CHART_COLORS[i % CHART_COLORS.length] }))
  }, [papers])

  // ── Summary stats ──
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
      const totalDays = resolved.reduce((sum, p) => {
        const d1 = new Date(p.submitted_date!).getTime()
        const d2 = new Date(p.resolve_date!).getTime()
        return sum + Math.round((d2 - d1) / 86400000)
      }, 0)
      return Math.round(totalDays / resolved.length)
    })()
    const rate = total > 0 ? Math.round(accepted / total * 100) : 0
    return { total, accepted, rejected, inProgress, firstAuthor, corrAuthor, collaborators, journals, avgDays, rate }
  }, [papers, currentUsername, authorName])

  // Theme colors for chart config
  const gridColor = cssVar('--border-subtle') || '#eee'
  const mutedColor = cssVar('--text-muted') || '#999'

  if (papers.length === 0) {
    return (
      <div className="stats-panel">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-text">还没有投稿数据</div>
          <div className="empty-sub">添加论文后即可查看统计分析</div>
        </div>
      </div>
    )
  }

  return (
    <div className="stats-panel">
      {/* ── Summary cards ── */}
      <div className="stats-summary">
        {[
          { icon: '📄', bg: 'var(--accent-bg)', color: 'var(--accent)', value: summary.total, label: '论文总数' },
          { icon: '✅', bg: 'rgba(34,197,94,0.1)', color: '#22c55e', value: summary.accepted, label: '已接收' },
          { icon: '⏳', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', value: summary.inProgress, label: '进行中' },
          { icon: '🚫', bg: 'rgba(239,68,68,0.1)', color: '#ef4444', value: summary.rejected, label: '被拒' },
          { icon: '👤', bg: 'var(--purple-bg)', color: 'var(--purple)', value: summary.firstAuthor, label: '第一作者' },
          { icon: '✉️', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', value: summary.corrAuthor, label: '通讯作者' },
          { icon: '👥', bg: 'var(--info-bg)', color: 'var(--info)', value: summary.collaborators, label: '合作者' },
          { icon: '📰', bg: 'rgba(8,145,178,0.1)', color: '#0891b2', value: summary.journals, label: '涉及期刊' },
          { icon: '⏱', bg: 'rgba(168,85,247,0.1)', color: '#a855f7', value: summary.avgDays, label: '平均审稿天数' },
          { icon: '🎯', bg: summary.rate >= 50 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: summary.rate >= 50 ? '#22c55e' : '#f59e0b', value: summary.total > 0 ? `${summary.rate}%` : '—', label: '接收率' },
        ].map((item, i) => (
          <div key={item.label} className="summary-card animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="summary-icon" style={{ background: item.bg, color: item.color }}>{item.icon}</div>
            <div>
              <div className="summary-value" style={{ color: item.color }}>{item.value}</div>
              <div className="summary-label">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Time trend (full-width hero chart) ── */}
      {timeData.length > 1 && (
        <div className="chart-card chart-card-hero animate-in">
          <div className="chart-header">
            <h3 className="chart-title">投稿时间趋势</h3>
            <div className="chart-legend">
              <span className="chart-legend-item"><span className="legend-dot" style={{ background: '#0891b2' }} />累积投稿</span>
              <span className="chart-legend-item"><span className="legend-dot" style={{ background: '#22c55e' }} />累积接收</span>
              <span className="chart-legend-item"><span className="legend-dot" style={{ background: '#f59e0b' }} />审稿中</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={370}>
            <AreaChart data={timeData}>
              <defs>
                <linearGradient id="gradSubmitted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0891b2" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAccepted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradInProgress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: mutedColor }}
                angle={-45}
                textAnchor="end"
                height={50}
                interval={timeData.length > 30 ? Math.floor(timeData.length / 12) : 'preserveStartEnd'}
                axisLine={false}
                tickLine={false}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip content={<TrendTooltip />} />
              <Area yAxisId="left" type="monotone" dataKey="cumSubmitted" name="累积投稿" stroke="#0891b2" strokeWidth={2.5} fill="url(#gradSubmitted)" dot={false} activeDot={{ r: 5, stroke: '#0891b2', strokeWidth: 2, fill: '#fff' }} />
              <Area yAxisId="left" type="monotone" dataKey="cumAccepted" name="累积接收" stroke="#22c55e" strokeWidth={2.5} fill="url(#gradAccepted)" dot={false} activeDot={{ r: 5, stroke: '#22c55e', strokeWidth: 2, fill: '#fff' }} />
              <Area yAxisId="left" type="monotone" dataKey="inProgress" name="审稿中" stroke="#f59e0b" strokeWidth={2} fill="url(#gradInProgress)" dot={false} activeDot={{ r: 5, stroke: '#f59e0b', strokeWidth: 2, fill: '#fff' }} />
              <Brush dataKey="date" height={28} stroke="#0891b2" fill="var(--bg-glass, rgba(255,255,255,0.6))" travellerWidth={10} tickFormatter={(v: string) => v.slice(5)} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            拖动下方滑块可缩放时间范围
          </div>
        </div>
      )}

      {/* ── Charts grid ── */}
      <div className="charts-grid">
        {/* Status pie chart */}
        {statusData.length > 0 && (
          <div className="chart-card">
            <h3 className="chart-title">状态分布</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Journal distribution */}
        {journalData.length > 0 && (
          <div className="chart-card">
            <h3 className="chart-title">期刊分布 (Top {journalData.length})</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={journalData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: mutedColor }} width={120} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="value" name="论文数" radius={[0, 4, 4, 0]} barSize={18}>
                  {journalData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* JCR distribution */}
        {jcrData.length > 0 && (
          <div className="chart-card">
            <h3 className="chart-title">JCR 分区分布</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={jcrData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: mutedColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="value" name="论文数" radius={[6, 6, 0, 0]} barSize={36}>
                  {jcrData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* CAS distribution */}
        {casData.length > 0 && (
          <div className="chart-card">
            <h3 className="chart-title">中科院分区分布</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={casData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: mutedColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="value" name="论文数" radius={[6, 6, 0, 0]} barSize={36}>
                  {casData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Custom quartile */}
        {custData.length > 0 && (
          <div className="chart-card">
            <h3 className="chart-title">自定义分区分布</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={custData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: mutedColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="value" name="论文数" radius={[6, 6, 0, 0]} barSize={36}>
                  {custData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Chinese category */}
        {zhCategoryData.length > 0 && (
          <div className="chart-card">
            <h3 className="chart-title">中文期刊分类</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={zhCategoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: mutedColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="value" name="论文数" radius={[6, 6, 0, 0]} barSize={36}>
                  {zhCategoryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Author contribution (full width) */}
        {authorData.length > 0 && (
          <div className="chart-card chart-card-wide">
            <h3 className="chart-title">作者贡献统计</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, authorData.length * 28 + 40)}>
              <BarChart data={authorData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: mutedColor }} allowDecimals={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: mutedColor }} width={90} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="value" name="论文数" radius={[0, 6, 6, 0]} barSize={20}>
                  {authorData.map((entry, i) => <Cell key={i} fill={entry.fill} opacity={entry.isMe ? 1 : 0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
