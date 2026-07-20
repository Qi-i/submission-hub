import { type ReactNode } from 'react'
import { ThemeProvider } from './lib/theme'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import ApcAutoConverter from './components/ApcAutoConverter'
import { OnlineFirstRunGuideGate } from './components/FirstRunGuide'
import NavigationMemory from './components/NavigationMemory'
import AccountLinkResult from './components/AccountLinkResult'

function AccountThemeProvider({ children }: { children: ReactNode }) {
  const { user, isDemo, experiencePreferences, updateExperiencePreferences } = useAuth()
  const accountKey = user && !isDemo ? user.id : undefined

  return (
    <ThemeProvider
      accountKey={accountKey}
      accountPreferences={accountKey ? experiencePreferences : undefined}
      onAccountPreferencesChange={accountKey ? updateExperiencePreferences : undefined}
    >
      {children}
    </ThemeProvider>
  )
}

function AppContent() {
  const { user, loading, isDemo } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span style={{ fontSize: 13 }}>加载中...</span>
      </div>
    )
  }

  if (!user) return <Login />
  return <>
    <NavigationMemory scope={`online:${user.id}`} disabled={isDemo} />
    <Dashboard />
    <AccountLinkResult />
    <OnlineFirstRunGuideGate />
  </>
}

export default function App() {
  return (
    <AuthProvider>
      <AccountThemeProvider>
        <ApcAutoConverter />
        <AppContent />
      </AccountThemeProvider>
    </AuthProvider>
  )
}
