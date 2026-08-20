import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { automaticPanelLabel, type FigurePanel, type FigureProject, type FigureSnapGuide, type RuntimeFigureAsset } from '../../lib/figure-composer/types'

type DragState = {
  id: string
  dx: number
  dy: number
} | null

interface Props {
  project: FigureProject
  assets: Map<string, RuntimeFigureAsset>
  zoom: number
  guides: FigureSnapGuide[]
  onSelectPanel: (id: string, mode: 'replace' | 'toggle' | 'range') => void
  onClearSelection: () => void
  onMovePanel: (id: string, x: number, y: number) => void
  onFinishMove: () => void
}

function pointFor(event: ReactPointerEvent<HTMLCanvasElement>, project: FigureProject) {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * project.canvas.width / Math.max(1, rect.width),
    y: (event.clientY - rect.top) * project.canvas.height / Math.max(1, rect.height),
  }
}

function hitPanel(panels: FigurePanel[], x: number, y: number) {
  return [...panels].reverse().find(panel => x >= panel.x && x <= panel.x + panel.width && y >= panel.y && y <= panel.y + panel.height) || null
}

export default function FigureCanvas({ project, assets, zoom, guides, onSelectPanel, onClearSelection, onMovePanel, onFinishMove }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState>(null)
  const [imageVersion, setImageVersion] = useState(0)
  const imageCache = useRef(new Map<string, HTMLImageElement>())

  useEffect(() => {
    let cancelled = false
    for (const asset of assets.values()) {
      if (imageCache.current.has(asset.id)) continue
      const image = new Image()
      image.onload = () => {
        if (!cancelled) {
          imageCache.current.set(asset.id, image)
          setImageVersion(value => value + 1)
        }
      }
      image.src = asset.objectUrl
    }
    for (const id of [...imageCache.current.keys()]) {
      if (!assets.has(id)) imageCache.current.delete(id)
    }
    return () => { cancelled = true }
  }, [assets])

  const selected = useMemo(() => new Set(project.selectedPanelIds), [project.selectedPanelIds])

  useEffect(() => {
    void imageVersion
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
    canvas.width = Math.max(1, Math.round(project.canvas.width * dpr))
    canvas.height = Math.max(1, Math.round(project.canvas.height * dpr))
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, project.canvas.width, project.canvas.height)
    context.fillStyle = project.canvas.background
    context.fillRect(0, 0, project.canvas.width, project.canvas.height)

    project.panels.forEach((panel, index) => {
      const image = imageCache.current.get(panel.assetId)
      if (image) {
        const sourceRatio = image.naturalWidth / Math.max(1, image.naturalHeight)
        const boxRatio = panel.width / Math.max(1, panel.height)
        context.save()
        context.beginPath()
        context.rect(panel.x, panel.y, panel.width, panel.height)
        context.clip()
        if (panel.fit === 'cover') {
          if (sourceRatio > boxRatio) {
            const sourceWidth = image.naturalHeight * boxRatio
            context.drawImage(image, (image.naturalWidth - sourceWidth) / 2, 0, sourceWidth, image.naturalHeight, panel.x, panel.y, panel.width, panel.height)
          } else {
            const sourceHeight = image.naturalWidth / boxRatio
            context.drawImage(image, 0, (image.naturalHeight - sourceHeight) / 2, image.naturalWidth, sourceHeight, panel.x, panel.y, panel.width, panel.height)
          }
        } else {
          let width = panel.width
          let height = panel.height
          if (sourceRatio > boxRatio) height = width / sourceRatio
          else width = height * sourceRatio
          context.drawImage(image, panel.x + (panel.width - width) / 2, panel.y + (panel.height - height) / 2, width, height)
        }
        context.restore()
      }

      if (panel.border.enabled) {
        context.save()
        context.strokeStyle = panel.border.color
        context.lineWidth = panel.border.width
        context.setLineDash(panel.border.style === 'dashed' ? [panel.border.width * 4, panel.border.width * 3] : [])
        context.strokeRect(panel.x, panel.y, panel.width, panel.height)
        context.restore()
      }

      if (panel.label.visible) {
        const label = panel.label.textOverride || automaticPanelLabel(index, panel.label.style)
        context.save()
        context.fillStyle = panel.label.color
        context.font = `${panel.label.fontWeight} ${panel.label.fontSize}px "${panel.label.fontFamily}", serif`
        context.textBaseline = 'top'
        const metrics = context.measureText(label)
        const right = panel.label.position.endsWith('right')
        const bottom = panel.label.position.startsWith('bottom')
        const x = right ? panel.x + panel.width - metrics.width - panel.label.offsetX : panel.x + panel.label.offsetX
        const y = bottom ? panel.y + panel.height - panel.label.fontSize - panel.label.offsetY : panel.y + panel.label.offsetY
        context.fillText(label, x, y)
        context.restore()
      }

      if (selected.has(panel.id)) {
        context.save()
        context.strokeStyle = '#2563eb'
        context.lineWidth = 2
        context.setLineDash([6, 4])
        context.strokeRect(panel.x - 2, panel.y - 2, panel.width + 4, panel.height + 4)
        context.restore()
      }
    })

    project.texts.forEach(text => {
      context.save()
      context.fillStyle = text.color
      context.font = `${text.fontWeight} ${text.fontSize}px "${text.fontFamily}", sans-serif`
      context.textBaseline = 'top'
      context.fillText(text.text, text.x, text.y)
      context.restore()
    })

    guides.forEach(guide => {
      context.save()
      context.strokeStyle = guide.kind === 'gap' ? '#7c3aed' : '#0ea5e9'
      context.lineWidth = 1
      context.setLineDash(guide.kind === 'center' ? [5, 4] : [])
      context.beginPath()
      if (guide.axis === 'x') {
        context.moveTo(guide.position, guide.from)
        context.lineTo(guide.position, guide.to)
      } else {
        context.moveTo(guide.from, guide.position)
        context.lineTo(guide.to, guide.position)
      }
      context.stroke()
      context.restore()
    })
  }, [project, selected, guides, imageVersion])

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = pointFor(event, project)
    const panel = hitPanel(project.panels, point.x, point.y)
    if (!panel) {
      onClearSelection()
      return
    }
    const mode = event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'replace'
    onSelectPanel(panel.id, mode)
    dragRef.current = { id: panel.id, dx: point.x - panel.x, dy: point.y - panel.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const point = pointFor(event, project)
    onMovePanel(drag.id, point.x - drag.dx, point.y - drag.dy)
  }

  const finish = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    onFinishMove()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return <div className="figure-composer__canvas-viewport" data-testid="figure-canvas-viewport">
    <div
      className="figure-composer__canvas-scale"
      style={{ width: project.canvas.width * zoom, height: project.canvas.height * zoom }}
    >
      <canvas
        ref={canvasRef}
        className="figure-composer__canvas"
        style={{ width: project.canvas.width * zoom, height: project.canvas.height * zoom }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        aria-label="科研组图 Canvas 工作区"
      />
    </div>
  </div>
}
