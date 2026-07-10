import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { UserProfile } from './types'
import { ADMIN_ID } from './types'
import { DEMO_PROFILE } from './demo-data'

interface AuthState {
  user: UserProfile | null
  loading: boolean
  isDemo: boolean
  signInWithGithub: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<string | null>
  signUpWithEmail: (email: string, password: string, username: string) => Promise<string | null>
  signOut: () => Promise<void>
  enterDemo: () => void
  exitDemo: () => void
  updateAuthorName: (name: string) => Promise<boolean>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isDemo: false,
  signInWithGithub: async () => {},
  signInWithEmail: async () => null,
  signUpWithEmail: async () => null,
  signOut: async () => {},
  enterDemo: () => {},
  exitDemo: () => {},
  updateAuthorName: async () => false,
})

function usernameFromUser(user: { email?: string | null; user_metadata?: Record<string, any> }) {
  const meta = user.user_metadata || {}
  return meta.username || meta.user_name || meta.preferred_username || meta.name || user.email?.split('@')[0] || 'user'
}

function oauthRedirectUrl() {
  if (typeof window === 'undefined') return undefined
  return new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString()
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

    const loadSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!active) return
        if (session?.user) {
          const username = usernameFromUser(session.user)
          await ensureProfile(session.user.id, username, session.user.user_metadata?.avatar_url)
          const profile = await fetchProfile(session.user.id)
          if (active) setUser(profile)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(async () => {
        if (!active) return
        if (session?.user) {
          const username = usernameFromUser(session.user)
          await ensureProfile(session.user.id, username, session.user.user_metadata?.avatar_url)
          const profile = await fetchProfile(session.user.id)
          if (active) setUser(profile)
        } else if (active) {
          setUser(null)
        }
        if (active) setLoading(false)
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
      .single()
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
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existing) return

    const profile = {
      id: userId,
      username,
      display_name: username,
      avatar_url: avatarUrl || null,
    }
    const { error } = await supabase.from('user_profiles').insert(profile as any)
    if (!error) return

    if (error.code === '23505') {
      const uniqueName = `${username}-${userId.slice(0, 4)}`
      const { error: retryError } = await supabase.from('user_profiles').insert({ ...profile, username: uniqueName, display_name: uniqueName } as any)
      if (retryError) console.error('Create unique profile error:', retryError)
      return
    }
    console.error('Create profile error:', error)
  }

  const signInWithGithub = async () => {
    const redirectTo = oauthRedirectUrl()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: redirectTo ? { redirectTo } : undefined,
    })
    if (error) throw error
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    if (data.user) await ensureProfile(data.user.id, usernameFromUser(data.user))
    return null
  }

  const signUpWithEmail = async (email: string, password: string, username: string) => {
    const cleanedUsername = username.trim()
    if (!cleanedUsername) return '请输入用户名。'
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: cleanedUsername, name: cleanedUsername } },
    })
    if (error) return error.message
    if (data.user && !data.session) return '注册成功！请检查邮箱完成验证后再登录。'
    if (data.user) await ensureProfile(data.user.id, cleanedUsername)
    return null
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsDemo(false)
  }

  const updateAuthorName = async (name: string): Promise<boolean> => {
    if (!user) return false
    const { error } = await ((supabase.from('user_profiles') as any).update({ author_name: name || null })).eq('id', user.id)
    if (error) {
      console.error('updateAuthorName error:', error)
      return false
    }
    setUser({ ...user, author_name: name || null })
    return true
  }

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, signInWithGithub, signInWithEmail, signUpWithEmail, signOut, enterDemo, exitDemo, updateAuthorName }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
