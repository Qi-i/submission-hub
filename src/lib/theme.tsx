import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type UiMode = 'classic' | 'luminous' | 'luminous-x'

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

interface ThemeProviderProps {
  children: ReactNode
  accountKey?: string
  accountPreferences?: StoredPreferences
  onAccountPreferencesChange?: (patch: StoredPreferences) => unknown
}

const DEFAULT_PREFERENCES: Required<StoredPreferences> = {
  mode: 'light',
  uiMode: 'luminous-x',
}

const UI_SEQUENCE: UiMode[] = ['classic', 'luminous', 'luminous-x']

const UI_META: Record<UiMode, { label: string; nextLabel: string; icon: string }> = {
  classic: { label: '经典', nextLabel: '切换到 Luminous UI', icon: '✦' },
  luminous: { label: 'Luminous', nextLabel: '切换到 Luminous X', icon: '◆' },
  'luminous-x': { label: 'Luminous X', nextLabel: '返回经典 UI', icon: '↺' },
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
  return value === 'classic' || value === 'luminous' || value === 'luminous-x'
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getVisualUiOverride(): UiMode | undefined {
  if (typeof window === 'undefined' || !window.location.pathname.includes('/tests/visual/')) return undefined
  const requested = new URLSearchParams(window.location.search).get('ui')
  return isUiMode(requested) ? requested : 'classic'
}

function readStoredPreferences(): Required<StoredPreferences> {
  try {
    const raw = localStorage.getItem('sh-prefs')
    const parsed = raw ? JSON.parse(raw) as StoredPreferences : {}
    return {
      mode: isThemeMode(parsed.mode) ? parsed.mode : DEFAULT_PREFERENCES.mode,
      uiMode: getVisualUiOverride() || (isUiMode(parsed.uiMode) ? parsed.uiMode : DEFAULT_PREFERENCES.uiMode),
    }
  } catch {
    return {
      ...DEFAULT_PREFERENCES,
      uiMode: getVisualUiOverride() || DEFAULT_PREFERENCES.uiMode,
    }
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
  const currentIndex = UI_SEQUENCE.indexOf(uiMode)
  const nextMode = UI_SEQUENCE[(currentIndex + 1) % UI_SEQUENCE.length]
  const meta = UI_META[uiMode]

  return (
    <div className="ui-mode-switcher" data-ui-mode={uiMode} role="group" aria-label="界面版本切换">
      <span className="ui-mode-switcher-label">{meta.label}</span>
      <button
        type="button"
        className="active"
        aria-label={meta.nextLabel}
        title={meta.nextLabel}
        onClick={() => setUiMode(nextMode)}
      >
        <span className="ui-mode-spark" aria-hidden="true">{meta.icon}</span>
      </button>
    </div>
  )
}

export function ThemeProvider({
  children,
  accountKey,
  accountPreferences,
  onAccountPreferencesChange,
}: ThemeProviderProps) {
  const [initialPreferences] = useState(readStoredPreferences)
  const [mode, setModeState] = useState<ThemeMode>(initialPreferences.mode)
  const [uiMode, setUiModeState] = useState<UiMode>(initialPreferences.uiMode)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)
  const seededAccountRef = useRef('')

  const resolved = mode === 'system' ? systemTheme : mode

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!accountKey || getVisualUiOverride()) return
    const nextMode = isThemeMode(accountPreferences?.mode) ? accountPreferences.mode : DEFAULT_PREFERENCES.mode
    const nextUiMode = isUiMode(accountPreferences?.uiMode) ? accountPreferences.uiMode : DEFAULT_PREFERENCES.uiMode
    setModeState(nextMode)
    setUiModeState(nextUiMode)
    mergeStoredPreferences({ mode: nextMode, uiMode: nextUiMode })

    const needsSeed = !isThemeMode(accountPreferences?.mode) || !isUiMode(accountPreferences?.uiMode)
    if (needsSeed && seededAccountRef.current !== accountKey) {
      seededAccountRef.current = accountKey
      void onAccountPreferencesChange?.({ mode: nextMode, uiMode: nextUiMode })
    }
  }, [accountKey, accountPreferences?.mode, accountPreferences?.uiMode, onAccountPreferencesChange])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.setAttribute('data-ui', uiMode)
  }, [resolved, uiMode])

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode)
    mergeStoredPreferences({ mode: nextMode })
    if (accountKey) void onAccountPreferencesChange?.({ mode: nextMode })
  }

  const setUiMode = (nextUiMode: UiMode) => {
    setUiModeState(nextUiMode)
    mergeStoredPreferences({ uiMode: nextUiMode })
    if (accountKey) void onAccountPreferencesChange?.({ uiMode: nextUiMode })
  }

  return (
    <ThemeContext.Provider value={{ mode, resolved, uiMode, setMode, setUiMode }}>
      {children}
      <UiModeSwitcher uiMode={uiMode} setUiMode={setUiMode} />
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
