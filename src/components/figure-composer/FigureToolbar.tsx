import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, CheckSquare2, ChevronDown, ChevronRight, Eraser, GripVertical, Grid3X3, Maximize2, Rows3, Scan, SquareStack, ZoomIn, ZoomOut } from 'lucide-react'
import type { AlignMode, DistributionAxis, FigureLayoutPreset } from '../../lib/figure-composer/types'

interface Props {
  selectedCount: number
  panelCount: number
  zoom: number
  layoutPreset: FigureLayoutPreset
  gridRows: number
  gridColumns: number
  onZoom: (value: number) => void
  onFitView: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  onAlign: (mode: AlignMode) => void
  onDistribute: (axis: DistributionAxis) => void
  onLayoutPreset: (preset: FigureLayoutPreset) => void
  onGridSize: (rows: number, columns: number) => void
  onAutoWrap: () => void
  onScaleSelected: (factor: number) => void
}

type ClusterKey = 'layout' | 'selection' | 'align' | 'view'
const DEFAULT_ORDER: ClusterKey[] = ['layout', 'selection', 'align', 'view']
const STORAGE_KEY = 'submission-hub.figure-composer.toolbar'

function readToolbarState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as { order?: ClusterKey[]; collapsed?: Partial<Record<ClusterKey, boolean>> } | null
    const order = stored?.order?.filter(key => DEFAULT_ORDER.includes(key)) || []
    return {
      order: [...order, ...DEFAULT_ORDER.filter(key => !order.includes(key))],
      collapsed: { align: true, ...(stored?.collapsed || {}) } as Record<ClusterKey, boolean>,
    }
  } catch {
    return { order: DEFAULT_ORDER, collapsed: { layout: false, selection: false, align: true, view: false } as Record<ClusterKey, boolean> }
  }
}

function Cluster({ clusterKey, label, collapsed, onToggle, onDragStart, onDrop, children }: {
  clusterKey: ClusterKey
  label: string
  collapsed: boolean
  onToggle: () => void
  onDragStart: (key: ClusterKey) => void
  onDrop: (key: ClusterKey) => void
  children: ReactNode
}) {
  return <section
    className={`figure-composer__tool-cluster${collapsed ? ' is-collapsed' : ''}`}
    data-tool-cluster={clusterKey}
    draggable
    aria-expanded={!collapsed}
    onDragStart={() => onDragStart(clusterKey)}
    onDragOver={event => event.preventDefault()}
    onDrop={event => { event.preventDefault(); onDrop(clusterKey) }}
  >
    <div className="figure-composer__tool-cluster-head">
      <GripVertical size={12} aria-hidden="true" />
      <strong>{label}</strong>
      <button type="button" className="figure-composer__tool-collapse" title={collapsed ? `展开${label}` : `收起${label}`} onClick={onToggle}>{collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button>
    </div>
    {!collapsed && <div className="figure-composer__tool-cluster-body">{children}</div>}
  </section>
}

export default function FigureToolbar({ selectedCount, panelCount, zoom, layoutPreset, gridRows, gridColumns, onZoom, onFitView, onSelectAll, onClearSelection, onAlign, onDistribute, onLayoutPreset, onGridSize, onAutoWrap, onScaleSelected }: Props) {
  const initial = useMemo(readToolbarState, [])
  const [order, setOrder] = useState<ClusterKey[]>(initial.order)
  const [collapsed, setCollapsed] = useState<Record<ClusterKey, boolean>>(initial.collapsed)
  const [dragging, setDragging] = useState<ClusterKey | null>(null)
  const alignDisabled = selectedCount < 2
  const distributeDisabled = selectedCount < 3

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, collapsed }))
  }, [order, collapsed])

  const toggle = (key: ClusterKey) => setCollapsed(previous => ({ ...previous, [key]: !previous[key] }))
  const dropOn = (target: ClusterKey) => {
    if (!dragging || dragging === target) return setDragging(null)
    setOrder(previous => {
      const next = previous.filter(key => key !== dragging)
      next.splice(Math.max(0, next.indexOf(target)), 0, dragging)
      return next
    })
    setDragging(null)
  }

  const clusters: Record<ClusterKey, ReactNode> = {
    layout: <>
      <select aria-label="布局预设" value={layoutPreset} onChange={event => onLayoutPreset(event.target.value as FigureLayoutPreset)}>
        <option value="auto">自动网格</option>
        <option value="uniform">均匀网格</option>
        <option value="hero-right-stack">A 大图 + B/C</option>
      </select>
      <label className="figure-composer__compact-field">行<input className="figure-composer__grid-number" aria-label="网格行数" type="number" min="1" max="12" value={gridRows} onChange={event => onGridSize(Math.max(1, Number(event.target.value) || 1), gridColumns)} /></label>
      <label className="figure-composer__compact-field">列<input className="figure-composer__grid-number" aria-label="网格列数" type="number" min="1" max="12" value={gridColumns} onChange={event => onGridSize(gridRows, Math.max(1, Number(event.target.value) || 1))} /></label>
      <button type="button" title="按当前布局重排" onClick={() => onLayoutPreset(layoutPreset)}><Grid3X3 size={14} /> 重排</button>
      <button type="button" title="让画布紧贴所有子图" onClick={onAutoWrap}><Maximize2 size={14} /> 包裹</button>
    </>,
    selection: <>
      <button type="button" disabled={!panelCount || selectedCount === panelCount} onClick={onSelectAll}><CheckSquare2 size={14} /> 全选</button>
      <button type="button" disabled={!selectedCount} onClick={onClearSelection}><Eraser size={14} /> 清空选择</button>
      <button type="button" disabled={!selectedCount} onClick={() => onScaleSelected(.92)}>缩小</button>
      <button type="button" disabled={!selectedCount} onClick={() => onScaleSelected(1.08)}>放大</button>
      <span className="figure-composer__selection-count"><SquareStack size={13} /> {selectedCount ? `已选 ${selectedCount}` : '未选择'}</span>
    </>,
    align: <>
      <button disabled={alignDisabled} title="左对齐" onClick={() => onAlign('left')}><AlignStartVertical size={14} /></button>
      <button disabled={alignDisabled} title="水平中心" onClick={() => onAlign('horizontal-center')}><AlignCenterVertical size={14} /></button>
      <button disabled={alignDisabled} title="右对齐" onClick={() => onAlign('right')}><AlignEndVertical size={14} /></button>
      <button disabled={alignDisabled} title="上对齐" onClick={() => onAlign('top')}><AlignStartHorizontal size={14} /></button>
      <button disabled={alignDisabled} title="垂直中心" onClick={() => onAlign('vertical-center')}><AlignCenterHorizontal size={14} /></button>
      <button disabled={alignDisabled} title="下对齐" onClick={() => onAlign('bottom')}><AlignEndHorizontal size={14} /></button>
      <button disabled={distributeDisabled} title="横向等间距" onClick={() => onDistribute('horizontal')}><AlignHorizontalDistributeCenter size={14} /></button>
      <button disabled={distributeDisabled} title="纵向等间距" onClick={() => onDistribute('vertical')}><AlignVerticalDistributeCenter size={14} /></button>
    </>,
    view: <>
      <button type="button" title="适配画布到当前视图" onClick={onFitView}><Scan size={14} /> 适配画布</button>
      <button type="button" title="缩小视图" onClick={() => onZoom(Math.max(0.2, zoom - 0.1))}><ZoomOut size={14} /></button>
      <b className="figure-composer__zoom-value">{Math.round(zoom * 100)}%</b>
      <button type="button" title="放大视图" onClick={() => onZoom(Math.min(2, zoom + 0.1))}><ZoomIn size={14} /></button>
      <Rows3 size={13} aria-hidden="true" />
    </>,
  }

  const labels: Record<ClusterKey, string> = { layout: '布局', selection: '选择', align: '对齐', view: '视图' }

  return <div className="figure-composer__toolbar" aria-label="科研组图工具栏">
    {order.map(key => <Cluster key={key} clusterKey={key} label={labels[key]} collapsed={collapsed[key]} onToggle={() => toggle(key)} onDragStart={setDragging} onDrop={dropOn}>{clusters[key]}</Cluster>)}
  </div>
}
