import { FileImage, FolderOpen, HardDrive, Layers3, Plus, Save, Trash2, Upload } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import type { ManuscriptDraft } from '../../lib/preparation'
import { FIGURE_ACCEPT } from '../../lib/figure-composer/image-import'
import { automaticPanelLabel, figureDisplayName, type FigureProject, type RuntimeFigureAsset } from '../../lib/figure-composer/types'

interface Props {
  project: FigureProject
  projects: FigureProject[]
  drafts: ManuscriptDraft[]
  assets: Map<string, RuntimeFigureAsset>
  busy: boolean
  onProjectField: (patch: Partial<Pick<FigureProject, 'draftId' | 'role' | 'sequence' | 'name' | 'publicationLabel' | 'title' | 'caption'>>) => void
  onNewProject: () => void
  onOpenProject: (id: string) => void
  onSaveProject: () => void
  onDeleteProject: () => void
  onImport: (files: FileList | File[]) => void
  onSelectPanel: (id: string, mode: 'replace' | 'toggle' | 'range') => void
  onMoveLayer: (id: string, direction: -1 | 1) => void
  onRemovePanel: (id: string) => void
  globalControls?: ReactNode
}

export default function FigureSidebar({ project, projects, drafts, assets, busy, onProjectField, onNewProject, onOpenProject, onSaveProject, onDeleteProject, onImport, onSelectPanel, onMoveLayer, onRemovePanel, globalControls }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <aside className="figure-composer__left" aria-label="组图工程与图片">
    <section className="figure-composer__section figure-composer__layers-section">
      <div className="figure-composer__section-title"><FileImage size={14} /><strong>图片与图层</strong><span>{project.panels.length}</span></div>
      <div className="figure-composer__import-row">
        <button className="figure-composer__import" type="button" disabled={busy} title="支持 PNG、JPG、WEBP、SVG、TIFF、PDF" onClick={() => inputRef.current?.click()}><Upload size={15} /> 导入图片</button>
        <small className="figure-composer__local-save-note" title="图片和工程保存在当前浏览器 IndexedDB，不会上传服务器。">IndexedDB · 不会上传 · {assets.size}</small>
      </div>
      <input ref={inputRef} hidden multiple type="file" accept={FIGURE_ACCEPT} onChange={event => event.target.files && onImport(event.target.files)} />
      <div className="figure-composer__layers">
        {project.panels.map((panel, index) => <div key={panel.id} className={`figure-composer__layer ${project.selectedPanelIds.includes(panel.id) ? 'active' : ''}`}>
          <button type="button" className="figure-composer__layer-main" onClick={event => onSelectPanel(panel.id, event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'replace')}>
            <b>{automaticPanelLabel(index, panel.label.style)}</b>
            <span title={panel.name}>{panel.name}</span>
            <small>{panel.naturalWidth}×{panel.naturalHeight} · {(panel.originalAspectRatio || 0).toFixed(2)}</small>
          </button>
          <div className="figure-composer__layer-actions">
            <button title="上移图层" onClick={() => onMoveLayer(panel.id, 1)}>↑</button>
            <button title="下移图层" onClick={() => onMoveLayer(panel.id, -1)}>↓</button>
            <button title="删除图层" onClick={() => onRemovePanel(panel.id)}>×</button>
          </div>
        </div>)}
        {!project.panels.length && <div className="figure-composer__empty"><Layers3 size={18} /><span>导入图片后在这里管理图层。</span></div>}
      </div>
    </section>

    {globalControls}

    <details className="figure-composer__section figure-composer__compact-details figure-composer__caption-section">
      <summary><Layers3 size={13} /><strong>图题与图注</strong><span>{project.title || project.caption ? '已填写' : '可选'}</span></summary>
      <div className="figure-composer__details-body">
        <label>图题<input value={project.title} placeholder="图题（可选）" onChange={event => onProjectField({ title: event.target.value })} /></label>
        <label>图注<textarea rows={2} value={project.caption} placeholder="完整图注与子图说明" onChange={event => onProjectField({ caption: event.target.value })} /></label>
      </div>
    </details>

    <section className="figure-composer__section figure-composer__project-library">
      <div className="figure-composer__section-title"><HardDrive size={14} /><strong>本地草稿库</strong><span>{projects.length}</span></div>
      <div className="figure-composer__button-row figure-composer__project-actions">
        <button type="button" onClick={onNewProject}><Plus size={13} /> 新建</button>
        <button type="button" className="primary" disabled={busy} onClick={onSaveProject} title="保存到当前浏览器 IndexedDB，不会上传服务器"><Save size={13} /> 保存</button>
        <button type="button" className="danger" disabled={!projects.some(item => item.id === project.id)} onClick={onDeleteProject}><Trash2 size={13} /> 删除</button>
      </div>
      <div className="figure-composer__project-list">
        {projects.map(item => <button key={item.id} type="button" className={item.id === project.id ? 'active' : ''} onClick={() => onOpenProject(item.id)}>
          <span>{item.name}</span><small>{item.publicationLabel ? `${item.publicationLabel} · ` : ''}{item.panels.length} 子图</small>
        </button>)}
        {!projects.length && <p className="figure-composer__empty">当前浏览器还没有已保存组图工程。</p>}
      </div>

      <details className="figure-composer__project-meta figure-composer__compact-details">
        <summary><FolderOpen size={13} /><strong>工程与出版信息</strong></summary>
        <div className="figure-composer__details-body">
          <label>工程名称<input value={project.name} placeholder="未命名组图" onChange={event => onProjectField({ name: event.target.value || '未命名组图' })} /></label>
          <label>关联草稿
            <select value={project.draftId || ''} onChange={event => onProjectField({ draftId: event.target.value || null })}>
              <option value="">未关联草稿</option>
              {drafts.map(draft => <option key={draft.id} value={draft.id}>{draft.title}</option>)}
            </select>
          </label>
          <div className="figure-composer__field-grid two">
            <label>类型<select value={project.role} onChange={event => onProjectField({ role: event.target.value as FigureProject['role'] })}><option value="main">Figure</option><option value="supplementary">Supplementary</option></select></label>
            <label>序号<input type="number" min="1" value={project.sequence} onChange={event => onProjectField({ sequence: Math.max(1, Number(event.target.value) || 1) })} /></label>
          </div>
          <label>出版编号
            <div className="figure-composer__inline-add">
              <input value={project.publicationLabel || ''} placeholder="需要时再填写" onChange={event => onProjectField({ publicationLabel: event.target.value.trim() || null })} />
              <button type="button" onClick={() => onProjectField({ publicationLabel: figureDisplayName(project.role, project.sequence) })}>生成</button>
            </div>
          </label>
        </div>
      </details>
    </section>
  </aside>
}
