import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
import { inferMainSubmissionStatus, inferRevisionRound } from '../lib/submission-intelligence'
import { createOnlineBackup, importOnlineBackup } from '../lib/online-backup'
import { DEMO_PAPERS } from '../lib/demo-data'
import PaperCard from './PaperCard'
import PaperForm from './PaperForm'
import MetricCard from './MetricCard'
import ActionCenter from './ActionCenter'
import OnlinePreparationWorkspace from './OnlinePreparationWorkspace'
import AccountSettingsModal from './AccountSettingsModal'
import { Search, Plus, Download, Upload, LogOut, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, Shield, X, Settings, Lightbulb } from 'lucide-react'
import PersonalStats from './PersonalStats'
import AdminPanel from './AdminPanel'

type ViewFilter = 'all' | 'me' | 'author'
type Tab = 'preparation' | 'dashboard' | 'stats' | 'admin'
type StatusFilter = 'all' | string

const localDateLabel = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function normalizePaperWorkflow(paper: Paper): Paper {
  return {
    ...paper,
    status: inferMainSubmissionStatus(paper.system_status, paper.status),
    revision_round: inferRevisionRound(paper.timeline, paper.system_status, Number(paper.revision_round || 0)),
  }
}

export default function Dashboard() {
  const { user, signOut, isDemo, exitDemo } = useAuth()
  const { mode, setMode } = useTheme()
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(!isDemo)
  const [search, setSearch] = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [showFilterDrop, setShowFilterDrop] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [editing, setEditing] = useState<Paper | 'new' | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showSettings, setShowSettings] = useState(false)
  const [transferring, setTransferring] = useState(false)

  const canAccessAdmin = user?.is_admin === true && !isDemo

  useEffect(() => {
    if (tab === 'admin' && !canAccessAdmin) setTab('dashboard')
    if (tab === 'preparation' && isDemo) setTab('dashboard')
  }, [tab, canAccessAdmin, isDemo])

  const closeTools = () => {
    setShowTools(false)
    setShowFilterDrop(false)
  }

  const changeTab = (next: Tab) => {
    closeTools()
    setTab(next)
  }

  const openPaperForm = (target: Paper | 'new') => {
    closeTools()
    setEditing(target)
  }

  const openSettings = () => {
    closeTools()
    setShowSettings(true)
  }

  const cycleTheme = () => {
    const next: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' }
    setMode(next[mode])
  }

  const loadPapers = useCallback(async () => {
    if (isDemo) {
      setPapers(DEMO_PAPERS.map(normalizePaperWorkflow))
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('papers')
      .select('*')
      .order('submitted_date', { ascending: false, nullsFirst: false })
    if (error) console.error('Load papers error:', error)
    else setPapers(((data || []) as Paper[]).map(normalizePaperWorkflow))
    setLoading(false)
  }, [isDemo])

  useEffect(() => { void loadPapers() }, [loadPapers])

  const allAuthors = Array.from(new Set(papers.flatMap(paper => paper.authors || []))).sort()
  const matchName = user?.author_name || user?.username || ''
  const sameName = (left: string, right: string) => left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()

  let filtered = papers
  if (statusFilter !== 'all') filtered = filtered.filter(paper => paper.status === statusFilter)
  if (viewFilter === 'me' && user) {
    filtered = filtered.filter(paper => (paper.authors || []).some(name => sameName(name, user.username) || (!!user.author_name && sameName(name, user.author_name))))
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
      (paper.citation || '').toLocaleLowerCase().includes(query) ||
      (paper.journal_url || '').toLocaleLowerCase().includes(query) ||
      (paper.journal_apc_note || '').toLocaleLowerCase().includes(query) ||
      (paper.authors || []).some(author => author.toLocaleLowerCase().includes(query)) ||
      (paper.files || []).some(file => `${file.n || ''} ${file.p || ''} ${file.t || ''}`.toLocaleLowerCase().includes(query))
    )
  }

  const stats = STATUSES.map(status => ({ ...status, count: papers.filter(paper => paper.status === status.key).length }))
  const hasActiveTools = !!search.trim() || viewFilter !== 'all' || statusFilter !== 'all'

  const clearTools = () => {
    setSearch('')
    setViewFilter('all')
    setStatusFilter('all')
    setFilterAuthor('')
    setShowFilterDrop(false)
  }

  const handleExport = async () => {
    if (transferring) return
    setTransferring(true)
    try {
      const content = await createOnlineBackup(papers)
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `SubmissionHub_Backup_${localDateLabel()}.json`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (error) {
      console.error('Create backup failed:', error)
      alert(error instanceof Error ? `备份失败：${error.message}` : '备份失败。')
    } finally {
      setTransferring(false)
    }
  }

  const handleImport = () => {
    if (transferring) return
    closeTools()
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file || !user) return
      setTransferring(true)
      try {
        const result = await importOnlineBackup(await file.text(), user.id, papers)
        await loadPapers()
        alert(`导入完成：投稿 ${result.papers} 条、期刊 ${result.journals} 条、选题 ${result.topics} 条、草稿 ${result.drafts} 条。`)
      } catch (error) {
        console.error('Import backup failed:', error)
        alert(error instanceof Error ? `导入失败：${error.message}` : '导入失败。')
      } finally {
        setTransferring(false)
      }
    }
    input.click()
  }

  const filterLabel =
    viewFilter === 'all' ? '全部记录' :
    viewFilter === 'me' ? `我的 (${matchName || user?.username || '未设置'})` :
    filterAuthor

  const toolPanel = showTools && tab === 'dashboard' && (
    <div className="tool-popover header-tool-popover">
      <div className="search-wrap">
        <Search size={15} className="search-icon" />
        <input className="search-input" placeholder="搜索标题、期刊、作者、稿件编号、DOI、引用格式或附件..." value={search} onChange={event => setSearch(event.target.value)} autoFocus />
      </div>
      <div className="dropdown smart-filter-dropdown">
        <button className="btn btn-ghost btn-sm" onClick={() => setShowFilterDrop(!showFilterDrop)} style={{ gap: 6 }}><Filter size={13} /> {filterLabel} <ChevronDown size={12} /></button>
        <div className="dropdown-menu" style={{ display: showFilterDrop ? 'flex' : 'none' }}>
          <div className={`dropdown-item ${viewFilter === 'all' ? 'active' : ''}`} onClick={() => { setViewFilter('all'); setShowFilterDrop(false) }}>查看全部记录</div>
          <div className={`dropdown-item ${viewFilter === 'me' ? 'active' : ''}`} onClick={() => { setViewFilter('me'); setShowFilterDrop(false) }}>仅看我的 ({matchName || user?.username})</div>
          {allAuthors.length > 0 && <><div className="dropdown-sep">指定作者</div>{allAuthors.filter(author => !sameName(author, user?.username || '') && !sameName(author, user?.author_name || '')).map(author => <div key={author} className={`dropdown-item ${viewFilter === 'author' && filterAuthor === author ? 'active' : ''}`} onClick={() => { setViewFilter('author'); setFilterAuthor(author); setShowFilterDrop(false) }}>{author}</div>)}</>}
        </div>
      </div>
      {hasActiveTools && <button className="btn btn-ghost btn-sm toolbar-clear" onClick={clearTools}>清除条件</button>}
    </div>
  )

  if (loading) return <div className="loading-screen"><div className="spinner" /><span style={{ fontSize: 13 }}>加载数据中...</span></div>

  return (
    <div className="app-layout">
      {isDemo && <div className="demo-banner"><span>🎭 演示模式 — 数据为示例，不会保存更改</span><button className="btn btn-sm btn-ghost" onClick={exitDemo}><X size={14} /> 退出演示</button></div>}

      <header className="app-header app-header-refined">
        <div className="header-left-cluster">
          <div className="header-brand"><div className="header-logo">SH</div><div><div className="header-title">Submission Hub</div><div className="header-subtitle">学术投稿与成果管理</div></div></div>
          <nav className="header-tabs" aria-label="主导航">
            {!isDemo && <button className={tab === 'preparation' ? 'active' : ''} onClick={() => changeTab('preparation')}><Lightbulb size={14} /> 投稿准备</button>}
            <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => changeTab('dashboard')}><FileText size={14} /> 投稿管理</button>
            <button className={tab === 'stats' ? 'active' : ''} onClick={() => changeTab('stats')}><BarChart3 size={14} /> 个人统计</button>
            {canAccessAdmin && <button className={tab === 'admin' ? 'active' : ''} onClick={() => changeTab('admin')}><Shield size={14} /> 后台管理</button>}
          </nav>
        </div>

        <div className="header-actions">
          {tab === 'dashboard' && <div className={`header-toolbox ${showTools ? 'open' : ''}`}><button className={`btn btn-ghost btn-sm toolbar-toggle ${hasActiveTools ? 'active' : ''}`} onClick={() => { setShowTools(!showTools); setShowFilterDrop(false) }}><Filter size={13} /> 检索筛选 <span className="toolbar-count-mini">{filtered.length}</span> <ChevronDown size={12} className={showTools ? 'rotated' : ''} /></button>{toolPanel}</div>}
          <button className="btn btn-ghost btn-sm btn-icon theme-toggle-btn" onClick={cycleTheme} title={mode === 'light' ? '浅色模式' : mode === 'dark' ? '深色模式' : '跟随系统'}>{mode === 'light' ? <Sun size={15} /> : mode === 'dark' ? <Moon size={15} /> : <Monitor size={15} />}</button>
          {!isDemo && <><button className="btn btn-ghost btn-sm" onClick={handleImport} disabled={transferring} title="导入完整备份"><Upload size={14} /> 导入</button><button className="btn btn-ghost btn-sm" onClick={() => void handleExport()} disabled={transferring} title="备份投稿和准备数据"><Download size={14} /> {transferring ? '处理中' : '备份'}</button>{tab === 'dashboard' && <button className="btn btn-primary btn-sm" onClick={() => openPaperForm('new')}><Plus size={14} /> 新建投稿</button>}</>}
          {user && !isDemo && <button className="btn btn-ghost btn-sm btn-icon" onClick={openSettings} title="个人设置"><Settings size={15} /></button>}
          {user && <div className="header-user">{user.avatar_url && <img src={user.avatar_url} alt="" />}<span>{user.display_name || user.username}</span><button className="btn btn-ghost btn-sm btn-icon" onClick={isDemo ? exitDemo : signOut} title="退出" style={{ border: 'none', padding: 0, width: 28, height: 28 }}><LogOut size={14} /></button></div>}
        </div>
      </header>

      {tab === 'preparation' && user && !isDemo && <OnlinePreparationWorkspace userId={user.id} onPaperCreated={() => void loadPapers()} />}

      {tab === 'dashboard' && <>
        <div className="metric-grid dashboard-metrics" style={{ ['--metric-columns' as any]: 8 }}>
          {stats.map(status => <MetricCard key={status.key} icon={status.emoji} value={status.count} label={status.label} helper="点击筛选" color={status.color} tone={`${status.color}18`} active={statusFilter === status.key} onClick={() => setStatusFilter(statusFilter === status.key ? 'all' : status.key)} />)}
          <MetricCard icon="📊" value={papers.length} label="总计" helper="全部记录" color="var(--text-primary)" tone="var(--bg-elevated)" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
        </div>
        <ActionCenter papers={papers} onOpen={isDemo ? undefined : openPaperForm} />
        <div className="paper-grid">{filtered.length === 0 ? <div className="empty-state"><div className="empty-icon">📑</div><div className="empty-text">{papers.length === 0 ? '还没有投稿记录' : '没有符合条件的记录'}</div><div className="empty-sub">{papers.length === 0 && '点击右上角「新建投稿」开始记录'}</div></div> : filtered.map((paper, index) => <PaperCard key={paper.id} paper={paper} currentUsername={user?.username || ''} authorName={user?.author_name || ''} allPapers={papers} index={index} onClick={isDemo ? undefined : () => openPaperForm(paper)} />)}</div>
      </>}

      {tab === 'stats' && <PersonalStats papers={papers} currentUsername={user?.username || ''} authorName={user?.author_name || ''} />}
      {tab === 'admin' && canAccessAdmin && <AdminPanel />}

      {editing && <PaperForm paper={editing} allPapers={papers} currentUsername={user?.username || ''} onSave={async data => {
        if (editing === 'new') {
          const { error } = await supabase.from('papers').insert({ ...data, id: crypto.randomUUID(), user_id: user!.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
          if (error) throw error
        } else {
          const updateData = { ...data, updated_at: new Date().toISOString() }
          const { error } = await ((supabase.from('papers') as any).update(updateData)).eq('id', editing.id)
          if (error) throw error
        }
        setEditing(null)
        await loadPapers()
      }} onDelete={async id => {
        if (!confirm('确认删除这条投稿记录？')) return
        const { error } = await supabase.from('papers').delete().eq('id', id)
        if (error) { alert('删除失败: ' + error.message); return }
        setEditing(null)
        await loadPapers()
      }} onClose={() => setEditing(null)} />}

      {showSettings && <AccountSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
