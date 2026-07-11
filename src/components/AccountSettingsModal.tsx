import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Github, LoaderCircle, LockKeyhole, UserRound, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import '../account-settings.css'

type ActiveAction = 'profile' | 'github' | 'password' | null
type Feedback = { kind: 'success' | 'error'; text: string } | null

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function AccountSettingsModal({ onClose }: { onClose: () => void }) {
  const { user, updateAuthorName, linkGithubIdentity, setAccountPassword, getLinkedProviders } = useAuth()
  const [authorName, setAuthorName] = useState(user?.author_name || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [providers, setProviders] = useState<string[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [providerLoadFailed, setProviderLoadFailed] = useState(false)
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)

  useEffect(() => {
    let active = true
    void getLinkedProviders()
      .then(next => {
        if (!active) return
        setProviders(next)
        setProviderLoadFailed(false)
      })
      .catch(error => {
        if (!active) return
        setProviderLoadFailed(true)
        setFeedback({ kind: 'error', text: messageFrom(error, '无法读取账户登录方式，请稍后重试。') })
      })
      .finally(() => {
        if (active) setLoadingProviders(false)
      })
    return () => { active = false }
  }, [])

  const githubLinked = providers.includes('github')

  const close = () => {
    if (!activeAction) onClose()
  }

  const saveAuthorName = async () => {
    if (activeAction) return
    setActiveAction('profile')
    setFeedback(null)
    try {
      const ok = await updateAuthorName(authorName.trim())
      setFeedback(ok
        ? { kind: 'success', text: '论文署名已保存。' }
        : { kind: 'error', text: '保存失败，请确认账户资料表已正确初始化。' })
    } catch (error) {
      setFeedback({ kind: 'error', text: messageFrom(error, '论文署名保存失败。') })
    } finally {
      setActiveAction(null)
    }
  }

  const linkGithub = async () => {
    if (activeAction || githubLinked || providerLoadFailed) return
    setActiveAction('github')
    setFeedback(null)
    try {
      const error = await linkGithubIdentity()
      if (error) {
        setFeedback({ kind: 'error', text: error })
        setActiveAction(null)
      }
    } catch (error) {
      setActiveAction(null)
      setFeedback({ kind: 'error', text: messageFrom(error, 'GitHub 绑定启动失败。') })
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
    try {
      const error = await setAccountPassword(password)
      if (error) {
        setFeedback({ kind: 'error', text: error })
        return
      }
      setPassword('')
      setConfirmPassword('')
      setFeedback({ kind: 'success', text: '账户密码已设置或更新，以后可使用当前账户邮箱登录。' })
    } catch (error) {
      setFeedback({ kind: 'error', text: messageFrom(error, '密码更新失败。') })
    } finally {
      setActiveAction(null)
    }
  }

  const providerStatus = loadingProviders
    ? '检查中'
    : providerLoadFailed
      ? '读取失败'
      : githubLinked
        ? '已绑定'
        : '未绑定'

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal account-settings-modal" role="dialog" aria-modal="true" aria-labelledby="account-settings-title" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title" id="account-settings-title">个人设置</h3>
            <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-muted)' }}>管理论文署名和账户登录方式</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={close} disabled={activeAction !== null} aria-label="关闭个人设置"><X size={18} /></button>
        </div>

        <div className="modal-body account-settings-body">
          {feedback && (
            <div className={`account-settings-feedback ${feedback.kind}`} role="status" aria-live="polite">
              {feedback.kind === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{feedback.text}</span>
            </div>
          )}

          <section className="account-settings-section">
            <div className="account-settings-section-header"><UserRound size={16} /> 论文署名</div>
            <div className="field">
              <input
                className="input"
                value={authorName}
                onChange={event => setAuthorName(event.target.value)}
                placeholder="例如：Zhang Wei"
                maxLength={120}
                style={{ fontSize: 14, fontWeight: 600 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>用于识别您作为作者或通讯作者的论文，并生成个人统计。</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveAuthorName()} disabled={activeAction !== null}>
                {activeAction === 'profile' && <LoaderCircle size={14} className="account-settings-spinner" />} 保存署名
              </button>
            </div>
          </section>

          <section className="account-settings-section">
            <div className="account-settings-section-header account-settings-section-header-spread">
              <span className="account-settings-heading"><Github size={16} /> GitHub 登录</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: githubLinked ? 'var(--success)' : providerLoadFailed ? 'var(--danger)' : 'var(--text-muted)' }}>
                {providerStatus}
              </span>
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-muted)' }}>绑定后，GitHub 登录与邮箱密码登录将进入同一账户，共享全部投稿数据。</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void linkGithub()} disabled={loadingProviders || providerLoadFailed || githubLinked || activeAction !== null}>
                {activeAction === 'github' ? <LoaderCircle size={14} className="account-settings-spinner" /> : <Github size={14} />}
                {githubLinked ? 'GitHub 已绑定' : activeAction === 'github' ? '正在跳转' : '绑定 GitHub'}
              </button>
            </div>
          </section>

          <section className="account-settings-section">
            <div className="account-settings-section-header"><LockKeyhole size={16} /> 设置或更新密码</div>
            <div className="account-settings-password-grid">
              <div className="field">
                <label className="field-label" htmlFor="account-new-password">新密码</label>
                <input id="account-new-password" className="input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 6 位" minLength={6} maxLength={128} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="account-confirm-password">确认密码</label>
                <input id="account-confirm-password" className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void savePassword() }} placeholder="再次输入" minLength={6} maxLength={128} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void savePassword()} disabled={!password || !confirmPassword || activeAction !== null}>
                {activeAction === 'password' && <LoaderCircle size={14} className="account-settings-spinner" />} 设置密码
              </button>
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.display_name || user?.username}</div>
          <button type="button" className="btn btn-ghost" onClick={close} disabled={activeAction !== null}>关闭</button>
        </div>
      </div>
    </div>
  )
}
