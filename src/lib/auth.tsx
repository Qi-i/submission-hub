import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { UserProfile } from './types'
import { ADMIN_ID } from './types'
import { DEMO_PROFILE } from './demo-data'

interface AuthState {
  user: UserProfile | null
  loading: boolean
  isDemo: boolean
  signInWithGithub: () => Promise<string | null>
  signInWithEmail: (email: string, password: string) => Promise<string | null>
  signUpWithEmail: (email: string, password: string, username: string) => Promise<string | null>
  linkGithubIdentity: () => Promise<string | null>
  setAccountPassword: (password: string) => Promise<string | null>
  getLinkedProviders: () => Promise<string[]>
  signOut: () => Promise<void>
  enterDemo: () => void
  exitDemo: () => void
  updateAuthorName: (name: string) => Promise<boolean>
}

type AuthUserLike = {
  id: string
  email?: string | null
  created_at?: string
  user_metadata?: Record<string, any>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isDemo: false,
  signInWithGithub: async () => null,
  signInWithEmail: async () => null,
  signUpWithEmail: async () => null,
  linkGithubIdentity: async () => null,
  setAccountPassword: async () => null,
  getLinkedProviders: async () => [],
  signOut: async () => {},
  enterDemo: () => {},
  exitDemo: () => {},
  updateAuthorName: async () => false,
})

function usernameFromUser(user: AuthUserLike) {
  const meta = user.user_metadata || {}
  return meta.username || meta.user_name || meta.preferred_username || meta.name || user.email?.split('@')[0] || 'user'
}

function fallbackProfile(user: AuthUserLike): UserProfile {
  const username = usernameFromUser(user)
  return {
    id: user.id,
    username,
    display_name: username,
    avatar_url: user.user_metadata?.avatar_url || null,
    author_name: null,
    created_at: user.created_at || new Date().toISOString(),
    is_admin: user.id === ADMIN_ID,
  }
}

function oauthRedirectUrl() {
  if (typeof window === 'undefined') return undefined
  const base = import.meta.env.BASE_URL || '/'
  return new URL(base, window.location.origin).toString()
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  const enterDemo = () => {
    setUser(DEMO_PROFILE)
    setIsDemo(true)
  }

  const exitDemo = () => {
    setUser(null)
    setIsDemo(false)
  }

  useEffect(() => {
    let active = true

    const applySessionUser = async (authUser: AuthUserLike) => {
      const username = usernameFromUser(authUser)
      await ensureProfile(authUser.id, username, authUser.user_metadata?.avatar_url)
      const profile = await fetchProfile(authUser.id)
      if (active) setUser(profile || fallbackProfile(authUser))
    }

    const loadSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) console.error('Load auth session error:', error)
        if (!active) return
        if (session?.user) await applySessionUser(session.user)
        else setUser(null)
      } catch (error) {
        console.error('Load auth session failed:', error)
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(async () => {
        if (!active) return
        try {
          if (session?.user) await applySessionUser(session.user)
          else setUser(null)
        } catch (error) {
          console.error('Apply auth state failed:', error)
          if (session?.user && active) setUser(fallbackProfile(session.user))
        } finally {
          if (active) setLoading(false)
        }
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) {
      if (error) console.error('Fetch profile error:', error)
      return null
    }
    return {
      id: (data as any).id,
      username: (data as any).username,
      display_name: (data as any).display_name,
      avatar_url: (data as any).avatar_url,
      author_name: (data as any).author_name || null,
      created_at: (data as any).created_at,
      is_admin: (data as any).id === ADMIN_ID,
    }
  }

  async function ensureProfile(userId: string, username: string, avatarUrl?: string) {
    const { data: existing, error: readError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (readError) console.error('Check profile error:', readError)
    if (existing) return

    const profile = {
      id: userId,
      username,
      display_name: username,
      avatar_url: avatarUrl || null,
    }
    const { error } = await supabase.from('user_profiles').insert(profile as any)
    if (!error || error.code === '23505' && error.message?.toLocaleLowerCase().includes('id')) return

    if (error.code === '23505') {
      const uniqueName = `${username}-${userId.slice(0, 4)}`
      const { error: retryError } = await supabase.from('user_profiles').insert({ ...profile, username: uniqueName, display_name: uniqueName } as any)
      if (retryError && retryError.code !== '23505') console.error('Create unique profile error:', retryError)
      return
    }
    console.error('Create profile error:', error)
  }

  const signInWithGithub = async () => {
    try {
      const redirectTo = oauthRedirectUrl()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: redirectTo ? { redirectTo } : undefined,
      })
      return error?.message || null
    } catch (error) {
      return errorMessage(error, 'GitHub 登录启动失败，请稍后重试。')
    }
  }

  const linkGithubIdentity = async () => {
    try {
      const redirectTo = oauthRedirectUrl()
      const { error } = await supabase.auth.linkIdentity({
        provider: 'github',
        options: redirectTo ? { redirectTo } : undefined,
      })
      return error?.message || null
    } catch (error) {
      return errorMessage(error, 'GitHub 绑定启动失败，请稍后重试。')
    }
  }

  const setAccountPassword = async (password: string) => {
    if (password.length < 6) return '密码至少需要 6 位。'
    try {
      const { error } = await supabase.auth.updateUser({ password })
      return error?.message || null
    } catch (error) {
      return errorMessage(error, '密码更新失败，请稍后重试。')
    }
  }

  const getLinkedProviders = async () => {
    const { data, error } = await supabase.auth.getUserIdentities()
    if (error) throw new Error(error.message || '无法读取账户登录方式。')
    return Array.from(new Set(data.identities.map(identity => identity.provider)))
  }

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return error.message
      if (data.user) await ensureProfile(data.user.id, usernameFromUser(data.user), data.user.user_metadata?.avatar_url)
      return null
    } catch (error) {
      return errorMessage(error, '邮箱登录失败，请稍后重试。')
    }
  }

  const signUpWithEmail = async (email: string, password: string, username: string) => {
    const cleanedUsername = username.trim()
    if (!cleanedUsername) return '请输入用户名。'
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: cleanedUsername, name: cleanedUsername } },
      })
      if (error) return error.message
      if (data.user && !data.session) return '注册成功！请检查邮箱完成验证后再登录。'
      if (data.user) await ensureProfile(data.user.id, cleanedUsername)
      return null
    } catch (error) {
      return errorMessage(error, '注册失败，请稍后重试。')
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) console.error('Sign out error:', error)
    } finally {
      setUser(null)
      setIsDemo(false)
    }
  }

  const updateAuthorName = async (name: string): Promise<boolean> => {
    if (!user) return false
    const cleanedName = name.trim()
    const { error } = await ((supabase.from('user_profiles') as any).update({ author_name: cleanedName || null })).eq('id', user.id)
    if (error) {
      console.error('updateAuthorName error:', error)
      return false
    }
    setUser(current => current ? { ...current, author_name: cleanedName || null } : current)
    return true
  }

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, signInWithGithub, signInWithEmail, signUpWithEmail, linkGithubIdentity, setAccountPassword, getLinkedProviders, signOut, enterDemo, exitDemo, updateAuthorName }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
