import { useMemo } from 'react'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer } from 'recharts'

interface Props {
  papers: Paper[]
  currentUsername: string
}

// Get CSS variable value
function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const CHART_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#a855f7', '#22c55e', '#ef4444', '#64748b', '#ec4899', '#14b8a6', '#f97316']

export default function PersonalStats({ papers, currentUsername }: Props) {
  // Status distribution for pie chart
  const statusData = useMemo(() => {
    return STATUSES.map(s => ({
      name: `${s.emoji} ${s.label}`,
      value: papers.filter(p => p.status === s.key).length,
      color: s.color,
    })).filter(d => d.value > 0)
  }, [papers])

  // JCR distribution
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

  // CAS (中科院) distribution
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

  // Custom quartile distribution
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

  // Author contribution
  const authorData = useMemo(() => {
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
        fill: name === currentUsername ? cssVar('--accent') || '#0891b2' : CHART_COLORS[i % CHART_COLORS.length],
        isMe: name === currentUsername,
      }))
  }, [papers, currentUsername])

  // Time trend (monthly submissions and acceptances)
  const timeData = useMemo(() => {
    const monthly: Record<string, { submitted: number; accepted: number }> = {}
    papers.forEach(p => {
      if (p.submitted_date) {
        const ym = p.submitted_date.slice(0, 7) // YYYY-MM
        if (!monthly[ym]) monthly[ym] = { submitted: 0, accepted: 0 }
        monthly[ym].submitted++
      }
      if (p.resolve_date && (p.status === 'accepted' || p.status === 'rejected')) {
        const ym = p.resolve_date.slice(0, 7)
        if (!monthly[ym]) monthly[ym] = { submitted: 0, accepted: 0 }
        if (p.status === 'accepted') monthly[ym].accepted++
      }
    })
    return Object.entries(monthly)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data }))
  }, [papers])

  // Chinese journal category distribution
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

  // Summary stats
  const summary = useMemo(() => {
    const total = papers.length
    const accepted = papers.filter(p => p.status === 'accepted').length
    const inProgress = papers.filter(p => ['submitted', 'under_review', 'revision'].includes(p.status)).length
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
    const journals = new Set(papers.map(p => p.journal).filter(Boolean)).size
    return { total, accepted, inProgress, avgDays, journals }
  }, [papers])

  const tooltipStyle = {
    contentStyle: {
      background: cssVar('--bg-card') || '#fff',
      border: `1px solid ${cssVar('--border-default') || '#eee'}`,
      borderRadius: 8,
      fontSize: 12,
    },
  }

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
      {/* Summary cards */}
      <div className="stats-summary">
        <div className="summary-card">
          <div className="summary-value">{summary.total}</div>
          <div className="summary-label">论文总数</div>
        </div>
        <div className="summary-card">
          <div className="summary-value" style={{ color: '#22c55e' }}>{summary.accepted}</div>
          <div className="summary-label">已接收</div>
        </div>
        <div className="summary-card">
          <div className="summary-value" style={{ color: '#f59e0b' }}>{summary.inProgress}</div>
          <div className="summary-label">进行中</div>
        </div>
        <div className="summary-card">
          <div className="summary-value" style={{ color: '#0891b2' }}>{summary.journals}</div>
          <div className="summary-label">涉及期刊</div>
        </div>
        <div className="summary-card">
          <div className="summary-value" style={{ color: '#a855f7' }}>{summary.avgDays}</div>
          <div className="summary-label">平均审稿天数</div>
        </div>
        <div className="summary-card">
          <div className="summary-value" style={{ color: summary.total > 0 ? '#22c55e' : '#64748b' }}>
            {summary.total > 0 ? `${Math.round(summary.accepted / summary.total * 100)}%` : '—'}
          </div>
          <div className="summary-label">接收率</div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="charts-grid">
        {/* Status pie chart */}
        {statusData.length > 0 && (
          <div className="chart-card">
            <h3 className="chart-title">状态分布</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Time trend */}
        {timeData.length > 1 && (
          <div className="chart-card">
            <h3 className="chart-title">投稿时间趋势</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border-subtle') || '#eee'} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="submitted" name="投稿" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="accepted" name="接收" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* JCR distribution */}
        {jcrData.length > 0 && (
          <div className="chart-card">
            <h3 className="chart-title">JCR 分区分布</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={jcrData}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border-subtle') || '#eee'} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" name="论文数" radius={[4, 4, 0, 0]}>
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
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border-subtle') || '#eee'} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" name="论文数" radius={[4, 4, 0, 0]}>
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
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border-subtle') || '#eee'} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" name="论文数" radius={[4, 4, 0, 0]}>
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
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border-subtle') || '#eee'} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" name="论文数" radius={[4, 4, 0, 0]}>
                  {zhCategoryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Author contribution */}
        {authorData.length > 0 && (
          <div className="chart-card chart-card-wide">
            <h3 className="chart-title">作者贡献统计</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={authorData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border-subtle') || '#eee'} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" name="论文数" radius={[0, 4, 4, 0]}>
                  {authorData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
