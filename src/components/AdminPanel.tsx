import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { STATUSES, ADMIN_ID } from '../lib/types'
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

  // Edit user modal
  const [editingUser, setEditingUser] = useState<UserStats | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')

  // Reset password modal
  const [resetUser, setResetUser] = useState<UserStats | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      // Fetch all user profiles (RLS allows public read)
      const { data: profiles, error: pErr } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (pErr) throw pErr

      // Fetch paper stats via Edge Function
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (token) {
        const res = await supabase.functions.invoke('admin-stats', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data) {
          // Merge profiles with stats
          const statsMap = new Map(res.data.map((s: any) => [s.user_id, s]))
          const merged: UserStats[] = (profiles || []).map(p => {
            const s = statsMap.get(p.id)
            return {
              id: p.id,
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              created_at: p.created_at,
              paper_count: s?.paper_count || 0,
              status_counts: s?.status_counts || {},
            }
          })
          setUsers(merged)
          setLoading(false)
          return
        }
      }

      // Fallback: just show profiles without paper stats
      const merged: UserStats[] = (profiles || []).map(p => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        paper_count: 0,
        status_counts: {},
      }))
      setUsers(merged)
    } catch (e: any) {
      setError(e.message || '加载用户数据失败')
    }
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const handleEditSave = async () => {
    if (!editingUser) return
    try {
      // Update user profile via Edge Function (bypasses RLS for other users)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await supabase.functions.invoke('admin-stats', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: 'update_user',
          user_id: editingUser.id,
          username: editUsername,
          display_name: editDisplayName,
        },
      })
      if (res.error) throw res.error
      setEditingUser(null)
      await loadUsers()
    } catch (e: any) {
      alert('更新失败: ' + (e.message || '未知错误'))
    }
  }

  const handleResetPassword = async () => {
    if (!resetUser || !newPassword) return
    setResetting(true)
    setResetMsg('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await supabase.functions.invoke('reset-password', {
        headers: { Authorization: `Bearer ${token}` },
        body: { user_id: resetUser.id, new_password: newPassword },
      })
      if (res.error) throw res.error
      setResetMsg(`密码已重置为: ${newPassword}`)
      setTimeout(() => { setResetUser(null); setNewPassword(''); setResetMsg('') }, 3000)
    } catch (e: any) {
      setResetMsg('重置失败: ' + (e.message || '未知错误'))
    }
    setResetting(false)
  }

  // Aggregate stats
  const totalUsers = users.length
  const totalPapers = users.reduce((sum, u) => sum + u.paper_count, 0)

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="loading-screen" style={{ minHeight: 300 }}>
          <div className="spinner" />
          <span style={{ fontSize: 13 }}>加载管理数据...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      {/* Admin header */}
      <div className="admin-header">
        <div>
          <h2 className="admin-title">后台管理</h2>
          <p className="admin-subtitle">管理员：{user?.username}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadUsers}>
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {error && (
        <div className="auth-error" style={{ margin: '0 24px 16px' }}>
          ⚠️ {error}
          <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
            提示：需要先部署 Edge Functions 才能获取论文统计数据。
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="admin-summary">
        <div className="summary-card">
          <Users size={20} style={{ color: 'var(--accent)' }} />
          <div>
            <div className="summary-value">{totalUsers}</div>
            <div className="summary-label">注册用户</div>
          </div>
        </div>
        <div className="summary-card">
          <FileText size={20} style={{ color: 'var(--purple)' }} />
          <div>
            <div className="summary-value">{totalPapers}</div>
            <div className="summary-label">论文总数</div>
          </div>
        </div>
      </div>

      {/* User list */}
      <div className="admin-user-list">
        {users.map(u => (
          <div key={u.id} className="admin-row">
            <div className="admin-row-main">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="admin-avatar" />
              ) : (
                <div className="admin-avatar admin-avatar-placeholder">
                  {(u.display_name || u.username || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="admin-row-info">
                <div className="admin-row-name">
                  {u.display_name || u.username}
                  {u.id === ADMIN_ID && <span className="badge badge-sm status-review" style={{ marginLeft: 6 }}>管理员</span>}
                </div>
                <div className="admin-row-meta">
                  @{u.username} · 注册于 {u.created_at?.slice(0, 10)}
                </div>
              </div>
            </div>

            <div className="admin-row-stats">
              <span className="admin-paper-count">{u.paper_count} 篇</span>
              {STATUSES.map(s => {
                const count = u.status_counts[s.key] || 0
                if (count === 0) return null
                return (
                  <span key={s.key} className="admin-status-chip" style={{ color: s.color }} title={s.label}>
                    {s.emoji}{count}
                  </span>
                )
              })}
            </div>

            <div className="admin-row-actions">
              <button
                className="btn btn-ghost btn-sm btn-icon"
                title="编辑用户"
                onClick={() => { setEditingUser(u); setEditUsername(u.username); setEditDisplayName(u.display_name || '') }}
              >
                <Edit3 size={14} />
              </button>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                title="重置密码"
                onClick={() => { setResetUser(u); setNewPassword(''); setResetMsg('') }}
              >
                <Key size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit user modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">编辑用户</span>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditingUser(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label">用户名</label>
                <input className="input" value={editUsername} onChange={e => setEditUsername(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">显示名称</label>
                <input className="input" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingUser(null)}>取消</button>
              <button className="btn btn-primary btn-sm" onClick={handleEditSave}><Check size={14} /> 保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetUser && (
        <div className="modal-overlay" onClick={() => setResetUser(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">重置密码</span>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setResetUser(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                为用户 <strong>{resetUser.display_name || resetUser.username}</strong> 设置新密码：
              </p>
              <div className="field">
                <label className="field-label">新密码</label>
                <input
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="输入新密码（至少 6 位）"
                />
              </div>
              {resetMsg && (
                <div className={`auth-error`} style={{ marginBottom: 0, background: resetMsg.includes('成功') ? 'var(--success-bg)' : undefined }}>
                  {resetMsg}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setResetUser(null)}>取消</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={resetting || newPassword.length < 6}
                onClick={handleResetPassword}
              >
                {resetting ? '处理中...' : '确认重置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
