import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeState>({
  mode: 'system',
  resolved: 'light',
  setMode: () => {},
})

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadMode(): ThemeMode {
  try {
    const raw = localStorage.getItem('sh-prefs')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.mode) return parsed.mode
    }
  } catch {}
  return 'system'
}

function saveMode(mode: ThemeMode) {
  try { localStorage.setItem('sh-prefs', JSON.stringify({ mode })) } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(loadMode)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme)

  const resolved = mode === 'system' ? systemTheme : mode

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
  }, [resolved])

  const setMode = (m: ThemeMode) => {
    setModeState(m)
    saveMode(m)
  }

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
