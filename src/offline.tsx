import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './lib/theme'
import OfflineDashboard from './components/OfflineDashboard'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <OfflineDashboard />
    </ThemeProvider>
  </React.StrictMode>,
)
