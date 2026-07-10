import { Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type TrendKey = 'cumSubmitted' | 'cumAccepted' | 'inProgress' | 'submitted' | 'accepted' | 'rejected'

type Props = {
  data: any[]
  visible: Record<TrendKey, boolean>
}

const series: { key: TrendKey; label: string; color: string; width: number; dash?: string }[] = [
  { key: 'cumSubmitted', label: '累积投稿', color: '#0891b2', width: 3.2 },
  { key: 'cumAccepted', label: '累积接收', color: '#22c55e', width: 3.0 },
  { key: 'inProgress', label: '进行中', color: '#f59e0b', width: 2.4, dash: '7 5' },
  { key: 'submitted', label: '当期投稿', color: '#3b82f6', width: 2.0, dash: '4 4' },
  { key: 'accepted', label: '当期接收', color: '#10b981', width: 2.0, dash: '2 5' },
  { key: 'rejected', label: '当期被拒', color: '#ef4444', width: 2.0, dash: '9 4 2 4' },
]

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip glass-panel">
      <div className="chart-tooltip-title">{label}</div>
      {payload.map((item: any, index: number) => (
        <div key={index} className="chart-tooltip-row"><span style={{ color: item.color }}>{item.name}</span><b>{item.value}</b></div>
      ))}
    </div>
  )
}

export default function StatsTrendChart({ data, visible }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 10, right: 18, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} minTickGap={18} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip content={<TrendTooltip />} />
        {series.filter(item => visible[item.key]).map(item => (
          <Line key={item.key} type="monotoneX" dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={item.width} strokeDasharray={item.dash} dot={false} activeDot={{ r: 5, stroke: item.color, strokeWidth: 2, fill: '#fff' }} />
        ))}
        <Brush dataKey="period" height={24} stroke="#0891b2" fill="var(--bg-glass)" travellerWidth={8} />
      </LineChart>
    </ResponsiveContainer>
  )
}
