import React from 'react'
import ReactDOM from 'react-dom/client'
import './app-styles'
import './journal-library-runtime-fixes'
import { ThemeProvider } from './lib/theme'
import OfflineDashboard from './components/OfflineDashboard'
import ApcAutoConverter from './components/ApcAutoConverter'
import OfflineFirstRunGuide from './components/OfflineFirstRunGuide'
import NavigationMemory from './components/NavigationMemory'
import ProjectFeedback from './components/ProjectFeedback'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ApcAutoConverter />
      <NavigationMemory scope="offline" />
      <OfflineDashboard />
      <OfflineFirstRunGuide />
      <ProjectFeedback />
    </ThemeProvider>
  </React.StrictMode>,
)
