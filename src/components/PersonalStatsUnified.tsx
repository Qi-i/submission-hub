import { useEffect, useMemo, useState } from 'react'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
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
type DistributionItem = { name: string; value: number; color: string; meta?: string }

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
    return saved ? { ...defaultModules, ...JSON.parse(saved) } : defaultModules
  } catch {
    return defaultModules
  }
}

function parseDate(value?: string | null) {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isFinite(date.getTime()) ? date : null
}

function localToday() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function daysBetween(start?: string | null, end?: string | null) {
  const left = parseDate(start)
  const right = parseDate(end)
  if (!left || !right) return null
  return Math.round((Date.UTC(right.getFullYear(), right.getMonth(), right.getDate()) - Date.UTC(left.getFullYear(), left.getMonth(), left.getDate())) / 86400000)
}

const daysSince = (value?: string | null) => daysBetween(value, localToday())
const pad = (value: number) => String(value).padStart(2, '0')

function periodKey(date: Date, scale: Scale) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  if (scale === 'year') return `${year}`
  if (scale === 'quarter') return `${year}-Q${Math.floor((month - 1) / 3) + 1}`
  return `${year}-${pad(month)}`
}

function periodStart(key: string, scale: Scale) {
  if (scale === 'year') return new Date(Number(key), 0, 1)
  if (scale === 'quarter') {
    const [year, quarter] = key.split('-Q')
    return new Date(Number(year), (Number(quarter) - 1) * 3, 1)
  }
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1, 1)
}

function nextPeriod(date: Date, scale: Scale) {
  const next = new Date(date)
  if (scale === 'year') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + (scale === 'quarter' ? 3 : 1))
  return next
}

function cutoff(range: Range) {
  if (range === 'all') return null
  const date = new Date()
  date.setFullYear(date.getFullYear() - (range === '1y' ? 1 : range === '3y' ? 3 : 5))
  date.setHours(0, 0, 0, 0)
  return date
}

function InsightCard({ label, value, hint, tone }: { label: string; value: string | number; hint: string; tone: string }) {
  return <div className="insight-card unified-insight-card" data-tone={tone}><span>{label}</span><b>{value}</b><small>{hint}</small></div>
}

function DistributionPanel({ title, subtitle, items }: { title: string; subtitle: string; items: DistributionItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const max = Math.max(1, ...items.map(item => item.value))

  return (
    <section className="chart-card stats-distribution-card glass-panel">
      <div className="stats-distribution-head"><div><h3>{title}</h3><p>{subtitle}</p></div><b>{total}</b></div>
      <div className="stats-distribution-list">
        {items.length ? items.map(item => (
          <div className="stats-distribution-row" key={item.name}>
            <div className="stats-distribution-copy"><span className="stats-distribution-dot" style={{ background: item.color }} /><strong title={item.name}>{item.name}</strong>{item.meta && <small>{item.meta}</small>}<b>{item.value}</b></div>
            <div className="stats-distribution-track"><span style={{ width: `${Math.max(item.value > 0 ? 4 : 0, item.value / max * 100)}%`, background: item.color }} /></div>
          </div>
        )) : <div className="stats-distribution-empty">暂无可统计数据</div>}
      </div>
    </section>
  )
}

export default function PersonalStatsUnified({ papers, currentUsername, authorName }: Props) {
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
    try { localStorage.setItem(moduleStorageKey, JSON.stringify(modules)) } catch { /* optional preference */ }
  }, [modules])

  const summary = useMemo(() => {
    const submittedTotal = papers.filter(paper => paper.status !== 'preparing' || !!paper.submitted_date).length
    const accepted = papers.filter(paper => paper.status === 'accepted').length
    const rejected = papers.filter(paper => paper.status === 'rejected').length
    const revision = papers.filter(paper => paper.status === 'revision').length
    const inProgress = papers.filter(paper => ['submitted', 'under_review', 'revision'].includes(paper.status)).length
    const matchName = (authorName || currentUsername).trim().toLocaleLowerCase()
    const firstAuthor = matchName ? papers.filter(paper => (paper.authors?.[0] || '').trim().toLocaleLowerCase() === matchName).length : 0
    const corrAuthor = matchName ? papers.filter(paper => (paper.corresponding_author || '').trim().toLocaleLowerCase() === matchName).length : 0
    const decided = accepted + rejected
    return {
      submittedTotal, accepted, rejected, revision, inProgress, firstAuthor, corrAuthor,
      acceptedRate: decided ? Math.round(accepted / decided * 100) : 0,
      rejectionRate: decided ? Math.round(rejected / decided * 100) : 0,
    }
  }, [papers, currentUsername, authorName])

  const processInsights = useMemo(() => {
    const resolvedDurations = papers
      .filter(paper => ['accepted', 'rejected', 'withdrawn'].includes(paper.status))
      .map(paper => daysBetween(paper.submitted_date, paper.resolve_date))
      .filter((days): days is number => days !== null && days >= 0)
    const activeDurations = papers
      .filter(paper => ['submitted', 'under_review', 'revision'].includes(paper.status))
      .map(paper => daysSince(paper.submitted_date))
      .filter((days): days is number => days !== null && days >= 0)
    const urgentRevision = papers.filter(paper => {
      if (paper.status !== 'revision' || !paper.deadline) return false
      const remaining = daysBetween(localToday(), paper.deadline)
      return remaining !== null && remaining >= 0 && remaining <= 7
    }).length
    return {
      avgResolved: resolvedDurations.length ? Math.round(resolvedDurations.reduce((sum, days) => sum + days, 0) / resolvedDurations.length) : 0,
      maxResolved: resolvedDurations.length ? Math.max(...resolvedDurations) : 0,
      avgActive: activeDurations.length ? Math.round(activeDurations.reduce((sum, days) => sum + days, 0) / activeDurations.length) : 0,
      longActive: activeDurations.filter(days => days >= 90).length,
      urgentRevision,
    }
  }, [papers])

  const riskData = useMemo<DistributionItem[]>(() => {
    const buckets: DistributionItem[] = [
      { name: '0–30 天', value: 0, color: '#22c55e', meta: '正常推进' },
      { name: '31–90 天', value: 0, color: '#f59e0b', meta: '持续关注' },
      { name: '90 天以上', value: 0, color: '#ef4444', meta: '建议重点跟踪' },
    ]
    papers.filter(paper => ['submitted', 'under_review', 'revision'].includes(paper.status)).forEach(paper => {
      const days = daysSince(paper.submitted_date)
      if (days === null || days < 0) return
      if (days <= 30) buckets[0].value++
      else if (days <= 90) buckets[1].value++
      else buckets[2].value++
    })
    return buckets
  }, [papers])

  const trendData = useMemo(() => {
    const dates = papers.flatMap(paper => [parseDate(paper.submitted_date), parseDate(paper.resolve_date)]).filter(Boolean) as Date[]
    if (!dates.length) return []
    let cursor = periodStart(periodKey(new Date(Math.min(...dates.map(date => date.getTime()))), scale), scale)
    const end = periodStart(periodKey(new Date(Math.max(Date.now(), ...dates.map(date => date.getTime()))), scale), scale)
    const buckets: Record<string, { submitted: number; accepted: number; rejected: number; withdrawn: number }> = {}
    while (cursor <= end) {
      buckets[periodKey(cursor, scale)] = { submitted: 0, accepted: 0, rejected: 0, withdrawn: 0 }
      cursor = nextPeriod(cursor, scale)
    }
    papers.forEach(paper => {
      const submitted = parseDate(paper.submitted_date)
      if (submitted) buckets[periodKey(submitted, scale)].submitted++
      const resolved = parseDate(paper.resolve_date)
      if (resolved && ['accepted', 'rejected', 'withdrawn'].includes(paper.status)) {
        const key = periodKey(resolved, scale)
        if (!buckets[key]) buckets[key] = { submitted: 0, accepted: 0, rejected: 0, withdrawn: 0 }
        if (paper.status === 'accepted') buckets[key].accepted++
        if (paper.status === 'rejected') buckets[key].rejected++
        if (paper.status === 'withdrawn') buckets[key].withdrawn++
      }
    })
    let cumSubmitted = 0
    let cumAccepted = 0
    let cumRejected = 0
    let cumWithdrawn = 0
    const startCut = cutoff(range)
    return Object.entries(buckets)
      .sort(([left], [right]) => periodStart(left, scale).getTime() - periodStart(right, scale).getTime())
      .map(([period, item]) => {
        cumSubmitted += item.submitted
        cumAccepted += item.accepted
        cumRejected += item.rejected
        cumWithdrawn += item.withdrawn
        return { period, periodDate: periodStart(period, scale), ...item, cumSubmitted, cumAccepted, cumRejected, inProgress: Math.max(0, cumSubmitted - cumAccepted - cumRejected - cumWithdrawn) }
      })
      .filter(row => !startCut || row.periodDate >= startCut)
  }, [papers, scale, range])

  const statusData = useMemo<DistributionItem[]>(() => STATUSES
    .map(status => ({ name: status.label, value: papers.filter(paper => paper.status === status.key).length, color: status.color, meta: status.emoji }))
    .filter(item => item.value > 0), [papers])

  const journalData = useMemo<DistributionItem[]>(() => {
    const counts = new Map<string, number>()
    papers.forEach(paper => { if (paper.journal) counts.set(paper.journal, (counts.get(paper.journal) || 0) + 1) })
    const colors = ['#0ea5e9', '#6366f1', '#14b8a6', '#f59e0b', '#a855f7', '#ef4444', '#22c55e', '#ec4899']
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]).slice(0, 8).map(([name, value], index) => ({ name, value, color: colors[index % colors.length], meta: '投稿次数' }))
  }, [papers])

  if (!papers.length) return <div className="stats-panel"><div className="empty-state"><div className="empty-icon">📊</div><div className="empty-text">还没有投稿数据</div><div className="empty-sub">添加论文后即可查看投稿统计</div></div></div>

  const cards = [
    { icon: '📄', value: summary.submittedTotal, label: '投稿总数', tone: 'blue' },
    { icon: '✅', value: summary.accepted, label: '已接收', tone: 'green' },
    { icon: '⏳', value: summary.inProgress, label: '进行中', tone: 'orange' },
    { icon: '🔧', value: summary.revision, label: '修回中', tone: 'purple' },
    { icon: '🚫', value: summary.rejected, label: '被拒', tone: 'red' },
    { icon: '🎯', value: `${summary.acceptedRate}%`, label: '接收率（已决）', tone: 'green' },
    { icon: '👤', value: summary.firstAuthor, label: '第一作者', tone: 'blue', secondary: true },
    { icon: '✉', value: summary.corrAuthor, label: '通讯作者', tone: 'orange', secondary: true },
    { icon: '⚠️', value: `${summary.rejectionRate}%`, label: '拒稿率（已决）', tone: 'red', secondary: true },
  ]

  return (
    <div className="stats-panel stats-panel-unified">
      <div className="stats-module-controls">
        <button className={modules.overview ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, overview: !previous.overview }))}>核心概览</button>
        <button className={modules.process ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, process: !previous.process }))}>过程指标</button>
        <button className={modules.trend ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, trend: !previous.trend }))}>趋势图</button>
        <button className={modules.charts ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, charts: !previous.charts }))}>分布概览</button>
        <button onClick={() => setModules(defaultModules)}>恢复默认</button>
      </div>

      {modules.overview && <div className="stats-summary-unified">
        {cards.map((card, index) => <div key={card.label} className="summary-card stats-summary-card glass-panel" data-tone={card.tone} data-secondary={card.secondary ? 'true' : 'false'}><span className="summary-icon">{card.icon}</span><div><b>{card.value}</b><span>{card.label}</span></div></div>)}
      </div>}

      {modules.process && <div className="process-insight-grid process-insight-grid-unified">
        <InsightCard label="已完结平均周期" value={`${processInsights.avgResolved} 天`} hint="仅统计有首投和终审日期的已结束稿件" tone="blue" />
        <InsightCard label="最长完结周期" value={`${processInsights.maxResolved} 天`} hint="历史最长完整审稿链路" tone="purple" />
        <InsightCard label="进行中平均周期" value={`${processInsights.avgActive} 天`} hint="仅统计有首投日期的未完结稿件" tone="orange" />
        <InsightCard label="90 天以上进行中" value={processInsights.longActive} hint="建议重点跟踪长期停留稿件" tone="red" />
        <InsightCard label="修回 7 天内截止" value={processInsights.urgentRevision} hint="不含已经逾期的稿件" tone="red" />
      </div>}

      {modules.trend && trendData.length > 0 && <section className="chart-card chart-card-hero trend-card-unified glass-panel">
        <div className="chart-header refined-chart-header"><div><h3 className="chart-title">投稿时间趋势</h3><p className="chart-subtitle">累计量用于观察长期进展，当期量用于识别投稿节奏。</p></div><div className="trend-controls"><div className="segmented-control"><button className={scale === 'month' ? 'active' : ''} onClick={() => setScale('month')}>月</button><button className={scale === 'quarter' ? 'active' : ''} onClick={() => setScale('quarter')}>季度</button><button className={scale === 'year' ? 'active' : ''} onClick={() => setScale('year')}>年</button></div><div className="segmented-control"><button className={range === 'all' ? 'active' : ''} onClick={() => setRange('all')}>全部</button><button className={range === '1y' ? 'active' : ''} onClick={() => setRange('1y')}>1 年</button><button className={range === '3y' ? 'active' : ''} onClick={() => setRange('3y')}>3 年</button><button className={range === '5y' ? 'active' : ''} onClick={() => setRange('5y')}>5 年</button></div></div></div>
        <div className="series-toggle-row">{series.map(item => <button key={item.key} className={visible[item.key] ? 'series-chip active' : 'series-chip'} onClick={() => setVisible(previous => ({ ...previous, [item.key]: !previous[item.key] }))}><span style={{ background: item.color }} />{item.label}</button>)}</div>
        <StatsTrendChart data={trendData} visible={visible} />
      </section>}

      {modules.charts && <div className="stats-distribution-grid">
        <DistributionPanel title="投稿状态" subtitle="当前全部稿件的主状态构成" items={statusData} />
        <DistributionPanel title="进行中周期" subtitle="按首投日期划分当前处理时长" items={riskData} />
        <DistributionPanel title="投稿期刊" subtitle={`按投稿次数列出前 ${journalData.length} 本期刊`} items={journalData} />
      </div>}
    </div>
  )
}
