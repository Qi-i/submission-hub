import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, Grid3X3, Maximize2, Rows3, ZoomIn, ZoomOut } from 'lucide-react'
import type { AlignMode, DistributionAxis, FigureLayoutPreset } from '../../lib/figure-composer/types'

interface Props {
  selectedCount: number
  zoom: number
  layoutPreset: FigureLayoutPreset
  onZoom: (value: number) => void
  onAlign: (mode: AlignMode) => void
  onDistribute: (axis: DistributionAxis) => void
  onLayoutPreset: (preset: FigureLayoutPreset) => void
  onAutoWrap: () => void
}

export default function FigureToolbar({ selectedCount, zoom, layoutPreset, onZoom, onAlign, onDistribute, onLayoutPreset, onAutoWrap }: Props) {
  const alignDisabled = selectedCount < 2
  const distributeDisabled = selectedCount < 3
  return <div className="figure-composer__toolbar" aria-label="科研组图工具栏">
    <div className="figure-composer__tool-group">
      <select aria-label="布局预设" value={layoutPreset} onChange={event => onLayoutPreset(event.target.value as FigureLayoutPreset)}>
        <option value="auto">自动网格</option>
        <option value="uniform">均匀网格</option>
        <option value="hero-right-stack">A 大图 + B/C</option>
      </select>
      <button type="button" onClick={() => onLayoutPreset(layoutPreset)}><Grid3X3 size={14} /> 重排</button>
      <button type="button" onClick={onAutoWrap}><Maximize2 size={14} /> 包裹画布</button>
    </div>

    <div className="figure-composer__tool-group" aria-label="对齐与分布">
      <button disabled={alignDisabled} title="左对齐" onClick={() => onAlign('left')}><AlignStartVertical size={14} /></button>
      <button disabled={alignDisabled} title="水平中心" onClick={() => onAlign('horizontal-center')}><AlignCenterVertical size={14} /></button>
      <button disabled={alignDisabled} title="右对齐" onClick={() => onAlign('right')}><AlignEndVertical size={14} /></button>
      <button disabled={alignDisabled} title="上对齐" onClick={() => onAlign('top')}><AlignStartHorizontal size={14} /></button>
      <button disabled={alignDisabled} title="垂直中心" onClick={() => onAlign('vertical-center')}><AlignCenterHorizontal size={14} /></button>
      <button disabled={alignDisabled} title="下对齐" onClick={() => onAlign('bottom')}><AlignEndHorizontal size={14} /></button>
      <button disabled={distributeDisabled} title="横向等间距" onClick={() => onDistribute('horizontal')}><AlignHorizontalDistributeCenter size={14} /></button>
      <button disabled={distributeDisabled} title="纵向等间距" onClick={() => onDistribute('vertical')}><AlignVerticalDistributeCenter size={14} /></button>
    </div>

    <div className="figure-composer__tool-group figure-composer__zoom">
      <button title="缩小视图" onClick={() => onZoom(Math.max(0.3, zoom - 0.1))}><ZoomOut size={14} /></button>
      <b>{Math.round(zoom * 100)}%</b>
      <button title="放大视图" onClick={() => onZoom(Math.min(2, zoom + 0.1))}><ZoomIn size={14} /></button>
      <Rows3 size={13} aria-hidden="true" />
      <span>{selectedCount ? `已选 ${selectedCount}` : '未选择'}</span>
    </div>
  </div>
}
