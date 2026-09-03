import { useLayoutEffect } from 'react'

type MainPage = 'preparation' | 'journals' | 'dashboard' | 'stats' | 'admin'
type PreparationSection = 'overview' | 'paper' | 'materials' | 'match' | 'check'
type LegacyPreparationSection = 'topics' | 'drafts' | 'journals' | 'compare'
type LayoutMode = 'workflow' | 'board' | 'journal'

interface NavigationState {
  page?: MainPage
  preparationSection?: PreparationSection | LegacyPreparationSection
  layoutMode?: LayoutMode
}

interface Props {
  scope: string
  disabled?: boolean
}

const MAIN_LABELS: Record<MainPage, string> = {
  preparation: '投稿准备',
  journals: '期刊中心',
  dashboard: '投稿管理',
  stats: '个人统计',
  admin: '后台管理',
}

const LAYOUT_LABELS: Record<LayoutMode, string> = {
  workflow: '工作流视图',
  board: '看板视图',
  journal: '按期刊视图',
}

const compactText = (value: string | null | undefined) => (value || '').replace(/\s+/g, '')

function keyFor(scope: string) {
  return `submission-hub:navigation:${scope}`
}

function normalizePreparationSection(value: NavigationState['preparationSection']): PreparationSection | undefined {
  return value ? 'overview' : undefined
}

function readState(scope: string): NavigationState {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(scope)) || '{}')
    if (!parsed || typeof parsed !== 'object') return {}
    const state = parsed as NavigationState
    const preparationSection = normalizePreparationSection(state.preparationSection)
    return { ...state, preparationSection }
  } catch {
    return {}
  }
}

function writeState(scope: string, patch: Partial<NavigationState>) {
  try {
    const next = { ...readState(scope), ...patch }
    if (next.preparationSection) next.preparationSection = normalizePreparationSection(next.preparationSection)
    localStorage.setItem(keyFor(scope), JSON.stringify(next))
  } catch {
    // Navigation memory is optional when local storage is unavailable.
  }
}

function findButton(selector: string, label: string) {
  const wanted = compactText(label)
  return Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
    .find(button => compactText(button.textContent).includes(wanted))
}

function mainPageFromButton(button: HTMLButtonElement): MainPage | null {
  const text = compactText(button.textContent)
  return (Object.entries(MAIN_LABELS).find(([, label]) => text.includes(compactText(label)))?.[0] as MainPage | undefined) || null
}

function layoutModeFromButton(button: HTMLButtonElement): LayoutMode | null {
  const text = compactText(button.textContent)
  return (Object.entries(LAYOUT_LABELS).find(([, label]) => text.includes(compactText(label)))?.[0] as LayoutMode | undefined) || null
}

export default function NavigationMemory({ scope, disabled = false }: Props) {
  useLayoutEffect(() => {
    if (disabled) return

    let initialPageRestored = false
    let lastLayoutSwitch: Element | null = null
    let frame = 0

    const restore = () => {
      frame = 0
      const state = readState(scope)

      if (!initialPageRestored) {
        const mainNav = document.querySelector('.header-tabs, .tab-bar')
        if (mainNav) {
          initialPageRestored = true
          if (state.page && state.page !== 'dashboard') {
            findButton('.header-tabs button, .tab-bar .tab-btn', MAIN_LABELS[state.page])?.click()
          }
        }
      }


      const layoutSwitch = document.querySelector('.lx-view-switch')
      if (layoutSwitch && layoutSwitch !== lastLayoutSwitch) {
        if (!state.layoutMode || state.layoutMode === 'workflow') {
          lastLayoutSwitch = layoutSwitch
        } else {
          const layoutButton = findButton('.lx-view-switch button', LAYOUT_LABELS[state.layoutMode])
          if (layoutButton) {
            lastLayoutSwitch = layoutSwitch
            layoutButton.click()
          }
        }
      } else if (!layoutSwitch) {
        lastLayoutSwitch = null
      }
    }

    const scheduleRestore = () => {
      if (frame) return
      frame = window.requestAnimationFrame(restore)
    }

    const handleClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button')
      if (!button) return

      if (button.closest('.header-tabs, .tab-bar')) {
        const page = mainPageFromButton(button)
        if (page) writeState(scope, page === 'preparation' ? { page, preparationSection: 'overview' } : { page })
        return
      }

      if (button.closest('.lx-view-switch')) {
        const layoutMode = layoutModeFromButton(button)
        if (layoutMode) writeState(scope, { layoutMode })
        return
      }

    }

    document.addEventListener('click', handleClick, true)
    const observer = new MutationObserver(scheduleRestore)
    observer.observe(document.body, { childList: true, subtree: true })
    restore()

    return () => {
      document.removeEventListener('click', handleClick, true)
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [disabled, scope])

  return null
}
