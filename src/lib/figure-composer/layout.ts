import type { FigurePanel, FigureProject } from './types'

function gridDimensions(count: number, requestedColumns: number, requestedRows: number) {
  if (requestedColumns > 0 && requestedRows > 0) return { columns: requestedColumns, rows: requestedRows }
  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))))
  return { columns, rows: Math.max(1, Math.ceil(count / columns)) }
}

function fitInBox(panel: FigurePanel, x: number, y: number, boxWidth: number, boxHeight: number) {
  const ratio = panel.originalAspectRatio > 0 ? panel.originalAspectRatio : panel.width / Math.max(1, panel.height)
  if (!panel.lockAspectRatio) return { ...panel, x, y, width: boxWidth, height: boxHeight }
  const boxRatio = boxWidth / Math.max(1, boxHeight)
  const width = ratio >= boxRatio ? boxWidth : boxHeight * ratio
  const height = width / Math.max(0.0001, ratio)
  return {
    ...panel,
    x: x + (boxWidth - width) / 2,
    y: y + (boxHeight - height) / 2,
    width,
    height,
  }
}

export function applyHeroRightStack(panels: FigurePanel[]) {
  return panels.map((panel, index) => {
    if (index === 0) return { ...panel, gridRow: 0, gridColumn: 0, rowSpan: 2, colSpan: 1 }
    if (index === 1) return { ...panel, gridRow: 0, gridColumn: 1, rowSpan: 1, colSpan: 1 }
    if (index === 2) return { ...panel, gridRow: 1, gridColumn: 1, rowSpan: 1, colSpan: 1 }
    const offset = index - 3
    return { ...panel, gridRow: 2 + Math.floor(offset / 2), gridColumn: offset % 2, rowSpan: 1, colSpan: 1 }
  })
}

function normalizeUniformPlacements(panels: FigurePanel[], columns: number) {
  return panels.map((panel, index) => ({
    ...panel,
    gridRow: Math.floor(index / columns),
    gridColumn: index % columns,
    rowSpan: 1,
    colSpan: 1,
  }))
}

function occupiedRows(panels: FigurePanel[]) {
  return Math.max(1, ...panels.map(panel => panel.gridRow + Math.max(1, panel.rowSpan)))
}

export function applyGridLayout(project: FigureProject, preset = project.canvas.layoutPreset): FigureProject {
  if (!project.panels.length) return project
  const requested = gridDimensions(project.panels.length, project.canvas.gridColumns, project.canvas.gridRows)
  let columns = requested.columns
  let placed = project.panels

  if (preset === 'hero-right-stack') {
    columns = 2
    placed = applyHeroRightStack(placed)
  } else if (preset === 'uniform' || preset === 'auto') {
    columns = preset === 'auto' ? Math.max(1, Math.ceil(Math.sqrt(project.panels.length))) : columns
    placed = normalizeUniformPlacements(placed, columns)
  }

  const rows = occupiedRows(placed)
  const margin = Math.max(0, project.canvas.margin)
  const gap = Math.max(0, project.canvas.gap)
  const usableWidth = Math.max(1, project.canvas.width - margin * 2 - gap * (columns - 1))
  const usableHeight = Math.max(1, project.canvas.height - margin * 2 - gap * (rows - 1))
  const cellWidth = usableWidth / columns
  const cellHeight = usableHeight / rows

  const panels = placed.map(panel => {
    const rowSpan = Math.max(1, Math.min(rows - panel.gridRow, panel.rowSpan || 1))
    const colSpan = Math.max(1, Math.min(columns - panel.gridColumn, panel.colSpan || 1))
    const x = margin + panel.gridColumn * (cellWidth + gap)
    const y = margin + panel.gridRow * (cellHeight + gap)
    const width = cellWidth * colSpan + gap * (colSpan - 1)
    const height = cellHeight * rowSpan + gap * (rowSpan - 1)
    return fitInBox({ ...panel, rowSpan, colSpan }, x, y, width, height)
  })

  return {
    ...project,
    canvas: {
      ...project.canvas,
      layoutMode: 'grid',
      layoutPreset: preset,
      gridColumns: columns,
      gridRows: rows,
    },
    panels,
    updatedAt: new Date().toISOString(),
  }
}

export function autoWrapProject(project: FigureProject): FigureProject {
  if (!project.panels.length && !project.texts.length) return project
  const margin = Math.max(0, project.canvas.margin)
  const panelBounds = project.panels.flatMap(panel => [
    { left: panel.x, top: panel.y, right: panel.x + panel.width, bottom: panel.y + panel.height },
  ])
  const textBounds = project.texts.map(text => ({
    left: text.x,
    top: text.y,
    right: text.x + Math.max(text.fontSize, text.text.length * text.fontSize * 0.62),
    bottom: text.y + text.fontSize * 1.25,
  }))
  const bounds = [...panelBounds, ...textBounds]
  const minX = Math.min(...bounds.map(item => item.left))
  const minY = Math.min(...bounds.map(item => item.top))
  const maxX = Math.max(...bounds.map(item => item.right))
  const maxY = Math.max(...bounds.map(item => item.bottom))
  const dx = margin - minX
  const dy = margin - minY
  const width = Math.max(1, maxX - minX + margin * 2)
  const height = Math.max(1, maxY - minY + margin * 2)

  return {
    ...project,
    canvas: { ...project.canvas, width, height, autoWrap: true },
    panels: project.panels.map(panel => ({ ...panel, x: panel.x + dx, y: panel.y + dy })),
    texts: project.texts.map(text => ({ ...text, x: text.x + dx, y: text.y + dy })),
    updatedAt: new Date().toISOString(),
  }
}

export const autoWrap = autoWrapProject
