import { Activity, Cloud, Database, Radio } from 'lucide-react'

interface Props {
  modeLabel: string
  recordCount: number
  channelLabel: string
  offline?: boolean
}

export default function LuminousXStatusBar({ modeLabel, recordCount, channelLabel, offline = false }: Props) {
  return (
    <section className="lx-status-bar" aria-label="Luminous X 工作区状态">
      <div className="lx-status-core">
        <span className="lx-status-beacon" aria-hidden="true" />
        <div>
          <small>LUMINOUS X · RESEARCH CONTROL</small>
          <strong>{modeLabel}</strong>
        </div>
      </div>

      <div className="lx-status-meta">
        <span><Activity size={13} /> 工作流已就绪</span>
        <span>{offline ? <Database size={13} /> : <Cloud size={13} />}{channelLabel}</span>
        <span><Radio size={13} /> 实时界面模式</span>
      </div>

      <div className="lx-status-count">
        <small>RECORDS</small>
        <b>{recordCount}</b>
      </div>
    </section>
  )
}
