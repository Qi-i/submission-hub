import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
import { createBackup, parseBackup } from '../lib/backup'
import { DEMO_PAPERS } from '../lib/demo-data'
import PaperCard from './PaperCard'
import PaperForm from './PaperForm'
import MetricCard from './MetricCard'
import ActionCenter from './ActionCenter'
import { Search, Plus, Download, Upload, LogOut, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, Shield, X, Settings } from 'lucide-react'
import PersonalStats from './PersonalStats'
import AdminPanel from './AdminPanel'

type ViewFilter = 'all' | 'me' | 'author'
type Tab = 'dashboard' | 'stats' | 'admin'
type StatusFilter = 'all' | string

const validStatuses = new Set<string>(STATUSES.map(status => status.key))
const asText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const localDateLabel = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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

  const canAccessAdmin = user?.is_admin === true && !isDemo

  useEffect(() => {
    if (tab === 'admin' && !canAccessAdmin) setTab('dashboard')
  }, [tab, canAccessAdmin])

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

  const handleExport = () => {
    const url = URL.createObjectURL(new Blob([createBackup(papers, 'online')], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `SubmissionHub_Backup_${localDateLabel()}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const handleImport = () => {
    closeTools()
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file || !user) return
      try {
        const data = parseBackup(await file.text())
        const existingIds = new Set(papers.map(paper => paper.id))
        const sourceRows = data.filter((row: any) => row && typeof row === 'object' && !existingIds.has(String(row.id || '')))
        if (!sourceRows.length) {
          alert('没有发现可新增的记录，重复 ID 已跳过。')
          return
        }

        const idMap = new Map<string, string>()
        const generatedIds = sourceRows.map((row: any) => {
          const id = crypto.randomUUID()
          const sourceId = asText(row.id)
          if (sourceId) idMap.set(sourceId, id)
          return id
        })
        const now = new Date().toISOString()

        const rows = sourceRows.map((source: any, index) => {
          const sourcePrevId = asText(source.prevId ?? source.prev_id)
          const status = asText(source.status) || 'preparing'
          const apcRaw = source.apc_amount ?? source.apcAmount
          const apcNumber = apcRaw === null || apcRaw === undefined || apcRaw === '' ? null : Number(apcRaw)
          const revisionNumber = Number(source.revision_round ?? source.revisionRound)
          return {
            id: generatedIds[index],
            user_id: user.id,
            title: asText(source.title) || '未命名',
            title_zh: asText(source.title_zh ?? source.titleZh),
            journal: asText(source.journal),
            manuscript_no: asText(source.manuscript_no ?? source.manuscriptNo),
            submission_system: asText(source.submission_system ?? source.submissionSystem),
            system_status: asText(source.system_status ?? source.systemStatus),
            last_status_date: asText(source.last_status_date ?? source.lastStatusDate),
            next_action: asText(source.next_action ?? source.nextAction),
            reminder_level: asText(source.reminder_level ?? source.reminderLevel) || 'none',
            apc_amount: apcNumber !== null && Number.isFinite(apcNumber) && apcNumber >= 0 ? apcNumber : null,
            apc_currency: asText(source.apc_currency ?? source.apcCurrency) || 'USD',
            revision_round: Number.isFinite(revisionNumber) ? Math.max(0, Math.trunc(revisionNumber)) : 0,
            followup_log: asText(source.followup_log ?? source.followupLog),
            doi: asText(source.doi),
            publication_info: asText(source.publication_info ?? source.publicationInfo),
            citation: asText(source.citation),
            journal_url: asText(source.journal_url ?? source.journalUrl),
            journal_apc_note: asText(source.journal_apc_note ?? source.journalApcNote),
            status: validStatuses.has(status) ? status : 'preparing',
            lang: asText(source.lang) || 'zh',
            quartile_jcr: asText(source.quartile_jcr ?? source.quartileJcr),
            quartile_cas: asText(source.quartile_cas ?? source.quartileCas),
            quartile_new: asText(source.quartile_new ?? source.quartileNew),
            quartile_cust: asText(source.quartile_cust ?? source.quartileCust),
            quartile_zh: Array.isArray(source.quartile_zh ?? source.quartileZh) ? (source.quartile_zh ?? source.quartileZh).filter((item: unknown) => typeof item === 'string') : [],
            authors: Array.isArray(source.authors) ? source.authors.filter((item: unknown) => typeof item === 'string') : [],
            corresponding_author: asText(source.corresponding_author ?? source.correspondingAuthor),
            submitted_date: asText(source.submittedDate ?? source.submitted_date),
            resolve_date: asText(source.resolveDate ?? source.resolve_date),
            deadline: asText(source.deadline),
            tracking_url: asText(source.trackingUrl ?? source.tracking_url),
            published_url: asText(source.publishedUrl ?? source.published_url),
            timeline: asText(source.timeline),
            notes: asText(source.notes),
            prev_id: sourcePrevId ? idMap.get(sourcePrevId) || (existingIds.has(sourcePrevId) ? sourcePrevId : null) : null,
            files: Array.isArray(source.files) ? source.files.map((item: any) => ({ n: asText(item?.n ?? item?.name) || '', p: asText(item?.p ?? item?.url) || '', t: asText(item?.t ?? item?.type) || '其它' })).filter((item: any) => item.n || item.p) : null,
            created_at: now,
            updated_at: now,
          }
        })

        for (let index = 0; index < rows.length; index += 200) {
          const { error } = await supabase.from('papers').insert(rows.slice(index, index + 200) as any)
          if (error) throw error
        }
        await loadPapers()
        alert(`导入完成：新增 ${rows.length} 条记录。`)
      } catch (error: any) {
        console.error('Import papers failed:', error)
        alert(`导入失败：${error?.message || 'JSON 格式不正确'}`)
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
            <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => { closeTools(); setTab('dashboard') }}><FileText size={14} /> 投稿管理</button>
            <button className={tab === 'stats' ? 'active' : ''} onClick={() => { closeTools(); setTab('stats') }}><BarChart3 size={14} /> 个人统计</button>
            {canAccessAdmin && <button className={tab === 'admin' ? 'active' : ''} onClick={() => { closeTools(); setTab('admin') }}><Shield size={14} /> 后台管理</button>}
          </nav>
        </div>

        <div className="header-actions">
          {tab === 'dashboard' && <div className={`header-toolbox ${showTools ? 'open' : ''}`}><button className={`btn btn-ghost btn-sm toolbar-toggle ${hasActiveTools ? 'active' : ''}`} onClick={() => { setShowTools(!showTools); setShowFilterDrop(false) }}><Filter size={13} /> 检索筛选 <span className="toolbar-count-mini">{filtered.length}</span> <ChevronDown size={12} className={showTools ? 'rotated' : ''} /></button>{toolPanel}</div>}
          <button className="btn btn-ghost btn-sm btn-icon theme-toggle-btn" onClick={cycleTheme} title={mode === 'light' ? '浅色模式' : mode === 'dark' ? '深色模式' : '跟随系统'}>{mode === 'light' ? <Sun size={15} /> : mode === 'dark' ? <Moon size={15} /> : <Monitor size={15} />}</button>
          {!isDemo && <><button className="btn btn-ghost btn-sm" onClick={handleImport} title="导入兼容备份"><Upload size={14} /> 导入</button><button className="btn btn-ghost btn-sm" onClick={handleExport} title="导出版本化备份"><Download size={14} /> 备份</button><button className="btn btn-primary btn-sm" onClick={() => openPaperForm('new')}><Plus size={14} /> 新建投稿</button></>}
          {user && !isDemo && <button className="btn btn-ghost btn-sm btn-icon" onClick={openSettings} title="个人设置"><Settings size={15} /></button>}
          {user && <div className="header-user">{user.avatar_url && <img src={user.avatar_url} alt="" />}<span>{user.display_name || user.username}</span><button className="btn btn-ghost btn-sm btn-icon" onClick={isDemo ? exitDemo : signOut} title="退出" style={{ border: 'none', padding: 0, width: 28, height: 28 }}><LogOut size={14} /></button></div>}
        </div>
      </header>

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

      {showSettings && <div className="modal-overlay" onClick={() => setShowSettings(false)}><div className="modal" onClick={event => event.stopPropagation()} style={{ maxWidth: 480 }}><div className="modal-header"><h3 className="modal-title">个人设置</h3><button className="btn btn-ghost btn-icon" onClick={() => setShowSettings(false)}><X size={18} /></button></div><div className="modal-body"><div className="field"><label className="field-label">论文署名</label><input className="input" value={authorNameInput} onChange={event => setAuthorNameInput(event.target.value)} placeholder="输入您在论文中使用的姓名，如：Zhang Wei" style={{ fontSize: 14, fontWeight: 600 }} /><span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>设置后，系统将自动识别您作为作者或通讯作者的论文，用于个人统计。</span></div></div><div className="modal-footer"><div /><div style={{ display: 'flex', gap: 10 }}><button className="btn btn-ghost" onClick={() => setShowSettings(false)}>取消</button><button className="btn btn-primary" onClick={async () => { const ok = await updateAuthorName(authorNameInput.trim()); if (!ok) { alert('保存失败：请确认数据库已执行 002_author_identity.sql 迁移（添加 author_name 列）'); return } setShowSettings(false) }}>保存</button></div></div></div></div>}
    </div>
  )
}
