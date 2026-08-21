import { Download, Ruler } from 'lucide-react'
import { PUBLICATION_PRESETS, type FigureExportFormat, type FigureProject, type FigureUnit, type PublicationPreset } from '../../lib/figure-composer/types'
import { physicalToOutputPx } from '../../lib/figure-composer/units'

interface Props {
  project: FigureProject
  busy: boolean
  onExportSettings: (patch: Partial<FigureProject['exportSettings']>) => void
  onApplyPreset: (preset: PublicationPreset) => void
  onExport: () => void
}

export default function FigureExportPanel({ project, busy, onExportSettings, onApplyPreset, onExport }: Props) {
  const outputWidth = physicalToOutputPx(project.exportSettings.physicalWidth, project.exportSettings.unit, project.exportSettings.dpi)
  const outputHeight = project.exportSettings.physicalHeight
    ? physicalToOutputPx(project.exportSettings.physicalHeight, project.exportSettings.unit, project.exportSettings.dpi)
    : Math.round(outputWidth * project.canvas.height / Math.max(1, project.canvas.width))

  return <section className="figure-composer__section" aria-label="出版尺寸与导出">
    <div className="figure-composer__section-title"><Ruler size={14} /><strong>出版尺寸与导出</strong></div>
    <label>尺寸预设<select defaultValue="custom" onChange={event => {
      const preset = PUBLICATION_PRESETS.find(item => item.id === event.target.value)
      if (preset) onApplyPreset(preset)
    }}>
      {PUBLICATION_PRESETS.map(preset => <option value={preset.id} key={preset.id}>{preset.label}</option>)}
    </select></label>
    <div className="figure-composer__field-grid two">
      <label>宽度<input type="number" min="1" step="0.1" value={project.exportSettings.physicalWidth} onChange={event => onExportSettings({ physicalWidth: Math.max(1, Number(event.target.value) || 1) })} /></label>
      <label>高度<input type="number" min="1" step="0.1" placeholder="自动" value={project.exportSettings.physicalHeight ?? ''} onChange={event => onExportSettings({ physicalHeight: event.target.value ? Math.max(1, Number(event.target.value) || 1) : null })} /></label>
      <label>单位<select value={project.exportSettings.unit} onChange={event => onExportSettings({ unit: event.target.value as FigureUnit })}><option value="mm">mm</option><option value="cm">cm</option><option value="inch">inch</option></select></label>
      <label>DPI<select value={project.exportSettings.dpi} onChange={event => onExportSettings({ dpi: Number(event.target.value) })}><option value="150">150</option><option value="300">300</option><option value="450">450</option><option value="600">600</option><option value="900">900</option><option value="1200">1200</option></select></label>
      <label>格式<select value={project.exportSettings.format} onChange={event => onExportSettings({ format: event.target.value as FigureExportFormat })}><option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WEBP</option><option value="tiff">TIFF</option><option value="pdf">PDF</option><option value="svg">SVG</option></select></label>
    </div>
    <div className="figure-composer__output-summary">
      <span>逻辑画布 {Math.round(project.canvas.width)} × {Math.round(project.canvas.height)}</span>
      <strong>输出 {outputWidth} × {outputHeight}px</strong>
    </div>
    <button type="button" className="figure-composer__primary-action" disabled={busy} onClick={onExport}><Download size={14} /> {busy ? '正在生成…' : `导出 ${project.exportSettings.format.toUpperCase()}`}</button>
  </section>
}
