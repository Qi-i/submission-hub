import { ThemeProvider } from './lib/theme'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import './size.css'
import './design-system.css'
import './stats-fix.css'
import './smart-toolbar.css'
import './ui-stabilize.css'
import './compact-form.css'
import './archive-form.css'
import './final-polish.css'
import './contrast-polish.css'
import './action-center.css'
import './preparation.css'
import './journal-comparison.css'
import './preparation-enhancements.css'
import './logo-redesign.css'
import './visual-refresh.css'
import './unified-ui.css'
import './unified-ui-additions.css'
import './ui-regression-fixes.css'
import './release-polish.css'

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
