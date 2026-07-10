import { ThemeProvider } from './lib/theme'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import './size.css'
import './design-system.css'
import './stats-fix.css'
import './corresponding-badge.css'
import './paper-status-polish.css'
import './smart-toolbar.css'
import './ui-stabilize.css'
import './compact-form.css'
import './archive-form.css'
import './final-polish.css'
import './contrast-polish.css'
import './timeline-today.css'
import './action-center.css'
import './logo-redesign.css'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span style={{ fontSize: 13 }}>加载中...</span>
      </div>
    )
  }

  if (!user) return <Login />
  return <Dashboard />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}
