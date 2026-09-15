import { SlidersHorizontal } from 'lucide-react'
import type { FigurePanel } from '../../lib/figure-composer/types'

interface Props {
  panel: FigurePanel | null
  selectedCount: number
  onPatch: (id: string, patch: Partial<FigurePanel>, editedDimension?: 'width' | 'height' | 'both') => void
}

const numberValue = (value: string, fallback: number, min?: number) => {
  const parsed = Number(value)
  const safe = Number.isFinite(parsed) ? parsed : fallback
  return min === undefined ? safe : Math.max(min, safe)
}

export default function FigurePanelInspector({ panel, selectedCount, onPatch }: Props) {
  return <section className="figure-composer__section figure-composer__inspector" aria-label="选中子图参数">
    <div className="figure-composer__section-title">
      <SlidersHorizontal size={14} /><strong>子图参数</strong>
      <span title={panel?.name}>{panel ? `${panel.naturalWidth}×${panel.naturalHeight}` : selectedCount ? `选中 ${selectedCount}` : '未选择'}</span>
    </div>
    {!panel && <p className="figure-composer__empty figure-composer__empty-inline">选择子图后编辑位置与尺寸。</p>}
    {panel && <>
      <div className="figure-composer__field-grid four figure-composer__geometry-grid">
        <label>X<input aria-label="X" type="number" step="1" value={Math.round(panel.x * 100) / 100} onChange={event => onPatch(panel.id, { x: numberValue(event.target.value, panel.x) })} /></label>
        <label>Y<input aria-label="Y" type="number" step="1" value={Math.round(panel.y * 100) / 100} onChange={event => onPatch(panel.id, { y: numberValue(event.target.value, panel.y) })} /></label>
        <label>W<input aria-label="W" type="number" min="1" step="1" value={Math.round(panel.width * 100) / 100} onChange={event => onPatch(panel.id, { width: numberValue(event.target.value, panel.width, 1) }, 'width')} /></label>
        <label>H<input aria-label="H" type="number" min="1" step="1" value={Math.round(panel.height * 100) / 100} onChange={event => onPatch(panel.id, { height: numberValue(event.target.value, panel.height, 1) }, 'height')} /></label>
      </div>

      <details className="figure-composer__compact-details figure-composer__panel-advanced">
        <summary><strong>网格与显示</strong><span>{panel.fit === 'contain' ? '完整显示' : '填满图框'}</span></summary>
        <div className="figure-composer__details-body">
          <div className="figure-composer__inline-options">
            <label className="figure-composer__check"><input type="checkbox" checked={panel.lockAspectRatio} onChange={event => onPatch(panel.id, { lockAspectRatio: event.target.checked })} /> 锁定比例</label>
            <label>显示<select value={panel.fit} onChange={event => onPatch(panel.id, { fit: event.target.value as FigurePanel['fit'] })}><option value="contain">完整</option><option value="cover">填满</option></select></label>
          </div>
          <div className="figure-composer__field-grid four">
            <label>行<input type="number" min="0" value={panel.gridRow} onChange={event => onPatch(panel.id, { gridRow: numberValue(event.target.value, panel.gridRow, 0) })} /></label>
            <label>列<input type="number" min="0" value={panel.gridColumn} onChange={event => onPatch(panel.id, { gridColumn: numberValue(event.target.value, panel.gridColumn, 0) })} /></label>
            <label>跨行<input aria-label="rowSpan" type="number" min="1" value={panel.rowSpan} onChange={event => onPatch(panel.id, { rowSpan: numberValue(event.target.value, panel.rowSpan, 1) })} /></label>
            <label>跨列<input aria-label="colSpan" type="number" min="1" value={panel.colSpan} onChange={event => onPatch(panel.id, { colSpan: numberValue(event.target.value, panel.colSpan, 1) })} /></label>
          </div>
        </div>
      </details>

      <details className="figure-composer__compact-details figure-composer__panel-label-details">
        <summary><strong>子图标签</strong><span>{panel.label.visible ? panel.label.textOverride || panel.label.style : '隐藏'}</span></summary>
        <div className="figure-composer__details-body">
          <label className="figure-composer__check"><input type="checkbox" checked={panel.label.visible} onChange={event => onPatch(panel.id, { label: { ...panel.label, visible: event.target.checked } })} /> 显示标签</label>
          <div className="figure-composer__field-grid two">
            <label>标签样式<select value={panel.label.style} onChange={event => onPatch(panel.id, { label: { ...panel.label, style: event.target.value as FigurePanel['label']['style'] } })}><option value="parena">(a), (b), (c)</option><option value="a">a, b, c</option><option value="parenA">(A), (B), (C)</option><option value="A">A, B, C</option></select></label>
            <label>覆盖文本<input value={panel.label.textOverride || ''} placeholder="自动" onChange={event => onPatch(panel.id, { label: { ...panel.label, textOverride: event.target.value || null } })} /></label>
            <label>字体<select value={panel.label.fontFamily} onChange={event => onPatch(panel.id, { label: { ...panel.label, fontFamily: event.target.value } })}><option>Times New Roman</option><option>Arial</option><option>Helvetica</option><option>Georgia</option><option>Microsoft YaHei</option><option>SimSun</option></select></label>
            <label>字号<input type="number" min="8" max="144" value={panel.label.fontSize} onChange={event => onPatch(panel.id, { label: { ...panel.label, fontSize: numberValue(event.target.value, panel.label.fontSize, 8) } })} /></label>
            <label>字重<select value={panel.label.fontWeight} onChange={event => onPatch(panel.id, { label: { ...panel.label, fontWeight: Number(event.target.value) as FigurePanel['label']['fontWeight'] } })}><option value="400">Regular</option><option value="500">Medium</option><option value="600">SemiBold</option><option value="700">Bold</option></select></label>
            <label>位置<select value={panel.label.position} onChange={event => onPatch(panel.id, { label: { ...panel.label, position: event.target.value as FigurePanel['label']['position'] } })}><option value="top-left">左上</option><option value="top-right">右上</option><option value="bottom-left">左下</option><option value="bottom-right">右下</option></select></label>
            <label>颜色<input type="color" value={panel.label.color} onChange={event => onPatch(panel.id, { label: { ...panel.label, color: event.target.value } })} /></label>
            <label>X 偏移<input type="number" value={panel.label.offsetX} onChange={event => onPatch(panel.id, { label: { ...panel.label, offsetX: numberValue(event.target.value, panel.label.offsetX) } })} /></label>
            <label>Y 偏移<input type="number" value={panel.label.offsetY} onChange={event => onPatch(panel.id, { label: { ...panel.label, offsetY: numberValue(event.target.value, panel.label.offsetY) } })} /></label>
          </div>
        </div>
      </details>

      <details className="figure-composer__compact-details figure-composer__panel-border-details">
        <summary><strong>边框</strong><span>{panel.border.enabled ? `${panel.border.width}px` : '隐藏'}</span></summary>
        <div className="figure-composer__details-body">
          <label className="figure-composer__check"><input type="checkbox" checked={panel.border.enabled} onChange={event => onPatch(panel.id, { border: { ...panel.border, enabled: event.target.checked } })} /> 显示边框</label>
          <div className="figure-composer__field-grid three">
            <label>颜色<input type="color" value={panel.border.color} onChange={event => onPatch(panel.id, { border: { ...panel.border, color: event.target.value } })} /></label>
            <label>线宽<input type="number" min="0.25" step="0.25" value={panel.border.width} onChange={event => onPatch(panel.id, { border: { ...panel.border, width: numberValue(event.target.value, panel.border.width, 0.25) } })} /></label>
            <label>线型<select value={panel.border.style} onChange={event => onPatch(panel.id, { border: { ...panel.border, style: event.target.value as FigurePanel['border']['style'] } })}><option value="solid">实线</option><option value="dashed">虚线</option></select></label>
          </div>
        </div>
      </details>
    </>}
  </section>
}
