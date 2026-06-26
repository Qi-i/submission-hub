import { Brush, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

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
      {payload.map((p: any, i: number) => (
        <div key={i} className="chart-tooltip-row"><span style={{ color: p.color }}>{p.name}</span><b>{p.value}</b></div>
      ))}
    </div>
  )
}

export default function StatsTrendChart({ data, visible }: Props) {
  return (
    <ResponsiveContainer width="100%" height={390}>
      <LineChart data={data} margin={{ top: 12, right: 22, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} minTickGap={18} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip content={<TrendTooltip />} />
        <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
        {series.filter(s => visible[s.key]).map(s => (
          <Line key={s.key} type="monotoneX" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} dot={false} activeDot={{ r: 5, stroke: s.color, strokeWidth: 2, fill: '#fff' }} />
        ))}
        <Brush dataKey="period" height={30} stroke="#0891b2" fill="var(--bg-glass)" travellerWidth={10} />
      </LineChart>
    </ResponsiveContainer>
  )
}
