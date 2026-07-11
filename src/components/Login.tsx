import { useEffect, useState } from 'react'
import { Github, Mail, Lock, User, LogIn, UserPlus, Eye, BookOpen, FileText, BarChart3, GraduationCap } from 'lucide-react'
import { useAuth } from '../lib/auth'

function readOAuthError() {
  if (typeof window === 'undefined') return ''
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return search.get('error_description') || hash.get('error_description') || search.get('error') || hash.get('error') || ''
}

function clearOAuthError() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const errorKeys = ['error', 'error_code', 'error_description']
  errorKeys.forEach(key => url.searchParams.delete(key))

  if (url.hash) {
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    errorKeys.forEach(key => hash.delete(key))
    const cleanedHash = hash.toString()
    url.hash = cleanedHash ? `#${cleanedHash}` : ''
  }

  window.history.replaceState({}, document.title, url.toString())
}

export default function Login() {
  const { signInWithGithub, signInWithEmail, signUpWithEmail, enterDemo } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)

  useEffect(() => {
    const oauthError = readOAuthError()
    if (!oauthError) return
    setError(oauthError)
    clearOAuthError()
  }, [])

  const handleGithubLogin = async () => {
    if (githubLoading || loading) return
    setError('')
    setGithubLoading(true)
    const oauthError = await signInWithGithub()
    if (oauthError) {
      setError(oauthError)
      setGithubLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const authError = mode === 'login'
      ? await signInWithEmail(email, password)
      : await signUpWithEmail(email, password, username)

    if (authError) setError(authError)
    setLoading(false)
  }

  const floatingIcons = [
    { Icon: BookOpen, x: '8%', y: '15%', size: 28, delay: 0, color: 'var(--accent)' },
    { Icon: FileText, x: '85%', y: '20%', size: 24, delay: 1.5, color: 'var(--purple)' },
    { Icon: BarChart3, x: '12%', y: '75%', size: 26, delay: 3, color: 'var(--gold)' },
    { Icon: GraduationCap, x: '88%', y: '70%', size: 30, delay: 0.8, color: 'var(--success)' },
  ]

  return (
    <div className="auth-page">
      <div className="auth-decor-grid" />

      {floatingIcons.map(({ Icon, x, y, size, delay, color }, i) => (
        <div key={i} style={{
          position: 'absolute', left: x, top: y, zIndex: 0,
          opacity: 0.12, color,
          animation: `float ${4 + i}s ease-in-out ${delay}s infinite`,
          pointerEvents: 'none',
        }}>
          <Icon size={size} strokeWidth={1.5} />
        </div>
      ))}

      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">SH</div>
          <div className="auth-title">Submission Hub</div>
          <div className="auth-desc">学术投稿与成果管理平台</div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '13px', fontSize: '14px', marginBottom: '4px', borderRadius: 12 }}
          onClick={() => void handleGithubLogin()}
          disabled={githubLoading || loading}
        >
          {githubLoading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <Github size={18} />}
          {githubLoading ? '正在跳转 GitHub...' : '使用 GitHub 登录'}
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
                <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  placeholder="输入用户名"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{ paddingLeft: 36, borderRadius: 10 }}
                  required
                />
              </div>
            </div>
          )}
          <div className="field">
            <label className="field-label">邮箱</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ paddingLeft: 36, borderRadius: 10 }}
                required
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label">密码</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                type="password"
                placeholder="至少 6 位"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: 36, borderRadius: 10 }}
                required
                minLength={6}
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '4px', borderRadius: 12 }}
            disabled={loading || githubLoading}
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

        <div className="auth-divider">或</div>

        <button
          className="btn btn-ghost"
          style={{ width: '100%', padding: '12px', fontSize: '13px', borderRadius: 12 }}
          onClick={enterDemo}
          disabled={loading || githubLoading}
        >
          <Eye size={16} />
          无需注册，立即体验演示 →
        </button>
      </div>
    </div>
  )
}
