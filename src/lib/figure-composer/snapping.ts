import { panelBounds } from './geometry'
import type { FigurePanel, FigureSnapGuide, SnapResult } from './types'

type Candidate = { value: number; guide: FigureSnapGuide }

function nearest(value: number, candidates: Candidate[], threshold: number) {
  let best: Candidate | null = null
  for (const candidate of candidates) {
    if (Math.abs(candidate.value - value) > threshold) continue
    if (!best || Math.abs(candidate.value - value) < Math.abs(best.value - value)) best = candidate
  }
  return best
}

export function snapPanel(
  panel: FigurePanel,
  others: FigurePanel[],
  canvas: { width: number; height: number },
  gap: number,
  threshold = 8,
): SnapResult {
  const xCandidates: Candidate[] = []
  const yCandidates: Candidate[] = []
  const moving = panelBounds(panel)

  const pushX = (value: number, position: number, from: number, to: number, kind: FigureSnapGuide['kind']) => {
    xCandidates.push({ value, guide: { axis: 'x', position, from, to, kind } })
  }
  const pushY = (value: number, position: number, from: number, to: number, kind: FigureSnapGuide['kind']) => {
    yCandidates.push({ value, guide: { axis: 'y', position, from, to, kind } })
  }

  pushX(0, 0, 0, canvas.height, 'edge')
  pushX(canvas.width - panel.width, canvas.width, 0, canvas.height, 'edge')
  pushX(canvas.width / 2 - panel.width / 2, canvas.width / 2, 0, canvas.height, 'center')
  pushY(0, 0, 0, canvas.width, 'edge')
  pushY(canvas.height - panel.height, canvas.height, 0, canvas.width, 'edge')
  pushY(canvas.height / 2 - panel.height / 2, canvas.height / 2, 0, canvas.width, 'center')

  for (const other of others) {
    if (other.id === panel.id) continue
    const bounds = panelBounds(other)
    const verticalFrom = Math.min(moving.top, bounds.top)
    const verticalTo = Math.max(moving.bottom, bounds.bottom)
    const horizontalFrom = Math.min(moving.left, bounds.left)
    const horizontalTo = Math.max(moving.right, bounds.right)

    pushX(bounds.left, bounds.left, verticalFrom, verticalTo, 'edge')
    pushX(bounds.right - panel.width, bounds.right, verticalFrom, verticalTo, 'edge')
    pushX(bounds.centerX - panel.width / 2, bounds.centerX, verticalFrom, verticalTo, 'center')
    pushX(bounds.right + gap, bounds.right + gap, verticalFrom, verticalTo, 'gap')
    pushX(bounds.left - gap - panel.width, bounds.left - gap, verticalFrom, verticalTo, 'gap')

    pushY(bounds.top, bounds.top, horizontalFrom, horizontalTo, 'edge')
    pushY(bounds.bottom - panel.height, bounds.bottom, horizontalFrom, horizontalTo, 'edge')
    pushY(bounds.centerY - panel.height / 2, bounds.centerY, horizontalFrom, horizontalTo, 'center')
    pushY(bounds.bottom + gap, bounds.bottom + gap, horizontalFrom, horizontalTo, 'gap')
    pushY(bounds.top - gap - panel.height, bounds.top - gap, horizontalFrom, horizontalTo, 'gap')
  }

  const snapX = nearest(panel.x, xCandidates, threshold)
  const snapY = nearest(panel.y, yCandidates, threshold)
  const guides: FigureSnapGuide[] = []
  if (snapX) guides.push(snapX.guide)
  if (snapY) guides.push(snapY.guide)

  return {
    x: snapX?.value ?? panel.x,
    y: snapY?.value ?? panel.y,
    guides,
  }
}
