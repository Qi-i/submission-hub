import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type UiMode = 'classic' | 'luminous'

type ResolvedTheme = 'light' | 'dark'

type StoredPreferences = {
  mode?: ThemeMode
  uiMode?: UiMode
}

interface ThemeState {
  mode: ThemeMode
  resolved: ResolvedTheme
  uiMode: UiMode
  setMode: (mode: ThemeMode) => void
  setUiMode: (uiMode: UiMode) => void
}

const DEFAULT_PREFERENCES: Required<StoredPreferences> = {
  mode: 'light',
  uiMode: 'classic',
}

const ThemeContext = createContext<ThemeState>({
  mode: DEFAULT_PREFERENCES.mode,
  resolved: 'light',
  uiMode: DEFAULT_PREFERENCES.uiMode,
  setMode: () => {},
  setUiMode: () => {},
})

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isUiMode(value: unknown): value is UiMode {
  return value === 'classic' || value === 'luminous'
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredPreferences(): Required<StoredPreferences> {
  try {
    const raw = localStorage.getItem('sh-prefs')
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as StoredPreferences
    return {
      mode: isThemeMode(parsed.mode) ? parsed.mode : DEFAULT_PREFERENCES.mode,
      uiMode: isUiMode(parsed.uiMode) ? parsed.uiMode : DEFAULT_PREFERENCES.uiMode,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function mergeStoredPreferences(patch: StoredPreferences) {
  try {
    const current = readStoredPreferences()
    localStorage.setItem('sh-prefs', JSON.stringify({ ...current, ...patch }))
  } catch {
    // Preferences are optional when browser storage is unavailable.
  }
}

function UiModeSwitcher({ uiMode, setUiMode }: Pick<ThemeState, 'uiMode' | 'setUiMode'>) {
  return (
    <div className="ui-mode-switcher" role="group" aria-label="界面版本切换">
      <span className="ui-mode-switcher-label">界面</span>
      <button
        type="button"
        className={uiMode === 'classic' ? 'active' : ''}
        aria-pressed={uiMode === 'classic'}
        onClick={() => setUiMode('classic')}
      >
        经典
      </button>
      <button
        type="button"
        className={uiMode === 'luminous' ? 'active' : ''}
        aria-pressed={uiMode === 'luminous'}
        onClick={() => setUiMode('luminous')}
      >
        <span className="ui-mode-spark" aria-hidden="true">✦</span>
        Luminous
      </button>
    </div>
  )
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [initialPreferences] = useState(readStoredPreferences)
  const [mode, setModeState] = useState<ThemeMode>(initialPreferences.mode)
  const [uiMode, setUiModeState] = useState<UiMode>(initialPreferences.uiMode)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  const resolved = mode === 'system' ? systemTheme : mode

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.setAttribute('data-ui', uiMode)
  }, [resolved, uiMode])

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode)
    mergeStoredPreferences({ mode: nextMode })
  }

  const setUiMode = (nextUiMode: UiMode) => {
    setUiModeState(nextUiMode)
    mergeStoredPreferences({ uiMode: nextUiMode })
  }

  return (
    <ThemeContext.Provider value={{ mode, resolved, uiMode, setMode, setUiMode }}>
      {children}
      <UiModeSwitcher uiMode={uiMode} setUiMode={setUiMode} />
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
