import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { UserProfile } from './types'

interface AuthState {
  user: UserProfile | null
  loading: boolean
  signInWithGithub: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<string | null>
  signUpWithEmail: (email: string, password: string, username: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signInWithGithub: async () => {},
  signInWithEmail: async () => null,
  signUpWithEmail: async () => null,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata
        const username = meta?.user_name || meta?.name || session.user.email?.split('@')[0] || 'user'
        await ensureProfile(session.user.id, username, meta?.avatar_url)
        const profile = await fetchProfile(session.user.id)
        setUser(profile)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Auto-create profile for GitHub OAuth users
        if (event === 'SIGNED_IN') {
          const meta = session.user.user_metadata
          const username = meta?.user_name || meta?.name || session.user.email?.split('@')[0] || 'user'
          await ensureProfile(session.user.id, username, meta?.avatar_url)
        }
        const profile = await fetchProfile(session.user.id)
        setUser(profile)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return data
  }

  async function ensureProfile(userId: string, username: string, avatarUrl?: string) {
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!existing) {
      const { error } = await supabase.from('user_profiles').insert({
        id: userId,
        username,
        display_name: username,
        avatar_url: avatarUrl || null,
      } as any)
      if (error) {
        // If username conflict, retry with userId suffix
        if (error.code === '23505') {
          const uniqueName = `${username}-${userId.slice(0, 4)}`
          await supabase.from('user_profiles').insert({
            id: userId,
            username: uniqueName,
            display_name: uniqueName,
            avatar_url: avatarUrl || null,
          } as any)
        }
      }
    }
  }

  const signInWithGithub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'https://qi-i.github.io/submission-hub/',
      },
    })
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    if (data.user) await ensureProfile(data.user.id, email.split('@')[0])
    return null
  }

  const signUpWithEmail = async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (error) return error.message
    if (data.user && !data.session) {
      return '注册成功！请检查邮箱完成验证后再登录。'
    }
    if (data.user) await ensureProfile(data.user.id, username)
    return null
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGithub, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
