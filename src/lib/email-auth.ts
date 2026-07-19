import { supabase } from './supabase'

export type EmailAuthResult = {
  error?: string
  notice?: string
}

function appRedirectUrl() {
  if (typeof window === 'undefined') return undefined
  const base = import.meta.env.BASE_URL || '/'
  return new URL(base, window.location.origin).toString()
}

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase()
}

function friendlyAuthError(message: string, mode: 'login' | 'register' | 'link') {
  const normalized = message.toLocaleLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return '邮箱或密码不正确。若账户最初使用 GitHub 创建，请先使用 GitHub 登录并在个人设置中设置密码，或改用邮箱登录链接。'
  }
  if (normalized.includes('email not confirmed')) return '邮箱尚未验证，请先打开验证邮件完成确认。'
  if (normalized.includes('email rate limit exceeded') || normalized.includes('over_email_send_rate_limit')) {
    return '邮件发送过于频繁，请稍后再试。'
  }
  if (normalized.includes('user already registered')) return '该邮箱已经注册，请直接登录或使用邮箱登录链接。'
  if (normalized.includes('signup is disabled')) return '当前未开放邮箱注册。'
  if (normalized.includes('password should be at least')) return '密码长度不足，请至少输入 6 位。'
  if (normalized.includes('network') || normalized.includes('fetch')) return '网络连接异常，请检查网络后重试。'

  if (mode === 'login') return message || '邮箱登录失败，请稍后重试。'
  if (mode === 'register') return message || '邮箱注册失败，请稍后重试。'
  return message || '邮箱登录链接发送失败，请稍后重试。'
}

export async function signInWithEmailPassword(email: string, password: string): Promise<EmailAuthResult> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return { error: '请输入邮箱。' }
  if (!password) return { error: '请输入密码。' }

  try {
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    return error ? { error: friendlyAuthError(error.message, 'login') } : {}
  } catch (error) {
    return { error: friendlyAuthError(error instanceof Error ? error.message : '', 'login') }
  }
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  username: string,
): Promise<EmailAuthResult> {
  const normalizedEmail = normalizeEmail(email)
  const cleanedUsername = username.trim()
  if (!normalizedEmail) return { error: '请输入邮箱。' }
  if (!cleanedUsername) return { error: '请输入用户名。' }
  if (password.length < 6) return { error: '密码至少需要 6 位。' }

  try {
    const emailRedirectTo = appRedirectUrl()
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { username: cleanedUsername, name: cleanedUsername },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    })
    if (error) return { error: friendlyAuthError(error.message, 'register') }
    if (data.user && !data.session) {
      return { notice: '注册申请已提交，请打开验证邮件完成确认；确认后会返回 Submission Hub。' }
    }
    return { notice: '注册成功，正在进入工作区。' }
  } catch (error) {
    return { error: friendlyAuthError(error instanceof Error ? error.message : '', 'register') }
  }
}

export async function sendExistingUserEmailLink(email: string): Promise<EmailAuthResult> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return { error: '请先输入邮箱。' }

  try {
    const emailRedirectTo = appRedirectUrl()
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    })
    if (error) return { error: friendlyAuthError(error.message, 'link') }
    return { notice: '邮箱登录链接已发送。请检查收件箱；打开链接后会返回当前 Submission Hub 页面。' }
  } catch (error) {
    return { error: friendlyAuthError(error instanceof Error ? error.message : '', 'link') }
  }
}
