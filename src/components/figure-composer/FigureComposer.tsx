import { ArrowLeft, Download, FileCheck2, Plus, Save, Type, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { ManuscriptDraft } from '../../lib/preparation'
import { alignPanels, distributePanels, resizePanel, translatePanels } from '../../lib/figure-composer/geometry'
import { importFigureFiles, revokeFigureAssets } from '../../lib/figure-composer/image-import'
import { applyGridLayout, autoWrapProject } from '../../lib/figure-composer/layout'
import { countFigureProjectsForDraft, deleteFigureProject, listFigureProjects, loadFigureProject, saveFigureProject } from '../../lib/figure-composer/project'
import { snapPanel } from '../../lib/figure-composer/snapping'
import { exportFigureProject } from '../../lib/figure-composer/export'
import { physicalToLogicalPx } from '../../lib/figure-composer/units'
import { validateFigureProject } from '../../lib/figure-composer/validation'
import {
  DEFAULT_BORDER_SETTINGS,
  DEFAULT_LABEL_SETTINGS,
  createEmptyFigureProject,
  type AlignMode,
  type DistributionAxis,
  type FigurePanel,
  type FigureProject,
  type FigureSnapGuide,
  type FigureText,
  type PublicationPreset,
  type RuntimeFigureAsset,
} from '../../lib/figure-composer/types'
import FigureCanvas from './FigureCanvas'
import FigureExportPanel from './FigureExportPanel'
import FigureGlobalLayoutPanel from './FigureGlobalLayoutPanel'
import FigurePanelInspector from './FigurePanelInspector'
import FigurePreflightPanel from './FigurePreflightPanel'
import FigureSidebar from './FigureSidebar'
import FigureToolbar from './FigureToolbar'

interface Props {
  drafts: ManuscriptDraft[]
  initialDraftId?: string | null
  onDraftFigureCountChange?: (draftId: string, count: number) => Promise<void> | void
  onBack?: () => void
}

type Action =
  | { type: 'replace'; project: FigureProject }
  | { type: 'patch'; patch: Partial<FigureProject> }

function reducer(project: FigureProject, action: Action): FigureProject {
  if (action.type === 'replace') return action.project
  return { ...project, ...action.patch, updatedAt: new Date().toISOString() }
}

function panelFromAsset(asset: RuntimeFigureAsset, index: number, project: FigureProject): FigurePanel {
  const originalAspectRatio = asset.naturalWidth / Math.max(1, asset.naturalHeight)
  const width = Math.max(100, project.canvas.panelWidth) * Math.max(.25, project.canvas.layoutScale / 100)
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    name: asset.name,
    sourceType: asset.mime,
    naturalWidth: asset.naturalWidth,
    naturalHeight: asset.naturalHeight,
    originalAspectRatio,
    x: project.canvas.margin + index * 12,
    y: project.canvas.margin + index * 12,
    width,
    height: width / Math.max(0.0001, originalAspectRatio),
    lockAspectRatio: true,
    gridRow: 0,
    gridColumn: 0,
    rowSpan: 1,
    colSpan: 1,
    fit: 'contain',
    label: { ...DEFAULT_LABEL_SETTINGS, ...project.labelDefaults },
    border: { ...DEFAULT_BORDER_SETTINGS, ...project.borderDefaults },
  }
}

function scaleProjectToWidth(project: FigureProject, width: number) {
  const factor = width / Math.max(1, project.canvas.width)
  return {
    ...project,
    canvas: { ...project.canvas, width, height: project.canvas.height * factor },
    panels: project.panels.map(panel => ({ ...panel, x: panel.x * factor, y: panel.y * factor, width: panel.width * factor, height: panel.height * factor })),
    texts: project.texts.map(text => ({ ...text, x: text.x * factor, y: text.y * factor })),
  }
}

const PANE_STORAGE_KEY = 'submission-hub.figure-composer.panes'
const DEFAULT_PANES = { left: 270, right: 330 }
function readPaneWidths() {
  try {
    const value = JSON.parse(localStorage.getItem(PANE_STORAGE_KEY) || 'null')
    return { left: Math.max(210, Math.min(460, Number(value?.left) || DEFAULT_PANES.left)), right: Math.max(260, Math.min(520, Number(value?.right) || DEFAULT_PANES.right)) }
  } catch { return DEFAULT_PANES }
}

export default function FigureComposer({ drafts, initialDraftId = null, onDraftFigureCountChange, onBack }: Props) {
  const [project, dispatch] = useReducer(reducer, createEmptyFigureProject(initialDraftId))
  const [projects, setProjects] = useState<FigureProject[]>([])
  const [assets, setAssets] = useState<Map<string, RuntimeFigureAsset>>(new Map())
  const assetsRef = useRef(assets)
  const [guides, setGuides] = useState<FigureSnapGuide[]>([])
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('导入图片后可自动排版，也可进入自由布局精确编辑。')
  const [textDraft, setTextDraft] = useState('')
  const [paneWidths, setPaneWidths] = useState(readPaneWidths)

  useEffect(() => { assetsRef.current = assets }, [assets])
  useEffect(() => { localStorage.setItem(PANE_STORAGE_KEY, JSON.stringify(paneWidths)) }, [paneWidths])
  useEffect(() => () => revokeFigureAssets(assetsRef.current.values()), [])

  const refreshProjects = useCallback(async () => {
    try {
      setProjects(await listFigureProjects())
    } catch (error) {
      console.error('Load figure projects failed:', error)
      setStatus('无法读取浏览器中的组图工程；请检查 IndexedDB 是否可用。')
    }
  }, [])

  useEffect(() => { void refreshProjects() }, [refreshProjects])

  const replace = (next: FigureProject) => dispatch({ type: 'replace', project: { ...next, updatedAt: new Date().toISOString() } })
  const preflight = useMemo(() => validateFigureProject(project), [project])
  const selectedPanel = useMemo(() => project.panels.find(panel => panel.id === project.selectedPanelIds.at(-1)) || null, [project.panels, project.selectedPanelIds])
  const selectedText = useMemo(() => project.texts.find(text => text.id === project.selectedTextId) || null, [project.texts, project.selectedTextId])

  const syncDraftCount = useCallback(async (draftId: string | null) => {
    if (!draftId || !onDraftFigureCountChange) return
    const count = await countFigureProjectsForDraft(draftId)
    await onDraftFigureCountChange(draftId, count)
  }, [onDraftFigureCountChange])

  const clearRuntimeAssets = () => {
    revokeFigureAssets(assetsRef.current.values())
    setAssets(new Map())
  }

  const newProject = () => {
    clearRuntimeAssets()
    const nextSequence = Math.max(0, ...projects.map(item => item.sequence)) + 1
    replace(createEmptyFigureProject(null, nextSequence, project.role))
    setGuides([])
    setStatus('已建立新的未命名组图；需要时可主动关联草稿或设置出版编号。')
  }

  const openProject = async (projectId: string) => {
    setBusy(true)
    try {
      const loaded = await loadFigureProject(projectId)
      if (!loaded) throw new Error('工程不存在或已被删除')
      clearRuntimeAssets()
      setAssets(loaded.assets)
      replace(loaded.project)
      setStatus(`已打开 ${loaded.project.name}。`)
    } catch (error) {
      setStatus(error instanceof Error ? `打开工程失败：${error.message}` : '打开工程失败。')
    } finally {
      setBusy(false)
    }
  }

  const saveProject = async () => {
    setBusy(true)
    try {
      await saveFigureProject(project, assets.values())
      await refreshProjects()
      await syncDraftCount(project.draftId)
      setStatus(`已保存 ${project.name}；图片仍仅保存在当前浏览器。`)
    } catch (error) {
      setStatus(error instanceof Error ? `保存失败：${error.message}` : '保存失败。')
    } finally {
      setBusy(false)
    }
  }

  const removeProject = async () => {
    if (!projects.some(item => item.id === project.id)) return
    if (!window.confirm(`删除本地组图工程“${project.name}”？`)) return
    setBusy(true)
    const oldDraftId = project.draftId
    try {
      await deleteFigureProject(project.id)
      clearRuntimeAssets()
      const next = createEmptyFigureProject(null)
      replace(next)
      await refreshProjects()
      await syncDraftCount(oldDraftId)
      setStatus('组图工程已从当前浏览器删除。')
    } catch (error) {
      setStatus(error instanceof Error ? `删除失败：${error.message}` : '删除失败。')
    } finally {
      setBusy(false)
    }
  }

  const patchProjectIdentity = (patch: Partial<Pick<FigureProject, 'draftId' | 'role' | 'sequence' | 'name' | 'publicationLabel' | 'title' | 'caption'>>) => {
    replace({ ...project, ...patch })
  }

  const handleImport = async (files: FileList | File[]) => {
    setBusy(true)
    setStatus('正在浏览器本地解析图片…')
    try {
      const result = await importFigureFiles(files)
      if (!result.assets.length) {
        setStatus(result.errors.map(item => `${item.file}：${item.message}`).join('；') || '没有可导入的图片。')
        return
      }
      const nextAssets = new Map(assets)
      result.assets.forEach(asset => nextAssets.set(asset.id, asset))
      setAssets(nextAssets)
      let next: FigureProject = {
        ...project,
        panels: [...project.panels, ...result.assets.map((asset, index) => panelFromAsset(asset, project.panels.length + index, project))],
        selectedPanelIds: [],
        selectedTextId: null,
      }
      if (next.canvas.layoutMode === 'grid') next = applyGridLayout(next)
      if (next.canvas.autoWrap) next = autoWrapProject(next)
      replace(next)
      setStatus(result.errors.length ? `已导入 ${result.assets.length} 个图层；${result.errors.length} 个文件失败。` : `已导入 ${result.assets.length} 个图层。`)
    } finally {
      setBusy(false)
    }
  }

  const selectPanel = (id: string, mode: 'replace' | 'toggle' | 'range') => {
    const ids = project.selectedPanelIds
    let nextIds: string[]
    if (mode === 'toggle') nextIds = ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]
    else if (mode === 'range' && ids.length) {
      const order = project.panels.map(panel => panel.id)
      const start = order.indexOf(ids[ids.length - 1])
      const end = order.indexOf(id)
      const [from, to] = start <= end ? [start, end] : [end, start]
      nextIds = Array.from(new Set([...ids, ...order.slice(from, to + 1)]))
    } else nextIds = [id]
    replace({ ...project, selectedPanelIds: nextIds, selectedTextId: null })
  }

  const selectText = (id: string) => replace({ ...project, selectedPanelIds: [], selectedTextId: id })
  const clearSelection = () => replace({ ...project, selectedPanelIds: [], selectedTextId: null })

  const movePanel = (id: string, x: number, y: number) => {
    const active = project.panels.find(panel => panel.id === id)
    if (!active) return
    const selectedIds = project.selectedPanelIds.includes(id) ? project.selectedPanelIds : [id]
    const proposed = { ...active, x, y }
    const snapped = snapPanel(proposed, project.panels, project.canvas, project.canvas.gap)
    const dx = snapped.x - active.x
    const dy = snapped.y - active.y
    setGuides(snapped.guides)
    replace({
      ...project,
      canvas: { ...project.canvas, layoutMode: 'manual' },
      panels: translatePanels(project.panels, selectedIds, dx, dy),
    })
  }

  const moveText = (id: string, x: number, y: number) => replace({ ...project, texts: project.texts.map(text => text.id === id ? { ...text, x, y } : text) })

  const patchPanel = (id: string, patch: Partial<FigurePanel>, editedDimension?: 'width' | 'height' | 'both') => {
    let panels = project.panels.map(panel => panel.id === id ? resizePanel({ ...panel, ...patch }, { ...patch, editedDimension }) : panel)
    let next: FigureProject = { ...project, panels }
    const spanChange = patch.rowSpan !== undefined || patch.colSpan !== undefined || patch.gridRow !== undefined || patch.gridColumn !== undefined
    const directGeometry = patch.x !== undefined || patch.y !== undefined || patch.width !== undefined || patch.height !== undefined
    if (spanChange && project.canvas.layoutMode === 'grid') next = applyGridLayout(next)
    else if (directGeometry) next = { ...next, canvas: { ...next.canvas, layoutMode: 'manual' } }
    replace(next)
  }

  const moveLayer = (id: string, direction: -1 | 1) => {
    const index = project.panels.findIndex(panel => panel.id === id)
    if (index < 0) return
    const target = Math.max(0, Math.min(project.panels.length - 1, index + direction))
    if (target === index) return
    const panels = [...project.panels]
    const [panel] = panels.splice(index, 1)
    panels.splice(target, 0, panel)
    replace({ ...project, panels })
  }

  const removePanel = (id: string) => {
    const panel = project.panels.find(item => item.id === id)
    if (!panel) return
    const asset = assets.get(panel.assetId)
    if (asset) revokeFigureAssets([asset])
    const nextAssets = new Map(assets)
    nextAssets.delete(panel.assetId)
    setAssets(nextAssets)
    let next = { ...project, panels: project.panels.filter(item => item.id !== id), selectedPanelIds: project.selectedPanelIds.filter(item => item !== id) }
    if (project.canvas.layoutMode === 'grid') next = applyGridLayout(next)
    if (project.canvas.autoWrap) next = autoWrapProject(next)
    replace(next)
  }

  const align = (mode: AlignMode) => replace({ ...project, canvas: { ...project.canvas, layoutMode: 'manual' }, panels: alignPanels(project.panels, project.selectedPanelIds, mode) })
  const distribute = (axis: DistributionAxis) => replace({ ...project, canvas: { ...project.canvas, layoutMode: 'manual' }, panels: distributePanels(project.panels, project.selectedPanelIds, axis) })

  const applyLayout = (preset: FigureProject['canvas']['layoutPreset']) => {
    let next = applyGridLayout({ ...project, canvas: { ...project.canvas, layoutPreset: preset } }, preset)
    if (next.canvas.autoWrap) next = autoWrapProject(next)
    replace(next)
  }

  const setGridSize = (rows: number, columns: number) => {
    let next = applyGridLayout({ ...project, canvas: { ...project.canvas, gridRows: rows, gridColumns: columns, layoutPreset: 'uniform' } }, 'uniform')
    if (next.canvas.autoWrap) next = autoWrapProject(next)
    replace(next)
  }

  const applyPublicationPreset = (preset: PublicationPreset) => {
    const width = physicalToLogicalPx(preset.width, preset.unit)
    const scaled = scaleProjectToWidth(project, width)
    replace({
      ...scaled,
      exportSettings: { ...scaled.exportSettings, physicalWidth: preset.width, physicalHeight: preset.height, unit: preset.unit },
    })
  }

  const addText = () => {
    const value = textDraft.trim()
    if (!value) return
    const text: FigureText = {
      id: crypto.randomUUID(),
      text: value,
      x: project.canvas.margin,
      y: project.canvas.margin,
      fontFamily: 'Times New Roman',
      fontSize: 18,
      fontWeight: 400,
      color: '#111827',
    }
    replace({ ...project, texts: [...project.texts, text], selectedPanelIds: [], selectedTextId: text.id })
    setTextDraft('')
  }

  const patchSelectedText = (patch: Partial<FigureText>) => {
    if (!selectedText) return
    replace({ ...project, texts: project.texts.map(text => text.id === selectedText.id ? { ...text, ...patch } : text) })
  }

  const removeSelectedText = () => {
    if (!selectedText) return
    replace({ ...project, texts: project.texts.filter(text => text.id !== selectedText.id), selectedTextId: null })
  }

  const patchCanvas = (patch: Partial<FigureProject['canvas']>, reflow = false) => {
    let next: FigureProject = { ...project, canvas: { ...project.canvas, ...patch } }
    if (reflow && next.canvas.layoutMode === 'grid') next = applyGridLayout(next)
    replace(next)
  }

  const patchLabelDefaults = (patch: Partial<FigureProject['labelDefaults']>) => replace({ ...project, labelDefaults: { ...project.labelDefaults, ...patch } })
  const patchBorderDefaults = (patch: Partial<FigureProject['borderDefaults']>) => replace({ ...project, borderDefaults: { ...project.borderDefaults, ...patch } })
  const applyLabelsToAll = () => replace({ ...project, panels: project.panels.map(panel => ({ ...panel, label: { ...project.labelDefaults, textOverride: panel.label.textOverride } })) })
  const applyBordersToAll = () => replace({ ...project, panels: project.panels.map(panel => ({ ...panel, border: { ...project.borderDefaults } })) })
  const scaleSelected = (factor: number) => {
    if (!project.selectedPanelIds.length) return
    replace({ ...project, canvas: { ...project.canvas, layoutMode: 'manual' }, panels: project.panels.map(panel => project.selectedPanelIds.includes(panel.id) ? resizePanel(panel, { width: Math.max(20, panel.width * factor), editedDimension: 'width' }) : panel) })
  }

  const beginPaneResize = (side: 'left' | 'right', event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const initial = paneWidths
    const move = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX
      setPaneWidths(side === 'left'
        ? { ...initial, left: Math.max(210, Math.min(460, initial.left + delta)) }
        : { ...initial, right: Math.max(260, Math.min(520, initial.right - delta)) })
    }
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }

  const resetPaneWidths = () => setPaneWidths(DEFAULT_PANES)

  const handleExport = async () => {
    setBusy(true)
    try {
      await exportFigureProject(project, assets)
      setStatus(`已按 ${project.exportSettings.dpi} DPI 生成 ${project.exportSettings.format.toUpperCase()}。`)
    } catch (error) {
      setStatus(error instanceof Error ? `导出失败：${error.message}` : '导出失败。')
    } finally {
      setBusy(false)
    }
  }

  return <section className="figure-composer" aria-label="科研组图">
    <header className="figure-composer__header">
      <div className="figure-composer__header-main">
        {onBack && <button className="figure-composer__icon-button" type="button" onClick={onBack}><ArrowLeft size={16} /><span>返回投稿准备</span></button>}
        <div className="figure-composer__identity"><small><span>投稿准备</span><i>/</i><span>科研组图</span></small><h2>{project.name}</h2><p>{project.publicationLabel ? `出版编号：${project.publicationLabel}` : '通用科研组图工作台 · 默认不关联任何论文'}</p></div>
      </div>
      <div className="figure-composer__header-actions">
        <button type="button" onClick={newProject}><Plus size={14} /> 新建</button>
        <button type="button" disabled={busy} onClick={() => void saveProject()}><Save size={14} /> 保存</button>
        <span className={`figure-composer__preflight-chip ${preflight.some(issue => issue.severity === 'error') ? 'error' : preflight.length ? 'warning' : 'ok'}`}><FileCheck2 size={14} /> {preflight.length ? `${preflight.length} 项检查` : '检查通过'}</span>
        <button className="primary" type="button" disabled={busy} onClick={() => void handleExport()}><Download size={14} /> 导出</button>
      </div>
    </header>

    <div className="figure-composer__workspace" style={{ '--fc-left-pane': `${paneWidths.left}px`, '--fc-right-pane': `${paneWidths.right}px` } as CSSProperties}>
      <FigureSidebar
        project={project}
        projects={projects}
        drafts={drafts}
        assets={assets}
        busy={busy}
        onProjectField={patchProjectIdentity}
        onNewProject={newProject}
        onOpenProject={id => void openProject(id)}
        onSaveProject={() => void saveProject()}
        onDeleteProject={() => void removeProject()}
        onImport={files => void handleImport(files)}
        onSelectPanel={selectPanel}
        onMoveLayer={moveLayer}
        onRemovePanel={removePanel}
        globalControls={<FigureGlobalLayoutPanel project={project} onCanvas={patchCanvas} onLabelDefaults={patchLabelDefaults} onBorderDefaults={patchBorderDefaults} onApplyLabelsToAll={applyLabelsToAll} onApplyBordersToAll={applyBordersToAll} />}
      />

      <div className="figure-composer__splitter" role="separator" aria-orientation="vertical" aria-label="调整左侧面板宽度" aria-valuenow={paneWidths.left} tabIndex={0} onPointerDown={event => beginPaneResize('left', event)} onDoubleClick={resetPaneWidths} />

      <main className="figure-composer__center">
        <FigureToolbar
          selectedCount={project.selectedPanelIds.length}
          zoom={zoom}
          layoutPreset={project.canvas.layoutPreset}
          gridRows={project.canvas.gridRows}
          gridColumns={project.canvas.gridColumns}
          onZoom={setZoom}
          onAlign={align}
          onDistribute={distribute}
          onLayoutPreset={applyLayout}
          onGridSize={setGridSize}
          onAutoWrap={() => replace(autoWrapProject(project))}
          onScaleSelected={scaleSelected}
        />
        <FigureCanvas
          project={project}
          assets={assets}
          zoom={zoom}
          guides={guides}
          onSelectPanel={selectPanel}
          onSelectText={selectText}
          onClearSelection={clearSelection}
          onMovePanel={movePanel}
          onMoveText={moveText}
          onFinishMove={() => setGuides([])}
        />
        <footer className="figure-composer__status" aria-live="polite"><span>{status}</span><b>{Math.round(project.canvas.width)}×{Math.round(project.canvas.height)} logical px · {project.panels.length} 子图</b></footer>
      </main>

      <div className="figure-composer__splitter" role="separator" aria-orientation="vertical" aria-label="调整右侧面板宽度" aria-valuenow={paneWidths.right} tabIndex={0} onPointerDown={event => beginPaneResize('right', event)} onDoubleClick={resetPaneWidths} />

      <aside className="figure-composer__right">
        <FigurePanelInspector panel={selectedPanel} selectedCount={project.selectedPanelIds.length} onPatch={patchPanel} />
        <section className="figure-composer__section" aria-label="自由文本">
          <div className="figure-composer__section-title"><Type size={14} /><strong>自由文本</strong></div>
          <div className="figure-composer__inline-add"><input value={textDraft} placeholder="添加可移动文本" onChange={event => setTextDraft(event.target.value)} /><button type="button" onClick={addText}><Plus size={13} /> 添加</button></div>
          {selectedText && <div className="figure-composer__text-editor">
            <label>文本<input value={selectedText.text} onChange={event => patchSelectedText({ text: event.target.value })} /></label>
            <div className="figure-composer__field-grid two">
              <label>字体<select value={selectedText.fontFamily} onChange={event => patchSelectedText({ fontFamily: event.target.value })}><option>Times New Roman</option><option>Arial</option><option>Helvetica</option><option>Microsoft YaHei</option><option>SimSun</option></select></label>
              <label>字号<input type="number" min="8" value={selectedText.fontSize} onChange={event => patchSelectedText({ fontSize: Math.max(8, Number(event.target.value) || 8) })} /></label>
              <label>颜色<input type="color" value={selectedText.color} onChange={event => patchSelectedText({ color: event.target.value })} /></label>
              <label>X<input type="number" value={selectedText.x} onChange={event => patchSelectedText({ x: Number(event.target.value) || 0 })} /></label>
              <label>Y<input type="number" value={selectedText.y} onChange={event => patchSelectedText({ y: Number(event.target.value) || 0 })} /></label>
            </div>
            <button type="button" className="danger" onClick={removeSelectedText}><X size={13} /> 删除文本</button>
          </div>}
        </section>
        <FigurePreflightPanel issues={preflight} />
        <FigureExportPanel
          project={project}
          busy={busy}
          onExportSettings={patch => replace({ ...project, exportSettings: { ...project.exportSettings, ...patch } })}
          onApplyPreset={applyPublicationPreset}
          onExport={() => void handleExport()}
        />
      </aside>
    </div>
    <div className="figure-composer__mobile-note">复杂组图排版建议在桌面端完成；当前设备仍可查看工程、调整基础参数和导出。</div>
  </section>
}
