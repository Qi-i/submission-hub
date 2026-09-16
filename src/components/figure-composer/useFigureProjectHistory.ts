import { useCallback, useReducer, useRef, useState } from 'react'
import type { FigureProject } from '../../lib/figure-composer/types'

const HISTORY_LIMIT = 50

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
