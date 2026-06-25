import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import type { Paper } from '../lib/types'
import { STATUSES, getStatus } from '../lib/types'
import { DEMO_PAPERS } from '../lib/demo-data'
import PaperCard from './PaperCard'
import PaperForm from './PaperForm'
import { Search, Plus, Download, Upload, LogOut, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, Shield, X } from 'lucide-react'
import PersonalStats from './PersonalStats'
import AdminPanel from './AdminPanel'

type ViewFilter = 'all' | 'me' | 'author'
type Tab = 'dashboard' | 'stats' | 'admin'

export default function Dashboard() {
  const { user, signOut, isDemo, exitDemo } = useAuth()
  const { mode, setMode } = useTheme()

  const cycleTheme = () => {
    const next: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' }
    setMode(next[mode])
  }
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(!isDemo)
  const [search, setSearch] = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [showFilterDrop, setShowFilterDrop] = useState(false)
  const [editing, setEditing] = useState<Paper | 'new' | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')

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

  // Collect all unique authors
  const allAuthors = Array.from(new Set(papers.flatMap(p => p.authors || []))).sort()

  // Filter papers
  let filtered = papers
  if (viewFilter === 'me' && user) {
    filtered = filtered.filter(p => (p.authors || []).includes(user.username))
  } else if (viewFilter === 'author' && filterAuthor) {
    filtered = filtered.filter(p => (p.authors || []).includes(filterAuthor))
  }
  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.journal || '').toLowerCase().includes(q) ||
      (p.authors || []).some(a => a.toLowerCase().includes(q))
    )
  }

  // Stats
  const stats = STATUSES.map(s => ({
    ...s,
    count: papers.filter(p => p.status === s.key).length,
  }))

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(papers, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `SubmissionHub_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const handleImport = () => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.json'
    inp.onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (!f) return
      const text = await f.text()
      try {
        const data = JSON.parse(text)
        if (!Array.isArray(data)) throw new Error()
        const rows = data.map((d: any) => ({
          id: crypto.randomUUID(),
          user_id: user!.id,
          title: d.title || '未命名',
          title_zh: d.title_zh || null,
          journal: d.journal || null,
          status: d.status || 'preparing',
          lang: d.lang || 'zh',
          quartile_jcr: d.quartile_jcr || null,
          quartile_cas: d.quartile_cas || null,
          quartile_new: d.quartile_new || null,
          quartile_cust: d.quartile_cust || null,
          quartile_zh: d.quartile_zh || null,
          authors: d.authors || [],
          submitted_date: d.submittedDate || d.submitted_date || null,
          resolve_date: d.resolveDate || d.resolve_date || null,
          deadline: d.deadline || null,
          tracking_url: d.trackingUrl || d.tracking_url || null,
          timeline: d.timeline || null,
          notes: d.notes || null,
          prev_id: d.prevId || d.prev_id || null,
          files: d.files || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
    viewFilter === 'all' ? '🌎 全部记录' :
    viewFilter === 'me' ? `🔥 我的 (${user?.username})` :
    `👤 ${filterAuthor}`

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span style={{ fontSize: 13 }}>加载数据中...</span>
      </div>
    )
  }

  return (
    <div className="app-layout">
      {/* Demo banner */}
      {isDemo && (
        <div className="demo-banner">
          <span>🎭 演示模式 — 数据为示例，不会保存更改</span>
          <button className="btn btn-sm btn-ghost" onClick={exitDemo}>
            <X size={14} /> 退出演示
          </button>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo">SH</div>
          <div>
            <div className="header-title">Submission Hub</div>
            <div className="header-subtitle">学术投稿与成果管理</div>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-ghost btn-sm btn-icon theme-toggle-btn"
            onClick={cycleTheme}
            title={mode === 'light' ? '浅色模式' : mode === 'dark' ? '深色模式' : '跟随系统'}
          >
            {mode === 'light' ? <Sun size={15} /> : mode === 'dark' ? <Moon size={15} /> : <Monitor size={15} />}
          </button>
          {!isDemo && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={handleImport} title="导入 JSON">
                <Upload size={14} /> 导入
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleExport} title="导出 JSON">
                <Download size={14} /> 导出
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
                <Plus size={14} /> 新建投稿
              </button>
            </>
          )}
          {user && (
            <div className="header-user">
              {user.avatar_url && <img src={user.avatar_url} alt="" />}
              <span>{user.display_name || user.username}</span>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={isDemo ? exitDemo : signOut}
                title="退出"
                style={{ border: 'none', padding: 0, width: 28, height: 28 }}
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Tab bar */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          <FileText size={14} /> 投稿管理
        </button>
        <button className={`tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
          <BarChart3 size={14} /> 个人统计
        </button>
        {user?.is_admin && (
          <button className={`tab-btn ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}>
            <Shield size={14} /> 后台管理
          </button>
        )}
      </div>

      {tab === 'dashboard' && (
        <>
          {/* Stats bar */}
          <div className="stats-bar">
            {stats.map(s => (
              <div key={s.key} className="stat-card">
                <div className="stat-value" style={{ color: s.color }}>{s.count}</div>
                <div>
                  <div className="stat-label">{s.emoji} {s.label}</div>
                </div>
              </div>
            ))}
            <div className="stat-card" style={{ flex: '0 0 auto', minWidth: 80 }}>
              <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{papers.length}</div>
              <div className="stat-label">📊 总计</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <div className="search-wrap">
              <Search size={15} className="search-icon" />
              <input
                className="search-input"
                placeholder="搜索标题、期刊或作者..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="dropdown" style={{ zIndex: 50 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowFilterDrop(!showFilterDrop)}
                style={{ gap: 6 }}
              >
                <Filter size={13} /> {filterLabel} <ChevronDown size={12} />
              </button>
              <div className="dropdown-menu" style={{ display: showFilterDrop ? 'flex' : 'none' }}>
                <div className={`dropdown-item ${viewFilter === 'all' ? 'active' : ''}`}
                  onClick={() => { setViewFilter('all'); setShowFilterDrop(false) }}>
                  🌎 查看全部记录
                </div>
                <div className={`dropdown-item ${viewFilter === 'me' ? 'active' : ''}`}
                  onClick={() => { setViewFilter('me'); setShowFilterDrop(false) }}>
                  🔥 仅看我的 ({user?.username})
                </div>
                {allAuthors.length > 0 && (
                  <>
                    <div className="dropdown-sep">指定作者</div>
                    {allAuthors.filter(a => a !== user?.username).map(a => (
                      <div key={a} className={`dropdown-item ${viewFilter === 'author' && filterAuthor === a ? 'active' : ''}`}
                        onClick={() => { setViewFilter('author'); setFilterAuthor(a); setShowFilterDrop(false) }}>
                        👤 {a}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 'auto' }}>
              共 {filtered.length} 篇记录
            </span>
          </div>

          {/* Paper grid */}
          <div className="paper-grid">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📑</div>
                <div className="empty-text">
                  {papers.length === 0 ? '还没有投稿记录' : '没有符合条件的记录'}
                </div>
                <div className="empty-sub">
                  {papers.length === 0 && '点击右上角「新建投稿」开始记录'}
                </div>
              </div>
            ) : (
              filtered.map(p => (
                <PaperCard
                  key={p.id}
                  paper={p}
                  currentUsername={user?.username || ''}
                  allPapers={papers}
                  onClick={isDemo ? undefined : () => setEditing(p)}
                />
              ))
            )}
          </div>
        </>
      )}

      {tab === 'stats' && <PersonalStats papers={papers} currentUsername={user?.username || ''} />}

      {tab === 'admin' && user?.is_admin && <AdminPanel />}

      {/* Paper form modal */}
      {editing && (
        <PaperForm
          paper={editing}
          allPapers={papers}
          currentUsername={user?.username || ''}
          onSave={async (data) => {
            if (editing === 'new') {
              const { error } = await supabase.from('papers').insert({
                ...data,
                id: crypto.randomUUID(),
                user_id: user!.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as any)
              if (error) { alert('保存失败: ' + error.message); return }
            } else {
              const updateData = { ...data, updated_at: new Date().toISOString() }
              const { error } = await ((supabase.from('papers') as any).update(updateData)).eq('id', editing.id)
              if (error) { alert('更新失败: ' + error.message); return }
            }
            setEditing(null)
            await loadPapers()
          }}
          onDelete={async (id) => {
            if (!confirm('确认删除这条投稿记录？')) return
            const { error } = await supabase.from('papers').delete().eq('id', id)
            if (error) { alert('删除失败: ' + error.message); return }
            setEditing(null)
            await loadPapers()
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
