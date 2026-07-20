import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../account-settings.css'

type Result = { kind: 'success' | 'error'; text: string } | null

const GITHUB_LINK_MARKER = 'submission-hub:github-link-pending'
const OAUTH_ERROR_KEYS = ['error', 'error_code', 'error_description']

function readOAuthError() {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return search.get('error_description') || hash.get('error_description') || search.get('error') || hash.get('error') || ''
}

function clearOAuthErrors() {
  const url = new URL(window.location.href)
  OAUTH_ERROR_KEYS.forEach(key => url.searchParams.delete(key))
  if (url.hash) {
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    OAUTH_ERROR_KEYS.forEach(key => hash.delete(key))
    url.hash = hash.toString() ? `#${hash.toString()}` : ''
  }
  window.history.replaceState({}, document.title, url.toString())
}

export default function AccountLinkResult() {
  const [result, setResult] = useState<Result>(null)

  useEffect(() => {
    if (window.sessionStorage.getItem(GITHUB_LINK_MARKER) !== '1') return
    window.sessionStorage.removeItem(GITHUB_LINK_MARKER)

    const oauthError = readOAuthError()
    if (oauthError) {
      setResult({ kind: 'error', text: `GitHub 绑定失败：${oauthError}` })
      clearOAuthErrors()
      return
    }

    let active = true
    void supabase.auth.getUserIdentities()
      .then(({ data, error }) => {
        if (!active) return
        if (error) throw error
        const linked = data.identities.some(identity => identity.provider === 'github')
        setResult(linked
          ? { kind: 'success', text: 'GitHub 已绑定到当前账户。以后两种登录方式将共享同一份数据。' }
          : { kind: 'error', text: '未检测到 GitHub 身份，绑定可能未完成。请在个人设置中重试。' })
      })
      .catch(error => {
        if (!active) return
        setResult({ kind: 'error', text: error instanceof Error ? error.message : '无法确认 GitHub 绑定结果。' })
      })

    return () => { active = false }
  }, [])

  if (!result) return null

  return (
    <div className={`account-link-result ${result.kind}`} role={result.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
      {result.kind === 'success' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
      <span>{result.text}</span>
      <button type="button" onClick={() => setResult(null)} aria-label="关闭绑定结果"><X size={15} /></button>
    </div>
  )
}
