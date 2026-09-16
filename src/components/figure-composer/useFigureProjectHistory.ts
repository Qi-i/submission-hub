import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { applyGridLayout, autoWrapProject } from '../../lib/figure-composer/layout'
import type { FigureProject } from '../../lib/figure-composer/types'

const HISTORY_LIMIT = 50
const DUPLICATE_OFFSET = 12
const KEYBOARD_NUDGE = 1
const KEYBOARD_NUDGE_FAST = 10

type HistoryState = {
  past: FigureProject[]
  future: FigureProject[]
}

type ReplaceMode = 'history' | 'transient' | 'reset'

const EMPTY_HISTORY: HistoryState = { past: [], future: [] }

function historySignature(project: FigureProject) {
  const { selectedPanelIds: _selectedPanelIds, selectedTextId: _selectedTextId, updatedAt: _updatedAt, ...meaningful } = project
  return JSON.stringify(meaningful)
}

function stamp(project: FigureProject): FigureProject {
  return { ...project, updatedAt: new Date().toISOString() }
}

function restoreSnapshot(snapshot: FigureProject, current: FigureProject): FigureProject {
  const panelIds = new Set(snapshot.panels.map(panel => panel.id))
  const textIds = new Set(snapshot.texts.map(text => text.id))
  return stamp({
    ...snapshot,
    selectedPanelIds: current.selectedPanelIds.filter(id => panelIds.has(id)),
    selectedTextId: current.selectedTextId && textIds.has(current.selectedTextId) ? current.selectedTextId : null,
  })
}

export function isFigureHistoryEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export default function useFigureProjectHistory(initialProject: FigureProject) {
  const [project, replaceProject] = useReducer((_current: FigureProject, next: FigureProject) => next, initialProject)
  const projectRef = useRef(project)
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY)
  const historyRef = useRef<HistoryState>(EMPTY_HISTORY)
  const gestureStartRef = useRef<FigureProject | null>(null)

  const publishHistory = useCallback((next: HistoryState) => {
    historyRef.current = next
    setHistory(next)
  }, [])

  const pushPast = useCallback((snapshot: FigureProject) => {
    const current = historyRef.current
    publishHistory({
      past: [...current.past.slice(-(HISTORY_LIMIT - 1)), snapshot],
      future: [],
    })
  }, [publishHistory])

  const apply = useCallback((nextProject: FigureProject, mode: ReplaceMode = 'history') => {
    const current = projectRef.current
    if (mode === 'history' && historySignature(current) !== historySignature(nextProject)) pushPast(current)
    else if (mode === 'reset') publishHistory(EMPTY_HISTORY)

    const next = stamp(nextProject)
    projectRef.current = next
    replaceProject(next)
  }, [publishHistory, pushPast])

  const replace = useCallback((next: FigureProject) => apply(next, 'history'), [apply])
  const replaceTransient = useCallback((next: FigureProject) => apply(next, 'transient'), [apply])
  const resetProject = useCallback((next: FigureProject) => {
    gestureStartRef.current = null
    apply(next, 'reset')
  }, [apply])

  const beginGesture = useCallback(() => {
    if (!gestureStartRef.current) gestureStartRef.current = projectRef.current
  }, [])

  const finishGesture = useCallback(() => {
    const start = gestureStartRef.current
    gestureStartRef.current = null
    if (!start || historySignature(start) === historySignature(projectRef.current)) return false
    pushPast(start)
    return true
  }, [pushPast])

  const undo = useCallback(() => {
    gestureStartRef.current = null
    const currentHistory = historyRef.current
    const previous = currentHistory.past.at(-1)
    if (!previous) return false
    const current = projectRef.current
    publishHistory({
      past: currentHistory.past.slice(0, -1),
      future: [...currentHistory.future.slice(-(HISTORY_LIMIT - 1)), current],
    })
    const restored = restoreSnapshot(previous, current)
    projectRef.current = restored
    replaceProject(restored)
    return true
  }, [publishHistory])

  const redo = useCallback(() => {
    gestureStartRef.current = null
    const currentHistory = historyRef.current
    const nextProject = currentHistory.future.at(-1)
    if (!nextProject) return false
    const current = projectRef.current
    publishHistory({
      past: [...currentHistory.past.slice(-(HISTORY_LIMIT - 1)), current],
      future: currentHistory.future.slice(0, -1),
    })
    const restored = restoreSnapshot(nextProject, current)
    projectRef.current = restored
    replaceProject(restored)
    return true
  }, [publishHistory])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFigureHistoryEditableTarget(event.target)) return

      const current = projectRef.current
      const key = event.key.toLowerCase()
      const modified = event.ctrlKey || event.metaKey

      if (modified && key === 'd' && current.selectedPanelIds.length) {
        const selectedIds = new Set(current.selectedPanelIds)
        const copies = current.panels
          .filter(panel => selectedIds.has(panel.id))
          .map(panel => ({
            ...panel,
            id: crypto.randomUUID(),
            x: panel.x + DUPLICATE_OFFSET,
            y: panel.y + DUPLICATE_OFFSET,
          }))
        if (copies.length) {
          event.preventDefault()
          apply({
            ...current,
            canvas: { ...current.canvas, layoutMode: 'manual' },
            panels: [...current.panels, ...copies],
            selectedPanelIds: copies.map(panel => panel.id),
            selectedTextId: null,
          })
        }
        return
      }

      if (!modified && !event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && current.selectedPanelIds.length) {
        const step = event.shiftKey ? KEYBOARD_NUDGE_FAST : KEYBOARD_NUDGE
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
        const selectedIds = new Set(current.selectedPanelIds)
        event.preventDefault()
        apply({
          ...current,
          canvas: { ...current.canvas, layoutMode: 'manual' },
          panels: current.panels.map(panel => selectedIds.has(panel.id) ? { ...panel, x: panel.x + dx, y: panel.y + dy } : panel),
        })
        return
      }

      if (!modified && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (current.selectedPanelIds.length) {
          event.preventDefault()
          const selectedIds = new Set(current.selectedPanelIds)
          let next: FigureProject = {
            ...current,
            panels: current.panels.filter(panel => !selectedIds.has(panel.id)),
            selectedPanelIds: [],
          }
          if (next.canvas.layoutMode === 'grid') next = applyGridLayout(next)
          if (next.canvas.autoWrap) next = autoWrapProject(next)
          apply(next)
          return
        }
        if (current.selectedTextId) {
          event.preventDefault()
          apply({
            ...current,
            texts: current.texts.filter(text => text.id !== current.selectedTextId),
            selectedTextId: null,
          })
          return
        }
      }

      if (!modified && event.key === 'Escape' && (current.selectedPanelIds.length || current.selectedTextId)) {
        event.preventDefault()
        apply({ ...current, selectedPanelIds: [], selectedTextId: null }, 'transient')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [apply])

  return {
    project,
    replace,
    replaceTransient,
    resetProject,
    beginGesture,
    finishGesture,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
