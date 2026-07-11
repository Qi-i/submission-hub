import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Github, LoaderCircle, LockKeyhole, UserRound, X } from 'lucide-react'
import { useAuth } from '../lib/auth'

type ActiveAction = 'profile' | 'github' | 'password' | null
type Feedback = { kind: 'success' | 'error'; text: string } | null

export default function AccountSettingsModal({ onClose }: { onClose: () => void }) {
  const { user, updateAuthorName, linkGithubIdentity, setAccountPassword, getLinkedProviders } = useAuth()
  const [authorName, setAuthorName] = useState(user?.author_name || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [providers, setProviders] = useState<string[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)

  useEffect(() => {
    let active = true
    void getLinkedProviders()
      .then(next => {
        if (active) setProviders(next)
      })
      .finally(() => {
        if (active) setLoadingProviders(false)
      })
    return () => { active = false }
  }, [])

  const githubLinked = providers.includes('github')

  const saveAuthorName = async () => {
    if (activeAction) return
    setActiveAction('profile')
    setFeedback(null)
    const ok = await updateAuthorName(authorName.trim())
    setActiveAction(null)
    setFeedback(ok
      ? { kind: 'success', text: '论文署名已保存。' }
      : { kind: 'error', text: '保存失败，请确认数据库已执行 002_author_identity.sql 迁移。' })
  }

  const linkGithub = async () => {
    if (activeAction || githubLinked) return
    setActiveAction('github')
    setFeedback(null)
    const error = await linkGithubIdentity()
    if (error) {
      setActiveAction(null)
      setFeedback({ kind: 'error', text: error })
    }
  }

  const savePassword = async () => {
    if (activeAction) return
    setFeedback(null)
    if (password.length < 6) {
      setFeedback({ kind: 'error', text: '密码至少需要 6 位。' })
      return
    }
    if (password !== confirmPassword) {
      setFeedback({ kind: 'error', text: '两次输入的密码不一致。' })
      return
    }

    setActiveAction('password')
    const error = await setAccountPassword(password)
    setActiveAction(null)
    if (error) {
      setFeedback({ kind: 'error', text: error })
      return
    }
    setPassword('')
    setConfirmPassword('')
    setFeedback({ kind: 'success', text: '账户密码已设置或更新，以后可使用当前账户邮箱登录。' })
  }

  const sectionStyle = {
    padding: 14,
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--bg-elevated)',
  } as const

  const sectionHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-primary)',
  } as const

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={event => event.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">个人设置</h3>
            <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-muted)' }}>管理论文署名和账户登录方式</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="关闭个人设置"><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
          {feedback && (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '9px 11px',
                borderRadius: 10,
                fontSize: 12,
                lineHeight: 1.5,
                color: feedback.kind === 'success' ? 'var(--success)' : 'var(--danger)',
                background: feedback.kind === 'success' ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'color-mix(in srgb, var(--danger) 10%, transparent)',
              }}
            >
              {feedback.kind === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{feedback.text}</span>
            </div>
          )}

          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}><UserRound size={16} /> 论文署名</div>
            <div className="field">
              <input
                className="input"
                value={authorName}
                onChange={event => setAuthorName(event.target.value)}
                placeholder="例如：Zhang Wei"
                style={{ fontSize: 14, fontWeight: 600 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>用于识别您作为作者或通讯作者的论文，并生成个人统计。</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => void saveAuthorName()} disabled={activeAction !== null}>
                {activeAction === 'profile' && <LoaderCircle size={14} className="spin" />} 保存署名
              </button>
            </div>
          </section>

          <section style={sectionStyle}>
            <div style={{ ...sectionHeaderStyle, justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Github size={16} /> GitHub 登录</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: githubLinked ? 'var(--success)' : 'var(--text-muted)' }}>
                {loadingProviders ? '检查中' : githubLinked ? '已绑定' : '未绑定'}
              </span>
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-muted)' }}>绑定后，GitHub 登录与邮箱密码登录将进入同一账户，共享全部投稿数据。</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => void linkGithub()} disabled={loadingProviders || githubLinked || activeAction !== null}>
                {activeAction === 'github' ? <LoaderCircle size={14} className="spin" /> : <Github size={14} />}
                {githubLinked ? 'GitHub 已绑定' : activeAction === 'github' ? '正在跳转' : '绑定 GitHub'}
              </button>
            </div>
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}><LockKeyhole size={16} /> 设置或更新密码</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div className="field">
                <label className="field-label">新密码</label>
                <input className="input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 6 位" minLength={6} />
              </div>
              <div className="field">
                <label className="field-label">确认密码</label>
                <input className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="再次输入" minLength={6} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => void savePassword()} disabled={!password || !confirmPassword || activeAction !== null}>
                {activeAction === 'password' && <LoaderCircle size={14} className="spin" />} 设置密码
              </button>
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.display_name || user?.username}</div>
          <button className="btn btn-ghost" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
