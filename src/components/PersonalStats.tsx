import { useEffect, useState } from 'react'
import type { Paper } from '../lib/types'
import PersonalStatsRefined from './PersonalStatsRefined'

type Props = {
  papers: Paper[]
  currentUsername: string
  authorName: string
}

type StatsCols = 4 | 5 | 6

const STORAGE_KEY = 'submission-hub-stats-view'

export default function PersonalStats(props: Props) {
  const [cols, setCols] = useState<StatsCols>(() => {
    const saved = Number(localStorage.getItem(`${STORAGE_KEY}-cols`))
    return saved === 4 || saved === 6 ? saved : 5
  })
  const [compact, setCompact] = useState(() => localStorage.getItem(`${STORAGE_KEY}-compact`) === '1')
  const [focus, setFocus] = useState(() => localStorage.getItem(`${STORAGE_KEY}-focus`) === '1')

  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}-cols`, String(cols)) }, [cols])
  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}-compact`, compact ? '1' : '0') }, [compact])
  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}-focus`, focus ? '1' : '0') }, [focus])

  const cls = ['stats-config-shell', `stats-cols-${cols}`, compact ? 'stats-compact' : '', focus ? 'hide-low-priority' : ''].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      <div className="stats-config-bar">
        {[4, 5, 6].map(n => <button key={n} className={cols === n ? 'active' : ''} onClick={() => setCols(n as StatsCols)}>{n}列</button>)}
        <button className={compact ? 'active' : ''} onClick={() => setCompact(v => !v)}>紧凑</button>
        <button className={focus ? 'active' : ''} onClick={() => setFocus(v => !v)}>重点指标</button>
      </div>
      <PersonalStatsRefined {...props} />
    </div>
  )
}
