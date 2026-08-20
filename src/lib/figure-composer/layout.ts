import type { FigurePanel, FigureProject } from './types'

interface GridPlacement {
  row: number
  column: number
  rowSpan: number
  colSpan: number
}

function gridDimensions(count: number, requestedColumns: number) {
  const columns = requestedColumns > 0
    ? requestedColumns
    : Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))))
  return { columns }
}

function normalizedSpan(value: number, max: number) {
  return Math.max(1, Math.min(max, Math.round(Number(value) || 1)))
}

/**
 * Pack panels into the first available grid cells while respecting rowSpan/colSpan.
 * This mirrors the proven local FigMergeStudio behavior without retaining DOM state.
 */
export function buildGridPlacements(panels: FigurePanel[], columns: number): { placements: GridPlacement[]; rows: number } {
  const occupied: boolean[][] = []
  const placements: GridPlacement[] = []
  const ensureRows = (count: number) => {
    while (occupied.length < count) occupied.push(Array(columns).fill(false))
  }

  panels.forEach((panel, index) => {
    const colSpan = normalizedSpan(panel.colSpan, columns)
    const rowSpan = normalizedSpan(panel.rowSpan, 5)
    let placed = false

    for (let row = 0; !placed; row += 1) {
      ensureRows(row + rowSpan)
      for (let column = 0; column <= columns - colSpan; column += 1) {
        let free = true
        for (let r = row; r < row + rowSpan && free; r += 1) {
          for (let c = column; c < column + colSpan; c += 1) {
            if (occupied[r][c]) {
              free = false
              break
            }
          }
        }
        if (!free) continue

        for (let r = row; r < row + rowSpan; r += 1) {
          for (let c = column; c < column + colSpan; c += 1) occupied[r][c] = true
        }
        placements[index] = { row, column, rowSpan, colSpan }
        placed = true
        break
      }
    }
  })

  return { placements, rows: Math.max(1, occupied.length) }
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

function explicitHeroPlacements(panels: FigurePanel[]): { placements: GridPlacement[]; rows: number } {
  const placements = panels.map(panel => ({
    row: panel.gridRow,
    column: panel.gridColumn,
    rowSpan: Math.max(1, panel.rowSpan),
    colSpan: Math.max(1, panel.colSpan),
  }))
  const rows = Math.max(1, ...placements.map(item => item.row + item.rowSpan))
  return { placements, rows }
}

function desiredPanelHeight(panel: FigurePanel, width: number) {
  if (!panel.lockAspectRatio) return Math.max(20, panel.height)
  const ratio = panel.originalAspectRatio > 0
    ? panel.originalAspectRatio
    : panel.width / Math.max(1, panel.height)
  return width / Math.max(0.0001, ratio)
}

export function applyGridLayout(project: FigureProject, preset = project.canvas.layoutPreset): FigureProject {
  if (!project.panels.length) return project

  let columns = preset === 'hero-right-stack'
    ? 2
    : gridDimensions(project.panels.length, preset === 'auto' ? 0 : project.canvas.gridColumns).columns
  columns = Math.max(1, Math.min(5, columns))

  const sourcePanels = preset === 'hero-right-stack'
    ? applyHeroRightStack(project.panels)
    : project.panels.map(panel => ({
      ...panel,
      rowSpan: normalizedSpan(panel.rowSpan, 5),
      colSpan: normalizedSpan(panel.colSpan, columns),
    }))

  const packed = preset === 'hero-right-stack'
    ? explicitHeroPlacements(sourcePanels)
    : buildGridPlacements(sourcePanels, columns)
  const { placements, rows } = packed

  const margin = Math.max(0, project.canvas.margin)
  const gap = Math.max(0, project.canvas.gap)
  const usableWidth = Math.max(1, project.canvas.width - margin * 2 - gap * (columns - 1))
  const cellWidth = usableWidth / columns

  const panelWidths = placements.map(place => cellWidth * place.colSpan + gap * (place.colSpan - 1))
  const panelHeights = sourcePanels.map((panel, index) => desiredPanelHeight(panel, panelWidths[index]))
  const rowHeights = Array(rows).fill(0) as number[]

  // One-row panels establish the natural row height first.
  placements.forEach((place, index) => {
    if (place.rowSpan === 1) rowHeights[place.row] = Math.max(rowHeights[place.row], panelHeights[index])
  })

  // Multi-row panels may require additional height; distribute only the deficit.
  placements.forEach((place, index) => {
    if (place.rowSpan <= 1) return
    const current = rowHeights
      .slice(place.row, place.row + place.rowSpan)
      .reduce((sum, height) => sum + height, 0) + gap * (place.rowSpan - 1)
    const deficit = panelHeights[index] - current
    if (deficit <= 0) return
    const extra = deficit / place.rowSpan
    for (let row = place.row; row < place.row + place.rowSpan; row += 1) rowHeights[row] += extra
  })

  // A row occupied only by a spanning/free-form panel must still have a usable height.
  const fallbackHeight = Math.max(20, cellWidth * 0.72)
  for (let row = 0; row < rowHeights.length; row += 1) {
    if (rowHeights[row] <= 0) rowHeights[row] = fallbackHeight
  }

  const rowTops: number[] = []
  let cursorY = margin
  rowHeights.forEach((height, row) => {
    rowTops[row] = cursorY
    cursorY += height + gap
  })

  const panels = sourcePanels.map((panel, index) => {
    const place = placements[index]
    return {
      ...panel,
      gridRow: place.row,
      gridColumn: place.column,
      rowSpan: place.rowSpan,
      colSpan: place.colSpan,
      x: margin + place.column * (cellWidth + gap),
      y: rowTops[place.row],
      width: panelWidths[index],
      height: panelHeights[index],
    }
  })

  const contentHeight = rowHeights.reduce((sum, height) => sum + height, 0) + gap * Math.max(0, rows - 1)
  return {
    ...project,
    canvas: {
      ...project.canvas,
      height: contentHeight + margin * 2,
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
  const panelBounds = project.panels.map(panel => ({
    left: panel.x,
    top: panel.y,
    right: panel.x + panel.width,
    bottom: panel.y + panel.height,
  }))
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
