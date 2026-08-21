import { useEffect, useState } from 'react'

type ProxyOption = { label: string; match: string; reset?: boolean }

const STATS_OPTIONS: ProxyOption[] = [
  { label: '核心概览', match: '核心概览' },
  { label: '过程指标', match: '过程指标' },
  { label: '趋势图', match: '趋势图' },
  { label: '分布概览', match: '分布概览' },
  { label: '恢复默认', match: '恢复默认', reset: true },
]

function findControlButton(match: string) {
  const container = document.querySelector('.stats-panel > .stats-module-controls')
  return Array.from(container?.querySelectorAll<HTMLButtonElement>('button') || [])
    .find(button => button.textContent?.replace(/\s+/g, '').includes(match.replace(/\s+/g, '')))
}

export default function LuminousXStatsProxy() {
  const [active, setActive] = useState<string[]>([])

  useEffect(() => {
    let previous = ''
    const sync = () => {
      const next = STATS_OPTIONS
        .filter(option => !option.reset && findControlButton(option.match)?.classList.contains('active'))
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
  }, [])

  return <div className="stats-module-controls lx-page-proxy-controls" role="group" aria-label="个人统计模块">
    {STATS_OPTIONS.map(option => <button
      key={option.match}
      type="button"
      className={!option.reset && active.includes(option.match) ? 'active' : option.reset ? 'lx-control-reset' : ''}
      aria-pressed={option.reset ? undefined : active.includes(option.match)}
      onClick={() => {
        findControlButton(option.match)?.click()
        window.requestAnimationFrame(() => setActive(STATS_OPTIONS.filter(item => !item.reset && findControlButton(item.match)?.classList.contains('active')).map(item => item.match)))
      }}
    >{option.label}</button>)}
  </div>
}
