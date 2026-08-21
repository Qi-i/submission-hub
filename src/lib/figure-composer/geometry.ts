import type { AlignMode, DistributionAxis, FigurePanel } from './types'

const EPSILON = 1e-6
export const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export type PanelResize = Partial<Pick<FigurePanel, 'x' | 'y' | 'width' | 'height'>> & {
  editedDimension?: 'width' | 'height' | 'both'
}

export function resizePanel(panel: FigurePanel, change: PanelResize): FigurePanel {
  let width = Math.max(1, change.width ?? panel.width)
  let height = Math.max(1, change.height ?? panel.height)
  const edited = change.editedDimension || (change.width !== undefined && change.height !== undefined ? 'both' : change.width !== undefined ? 'width' : 'height')

  if (panel.lockAspectRatio && panel.originalAspectRatio > EPSILON) {
    if (edited === 'height') width = height * panel.originalAspectRatio
    else height = width / panel.originalAspectRatio
  }

  return {
    ...panel,
    x: Number.isFinite(change.x) ? Number(change.x) : panel.x,
    y: Number.isFinite(change.y) ? Number(change.y) : panel.y,
    width,
    height,
  }
}

export function panelBounds(panel: Pick<FigurePanel, 'x' | 'y' | 'width' | 'height'>) {
  return {
    left: panel.x,
    top: panel.y,
    right: panel.x + panel.width,
    bottom: panel.y + panel.height,
    centerX: panel.x + panel.width / 2,
    centerY: panel.y + panel.height / 2,
  }
}

export function panelsOverlap(a: FigurePanel, b: FigurePanel, tolerance = 0.5) {
  const aa = panelBounds(a)
  const bb = panelBounds(b)
  return aa.left < bb.right - tolerance
    && aa.right > bb.left + tolerance
    && aa.top < bb.bottom - tolerance
    && aa.bottom > bb.top + tolerance
}

export function isPanelOutOfBounds(panel: FigurePanel, canvasWidth: number, canvasHeight: number, tolerance = 0.5) {
  const bounds = panelBounds(panel)
  return bounds.left < -tolerance
    || bounds.top < -tolerance
    || bounds.right > canvasWidth + tolerance
    || bounds.bottom > canvasHeight + tolerance
}

export function aspectRatioDeviation(panel: FigurePanel) {
  const rendered = panel.width / Math.max(EPSILON, panel.height)
  if (panel.originalAspectRatio <= EPSILON) return 0
  return Math.abs(rendered / panel.originalAspectRatio - 1)
}

export function alignPanels(panels: FigurePanel[], selectedIds: string[], mode: AlignMode): FigurePanel[] {
  const selected = panels.filter(panel => selectedIds.includes(panel.id))
  if (selected.length < 2) return panels
  const bounds = selected.map(panelBounds)
  const minLeft = Math.min(...bounds.map(item => item.left))
  const maxRight = Math.max(...bounds.map(item => item.right))
  const minTop = Math.min(...bounds.map(item => item.top))
  const maxBottom = Math.max(...bounds.map(item => item.bottom))
  const centerX = (minLeft + maxRight) / 2
  const centerY = (minTop + maxBottom) / 2

  return panels.map(panel => {
    if (!selectedIds.includes(panel.id)) return panel
    if (mode === 'left') return { ...panel, x: minLeft }
    if (mode === 'right') return { ...panel, x: maxRight - panel.width }
    if (mode === 'top') return { ...panel, y: minTop }
    if (mode === 'bottom') return { ...panel, y: maxBottom - panel.height }
    if (mode === 'horizontal-center') return { ...panel, x: centerX - panel.width / 2 }
    return { ...panel, y: centerY - panel.height / 2 }
  })
}

export function distributePanels(panels: FigurePanel[], selectedIds: string[], axis: DistributionAxis): FigurePanel[] {
  const selected = panels.filter(panel => selectedIds.includes(panel.id))
  if (selected.length < 3) return panels

  const ordered = [...selected].sort((a, b) => axis === 'horizontal' ? a.x - b.x : a.y - b.y)
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  const totalSize = ordered.reduce((sum, panel) => sum + (axis === 'horizontal' ? panel.width : panel.height), 0)
  const start = axis === 'horizontal' ? first.x : first.y
  const end = axis === 'horizontal' ? last.x + last.width : last.y + last.height
  const gap = Math.max(0, (end - start - totalSize) / (ordered.length - 1))
  const positions = new Map<string, number>()
  let cursor = start
  for (const panel of ordered) {
    positions.set(panel.id, cursor)
    cursor += (axis === 'horizontal' ? panel.width : panel.height) + gap
  }

  return panels.map(panel => {
    const position = positions.get(panel.id)
    if (position === undefined) return panel
    return axis === 'horizontal' ? { ...panel, x: position } : { ...panel, y: position }
  })
}

export function translatePanels(panels: FigurePanel[], ids: string[], dx: number, dy: number) {
  return panels.map(panel => ids.includes(panel.id) ? { ...panel, x: panel.x + dx, y: panel.y + dy } : panel)
}

export function fitPanelInsideCanvas(panel: FigurePanel, canvasWidth: number, canvasHeight: number) {
  const width = Math.min(panel.width, canvasWidth)
  const height = Math.min(panel.height, canvasHeight)
  return {
    ...panel,
    width,
    height,
    x: clampNumber(panel.x, 0, Math.max(0, canvasWidth - width)),
    y: clampNumber(panel.y, 0, Math.max(0, canvasHeight - height)),
  }
}
