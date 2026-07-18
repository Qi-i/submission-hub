import { ArrowUpDown, BookOpen, LayoutGrid } from 'lucide-react'

export type LuminousXLayoutMode = 'workflow' | 'board' | 'journal'

type PageKey = 'preparation' | 'dashboard' | 'stats' | 'admin'

interface Props {
  modeLabel: string
  recordCount: number
  subtitle: string
  layoutMode?: LuminousXLayoutMode
  onLayoutModeChange?: (mode: LuminousXLayoutMode) => void
}

const VIEW_OPTIONS: Array<{ key: LuminousXLayoutMode; label: string; icon: typeof ArrowUpDown }> = [
  { key: 'workflow', label: '工作流视图', icon: ArrowUpDown },
  { key: 'board', label: '看板视图', icon: LayoutGrid },
  { key: 'journal', label: '按期刊视图', icon: BookOpen },
]

function pageMeta(modeLabel: string): { key: PageKey; label: string } {
  if (modeLabel.includes('准备')) return { key: 'preparation', label: '投稿准备' }
  if (modeLabel.includes('统计')) return { key: 'stats', label: '个人统计' }
  if (modeLabel.includes('后台')) return { key: 'admin', label: '后台管理' }
  return { key: 'dashboard', label: '投稿管理' }
}

export default function LuminousXStatusBar({
  modeLabel,
  recordCount,
  subtitle,
  layoutMode = 'workflow',
  onLayoutModeChange,
}: Props) {
  const page = pageMeta(modeLabel)

  return (
    <section className="lx-status-bar" data-page={page.key} aria-label={`${page.label}页面控制栏`}>
      <div className="lx-status-core">
        <span className="lx-status-beacon" aria-hidden="true" />
        <div>
          <small>LUMINOUS X · RESEARCH CONTROL</small>
          <strong>{page.label}</strong>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="lx-status-controls-host" aria-label={`${page.label}页面操作`}>
        {onLayoutModeChange && (
          <div className="lx-view-switch" role="group" aria-label="投稿记录视图">
            {VIEW_OPTIONS.map(option => {
              const Icon = option.icon
              return (
                <button
                  key={option.key}
                  type="button"
                  className={layoutMode === option.key ? 'active' : ''}
                  aria-pressed={layoutMode === option.key}
                  onClick={() => onLayoutModeChange(option.key)}
                >
                  <Icon size={14} />
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="lx-status-count">
        <small>记录总数</small>
        <span><b>{recordCount}</b><em>篇</em></span>
      </div>
    </section>
  )
}
