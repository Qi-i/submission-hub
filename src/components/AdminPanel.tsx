import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { STATUSES } from '../lib/types'
import { Users, FileText, RefreshCw, Key, Edit3, X, Check } from 'lucide-react'

interface UserStats {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  paper_count: number
  status_counts: Record<string, number>
}

export default function AdminPanel() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState<UserStats | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [resetUser, setResetUser] = useState<UserStats | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  const authToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  }

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const token = await authToken()
      if (!token) throw new Error('登录状态已失效，请重新登录。')
      const response = await supabase.functions.invoke('admin-stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.error) throw response.error
      if (!Array.isArray(response.data)) throw new Error(response.data?.error || '后台返回格式不正确')
      setUsers(response.data.map((item: any) => ({
        id: item.user_id,
        username: item.username || 'user',
        display_name: item.display_name || null,
        avatar_url: item.avatar_url || null,
        created_at: item.created_at || '',
        paper_count: Number(item.paper_count) || 0,
        status_counts: item.status_counts && typeof item.status_counts === 'object' ? item.status_counts : {},
      })))
    } catch (caught: any) {
      console.error('Load admin data failed:', caught)
      setError(caught?.message || '加载用户数据失败')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadUsers() }, [])

  const handleEditSave = async () => {
    if (!editingUser) return
    const username = editUsername.trim()
    if (!username) {
      alert('用户名不能为空。')
      return
    }
    try {
      const token = await authToken()
      if (!token) throw new Error('登录状态已失效')
      const response = await supabase.functions.invoke('admin-stats', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: 'update_user',
          user_id: editingUser.id,
          username,
          display_name: editDisplayName.trim(),
        },
      })
      if (response.error) throw response.error
      if (response.data?.error) throw new Error(response.data.error)
      setEditingUser(null)
      await loadUsers()
    } catch (caught: any) {
      alert(`更新失败：${caught?.message || '未知错误'}`)
    }
  }

  const handleResetPassword = async () => {
    if (!resetUser || newPassword.length < 10 || resetting) return
    setResetting(true)
    setResetMsg('')
    try {
      const token = await authToken()
      if (!token) throw new Error('登录状态已失效')
      const response = await supabase.functions.invoke('reset-password', {
        headers: { Authorization: `Bearer ${token}` },
        body: { user_id: resetUser.id, new_password: newPassword },
      })
      if (response.error) throw response.error
      if (response.data?.error) throw new Error(response.data.error)
      setResetMsg('密码已重置。请通过安全渠道通知用户。')
      setNewPassword('')
      window.setTimeout(() => {
        setResetUser(null)
        setResetMsg('')
      }, 1800)
    } catch (caught: any) {
      setResetMsg(`重置失败：${caught?.message || '未知错误'}`)
    } finally {
      setResetting(false)
    }
  }

  const totalUsers = users.length
  const totalPapers = users.reduce((sum, item) => sum + item.paper_count, 0)

  if (loading) {
    return <div className="admin-panel"><div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /><span style={{ fontSize: 13 }}>加载管理数据...</span></div></div>
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div><h2 className="admin-title">后台管理</h2><p className="admin-subtitle">管理员：{user?.username}</p></div>
        <button className="btn btn-ghost btn-sm" onClick={() => void loadUsers()}><RefreshCw size={14} /> 刷新</button>
      </div>

      {error && <div className="auth-error" style={{ margin: '0 24px 16px' }}>⚠️ {error}<div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>请确认已部署 admin-stats Edge Function，并配置管理员 ID。</div></div>}

      <div className="admin-summary">
        <div className="summary-card"><Users size={20} style={{ color: 'var(--accent)' }} /><div><div className="summary-value">{totalUsers}</div><div className="summary-label">注册用户</div></div></div>
        <div className="summary-card"><FileText size={20} style={{ color: 'var(--purple)' }} /><div><div className="summary-value">{totalPapers}</div><div className="summary-label">论文总数</div></div></div>
      </div>

      <div className="admin-user-list">
        {users.length === 0 && !error && <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-text">暂无用户数据</div></div>}
        {users.map(item => (
          <div key={item.id} className="admin-row">
            <div className="admin-row-main">
              {item.avatar_url ? <img src={item.avatar_url} alt="" className="admin-avatar" /> : <div className="admin-avatar admin-avatar-placeholder">{(item.display_name || item.username || '?')[0].toUpperCase()}</div>}
              <div className="admin-row-info">
                <div className="admin-row-name">{item.display_name || item.username}{item.id === user?.id && <span className="badge badge-sm status-review" style={{ marginLeft: 6 }}>管理员</span>}</div>
                <div className="admin-row-meta">@{item.username} · 注册于 {item.created_at?.slice(0, 10) || '未知'}</div>
              </div>
            </div>

            <div className="admin-row-stats">
              <span className="admin-paper-count">{item.paper_count} 篇</span>
              {STATUSES.map(status => {
                const count = item.status_counts[status.key] || 0
                return count > 0 ? <span key={status.key} className="admin-status-chip" style={{ color: status.color }} title={status.label}>{status.emoji}{count}</span> : null
              })}
            </div>

            <div className="admin-row-actions">
              <button className="btn btn-ghost btn-sm btn-icon" title="编辑用户" onClick={() => { setEditingUser(item); setEditUsername(item.username); setEditDisplayName(item.display_name || '') }}><Edit3 size={14} /></button>
              <button className="btn btn-ghost btn-sm btn-icon" title="重置密码" onClick={() => { setResetUser(item); setNewPassword(''); setResetMsg('') }}><Key size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {editingUser && <div className="modal-overlay" onClick={() => setEditingUser(null)}><div className="modal" style={{ maxWidth: 440 }} onClick={event => event.stopPropagation()}>
        <div className="modal-header"><span className="modal-title">编辑用户</span><button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditingUser(null)}><X size={16} /></button></div>
        <div className="modal-body"><div className="field"><label className="field-label">用户名</label><input className="input" value={editUsername} onChange={event => setEditUsername(event.target.value)} maxLength={80} /></div><div className="field"><label className="field-label">显示名称</label><input className="input" value={editDisplayName} onChange={event => setEditDisplayName(event.target.value)} maxLength={120} /></div></div>
        <div className="modal-footer"><button className="btn btn-ghost btn-sm" onClick={() => setEditingUser(null)}>取消</button><button className="btn btn-primary btn-sm" onClick={() => void handleEditSave()}><Check size={14} /> 保存</button></div>
      </div></div>}

      {resetUser && <div className="modal-overlay" onClick={() => !resetting && setResetUser(null)}><div className="modal" style={{ maxWidth: 440 }} onClick={event => event.stopPropagation()}>
        <div className="modal-header"><span className="modal-title">重置密码</span><button className="btn btn-ghost btn-sm btn-icon" disabled={resetting} onClick={() => setResetUser(null)}><X size={16} /></button></div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>为用户 <strong>{resetUser.display_name || resetUser.username}</strong> 设置新密码：</p>
          <div className="field"><label className="field-label">新密码</label><input className="input" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="至少 10 位" minLength={10} maxLength={128} autoComplete="new-password" /></div>
          {resetMsg && <div className="auth-error" style={{ marginBottom: 0, background: resetMsg.startsWith('密码已') ? 'var(--success-bg)' : undefined }}>{resetMsg}</div>}
        </div>
        <div className="modal-footer"><button className="btn btn-ghost btn-sm" disabled={resetting} onClick={() => setResetUser(null)}>取消</button><button className="btn btn-primary btn-sm" disabled={resetting || newPassword.length < 10} onClick={() => void handleResetPassword()}>{resetting ? '处理中...' : '确认重置'}</button></div>
      </div></div>}
    </div>
  )
}
