import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Github,
  ImageOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import '../account-settings.css'

type ActiveAction = 'profile' | 'author' | 'github' | 'password' | null
type Feedback = { kind: 'success' | 'error'; text: string } | null

const AVATAR_BUCKET = 'profile-avatars'
const AVATAR_OBJECT = 'avatar'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ACCEPTED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const GITHUB_LINK_MARKER = 'submission-hub:github-link-pending'

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function avatarObjectPath(userId: string) {
  return `${userId}/${AVATAR_OBJECT}`
}

function versionedUrl(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`
}

function initials(value: string) {
  const cleaned = value.trim()
  if (!cleaned) return 'SH'
  return Array.from(cleaned).slice(0, 2).join('').toUpperCase()
}

export default function AccountSettingsModal({ onClose }: { onClose: () => void }) {
  const { user, updateAuthorName, linkGithubIdentity, setAccountPassword, getLinkedProviders } = useAuth()
  const [displayName, setDisplayName] = useState(user?.display_name || user?.username || '')
  const [authorName, setAuthorName] = useState(user?.author_name || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [providers, setProviders] = useState<string[]>([])
  const [emailAddress, setEmailAddress] = useState('')
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [providerLoadFailed, setProviderLoadFailed] = useState(false)
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const localPreview = useMemo(() => avatarFile ? URL.createObjectURL(avatarFile) : '', [avatarFile])
  const avatarPreview = removeAvatar ? '' : localPreview || user?.avatar_url || ''

  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview)
  }, [localPreview])

  useEffect(() => {
    let active = true
    void Promise.all([getLinkedProviders(), supabase.auth.getUser()])
      .then(([nextProviders, authResult]) => {
        if (!active) return
        if (authResult.error) throw authResult.error
        setProviders(nextProviders)
        setEmailAddress(authResult.data.user?.email || '')
        setEmailConfirmed(Boolean(authResult.data.user?.email_confirmed_at))
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
  const busy = activeAction !== null

  const close = () => {
    if (!busy) onClose()
  }

  const selectAvatar = (file?: File) => {
    setFeedback(null)
    if (!file) return
    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      setFeedback({ kind: 'error', text: '头像仅支持 JPG、PNG 或 WebP 图片。' })
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setFeedback({ kind: 'error', text: '头像文件不能超过 2 MB。' })
      return
    }
    setAvatarFile(file)
    setRemoveAvatar(false)
  }

  const saveProfile = async () => {
    if (!user || busy) return
    const cleanedDisplayName = displayName.trim()
    if (!cleanedDisplayName) {
      setFeedback({ kind: 'error', text: '外显名称不能为空。' })
      return
    }
    if (cleanedDisplayName.length > 80) {
      setFeedback({ kind: 'error', text: '外显名称不能超过 80 个字符。' })
      return
    }

    setActiveAction('profile')
    setFeedback(null)
    try {
      const objectPath = avatarObjectPath(user.id)
      let nextAvatarUrl = user.avatar_url || null

      if (removeAvatar) {
        const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([objectPath])
        if (removeError) throw removeError
        nextAvatarUrl = null
      } else if (avatarFile) {
        const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(objectPath, avatarFile, {
          cacheControl: '3600',
          contentType: avatarFile.type,
          upsert: true,
        })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath)
        nextAvatarUrl = versionedUrl(data.publicUrl)
      }

      const { error: profileError } = await (supabase.from('user_profiles') as any)
        .update({ display_name: cleanedDisplayName, avatar_url: nextAvatarUrl })
        .eq('id', user.id)
      if (profileError) throw profileError

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          display_name: cleanedDisplayName,
          name: cleanedDisplayName,
          avatar_url: nextAvatarUrl,
        },
      })
      if (metadataError) console.error('Sync auth profile metadata error:', metadataError)

      window.location.reload()
    } catch (error) {
      setFeedback({ kind: 'error', text: messageFrom(error, '个人资料保存失败，请稍后重试。') })
      setActiveAction(null)
    }
  }

  const saveAuthorName = async () => {
    if (busy) return
    setActiveAction('author')
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
    if (busy || githubLinked || providerLoadFailed) return
    setActiveAction('github')
    setFeedback(null)
    try {
      window.sessionStorage.setItem(GITHUB_LINK_MARKER, '1')
      const error = await linkGithubIdentity()
      if (error) {
        window.sessionStorage.removeItem(GITHUB_LINK_MARKER)
        setFeedback({ kind: 'error', text: error })
        setActiveAction(null)
      }
    } catch (error) {
      window.sessionStorage.removeItem(GITHUB_LINK_MARKER)
      setActiveAction(null)
      setFeedback({ kind: 'error', text: messageFrom(error, 'GitHub 绑定启动失败。') })
    }
  }

  const savePassword = async () => {
    if (busy) return
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
      setFeedback({ kind: 'success', text: '账户密码已设置或更新，以后可使用当前账户邮箱和密码登录。' })
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
            <div className="account-settings-subtitle">管理外显资料、论文署名和账户登录方式</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={close} disabled={busy} aria-label="关闭个人设置"><X size={18} /></button>
        </div>

        <div className="modal-body account-settings-body">
          {feedback && (
            <div className={`account-settings-feedback ${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
              {feedback.kind === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{feedback.text}</span>
            </div>
          )}

          <section className="account-settings-section">
            <div className="account-settings-section-header"><UserRound size={16} /> 外显资料</div>
            <div className="account-settings-profile-grid">
              <div className="account-settings-avatar-editor">
                <div className="account-settings-avatar-preview" aria-label="头像预览">
                  {avatarPreview ? <img src={avatarPreview} alt="当前头像" /> : <span>{initials(displayName)}</span>}
                </div>
                <input
                  ref={fileInputRef}
                  className="account-settings-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={event => selectAvatar(event.target.files?.[0])}
                />
                <div className="account-settings-avatar-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={busy}><Camera size={14} /> 上传头像</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAvatarFile(null); setRemoveAvatar(true); setFeedback(null) }} disabled={busy || (!avatarPreview && !user?.avatar_url)}><Trash2 size={14} /> 移除</button>
                </div>
                <span className="account-settings-help">JPG、PNG、WebP，最大 2 MB</span>
              </div>
              <div className="field account-settings-display-field">
                <label className="field-label" htmlFor="account-display-name">外显名称</label>
                <input
                  id="account-display-name"
                  className="input"
                  value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                  placeholder="显示在页面右上角的名称"
                  maxLength={80}
                />
                <span className="account-settings-help">用于页面展示，不改变论文作者识别规则。</span>
                <button type="button" className="btn btn-primary btn-sm account-settings-save-button" onClick={() => void saveProfile()} disabled={busy || !displayName.trim()}>
                  {activeAction === 'profile' && <LoaderCircle size={14} className="account-settings-spinner" />} 保存外显资料
                </button>
              </div>
            </div>
          </section>

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
              <span className="account-settings-help">用于识别您作为作者或通讯作者的论文，并生成个人统计。</span>
            </div>
            <div className="account-settings-action-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveAuthorName()} disabled={busy}>
                {activeAction === 'author' && <LoaderCircle size={14} className="account-settings-spinner" />} 保存署名
              </button>
            </div>
          </section>

          <section className="account-settings-section">
            <div className="account-settings-section-header"><Mail size={16} /> 邮箱登录</div>
            <div className="account-settings-identity-row">
              <div>
                <strong>{loadingProviders ? '正在读取账户邮箱…' : emailAddress || '未读取到邮箱'}</strong>
                <span>{emailConfirmed ? '邮箱已验证，可使用密码或一次性登录链接。' : '邮箱尚未验证，密码与登录链接可能不可用。'}</span>
              </div>
              <span className={`account-settings-status ${emailConfirmed ? 'success' : ''}`}>{loadingProviders ? '检查中' : emailConfirmed ? '已验证' : '待验证'}</span>
            </div>
          </section>

          <section className="account-settings-section">
            <div className="account-settings-section-header account-settings-section-header-spread">
              <span className="account-settings-heading"><Github size={16} /> GitHub 登录</span>
              <span className={`account-settings-status ${githubLinked ? 'success' : providerLoadFailed ? 'danger' : ''}`}>{providerStatus}</span>
            </div>
            <div className="account-settings-help">绑定后，GitHub 登录与邮箱登录将进入同一账户，共享全部投稿数据。</div>
            <div className="account-settings-action-row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void linkGithub()} disabled={loadingProviders || providerLoadFailed || githubLinked || busy}>
                {activeAction === 'github' ? <LoaderCircle size={14} className="account-settings-spinner" /> : <Github size={14} />}
                {githubLinked ? 'GitHub 已绑定' : activeAction === 'github' ? '正在跳转' : '绑定 GitHub'}
              </button>
            </div>
          </section>

          <section className="account-settings-section">
            <div className="account-settings-section-header"><LockKeyhole size={16} /> 设置或更新密码</div>
            <div className="account-settings-help account-settings-password-help">GitHub 创建的账户设置密码后，可直接使用同一邮箱和密码登录；未设置密码时仍可使用邮箱登录链接。</div>
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
            <div className="account-settings-action-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void savePassword()} disabled={!password || !confirmPassword || busy}>
                {activeAction === 'password' && <LoaderCircle size={14} className="account-settings-spinner" />} 设置密码
              </button>
            </div>
          </section>

          {!avatarPreview && removeAvatar && (
            <div className="account-settings-avatar-removal-note"><ImageOff size={14} /> 保存后将移除当前头像。</div>
          )}
        </div>

        <div className="modal-footer">
          <div className="account-settings-footer-identity">{displayName.trim() || user?.username}</div>
          <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>关闭</button>
        </div>
      </div>
    </div>
  )
}
