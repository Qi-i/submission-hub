import React from 'react'
import ReactDOM from 'react-dom/client'
import './app-styles'
import { ThemeProvider } from './lib/theme'
import OfflineDashboard from './components/OfflineDashboard'
import ApcAutoConverter from './components/ApcAutoConverter'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ApcAutoConverter />
      <OfflineDashboard />
    </ThemeProvider>
  </React.StrictMode>,
)
