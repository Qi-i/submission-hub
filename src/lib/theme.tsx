import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = 'small' | 'medium' | 'large'

interface ThemeState {
  mode: ThemeMode
  fontSize: FontSize
  resolved: 'light' | 'dark'
  setMode: (m: ThemeMode) => void
  setFontSize: (s: FontSize) => void
}

const ThemeContext = createContext<ThemeState>({
  mode: 'system',
  fontSize: 'medium',
  resolved: 'light',
  setMode: () => {},
  setFontSize: () => {},
})

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadPrefs(): { mode: ThemeMode; fontSize: FontSize } {
  try {
    const raw = localStorage.getItem('sh-prefs')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { mode: 'system', fontSize: 'medium' }
}

function savePrefs(mode: ThemeMode, fontSize: FontSize) {
  try { localStorage.setItem('sh-prefs', JSON.stringify({ mode, fontSize })) } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => loadPrefs().mode)
  const [fontSize, setFontSizeState] = useState<FontSize>(() => loadPrefs().fontSize)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme)

  const resolved = mode === 'system' ? systemTheme : mode

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Apply theme and font size to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.setAttribute('data-fontsize', fontSize)
  }, [resolved, fontSize])

  const setMode = (m: ThemeMode) => {
    setModeState(m)
    savePrefs(m, fontSize)
  }

  const setFontSize = (s: FontSize) => {
    setFontSizeState(s)
    savePrefs(mode, s)
  }

  return (
    <ThemeContext.Provider value={{ mode, fontSize, resolved, setMode, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
