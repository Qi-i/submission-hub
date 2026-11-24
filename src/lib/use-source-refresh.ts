import { useEffect, useRef } from 'react'

// Visible, online workspaces refresh without interrupting an editor or
// starting a second background read before the previous one finishes.
export function useSourceRefresh(refresh: () => Promise<unknown>, enabled: boolean, interval = 30000) {
  const latest = useRef(refresh)
  latest.current = refresh
  const running = useRef(false)
  useEffect(() => {
    if (!enabled) return
    const tick = async () => {
      if (running.current || document.hidden || !navigator.onLine) return
      if (document.querySelector('[aria-modal="true"], .modal-overlay, .modal-backdrop')) return
      const active = document.activeElement
      if (active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]')) return
      running.current = true
      try { await latest.current() } catch { /* retain the last successful view */ }
      finally { running.current = false }
    }
    const timer = window.setInterval(() => void tick(), interval)
    const resume = () => void tick()
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', resume)
      window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [enabled, interval])
}
