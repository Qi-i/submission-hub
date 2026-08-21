import { ArrowUpDown, BookOpen, LayoutGrid } from 'lucide-react'
import type { PreparationSection } from './preparation/PreparationNavigation'
import LuminousXStatsProxy from './LuminousXStatsProxy'

export type LuminousXLayoutMode = 'workflow' | 'board' | 'journal'

type PageKey = 'preparation' | 'dashboard' | 'stats' | 'admin'

interface Props {
  modeLabel: string
  recordCount: number
  subtitle: string
  layoutMode?: LuminousXLayoutMode
  onLayoutModeChange?: (mode: LuminousXLayoutMode) => void
  preparationSection?: PreparationSection
  onPreparationSectionChange?: (section: PreparationSection) => void
}

const VIEW_OPTIONS: Array<{ key: LuminousXLayoutMode; label: string; icon: typeof ArrowUpDown }> = [
  { key: 'workflow', label: '工作流视图', icon: ArrowUpDown },
  { key: 'board', label: '看板视图', icon: LayoutGrid },
  { key: 'journal', label: '按期刊视图', icon: BookOpen },
]

const PREPARATION_OPTIONS: Array<{ key: Exclude<PreparationSection, 'figures'>; label: string }> = [
  { key: 'overview', label: '总览' },
  { key: 'paper', label: '论文准备' },
  { key: 'materials', label: '投稿材料' },
  { key: 'match', label: '期刊匹配' },
  { key: 'check', label: '投稿前检查' },
]

function pageMeta(modeLabel: string): { key: PageKey; label: string } {
  if (modeLabel.includes('准备')) return { key: 'preparation', label: '投稿准备' }
  if (modeLabel.includes('统计')) return { key: 'stats', label: '个人统计' }
  if (modeLabel.includes('后台')) return { key: 'admin', label: '后台管理' }
  return { key: 'dashboard', label: '投稿管理' }
}

function PreparationControls({ section, onChange }: { section: PreparationSection; onChange: (section: PreparationSection) => void }) {
  if (section === 'figures') return null
  return <div className="prep-nav lx-page-proxy-controls lx-preparation-direct-controls" role="group" aria-label="投稿准备模块">
    {PREPARATION_OPTIONS.map(option => <button
      key={option.key}
      type="button"
      className={section === option.key ? 'active' : ''}
      aria-pressed={section === option.key}
      onClick={() => onChange(option.key)}
    >{option.label}</button>)}
  </div>
}

export default function LuminousXStatusBar({
  modeLabel,
  recordCount,
  subtitle,
  layoutMode = 'workflow',
  onLayoutModeChange,
  preparationSection = 'overview',
  onPreparationSectionChange,
}: Props) {
  const page = pageMeta(modeLabel)

  return (
    <section
      className="lx-status-bar"
      data-page={page.key}
      data-preparation-section={page.key === 'preparation' ? preparationSection : undefined}
      aria-label={`${page.label}页面控制栏`}
    >
      <div className="lx-status-core">
        <span className="lx-status-beacon" aria-hidden="true" />
        <div>
          <small>LUMINOUS X · RESEARCH CONTROL</small>
          <strong>{page.label}</strong>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="lx-status-controls-host" aria-label={`${page.label}页面操作`}>
        {page.key === 'preparation' && preparationSection !== 'figures' && <div id="lx-preparation-actions-slot" className="lx-preparation-actions-slot" />}
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
        {page.key === 'preparation' && onPreparationSectionChange && <PreparationControls section={preparationSection} onChange={onPreparationSectionChange} />}
        {page.key === 'stats' && <LuminousXStatsProxy />}
      </div>

      <div className="lx-status-count">
        <small>记录总数</small>
        <span><b>{recordCount}</b><em>篇</em></span>
      </div>
    </section>
  )
}
