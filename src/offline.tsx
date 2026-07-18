import React from 'react'
import ReactDOM from 'react-dom/client'
import './app-styles'
import { ThemeProvider } from './lib/theme'
import OfflineDashboard from './components/OfflineDashboard'
import ApcAutoConverter from './components/ApcAutoConverter'
import OfflineFirstRunGuide from './components/OfflineFirstRunGuide'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ApcAutoConverter />
      <OfflineDashboard />
      <OfflineFirstRunGuide />
    </ThemeProvider>
  </React.StrictMode>,
)
