import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import '../../src/app-styles'
import '../../src/journal-library-runtime-fixes'
import { ThemeProvider } from '../../src/lib/theme'
import OfflineDashboard from '../../src/components/OfflineDashboard'
import ApcAutoConverter from '../../src/components/ApcAutoConverter'
import NavigationMemory from '../../src/components/NavigationMemory'
import ProjectFeedback from '../../src/components/ProjectFeedback'

function VisualJournalCenterBridge() {
  useEffect(() => {
    let cancelled = false

    const ensure = () => {
      if (cancelled) return
      const tabBar = document.querySelector<HTMLElement>('.tab-bar')
      if (!tabBar) {
        window.setTimeout(ensure, 25)
        return
      }
      if (tabBar.querySelector('[data-main-nav-key="journals"]')) return

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'tab-btn visual-journal-center-route'
      button.dataset.mainNavKey = 'journals'
      button.textContent = '期刊中心'
      button.addEventListener('click', () => {
        const preparation = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn'))
          .find(item => item !== button && item.textContent?.includes('投稿准备'))
        preparation?.click()

        const openJournalSection = (attempt = 0) => {
          const pipelineButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.prep-pipeline button'))
            .find(item => item.querySelector('span')?.textContent?.trim() === '期刊')
          if (pipelineButton) {
            pipelineButton.click()
            return
          }
          if (attempt < 80) window.setTimeout(() => openJournalSection(attempt + 1), 25)
        }
        window.setTimeout(() => openJournalSection(), 0)
      })
      tabBar.insertBefore(button, tabBar.children[1] || null)
    }

    ensure()
    const observer = new MutationObserver(ensure)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelled = true
      observer.disconnect()
      document.querySelector('.visual-journal-center-route')?.remove()
    }
  }, [])

  return null
}

// Test-only compatibility shell for the existing Luminous regression suite.
// It deliberately lives under tests/ and is not an offline product entry or build target.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ApcAutoConverter />
      <NavigationMemory scope="visual-test" />
      <VisualJournalCenterBridge />
      <OfflineDashboard />
      <ProjectFeedback />
    </ThemeProvider>
  </React.StrictMode>,
)
