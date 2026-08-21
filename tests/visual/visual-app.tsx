import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../src/app-styles'
import '../../src/journal-library-runtime-fixes'
import { ThemeProvider } from '../../src/lib/theme'
import OfflineDashboard from '../../src/components/OfflineDashboard'
import OfflineFirstRunGuide from '../../src/components/OfflineFirstRunGuide'
import ApcAutoConverter from '../../src/components/ApcAutoConverter'
import NavigationMemory from '../../src/components/NavigationMemory'
import ProjectFeedback from '../../src/components/ProjectFeedback'

// Test-only compatibility shell for the existing Luminous regression suite.
// It deliberately lives under tests/ and is not an offline product entry or build target.
// The standalone guide avoids importing the online auth/Supabase stack into visual fixtures.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ApcAutoConverter />
      <NavigationMemory scope="visual-test" />
      <OfflineDashboard />
      <ProjectFeedback />
      <OfflineFirstRunGuide />
    </ThemeProvider>
  </React.StrictMode>,
)
