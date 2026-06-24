import { useState } from 'react'
import { Github, Mail, Lock, User, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { signInWithGithub, signInWithEmail, signUpWithEmail } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const err = mode === 'login'
      ? await signInWithEmail(email, password)
      : await signUpWithEmail(email, password, username)

    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">SH</div>
          <div className="auth-title">Submission Hub</div>
          <div className="auth-desc">学术投稿与成果管理平台</div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: '14px', marginBottom: '4px' }}
          onClick={() => signInWithGithub()}
        >
          <Github size={18} />
          使用 GitHub 登录
        </button>

        <div className="auth-divider">或使用邮箱</div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError('') }}
          >
            登录
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError('') }}
          >
            注册
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'register' && (
            <div className="field">
              <label className="field-label">用户名</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  placeholder="输入用户名"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{ paddingLeft: 34 }}
                  required
                />
              </div>
            </div>
          )}
          <div className="field">
            <label className="field-label">邮箱</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ paddingLeft: 34 }}
                required
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label">密码</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                type="password"
                placeholder="至少 6 位"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: 34 }}
                required
                minLength={6}
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px', marginTop: '4px' }}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            ) : mode === 'login' ? (
              <><LogIn size={16} /> 登录</>
            ) : (
              <><UserPlus size={16} /> 注册</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
