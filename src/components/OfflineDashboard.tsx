import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from '../lib/theme'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
import { createBackup, parseBackupBundle } from '../lib/backup'
import { mergePreparationSnapshots } from '../lib/preparation-backup'
import * as store from '../lib/local-store'
import * as prepStore from '../lib/local-preparation-store'
import PaperCard from './OfflinePaperCard'
import PaperForm from './OfflinePaperForm'
import ActionCenter from './ActionCenter'
import OfflinePreparationWorkspace from './OfflinePreparationWorkspace'
import LuminousXStatusBar, { type LuminousXLayoutMode } from './LuminousXStatusBar'
import { Search, Plus, Download, Upload, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, X, Lightbulb, Settings, HardDrive } from 'lucide-react'
import PersonalStats from './PersonalStats'

type ViewFilter = 'all' | 'me' | 'author'
type Tab = 'preparation' | 'dashboard' | 'stats'

const TAB_LABELS: Record<Tab, string> = {
  preparation: '投稿准备工作区',
  dashboard: '投稿管理控制台',
  stats: '个人统计分析舱',
}

const TAB_SUBTITLES: Record<Tab, string> = {
  preparation: '在本地组织选题、草稿和目标期刊，所有数据仅保存在当前浏览器。',
  dashboard: '离线集中管理投稿状态、作者、期刊、版本链和备份文件。',
  stats: '从投稿状态、周期、期刊与作者维度审视本地成果进展。',
}

const localDateLabel = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function OfflineDashboard() {
  const { mode, setMode, uiMode } = useTheme()
  const cycleTheme = () => {
    const next: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' }
    setMode(next[mode])
  }

  const [papers, setPapers] = useState<Paper[]>([])
  const [search, setSearch] = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [showFilterDrop, setShowFilterDrop] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [editing, setEditing] = useState<Paper | 'new' | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [layoutMode, setLayoutMode] = useState<LuminousXLayoutMode>('workflow')
  const [authorName, setAuthorName] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [authorNameInput, setAuthorNameInput] = useState('')
  const [prepRefresh, setPrepRefresh] = useState(0)
  const [transferring, setTransferring] = useState(false)

  const effectiveLayoutMode = uiMode === 'luminous-x' ? layoutMode : 'workflow'

  useEffect(() => {
    setPapers(store.getPapers())
    try {
      setAuthorName(localStorage.getItem('sh-offline-author') || '')
    } catch {
      setAuthorName('')
    }
  }, [])

  const refreshPapers = useCallback(() => {
    setPapers(store.getPapers())
  }, [])

  const allAuthors = Array.from(new Set(papers.flatMap(paper => paper.authors || []))).sort()
  const matchName = authorName || ''
  const sameName = (left: string, right: string) => left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()

  let filtered = papers
  if (viewFilter === 'me' && matchName) {
    filtered = filtered.filter(paper => (paper.authors || []).some(name => sameName(name, matchName)))
  } else if (viewFilter === 'author' && filterAuthor) {
    filtered = filtered.filter(paper => (paper.authors || []).some(name => sameName(name, filterAuthor)))
  }
  if (search.trim()) {
    const query = search.trim().toLocaleLowerCase()
    filtered = filtered.filter(paper =>
      (paper.title || '').toLocaleLowerCase().includes(query) ||
      (paper.title_zh || '').toLocaleLowerCase().includes(query) ||
      (paper.journal || '').toLocaleLowerCase().includes(query) ||
      (paper.manuscript_no || '').toLocaleLowerCase().includes(query) ||
      (paper.system_status || '').toLocaleLowerCase().includes(query) ||
      (paper.doi || '').toLocaleLowerCase().includes(query) ||
      (paper.publication_info || '').toLocaleLowerCase().includes(query) ||
      (paper.authors || []).some(author => author.toLocaleLowerCase().includes(query))
    )
  }

  const stats = STATUSES.map(status => ({
    ...status,
    count: papers.filter(paper => paper.status === status.key).length,
  }))
  const hasActiveTools = !!search.trim() || viewFilter !== 'all'

  const clearTools = () => {
    setSearch('')
    setViewFilter('all')
    setFilterAuthor('')
    setShowFilterDrop(false)
  }

  const handleExport = () => {
    if (transferring) return
    setTransferring(true)
    try {
      const content = createBackup(papers, 'offline', prepStore.getPreparationSnapshot())
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `SubmissionHub_Offline_Backup_${localDateLabel()}.json`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } finally {
      setTransferring(false)
    }
  }

  const handleImport = () => {
    if (transferring) return
    setShowTools(false)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return
      setTransferring(true)
      try {
        const json = await file.text()
        const bundle = parseBackupBundle(json)
        const beforePaperCount = store.getPapers().length
        const updatedPapers = store.importPapers(json)
        const paperAdded = Math.max(0, updatedPapers.length - beforePaperCount)
        let journalAdded = 0
        let topicAdded = 0
        let draftAdded = 0

        if (bundle.preparation) {
          const merge = mergePreparationSnapshots(
            prepStore.getPreparationSnapshot(),
            bundle.preparation,
            'offline',
            new Set(updatedPapers.map(paper => paper.id)),
          )
          prepStore.replacePreparationSnapshot(merge.snapshot)
          journalAdded = merge.added.journals.length
          topicAdded = merge.added.topics.length
          draftAdded = merge.added.drafts.length
          setPrepRefresh(value => value + 1)
        }

        setPapers(updatedPapers)
        alert(`导入完成：投稿 ${paperAdded} 条、期刊 ${journalAdded} 条、选题 ${topicAdded} 条、草稿 ${draftAdded} 条。`)
      } catch (error) {
        console.error('Import offline backup failed:', error)
        alert(error instanceof Error ? `导入失败：${error.message}` : '导入失败：备份格式不正确或本地存储不可用。')
      } finally {
        setTransferring(false)
      }
    }
    input.click()
  }

  const filterLabel =
    viewFilter === 'all' ? '全部记录' :
    viewFilter === 'me' ? `我的 (${matchName || '未设置'})` :
    filterAuthor

  const toolPanel = showTools && tab === 'dashboard' && (
    <div className="tool-popover header-tool-popover">
      <div className="search-wrap">
        <Search size={15} className="search-icon" />
        <input className="search-input" placeholder="搜索标题、期刊、作者、稿件编号或 DOI..." value={search} onChange={event => setSearch(event.target.value)} autoFocus />
      </div>
      <div className="dropdown smart-filter-dropdown">
        <button className="btn btn-ghost btn-sm" onClick={() => setShowFilterDrop(!showFilterDrop)} style={{ gap: 6 }}><Filter size={13} /> {filterLabel} <ChevronDown size={12} /></button>
        <div className="dropdown-menu" style={{ display: showFilterDrop ? 'flex' : 'none' }}>
          <div className={`dropdown-item ${viewFilter === 'all' ? 'active' : ''}`} onClick={() => { setViewFilter('all'); setShowFilterDrop(false) }}>查看全部记录</div>
          {matchName && <div className={`dropdown-item ${viewFilter === 'me' ? 'active' : ''}`} onClick={() => { setViewFilter('me'); setShowFilterDrop(false) }}>仅看我的 ({matchName})</div>}
          {allAuthors.length > 0 && <><div className="dropdown-sep">指定作者</div>{allAuthors.filter(author => !sameName(author, matchName)).map(author => <div key={author} className={`dropdown-item ${viewFilter === 'author' && filterAuthor === author ? 'active' : ''}`} onClick={() => { setViewFilter('author'); setFilterAuthor(author); setShowFilterDrop(false) }}>{author}</div>)}</>}
        </div>
      </div>
      {hasActiveTools && <button className="btn btn-ghost btn-sm toolbar-clear" onClick={clearTools}>清除条件</button>}
    </div>
  )

  const renderPaperCard = (paper: Paper, index: number) => (
    <PaperCard key={paper.id} paper={paper} currentUsername="" authorName={authorName} allPapers={papers} index={index} onClick={() => setEditing(paper)} />
  )

  const journalGroups = useMemo(() => {
    const groups = new Map<string, Paper[]>()
    filtered.forEach(paper => {
      const key = paper.journal?.trim() || '未指定期刊'
      groups.set(key, [...(groups.get(key) || []), paper])
    })
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right))
  }, [filtered])

  const paperCollection = filtered.length === 0 ? (
    <div className="paper-grid"><div className="empty-state"><div className="empty-icon">📑</div><div className="empty-text">{papers.length === 0 ? '还没有投稿记录' : '没有符合条件的记录'}</div><div className="empty-sub">{papers.length === 0 && '点击「新建投稿」开始记录，或导入备份文件'}</div></div></div>
  ) : effectiveLayoutMode === 'board' ? (
    <div className="lx-board-view">
      {STATUSES.map(status => {
        const items = filtered.filter(paper => paper.status === status.key)
        return (
          <section className="lx-board-column" key={status.key} style={{ ['--lx-column-accent' as any]: status.color }}>
            <header><span>{status.emoji} {status.label}</span><b>{items.length}</b></header>
            <div className="lx-board-stack">{items.length ? items.map((paper, index) => renderPaperCard(paper, index)) : <div className="lx-column-empty">暂无记录</div>}</div>
          </section>
        )
      })}
    </div>
  ) : effectiveLayoutMode === 'journal' ? (
    <div className="lx-journal-view">
      {journalGroups.map(([journal, items]) => (
        <section className="lx-journal-group" key={journal}>
          <header><div><small>JOURNAL GROUP</small><h2>{journal}</h2></div><b>{items.length} 篇</b></header>
          <div className="paper-grid lx-journal-group-grid">{items.map((paper, index) => renderPaperCard(paper, index))}</div>
        </section>
      ))}
    </div>
  ) : (
    <div className="paper-grid lx-workflow-view">{filtered.map((paper, index) => renderPaperCard(paper, index))}</div>
  )

  return (
    <div className="app-layout">
      <header className="app-header app-header-refined">
        <div className="header-brand">
          <div className="header-logo">SH</div>
          <div>
            <div className="header-title">Submission Hub</div>
            <div className="header-subtitle">离线版 · 数据仅存储在本地浏览器</div>
          </div>
        </div>
        <div className="header-actions">
          <div className="header-utility-stack">
            {tab === 'dashboard' && <div className={`header-toolbox ${showTools ? 'open' : ''}`}><button className={`btn btn-ghost btn-sm toolbar-toggle ${hasActiveTools ? 'active' : ''}`} onClick={() => { setShowTools(!showTools); setShowFilterDrop(false) }}><Filter size={13} /> 检索筛选 <span className="toolbar-count-mini">{filtered.length}</span> <ChevronDown size={12} className={showTools ? 'rotated' : ''} /></button>{toolPanel}</div>}
            <div className="header-utility-grid">
              <button className="btn btn-ghost btn-sm btn-icon theme-toggle-btn" onClick={cycleTheme} title={mode === 'light' ? '浅色模式' : mode === 'dark' ? '深色模式' : '跟随系统'}>{mode === 'light' ? <Sun size={15} /> : mode === 'dark' ? <Moon size={15} /> : <Monitor size={15} />}</button>
              <button className="btn btn-ghost btn-sm" onClick={handleImport} disabled={transferring} title="导入新旧版本完整备份"><Upload size={14} /> 导入</button>
              <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={transferring} title="备份投稿和准备数据"><Download size={14} /> {transferring ? '处理中' : '备份'}</button>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setAuthorNameInput(authorName); setShowSettings(true) }} title="设置署名"><Settings size={15} /></button>
            </div>
            {tab === 'dashboard' && <button className="btn btn-primary btn-sm lx-new-paper" onClick={() => setEditing('new')}><Plus size={14} /> 新建投稿</button>}
            <div className="header-user offline-user"><HardDrive size={15} /><span>{authorName || '本地工作区'}</span></div>
          </div>
        </div>
      </header>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'preparation' ? 'active' : ''}`} onClick={() => { setTab('preparation'); setShowTools(false) }}><Lightbulb size={14} /> 投稿准备</button>
        <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}><FileText size={14} /> 投稿管理</button>
        <button className={`tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => { setTab('stats'); setShowTools(false) }}><BarChart3 size={14} /> 个人统计</button>
      </div>

      {uiMode === 'luminous-x' && <LuminousXStatusBar
        modeLabel={TAB_LABELS[tab]}
        subtitle={TAB_SUBTITLES[tab]}
        recordCount={papers.length}
        layoutMode={layoutMode}
        onLayoutModeChange={tab === 'dashboard' ? setLayoutMode : undefined}
      />}

      {tab === 'preparation' && <OfflinePreparationWorkspace authorName={authorName} refreshToken={prepRefresh} onPaperCreated={refreshPapers} />}

      {tab === 'dashboard' && (
        <>
          <div className="stats-bar">
            {stats.map(status => (
              <div key={status.key} className="stat-card">
                <div className="stat-value" style={{ color: status.color }}>{status.count}</div>
                <div><div className="stat-label">{status.emoji} {status.label}</div></div>
              </div>
            ))}
            <div className="stat-card" style={{ flex: '0 0 auto', minWidth: 80 }}>
              <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{papers.length}</div>
              <div className="stat-label">📊 总计</div>
            </div>
          </div>

          <ActionCenter papers={papers} onOpen={paper => setEditing(paper)} />

          <div className="toolbar offline-main-toolbar">
            <div className="search-wrap">
              <Search size={15} className="search-icon" />
              <input className="search-input" placeholder="搜索标题、期刊、作者、稿件编号或 DOI..." value={search} onChange={event => setSearch(event.target.value)} />
            </div>
            <div className="dropdown" style={{ zIndex: 50 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowFilterDrop(!showFilterDrop)} style={{ gap: 6 }}><Filter size={13} /> {filterLabel} <ChevronDown size={12} /></button>
              <div className="dropdown-menu" style={{ display: showFilterDrop ? 'flex' : 'none' }}>
                <div className={`dropdown-item ${viewFilter === 'all' ? 'active' : ''}`} onClick={() => { setViewFilter('all'); setShowFilterDrop(false) }}>查看全部记录</div>
                {matchName && <div className={`dropdown-item ${viewFilter === 'me' ? 'active' : ''}`} onClick={() => { setViewFilter('me'); setShowFilterDrop(false) }}>仅看我的 ({matchName})</div>}
                {allAuthors.length > 0 && <><div className="dropdown-sep">指定作者</div>{allAuthors.filter(author => !sameName(author, matchName)).map(author => <div key={author} className={`dropdown-item ${viewFilter === 'author' && filterAuthor === author ? 'active' : ''}`} onClick={() => { setViewFilter('author'); setFilterAuthor(author); setShowFilterDrop(false) }}>{author}</div>)}</>}
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 'auto' }}>共 {filtered.length} 篇记录</span>
          </div>

          {paperCollection}
        </>
      )}

      {tab === 'stats' && <PersonalStats papers={papers} currentUsername="" authorName={authorName} />}

      {editing && (
        <PaperForm
          paper={editing}
          allPapers={papers}
          currentUsername={authorName}
          onSave={async data => {
            if (editing === 'new') {
              const newPaper: Paper = {
                ...data,
                id: crypto.randomUUID(),
                user_id: 'offline',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as Paper
              store.addPaper(newPaper)
            } else {
              store.updatePaper({ ...editing, ...data, updated_at: new Date().toISOString() })
            }
            setEditing(null)
            refreshPapers()
          }}
          onDelete={async id => {
            if (!confirm('确认删除这条投稿记录？')) return
            store.deletePaper(id)
            setEditing(null)
            refreshPapers()
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={event => event.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">⚙️ 个人设置</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label">论文署名（用于匹配作者统计）</label>
                <input className="input" value={authorNameInput} onChange={event => setAuthorNameInput(event.target.value)} placeholder="输入您在论文中使用的姓名，如：Zhang Wei" style={{ fontSize: 14, fontWeight: 600 }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>设置后，系统将自动识别您作为作者或通讯作者的论文。</span>
              </div>
            </div>
            <div className="modal-footer">
              <div />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>取消</button>
                <button className="btn btn-primary" onClick={() => {
                  const name = authorNameInput.trim()
                  try {
                    localStorage.setItem('sh-offline-author', name)
                    setAuthorName(name)
                    setShowSettings(false)
                  } catch {
                    alert('保存失败：浏览器本地存储不可用。')
                  }
                }}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
