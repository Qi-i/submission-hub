import { useEffect } from 'react'

type MainPage = 'preparation' | 'dashboard' | 'stats' | 'admin'
type PreparationSection = 'overview' | 'topics' | 'drafts' | 'journals' | 'compare'
type LayoutMode = 'workflow' | 'board' | 'journal'

interface NavigationState {
  page?: MainPage
  preparationSection?: PreparationSection
  layoutMode?: LayoutMode
}

interface Props {
  scope: string
  disabled?: boolean
}

const MAIN_LABELS: Record<MainPage, string> = {
  preparation: '投稿准备',
  dashboard: '投稿管理',
  stats: '个人统计',
  admin: '后台管理',
}

const PREPARATION_LABELS: Record<PreparationSection, string> = {
  overview: '总览',
  topics: '选题池',
  drafts: '草稿准备',
  journals: '期刊库',
  compare: '期刊比较',
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

function readState(scope: string): NavigationState {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(scope)) || '{}')
    return parsed && typeof parsed === 'object' ? parsed as NavigationState : {}
  } catch {
    return {}
  }
}

function writeState(scope: string, patch: Partial<NavigationState>) {
  try {
    localStorage.setItem(keyFor(scope), JSON.stringify({ ...readState(scope), ...patch }))
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

function preparationSectionFromButton(button: HTMLButtonElement): PreparationSection | null {
  const text = compactText(button.textContent)
  return (Object.entries(PREPARATION_LABELS).find(([, label]) => text.includes(compactText(label)))?.[0] as PreparationSection | undefined) || null
}

function layoutModeFromButton(button: HTMLButtonElement): LayoutMode | null {
  const text = compactText(button.textContent)
  return (Object.entries(LAYOUT_LABELS).find(([, label]) => text.includes(compactText(label)))?.[0] as LayoutMode | undefined) || null
}

export default function NavigationMemory({ scope, disabled = false }: Props) {
  useEffect(() => {
    if (disabled) return

    let initialPageRestored = false
    let lastPreparationWorkspace: Element | null = null
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

      const workspace = document.querySelector('.preparation-workspace')
      if (workspace && workspace !== lastPreparationWorkspace) {
        lastPreparationWorkspace = workspace
        if (state.preparationSection && state.preparationSection !== 'overview') {
          findButton('.preparation-workspace > .prep-nav button', PREPARATION_LABELS[state.preparationSection])?.click()
        }
      } else if (!workspace) {
        lastPreparationWorkspace = null
      }

      const layoutSwitch = document.querySelector('.lx-view-switch')
      if (layoutSwitch && layoutSwitch !== lastLayoutSwitch) {
        lastLayoutSwitch = layoutSwitch
        if (state.layoutMode && state.layoutMode !== 'workflow') {
          findButton('.lx-view-switch button', LAYOUT_LABELS[state.layoutMode])?.click()
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
        if (page) writeState(scope, { page })
        return
      }

      if (button.closest('.lx-view-switch')) {
        const layoutMode = layoutModeFromButton(button)
        if (layoutMode) writeState(scope, { layoutMode })
        return
      }

      const preparationControl = button.closest('.preparation-workspace > .prep-nav, .lx-status-bar[data-page="preparation"] .lx-page-proxy-controls')
      if (preparationControl) {
        const preparationSection = preparationSectionFromButton(button)
        if (preparationSection) writeState(scope, { preparationSection })
      }
    }

    document.addEventListener('click', handleClick, true)
    const observer = new MutationObserver(scheduleRestore)
    observer.observe(document.body, { childList: true, subtree: true })
    scheduleRestore()

    return () => {
      document.removeEventListener('click', handleClick, true)
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [disabled, scope])

  return null
}
