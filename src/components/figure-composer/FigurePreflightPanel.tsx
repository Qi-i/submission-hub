import { AlertTriangle, CheckCircle2, CircleAlert, Info } from 'lucide-react'
import type { FigurePreflightIssue } from '../../lib/figure-composer/types'

export default function FigurePreflightPanel({ issues }: { issues: FigurePreflightIssue[] }) {
  const errors = issues.filter(issue => issue.severity === 'error').length
  const warnings = issues.filter(issue => issue.severity === 'warning').length
  return <section className="figure-composer__section figure-composer__preflight" aria-label="投稿尺寸检查">
    <div className="figure-composer__section-title"><CircleAlert size={14} /><strong>投稿尺寸检查</strong><span>{errors ? `${errors} 错误` : warnings ? `${warnings} 提醒` : '通过'}</span></div>
    {!issues.length && <div className="figure-composer__preflight-ok"><CheckCircle2 size={14} /><span>尺寸、图注与格式检查通过</span></div>}
    <div className="figure-composer__preflight-list">
      {issues.map((issue, index) => <div key={`${issue.code}-${index}`} className={`figure-composer__issue ${issue.severity}`} title={`${issue.code} · ${issue.message}`}>
        {issue.severity === 'error' ? <CircleAlert size={13} /> : issue.severity === 'warning' ? <AlertTriangle size={13} /> : <Info size={13} />}
        <strong>{issue.code}</strong><span>{issue.message}</span>
      </div>)}
    </div>
  </section>
}
