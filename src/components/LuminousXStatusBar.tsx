import { useEffect, useState } from 'react'
import { ArrowUpDown, BookOpen, LayoutGrid } from 'lucide-react'

export type LuminousXLayoutMode = 'workflow' | 'board' | 'journal'

type PageKey = 'preparation' | 'dashboard' | 'stats' | 'admin'

type ProxyOption = {
  label: string
  match: string
  reset?: boolean
}

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

const PREPARATION_OPTIONS: ProxyOption[] = [
  { label: '总览', match: '总览' },
  { label: '选题池', match: '选题池' },
  { label: '草稿准备', match: '草稿准备' },
  { label: '期刊库', match: '期刊库' },
  { label: '期刊比较', match: '期刊比较' },
]

const STATS_OPTIONS: ProxyOption[] = [
  { label: '核心概览', match: '核心概览' },
  { label: '过程指标', match: '过程指标' },
  { label: '趋势图', match: '趋势图' },
  { label: '分布概览', match: '分布概览' },
  { label: '恢复默认', match: '恢复默认', reset: true },
]

function pageMeta(modeLabel: string): { key: PageKey; label: string } {
  if (modeLabel.includes('准备')) return { key: 'preparation', label: '投稿准备' }
  if (modeLabel.includes('统计')) return { key: 'stats', label: '个人统计' }
  if (modeLabel.includes('后台')) return { key: 'admin', label: '后台管理' }
  return { key: 'dashboard', label: '投稿管理' }
}

function findControlButton(containerSelector: string, match: string) {
  const container = document.querySelector(containerSelector)
  return Array.from(container?.querySelectorAll<HTMLButtonElement>('button') || [])
    .find(button => button.textContent?.replace(/\s+/g, '').includes(match.replace(/\s+/g, '')))
}

function ProxyControls({ page }: { page: 'preparation' | 'stats' }) {
  const options = page === 'preparation' ? PREPARATION_OPTIONS : STATS_OPTIONS
  const sourceSelector = page === 'preparation'
    ? '.preparation-workspace > .prep-nav'
    : '.stats-panel > .stats-module-controls'
  const [active, setActive] = useState<string[]>([])

  useEffect(() => {
    let previous = ''
    const sync = () => {
      const next = options
        .filter(option => !option.reset && findControlButton(sourceSelector, option.match)?.classList.contains('active'))
        .map(option => option.match)
      const signature = next.join('|')
      if (signature !== previous) {
        previous = signature
        setActive(next)
      }
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [page, sourceSelector])

  const className = page === 'preparation'
    ? 'prep-nav lx-page-proxy-controls'
    : 'stats-module-controls lx-page-proxy-controls'

  return (
    <div className={className} role="group" aria-label={page === 'preparation' ? '投稿准备模块' : '个人统计模块'}>
      {options.map(option => (
        <button
          key={option.match}
          type="button"
          className={!option.reset && active.includes(option.match) ? 'active' : option.reset ? 'lx-control-reset' : ''}
          aria-pressed={option.reset ? undefined : active.includes(option.match)}
          onClick={() => {
            findControlButton(sourceSelector, option.match)?.click()
            window.requestAnimationFrame(() => {
              const next = options
                .filter(item => !item.reset && findControlButton(sourceSelector, item.match)?.classList.contains('active'))
                .map(item => item.match)
              setActive(next)
            })
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
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
        {page.key === 'preparation' && <ProxyControls page="preparation" />}
        {page.key === 'stats' && <ProxyControls page="stats" />}
      </div>

      <div className="lx-status-count">
        <small>记录总数</small>
        <span><b>{recordCount}</b><em>篇</em></span>
      </div>
    </section>
  )
}
