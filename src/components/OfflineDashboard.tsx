import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../lib/theme'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
import * as store from '../lib/local-store'
import PaperCard from './PaperCard'
import PaperForm from './PaperForm'
import { Search, Plus, Download, Upload, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, X } from 'lucide-react'
import PersonalStats from './PersonalStats'

type ViewFilter = 'all' | 'me' | 'author'
type Tab = 'dashboard' | 'stats'

export default function OfflineDashboard() {
  const { mode, setMode } = useTheme()
  const cycleTheme = () => {
    const next: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' }
    setMode(next[mode])
  }

  const [papers, setPapers] = useState<Paper[]>([])
  const [search, setSearch] = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [showFilterDrop, setShowFilterDrop] = useState(false)
  const [editing, setEditing] = useState<Paper | 'new' | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [authorName, setAuthorName] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [authorNameInput, setAuthorNameInput] = useState('')

  useEffect(() => {
    setPapers(store.getPapers())
    try {
      const name = localStorage.getItem('sh-offline-author') || ''
      setAuthorName(name)
    } catch {}
  }, [])

  const refreshPapers = useCallback(() => {
    setPapers(store.getPapers())
  }, [])

  const allAuthors = Array.from(new Set(papers.flatMap(p => p.authors || []))).sort()

  const matchName = authorName || ''
  let filtered = papers
  if (viewFilter === 'me' && matchName) {
    filtered = filtered.filter(p => (p.authors || []).includes(matchName))
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

  const stats = STATUSES.map(s => ({
    ...s,
    count: papers.filter(p => p.status === s.key).length,
  }))

  const handleExport = () => {
    const blob = new Blob([store.exportPapers()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `SubmissionHub_Offline_${new Date().toISOString().slice(0, 10)}.json`
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
        const updated = store.importPapers(text)
        setPapers(updated)
      } catch {
        alert('导入失败：JSON 格式不正确')
      }
    }
    inp.click()
  }

  const filterLabel =
    viewFilter === 'all' ? '🌎 全部记录' :
    viewFilter === 'me' ? `🔥 我的` :
    `👤 ${filterAuthor}`

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo">SH</div>
          <div>
            <div className="header-title">Submission Hub</div>
            <div className="header-subtitle">离线版 · 数据存储在本地</div>
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
          <button className="btn btn-ghost btn-sm" onClick={handleImport} title="导入 JSON">
            <Upload size={14} /> 导入
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} title="导出 JSON">
            <Download size={14} /> 导出
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <Plus size={14} /> 新建投稿
          </button>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => { setAuthorNameInput(authorName); setShowSettings(true) }}
            title="设置署名"
          >
            <FileText size={15} />
          </button>
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
                {matchName && (
                  <div className={`dropdown-item ${viewFilter === 'me' ? 'active' : ''}`}
                    onClick={() => { setViewFilter('me'); setShowFilterDrop(false) }}>
                    🔥 仅看我的 ({matchName})
                  </div>
                )}
                {allAuthors.length > 0 && (
                  <>
                    <div className="dropdown-sep">指定作者</div>
                    {allAuthors.filter(a => a !== matchName).map(a => (
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
                  {papers.length === 0 && '点击右上角「新建投稿」开始记录，或导入 JSON 文件'}
                </div>
              </div>
            ) : (
              filtered.map((p, i) => (
                <PaperCard
                  key={p.id}
                  paper={p}
                  currentUsername=""
                  authorName={authorName}
                  allPapers={papers}
                  index={i}
                  onClick={() => setEditing(p)}
                />
              ))
            )}
          </div>
        </>
      )}

      {tab === 'stats' && <PersonalStats papers={papers} currentUsername="" authorName={authorName} />}

      {/* Paper form modal */}
      {editing && (
        <PaperForm
          paper={editing}
          allPapers={papers}
          currentUsername={authorName}
          onSave={(data) => {
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
          onDelete={(id) => {
            if (!confirm('确认删除这条投稿记录？')) return
            store.deletePaper(id)
            setEditing(null)
            refreshPapers()
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">⚙️ 个人设置</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowSettings(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label">论文署名 (用于匹配作者统计)</label>
                <input
                  className="input"
                  value={authorNameInput}
                  onChange={e => setAuthorNameInput(e.target.value)}
                  placeholder="输入您在论文中使用的姓名，如：Zhang Wei"
                  style={{ fontSize: 14, fontWeight: 600 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  设置后，系统将自动识别您作为作者/通讯作者的论文，用于个人统计
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <div />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>取消</button>
                <button className="btn btn-primary" onClick={() => {
                  const name = authorNameInput.trim()
                  setAuthorName(name)
                  localStorage.setItem('sh-offline-author', name)
                  setShowSettings(false)
                }}>
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
