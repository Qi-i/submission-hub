import { AlertTriangle, CheckCircle2, CircleAlert, Info } from 'lucide-react'
import type { FigurePreflightIssue } from '../../lib/figure-composer/types'

export default function FigurePreflightPanel({ issues }: { issues: FigurePreflightIssue[] }) {
  const errors = issues.filter(issue => issue.severity === 'error').length
  const warnings = issues.filter(issue => issue.severity === 'warning').length
  return <section className="figure-composer__section" aria-label="投稿尺寸检查">
    <div className="figure-composer__section-title"><CircleAlert size={14} /><strong>投稿尺寸检查</strong><span>{errors ? `${errors} 错误` : warnings ? `${warnings} 提醒` : '通过'}</span></div>
    {!issues.length && <div className="figure-composer__preflight-ok"><CheckCircle2 size={16} /><span>当前未发现分辨率、边界、重叠、拉伸、图注或格式问题。</span></div>}
    <div className="figure-composer__preflight-list">
      {issues.map((issue, index) => <div key={`${issue.code}-${index}`} className={`figure-composer__issue ${issue.severity}`}>
        {issue.severity === 'error' ? <CircleAlert size={14} /> : issue.severity === 'warning' ? <AlertTriangle size={14} /> : <Info size={14} />}
        <div><strong>{issue.code}</strong><p>{issue.message}</p></div>
      </div>)}
    </div>
  </section>
}
