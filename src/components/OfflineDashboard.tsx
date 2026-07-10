import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../lib/theme'
import type { Paper } from '../lib/types'
import { STATUSES } from '../lib/types'
import * as store from '../lib/local-store'
import PaperCard from './PaperCard'
import PaperForm from './PaperFormArchive'
import ActionCenter from './ActionCenter'
import { Search, Plus, Download, Upload, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, X } from 'lucide-react'
import PersonalStats from './PersonalStats'

type ViewFilter = 'all' | 'me' | 'author'
type Tab = 'dashboard' | 'stats'

const localDateLabel = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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

  const handleExport = () => {
    const url = URL.createObjectURL(new Blob([store.exportPapers()], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `SubmissionHub_Offline_Backup_${localDateLabel()}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const before = store.getPapers().length
        const updated = store.importPapers(await file.text())
        setPapers(updated)
        const added = Math.max(0, updated.length - before)
        alert(added > 0 ? `导入完成：新增 ${added} 条记录。` : '没有发现可新增的记录，重复 ID 已跳过。')
      } catch (error) {
        console.error('Import offline papers failed:', error)
        alert(error instanceof Error ? `导入失败：${error.message}` : '导入失败：备份格式不正确或本地存储不可用。')
      }
    }
    input.click()
  }

  const filterLabel =
    viewFilter === 'all' ? '🌎 全部记录' :
    viewFilter === 'me' ? '🔥 我的' :
    `👤 ${filterAuthor}`

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
          <button className="btn btn-ghost btn-sm btn-icon theme-toggle-btn" onClick={cycleTheme} title={mode === 'light' ? '浅色模式' : mode === 'dark' ? '深色模式' : '跟随系统'}>
            {mode === 'light' ? <Sun size={15} /> : mode === 'dark' ? <Moon size={15} /> : <Monitor size={15} />}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleImport} title="导入新旧版本备份"><Upload size={14} /> 导入</button>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} title="导出带版本信息的备份"><Download size={14} /> 备份</button>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={14} /> 新建投稿</button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setAuthorNameInput(authorName); setShowSettings(true) }} title="设置署名"><FileText size={15} /></button>
        </div>
      </header>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}><FileText size={14} /> 投稿管理</button>
        <button className={`tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}><BarChart3 size={14} /> 个人统计</button>
      </div>

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

          <div className="toolbar">
            <div className="search-wrap">
              <Search size={15} className="search-icon" />
              <input className="search-input" placeholder="搜索标题、期刊、作者、稿件编号或 DOI..." value={search} onChange={event => setSearch(event.target.value)} />
            </div>

            <div className="dropdown" style={{ zIndex: 50 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowFilterDrop(!showFilterDrop)} style={{ gap: 6 }}>
                <Filter size={13} /> {filterLabel} <ChevronDown size={12} />
              </button>
              <div className="dropdown-menu" style={{ display: showFilterDrop ? 'flex' : 'none' }}>
                <div className={`dropdown-item ${viewFilter === 'all' ? 'active' : ''}`} onClick={() => { setViewFilter('all'); setShowFilterDrop(false) }}>🌎 查看全部记录</div>
                {matchName && <div className={`dropdown-item ${viewFilter === 'me' ? 'active' : ''}`} onClick={() => { setViewFilter('me'); setShowFilterDrop(false) }}>🔥 仅看我的 ({matchName})</div>}
                {allAuthors.length > 0 && <>
                  <div className="dropdown-sep">指定作者</div>
                  {allAuthors.filter(author => !sameName(author, matchName)).map(author => <div key={author} className={`dropdown-item ${viewFilter === 'author' && filterAuthor === author ? 'active' : ''}`} onClick={() => { setViewFilter('author'); setFilterAuthor(author); setShowFilterDrop(false) }}>👤 {author}</div>)}
                </>}
              </div>
            </div>

            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 'auto' }}>共 {filtered.length} 篇记录</span>
          </div>

          <div className="paper-grid">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📑</div>
                <div className="empty-text">{papers.length === 0 ? '还没有投稿记录' : '没有符合条件的记录'}</div>
                <div className="empty-sub">{papers.length === 0 && '点击右上角「新建投稿」开始记录，或导入备份文件'}</div>
              </div>
            ) : filtered.map((paper, index) => (
              <PaperCard key={paper.id} paper={paper} currentUsername="" authorName={authorName} allPapers={papers} index={index} onClick={() => setEditing(paper)} />
            ))}
          </div>
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
