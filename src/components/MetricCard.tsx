import type { ReactNode } from 'react'

interface Props {
  icon: ReactNode
  value: ReactNode
  label: string
  helper?: string
  color?: string
  tone?: string
  active?: boolean
  disabled?: boolean
  density?: 'comfortable' | 'compact'
  onClick?: () => void
}

export default function MetricCard({ icon, value, label, helper, color = 'var(--accent)', tone = 'var(--accent-bg)', active = false, disabled = false, density = 'comfortable', onClick }: Props) {
  const clickable = !!onClick && !disabled
  return (
    <button
      type="button"
      className={`metric-card glass-panel ${active ? 'active' : ''} ${clickable ? 'clickable' : ''} metric-${density}`}
      style={{ ['--metric-color' as any]: color, ['--metric-tone' as any]: tone }}
      onClick={clickable ? onClick : undefined}
      disabled={disabled}
    >
      <span className="metric-accent" />
      <span className="metric-icon">{icon}</span>
      <span className="metric-copy">
        <span className="metric-value">{value}</span>
        <span className="metric-label">{label}</span>
        {helper && <span className="metric-helper">{helper}</span>}
      </span>
    </button>
  )
}
