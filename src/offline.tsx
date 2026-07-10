import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './lib/theme'
import OfflineDashboard from './components/OfflineDashboard'
import './index.css'
import './refined-ui.css'
import './polish-ui.css'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <OfflineDashboard />
    </ThemeProvider>
  </React.StrictMode>,
)
