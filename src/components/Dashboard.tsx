import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
import { DEMO_PAPERS } from '../lib/demo-data'
import PaperCard from './PaperCard'
import PaperForm from './PaperForm'
import MetricCard from './MetricCard'
import { Search, Plus, Download, Upload, LogOut, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, Shield, X, Settings } from 'lucide-react'
import PersonalStats from './PersonalStats'
import AdminPanel from './AdminPanel'

type ViewFilter = 'all' | 'me' | 'author'
type Tab = 'dashboard' | 'stats' | 'admin'
type StatusFilter = 'all' | string

export default function Dashboard() {
  const { user, signOut, isDemo, exitDemo, updateAuthorName } = useAuth()
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
  const [authorNameInput, setAuthorNameInput] = useState('')

  const canAccessAdmin = !!user && !isDemo

  const closeTools = () => {
    setShowTools(false)
    setShowFilterDrop(false)
  }

  const openPaperForm = (target: Paper | 'new') => {
    closeTools()
    setEditing(target)
  }

  const openSettings = () => {
    closeTools()
    setAuthorNameInput(user?.author_name || '')
    setShowSettings(true)
  }

  const cycleTheme = () => {
    const next: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' }
    setMode(next[mode])
  }

  const loadPapers = useCallback(async () => {
    if (isDemo) {
      setPapers(DEMO_PAPERS)
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('papers')
      .select('*')
      .order('submitted_date', { ascending: false, nullsFirst: false })
    if (error) console.error('Load papers error:', error)
    else setPapers(data || [])
    setLoading(false)
  }, [isDemo])

  useEffect(() => { loadPapers() }, [loadPapers])

  const allAuthors = Array.from(new Set(papers.flatMap(p => p.authors || []))).sort()
  const matchName = user?.author_name || user?.username || ''

  let filtered = papers
  if (statusFilter !== 'all') filtered = filtered.filter(p => p.status === statusFilter)
  if (viewFilter === 'me' && user) {
    filtered = filtered.filter(p =>
      (p.authors || []).includes(user.username) ||
      (user.author_name && (p.authors || []).includes(user.author_name))
    )
  } else if (viewFilter === 'author' && filterAuthor) {
    filtered = filtered.filter(p => (p.authors || []).includes(filterAuthor))
  }
  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.title_zh || '').toLowerCase().includes(q) ||
      (p.journal || '').toLowerCase().includes(q) ||
      (p.manuscript_no || '').toLowerCase().includes(q) ||
      (p.system_status || '').toLowerCase().includes(q) ||
      (p.authors || []).some(a => a.toLowerCase().includes(q))
    )
  }

  const stats = STATUSES.map(s => ({ ...s, count: papers.filter(p => p.status === s.key).length }))
  const hasActiveTools = !!search.trim() || viewFilter !== 'all'

  const clearTools = () => {
    setSearch('')
    setViewFilter('all')
    setFilterAuthor('')
    setShowFilterDrop(false)
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(papers, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `SubmissionHub_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const handleImport = () => {
    closeTools()
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.json'
    inp.onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (!f || !user) return
      const text = await f.text()
      try {
        const data = JSON.parse(text)
        if (!Array.isArray(data)) throw new Error()
        const now = new Date().toISOString()
        const rows = data.map((d: any) => ({
          id: crypto.randomUUID(),
          user_id: user.id,
          title: d.title || '未命名',
          title_zh: d.title_zh || null,
          journal: d.journal || null,
          manuscript_no: d.manuscript_no || null,
          submission_system: d.submission_system || null,
          system_status: d.system_status || null,
          last_status_date: d.last_status_date || null,
          next_action: d.next_action || null,
          reminder_level: d.reminder_level || 'none',
          apc_amount: d.apc_amount || null,
          apc_currency: d.apc_currency || 'USD',
          revision_round: d.revision_round || 0,
          followup_log: d.followup_log || null,
          status: d.status || 'preparing',
          lang: d.lang || 'zh',
          quartile_jcr: d.quartile_jcr || null,
          quartile_cas: d.quartile_cas || null,
          quartile_new: d.quartile_new || null,
          quartile_cust: d.quartile_cust || null,
          quartile_zh: d.quartile_zh || null,
          authors: d.authors || [],
          corresponding_author: d.corresponding_author || null,
          submitted_date: d.submittedDate || d.submitted_date || null,
          resolve_date: d.resolveDate || d.resolve_date || null,
          deadline: d.deadline || null,
          tracking_url: d.trackingUrl || d.tracking_url || null,
          published_url: d.publishedUrl || d.published_url || null,
          timeline: d.timeline || null,
          notes: d.notes || null,
          prev_id: d.prevId || d.prev_id || null,
          files: d.files || null,
          created_at: now,
          updated_at: now,
        }))
        const { error } = await supabase.from('papers').insert(rows as any)
        if (error) throw error
        await loadPapers()
      } catch {
        alert('导入失败：JSON 格式不正确')
      }
    }
    inp.click()
  }

  const filterLabel =
    viewFilter === 'all' ? '全部记录' :
    viewFilter === 'me' ? `我的 (${matchName || user?.username || '未设置'})` :
    filterAuthor

  const toolPanel = showTools && tab === 'dashboard' && (
    <div className="tool-popover header-tool-popover">
      <div className="search-wrap">
        <Search size={15} className="search-icon" />
        <input className="search-input" placeholder="搜索标题、期刊、作者、稿件编号或系统状态..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
      </div>
      <div className="dropdown smart-filter-dropdown">
        <button className="btn btn-ghost btn-sm" onClick={() => setShowFilterDrop(!showFilterDrop)} style={{ gap: 6 }}><Filter size={13} /> {filterLabel} <ChevronDown size={12} /></button>
        <div className="dropdown-menu" style={{ display: showFilterDrop ? 'flex' : 'none' }}>
          <div className={`dropdown-item ${viewFilter === 'all' ? 'active' : ''}`} onClick={() => { setViewFilter('all'); setShowFilterDrop(false) }}>查看全部记录</div>
          <div className={`dropdown-item ${viewFilter === 'me' ? 'active' : ''}`} onClick={() => { setViewFilter('me'); setShowFilterDrop(false) }}>仅看我的 ({matchName || user?.username})</div>
          {allAuthors.length > 0 && <><div className="dropdown-sep">指定作者</div>{allAuthors.filter(a => a !== user?.username && a !== user?.author_name).map(a => <div key={a} className={`dropdown-item ${viewFilter === 'author' && filterAuthor === a ? 'active' : ''}`} onClick={() => { setViewFilter('author'); setFilterAuthor(a); setShowFilterDrop(false) }}>{a}</div>)}</>}
        </div>
      </div>
      {hasActiveTools && <button className="btn btn-ghost btn-sm toolbar-clear" onClick={clearTools}>清除条件</button>}
    </div>
  )

  if (loading) return <div className="loading-screen"><div className="spinner" /><span style={{ fontSize: 13 }}>加载数据中...</span></div>

  return (
    <div className="app-layout">
      {isDemo && (
        <div className="demo-banner">
          <span>🎭 演示模式 — 数据为示例，不会保存更改</span>
          <button className="btn btn-sm btn-ghost" onClick={exitDemo}><X size={14} /> 退出演示</button>
        </div>
      )}

      <header className="app-header app-header-refined">
        <div className="header-left-cluster">
          <div className="header-brand">
            <div className="header-logo">SH</div>
            <div>
              <div className="header-title">Submission Hub</div>
              <div className="header-subtitle">学术投稿与成果管理</div>
            </div>
          </div>
          <nav className="header-tabs" aria-label="主导航">
            <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => { closeTools(); setTab('dashboard') }}><FileText size={14} /> 投稿管理</button>
            <button className={tab === 'stats' ? 'active' : ''} onClick={() => { closeTools(); setTab('stats') }}><BarChart3 size={14} /> 个人统计</button>
            {canAccessAdmin && <button className={tab === 'admin' ? 'active' : ''} onClick={() => { closeTools(); setTab('admin') }}><Shield size={14} /> 后台管理</button>}
          </nav>
        </div>

        <div className="header-actions">
          {tab === 'dashboard' && <div className={`header-toolbox ${showTools ? 'open' : ''}`}>
            <button className={`btn btn-ghost btn-sm toolbar-toggle ${hasActiveTools ? 'active' : ''}`} onClick={() => { setShowTools(!showTools); setShowFilterDrop(false) }}>
              <Filter size={13} /> 检索筛选 <span className="toolbar-count-mini">{filtered.length}</span> <ChevronDown size={12} className={showTools ? 'rotated' : ''} />
            </button>
            {toolPanel}
          </div>}
          <button className="btn btn-ghost btn-sm btn-icon theme-toggle-btn" onClick={cycleTheme} title={mode === 'light' ? '浅色模式' : mode === 'dark' ? '深色模式' : '跟随系统'}>
            {mode === 'light' ? <Sun size={15} /> : mode === 'dark' ? <Moon size={15} /> : <Monitor size={15} />}
          </button>
          {!isDemo && <><button className="btn btn-ghost btn-sm" onClick={handleImport} title="导入 JSON"><Upload size={14} /> 导入</button><button className="btn btn-ghost btn-sm" onClick={handleExport} title="导出 JSON"><Download size={14} /> 导出</button><button className="btn btn-primary btn-sm" onClick={() => openPaperForm('new')}><Plus size={14} /> 新建投稿</button></>}
          {user && !isDemo && <button className="btn btn-ghost btn-sm btn-icon" onClick={openSettings} title="个人设置"><Settings size={15} /></button>}
          {user && <div className="header-user">{user.avatar_url && <img src={user.avatar_url} alt="" />}<span>{user.display_name || user.username}</span><button className="btn btn-ghost btn-sm btn-icon" onClick={isDemo ? exitDemo : signOut} title="退出" style={{ border: 'none', padding: 0, width: 28, height: 28 }}><LogOut size={14} /></button></div>}
        </div>
      </header>

      {tab === 'dashboard' && <>
        <div className="metric-grid dashboard-metrics" style={{ ['--metric-columns' as any]: 8 }}>
          {stats.map(s => <MetricCard key={s.key} icon={s.emoji} value={s.count} label={s.label} helper="点击筛选" color={s.color} tone={`${s.color}18`} active={statusFilter === s.key} onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)} />)}
          <MetricCard icon="📊" value={papers.length} label="总计" helper="全部记录" color="var(--text-primary)" tone="var(--bg-elevated)" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
        </div>

        <div className="paper-grid">
          {filtered.length === 0 ? <div className="empty-state"><div className="empty-icon">📑</div><div className="empty-text">{papers.length === 0 ? '还没有投稿记录' : '没有符合条件的记录'}</div><div className="empty-sub">{papers.length === 0 && '点击右上角「新建投稿」开始记录'}</div></div> : filtered.map((p, i) => <PaperCard key={p.id} paper={p} currentUsername={user?.username || ''} authorName={user?.author_name || ''} allPapers={papers} index={i} onClick={isDemo ? undefined : () => openPaperForm(p)} />)}
        </div>
      </>}

      {tab === 'stats' && <PersonalStats papers={papers} currentUsername={user?.username || ''} authorName={user?.author_name || ''} />}
      {tab === 'admin' && canAccessAdmin && <AdminPanel />}

      {editing && <PaperForm paper={editing} allPapers={papers} currentUsername={user?.username || ''} onSave={async (data) => {
        if (editing === 'new') {
          const { error } = await supabase.from('papers').insert({ ...data, id: crypto.randomUUID(), user_id: user!.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
          if (error) { alert('保存失败: ' + error.message); return }
        } else {
          const updateData = { ...data, updated_at: new Date().toISOString() }
          const { error } = await ((supabase.from('papers') as any).update(updateData)).eq('id', editing.id)
          if (error) { alert('更新失败: ' + error.message); return }
        }
        setEditing(null)
        await loadPapers()
      }} onDelete={async (id) => {
        if (!confirm('确认删除这条投稿记录？')) return
        const { error } = await supabase.from('papers').delete().eq('id', id)
        if (error) { alert('删除失败: ' + error.message); return }
        setEditing(null)
        await loadPapers()
      }} onClose={() => setEditing(null)} />}

      {showSettings && <div className="modal-overlay" onClick={() => setShowSettings(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}><div className="modal-header"><h3 className="modal-title">个人设置</h3><button className="btn btn-ghost btn-icon" onClick={() => setShowSettings(false)}><X size={18} /></button></div><div className="modal-body"><div className="field"><label className="field-label">论文署名</label><input className="input" value={authorNameInput} onChange={e => setAuthorNameInput(e.target.value)} placeholder="输入您在论文中使用的姓名，如：Zhang Wei" style={{ fontSize: 14, fontWeight: 600 }} /><span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>设置后，系统将自动识别您作为作者/通讯作者的论文，用于个人统计。</span></div></div><div className="modal-footer"><div /><div style={{ display: 'flex', gap: 10 }}><button className="btn btn-ghost" onClick={() => setShowSettings(false)}>取消</button><button className="btn btn-primary" onClick={async () => { const ok = await updateAuthorName(authorNameInput.trim()); if (!ok) { alert('保存失败：请确认数据库已执行 002_author_identity.sql 迁移（添加 author_name 列）'); return } setShowSettings(false) }}>保存</button></div></div></div></div>}
    </div>
  )
}
