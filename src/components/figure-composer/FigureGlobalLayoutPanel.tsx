import { LayoutGrid, Tags } from 'lucide-react'
import type { FigureBorderSettings, FigureCanvasSettings, FigureLabelSettings, FigureProject } from '../../lib/figure-composer/types'

interface Props {
  project: FigureProject
  onCanvas: (patch: Partial<FigureCanvasSettings>, reflow?: boolean) => void
  onLabelDefaults: (patch: Partial<FigureLabelSettings>) => void
  onBorderDefaults: (patch: Partial<FigureBorderSettings>) => void
  onApplyLabelsToAll: () => void
  onApplyBordersToAll: () => void
}

const numberValue = (value: string, fallback: number, min?: number, max?: number) => {
  const parsed = Number(value)
  let next = Number.isFinite(parsed) ? parsed : fallback
  if (min !== undefined) next = Math.max(min, next)
  if (max !== undefined) next = Math.min(max, next)
  return next
}

export default function FigureGlobalLayoutPanel({ project, onCanvas, onLabelDefaults, onBorderDefaults, onApplyLabelsToAll, onApplyBordersToAll }: Props) {
  return <>
    <section className="figure-composer__section figure-composer__global-layout" aria-label="全局排版">
      <div className="figure-composer__section-title"><LayoutGrid size={14} /><strong>全局排版</strong></div>
      <div className="figure-composer__field-grid two">
        <label>单图宽度<input type="number" min="100" step="20" value={project.canvas.panelWidth} onChange={event => onCanvas({ panelWidth: numberValue(event.target.value, project.canvas.panelWidth, 100) }, true)} /></label>
        <label>整体缩放（%）<input type="number" min="25" max="400" step="5" value={project.canvas.layoutScale} onChange={event => onCanvas({ layoutScale: numberValue(event.target.value, project.canvas.layoutScale, 25, 400) }, true)} /></label>
        <label>图间距<input type="number" min="0" step="2" value={project.canvas.gap} onChange={event => onCanvas({ gap: numberValue(event.target.value, project.canvas.gap, 0) }, true)} /></label>
        <label>画布边距<input type="number" min="0" step="2" value={project.canvas.margin} onChange={event => onCanvas({ margin: numberValue(event.target.value, project.canvas.margin, 0) }, true)} /></label>
        <label>画布背景<input type="color" value={project.canvas.background} onChange={event => onCanvas({ background: event.target.value })} /></label>
      </div>
      <div className="figure-composer__subhead">图片边框</div>
      <label className="figure-composer__check"><input type="checkbox" checked={project.borderDefaults.enabled} onChange={event => onBorderDefaults({ enabled: event.target.checked })} /> 默认显示边框</label>
      <div className="figure-composer__field-grid three">
        <label>颜色<input type="color" value={project.borderDefaults.color} onChange={event => onBorderDefaults({ color: event.target.value })} /></label>
        <label>边框粗细<input type="number" min="0.25" step="0.25" value={project.borderDefaults.width} onChange={event => onBorderDefaults({ width: numberValue(event.target.value, project.borderDefaults.width, .25) })} /></label>
        <label>线型<select value={project.borderDefaults.style} onChange={event => onBorderDefaults({ style: event.target.value as FigureBorderSettings['style'] })}><option value="solid">实线</option><option value="dashed">虚线</option></select></label>
      </div>
      <button type="button" className="figure-composer__apply-all" onClick={onApplyBordersToAll}>边框应用到全部</button>
    </section>

    <section className="figure-composer__section figure-composer__global-labels" aria-label="全局标签">
      <div className="figure-composer__section-title"><Tags size={14} /><strong>全局标签</strong></div>
      <label className="figure-composer__check"><input type="checkbox" checked={project.labelDefaults.visible} onChange={event => onLabelDefaults({ visible: event.target.checked })} /> 显示标签</label>
      <div className="figure-composer__field-grid two">
        <label>标签样式<select value={project.labelDefaults.style} onChange={event => onLabelDefaults({ style: event.target.value as FigureLabelSettings['style'] })}><option value="parena">(a), (b), (c)</option><option value="a">a, b, c</option><option value="parenA">(A), (B), (C)</option><option value="A">A, B, C</option></select></label>
        <label>标签字体<select value={project.labelDefaults.fontFamily} onChange={event => onLabelDefaults({ fontFamily: event.target.value })}><option>Times New Roman</option><option>Arial</option><option>Cambria</option><option>Georgia</option><option>Microsoft YaHei</option><option>SimSun</option><option>SimHei</option></select></label>
        <label>标签字号<input type="number" min="8" max="240" value={project.labelDefaults.fontSize} onChange={event => onLabelDefaults({ fontSize: numberValue(event.target.value, project.labelDefaults.fontSize, 8, 240) })} /></label>
        <label>字重<select value={project.labelDefaults.fontWeight} onChange={event => onLabelDefaults({ fontWeight: Number(event.target.value) as FigureLabelSettings['fontWeight'] })}><option value="400">常规</option><option value="500">Medium</option><option value="600">SemiBold</option><option value="700">粗体</option></select></label>
        <label>标签位置<select value={project.labelDefaults.position} onChange={event => onLabelDefaults({ position: event.target.value as FigureLabelSettings['position'] })}><option value="top-left">左上</option><option value="top-right">右上</option><option value="bottom-left">左下</option><option value="bottom-right">右下</option></select></label>
        <label>标签颜色<input type="color" value={project.labelDefaults.color} onChange={event => onLabelDefaults({ color: event.target.value })} /></label>
        <label>横向偏移<input type="number" step="2" value={project.labelDefaults.offsetX} onChange={event => onLabelDefaults({ offsetX: numberValue(event.target.value, project.labelDefaults.offsetX) })} /></label>
        <label>纵向偏移<input type="number" step="2" value={project.labelDefaults.offsetY} onChange={event => onLabelDefaults({ offsetY: numberValue(event.target.value, project.labelDefaults.offsetY) })} /></label>
      </div>
      <button type="button" className="figure-composer__apply-all primary" onClick={onApplyLabelsToAll}>标签应用到全部</button>
    </section>
  </>
}
