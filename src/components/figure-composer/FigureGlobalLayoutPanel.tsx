import { LayoutGrid, Tags } from 'lucide-react'
import { useEffect, useState } from 'react'
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

interface NumericDraftInputProps {
  value: number
  min?: number
  max?: number
  step?: number | string
  ariaLabel?: string
  onCommit: (next: number) => void
}

/** Keep the field editable while cleared; reflow only after a complete value. */
function NumericDraftInput({ value, min, max, step, ariaLabel, onCommit }: NumericDraftInputProps) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => { setDraft(String(value)) }, [value])

  const commit = () => {
    if (!draft.trim() || !Number.isFinite(Number(draft))) {
      setDraft(String(value))
      return
    }
    const next = numberValue(draft, value, min, max)
    setDraft(String(next))
    if (next !== value) onCommit(next)
  }

  return <input
    aria-label={ariaLabel}
    type="number"
    min={min}
    max={max}
    step={step}
    value={draft}
    onChange={event => setDraft(event.target.value)}
    onBlur={commit}
    onKeyDown={event => {
      if (event.key === 'Enter') event.currentTarget.blur()
      if (event.key === 'Escape') setDraft(String(value))
    }}
  />
}

export default function FigureGlobalLayoutPanel({ project, onCanvas, onLabelDefaults, onBorderDefaults, onApplyLabelsToAll, onApplyBordersToAll }: Props) {
  const [labelFontSizeDraft, setLabelFontSizeDraft] = useState(String(project.labelDefaults.fontSize))

  useEffect(() => {
    setLabelFontSizeDraft(String(project.labelDefaults.fontSize))
  }, [project.id, project.labelDefaults.fontSize])

  const commitLabelFontSize = () => {
    const parsed = Number(labelFontSizeDraft)
    const next = Number.isFinite(parsed) ? Math.max(8, Math.min(240, parsed)) : project.labelDefaults.fontSize
    setLabelFontSizeDraft(String(next))
    if (next !== project.labelDefaults.fontSize) onLabelDefaults({ fontSize: next })
  }
  return <>
    <section className="figure-composer__section figure-composer__global-layout" aria-label="全局排版">
      <div className="figure-composer__section-title">
        <LayoutGrid size={14} /><strong>全局排版</strong>
        <label className="figure-composer__title-color" title="画布背景"><span>背景</span><input aria-label="画布背景" type="color" value={project.canvas.background} onChange={event => onCanvas({ background: event.target.value })} /></label>
      </div>
      <div className="figure-composer__field-grid two figure-composer__global-core">
        <label className="figure-composer__rail-inline-field"><span>单图宽度</span><NumericDraftInput key={project.id} min={100} step={20} value={project.canvas.panelWidth} onCommit={panelWidth => onCanvas({ panelWidth }, true)} /></label>
        <label className="figure-composer__rail-inline-field"><span>整体缩放</span><div className="figure-composer__unit-input"><NumericDraftInput key={project.id} ariaLabel="整体缩放" min={25} max={400} step={5} value={project.canvas.layoutScale} onCommit={layoutScale => onCanvas({ layoutScale }, true)} /><em>%</em></div></label>
        <label className="figure-composer__rail-inline-field"><span>图间距</span><NumericDraftInput key={project.id} min={0} step={2} value={project.canvas.gap} onCommit={gap => onCanvas({ gap }, true)} /></label>
        <label className="figure-composer__rail-inline-field"><span>画布边距</span><NumericDraftInput key={project.id} min={0} step={2} value={project.canvas.margin} onCommit={margin => onCanvas({ margin }, true)} /></label>
      </div>
      <details className="figure-composer__compact-details figure-composer__global-advanced">
        <summary><strong>默认边框</strong><span>{project.borderDefaults.enabled ? '已开启' : '关闭'}</span></summary>
        <div className="figure-composer__details-body">
          <label className="figure-composer__check"><input type="checkbox" checked={project.borderDefaults.enabled} onChange={event => onBorderDefaults({ enabled: event.target.checked })} /> 显示边框</label>
          <div className="figure-composer__field-grid three">
            <label>颜色<input type="color" value={project.borderDefaults.color} onChange={event => onBorderDefaults({ color: event.target.value })} /></label>
            <label>线宽<NumericDraftInput key={project.id} min={0.25} step={0.25} value={project.borderDefaults.width} onCommit={width => onBorderDefaults({ width })} /></label>
            <label>线型<select value={project.borderDefaults.style} onChange={event => onBorderDefaults({ style: event.target.value as FigureBorderSettings['style'] })}><option value="solid">实线</option><option value="dashed">虚线</option></select></label>
          </div>
          <button type="button" className="figure-composer__mini-action" aria-label="边框应用到全部" onClick={onApplyBordersToAll}>应用到全部</button>
        </div>
      </details>
    </section>

    <section className="figure-composer__section figure-composer__global-labels" aria-label="全局标签">
      <div className="figure-composer__section-title"><Tags size={14} /><strong>全局标签</strong><button type="button" className="figure-composer__mini-action" aria-label="标签应用到全部" onClick={onApplyLabelsToAll}>应用到全部</button></div>
      <div className="figure-composer__label-core">
        <label className="figure-composer__check"><input type="checkbox" checked={project.labelDefaults.visible} onChange={event => onLabelDefaults({ visible: event.target.checked })} /> 显示</label>
        <select aria-label="标签样式" value={project.labelDefaults.style} onChange={event => onLabelDefaults({ style: event.target.value as FigureLabelSettings['style'] })}><option value="parena">(a), (b), (c)</option><option value="a">a, b, c</option><option value="parenA">(A), (B), (C)</option><option value="A">A, B, C</option></select>
        <input
          aria-label="标签字号"
          type="number"
          min="8"
          max="240"
          value={labelFontSizeDraft}
          onChange={event => setLabelFontSizeDraft(event.target.value)}
          onBlur={commitLabelFontSize}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
        <select aria-label="标签位置" value={project.labelDefaults.position} onChange={event => onLabelDefaults({ position: event.target.value as FigureLabelSettings['position'] })}><option value="top-left">左上</option><option value="top-right">右上</option><option value="bottom-left">左下</option><option value="bottom-right">右下</option></select>
      </div>
      <details className="figure-composer__compact-details figure-composer__label-advanced">
        <summary><strong>字体、颜色与偏移</strong></summary>
        <div className="figure-composer__details-body">
          <div className="figure-composer__field-grid two">
            <label>标签字体<select value={project.labelDefaults.fontFamily} onChange={event => onLabelDefaults({ fontFamily: event.target.value })}><option>Times New Roman</option><option>Arial</option><option>Cambria</option><option>Georgia</option><option>Microsoft YaHei</option><option>SimSun</option><option>SimHei</option></select></label>
            <label>字重<select value={project.labelDefaults.fontWeight} onChange={event => onLabelDefaults({ fontWeight: Number(event.target.value) as FigureLabelSettings['fontWeight'] })}><option value="400">常规</option><option value="500">Medium</option><option value="600">SemiBold</option><option value="700">粗体</option></select></label>
            <label>颜色<input type="color" value={project.labelDefaults.color} onChange={event => onLabelDefaults({ color: event.target.value })} /></label>
            <label>横向偏移<NumericDraftInput key={project.id} step={2} value={project.labelDefaults.offsetX} onCommit={offsetX => onLabelDefaults({ offsetX })} /></label>
            <label>纵向偏移<NumericDraftInput key={project.id} step={2} value={project.labelDefaults.offsetY} onCommit={offsetY => onLabelDefaults({ offsetY })} /></label>
          </div>
        </div>
      </details>
    </section>
  </>
}
