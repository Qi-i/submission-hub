import fs from 'node:fs'

const read = file => fs.readFileSync(file, 'utf8')
const write = (file, content) => fs.writeFileSync(file, content)
const replace = (source, needle, replacement, label) => {
  if (!source.includes(needle)) throw new Error(`Missing patch anchor: ${label}`)
  return source.replace(needle, replacement)
}

// Dashboard: first-class Journal Center and deterministic Preparation overview entry.
{
  const file = 'src/components/Dashboard.tsx'
  let s = read(file)
  s = replace(s, "import OnlinePreparationWorkspace from './OnlinePreparationWorkspace'", "import OnlinePreparationWorkspace from './OnlinePreparationWorkspace'\nimport JournalCenterWorkspace from './JournalCenterWorkspace'", 'Dashboard JournalCenter import')
  s = replace(s, `  const changeTab = (next: Tab) => {\n    closeTools()\n    setTab(next)\n  }`, `  const changeTab = (next: Tab) => {\n    closeTools()\n    if (next === 'preparation') setPreparationSection('overview')\n    setTab(next)\n  }`, 'Dashboard changeTab')
  s = replace(s, `{uiMode === 'luminous-x' && <LuminousXStatusBar`, `{uiMode === 'luminous-x' && tab !== 'journals' && <LuminousXStatusBar`, 'Journal Center duplicate Luminous X banner')
  s = replace(s, `{tab === 'preparation' && user && !isDemo && <OnlinePreparationWorkspace userId={user.id} section={preparationSection} onSectionChange={setPreparationSection} onPaperCreated={() => { void loadPapers(); void loadJournalProfiles() }} />}`, `{tab === 'preparation' && user && !isDemo && <OnlinePreparationWorkspace userId={user.id} section={preparationSection} onSectionChange={setPreparationSection} onOpenJournalCenter={() => changeTab('journals')} onPaperCreated={() => { void loadPapers(); void loadJournalProfiles() }} />}`, 'Preparation journal-center jump')
  s = replace(s, `{tab === 'journals' && user && !isDemo && <OnlinePreparationWorkspace userId={user.id} section="match" onSectionChange={() => {}} workspaceMode="journal-center" onPaperCreated={() => { void loadPapers(); void loadJournalProfiles() }} />}`, `{tab === 'journals' && user && !isDemo && <JournalCenterWorkspace userId={user.id} onChanged={() => { void loadJournalProfiles() }} />}`, 'Dashboard first-class Journal Center render')
  write(file, s)
}

// Online Preparation: it owns Preparation only; Journal Center has its own loader/UI.
{
  const file = 'src/components/OnlinePreparationWorkspace.tsx'
  let s = read(file)
  s = replace(s, `  onPaperCreated?: () => void\n  workspaceMode?: 'preparation' | 'journal-center'`, `  onPaperCreated?: () => void\n  onOpenJournalCenter?: () => void`, 'OnlinePreparation props')
  s = replace(s, `export default function OnlinePreparationWorkspace({ userId, section, onSectionChange, onPaperCreated, workspaceMode = 'preparation' }: Props)`, `export default function OnlinePreparationWorkspace({ userId, section, onSectionChange, onPaperCreated, onOpenJournalCenter }: Props)`, 'OnlinePreparation signature')
  s = replace(s, `<PreparationWorkspaceSuite section={section} onSectionChange={onSectionChange} workspaceMode={workspaceMode} snapshot={snapshot}`, `<PreparationWorkspaceSuite section={section} onSectionChange={onSectionChange} onOpenJournalCenter={onOpenJournalCenter} snapshot={snapshot}`, 'OnlinePreparation suite props')
  write(file, s)
}

// Preparation: one identity, normal topbar, dedicated matching workflow.
{
  const file = 'src/components/PreparationWorkspace.tsx'
  let s = read(file)
  s = replace(s, `import PreparationOverviewModules from './preparation/PreparationOverviewModules'`, `import PreparationOverviewModules from './preparation/PreparationOverviewModules'\nimport JournalMatchWorkspace from './preparation/JournalMatchWorkspace'`, 'JournalMatch import')
  s = replace(s, `  onDraftFigureCountChange?: (draftId: string, count: number) => Promise<void> | void\n  section?: PreparationSection\n  onSectionChange?: (section: PreparationSection) => void\n  workspaceMode?: 'preparation' | 'journal-center'`, `  onDraftFigureCountChange?: (draftId: string, count: number) => Promise<void> | void\n  onOpenJournalCenter?: () => void\n  section?: PreparationSection\n  onSectionChange?: (section: PreparationSection) => void`, 'Preparation props')
  s = replace(s, `  onPromoteDraft, onLookupJournalRanks, onDraftFigureCountChange,\n  section: controlledSection, onSectionChange, workspaceMode = 'preparation',\n}: Props) {\n  const standaloneJournalCenter = workspaceMode === 'journal-center'\n  const [section, setInternalSection] = useState<SectionKey>(controlledSection || (standaloneJournalCenter ? 'match' : 'overview'))`, `  onPromoteDraft, onLookupJournalRanks, onDraftFigureCountChange, onOpenJournalCenter,\n  section: controlledSection, onSectionChange,\n}: Props) {\n  const [section, setInternalSection] = useState<SectionKey>(controlledSection || 'overview')`, 'Preparation identity')

  const rootStart = s.indexOf('  return <div className={`preparation-workspace')
  const navEndAnchor = `<PreparationNavigation section={primarySection} draftCount={normalized.drafts.length} journalCount={normalized.journals.length} onChange={next => setSection(next)} />}`
  const navEnd = s.indexOf(navEndAnchor, rootStart)
  if (rootStart < 0 || navEnd < 0) throw new Error('Missing Preparation topbar block')
  const afterNav = navEnd + navEndAnchor.length
  const topbar = `  return <div className="preparation-workspace" data-section={primarySection}>\n    {section !== 'figures' && <div className="prep-topbar">\n      <div className="prep-heading">\n        <span className="prep-eyebrow">PRE-SUBMISSION WORKSPACE</span>\n        <h1>投稿准备</h1>\n        <p>把选题、草稿与目标期刊组织成一条清晰的投稿前流程。</p>\n      </div>\n      {(uiMode === 'luminous-x' && canPortalActions && luminousXActionSlot ? createPortal(\n        <div className="prep-top-actions prep-top-actions-portal">\n          {figureToolEntry}\n          <div className="prep-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索选题、草稿或期刊..." /></div>\n          <button className="btn btn-journal-primary btn-sm" onClick={() => setEditor({ type: 'journal', value: 'new' })}><Star size={14} /> 收藏期刊</button>\n          {!['journals', 'compare', 'match'].includes(section) && <button className="btn btn-context-new btn-sm" onClick={openContextNew}><Plus size={14} /> {section === 'topics' ? '新增选题' : '新建草稿'}</button>}\n        </div>, luminousXActionSlot,\n      ) : <div className="prep-top-actions">\n        {figureToolEntry}\n        <div className="prep-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索选题、草稿或期刊..." /></div>\n        <button className="btn btn-journal-primary btn-sm" onClick={() => setEditor({ type: 'journal', value: 'new' })}><Star size={14} /> 收藏期刊</button>\n        {!['journals', 'compare', 'match'].includes(section) && <button className="btn btn-context-new btn-sm" onClick={openContextNew}><Plus size={14} /> {section === 'topics' ? '新增选题' : '新建草稿'}</button>}\n      </div>)}\n    </div>}\n\n    {section !== 'figures' && <PreparationNavigation section={primarySection} draftCount={normalized.drafts.length} journalCount={normalized.journals.length} onChange={next => setSection(next)} />}`
  s = s.slice(0, rootStart) + topbar + s.slice(afterNav)

  const matchStart = s.indexOf(`    {section === 'match' &&`)
  const checkStart = s.indexOf(`    {section === 'check' &&`, matchStart)
  if (matchStart < 0 || checkStart < 0) throw new Error('Missing Preparation match block')
  const match = `    {section === 'match' && <JournalMatchWorkspace\n      drafts={orderedDrafts}\n      journals={orderedJournals}\n      onEditDraft={draft => setEditor({ type: 'draft', value: draft })}\n      onEditJournal={journal => setEditor({ type: 'journal', value: journal })}\n      onOpenJournalCenter={onOpenJournalCenter || (() => {})}\n    />}\n\n`
  s = s.slice(0, matchStart) + match + s.slice(checkStart)
  write(file, s)
}

// Figure Sidebar: accept a real global controls block in the left pane.
{
  const file = 'src/components/figure-composer/FigureSidebar.tsx'
  let s = read(file)
  s = replace(s, `import { useRef } from 'react'`, `import { type ReactNode, useRef } from 'react'`, 'Sidebar ReactNode import')
  s = replace(s, `  onRemovePanel: (id: string) => void\n}`, `  onRemovePanel: (id: string) => void\n  globalControls?: ReactNode\n}`, 'Sidebar globalControls prop')
  s = replace(s, `export default function FigureSidebar({ project, projects, drafts, assets, busy, onProjectField, onNewProject, onOpenProject, onSaveProject, onDeleteProject, onImport, onSelectPanel, onMoveLayer, onRemovePanel }: Props)`, `export default function FigureSidebar({ project, projects, drafts, assets, busy, onProjectField, onNewProject, onOpenProject, onSaveProject, onDeleteProject, onImport, onSelectPanel, onMoveLayer, onRemovePanel, globalControls }: Props)`, 'Sidebar signature')
  s = replace(s, `    </section>\n\n    <section className="figure-composer__section">\n      <div className="figure-composer__section-title"><FileImage`, `    </section>\n\n    {globalControls}\n\n    <section className="figure-composer__section">\n      <div className="figure-composer__section-title"><FileImage`, 'Sidebar insert global controls')
  write(file, s)
}

// Toolbar: restore direct selected-panel scaling controls.
{
  const file = 'src/components/figure-composer/FigureToolbar.tsx'
  let s = read(file)
  s = replace(s, `  onAutoWrap: () => void\n}`, `  onAutoWrap: () => void\n  onScaleSelected: (factor: number) => void\n}`, 'Toolbar scale prop')
  s = replace(s, `export default function FigureToolbar({ selectedCount, zoom, layoutPreset, gridRows, gridColumns, onZoom, onAlign, onDistribute, onLayoutPreset, onGridSize, onAutoWrap }: Props)`, `export default function FigureToolbar({ selectedCount, zoom, layoutPreset, gridRows, gridColumns, onZoom, onAlign, onDistribute, onLayoutPreset, onGridSize, onAutoWrap, onScaleSelected }: Props)`, 'Toolbar signature')
  s = replace(s, `      <button type="button" onClick={onAutoWrap}><Maximize2 size={14} /> 包裹画布</button>`, `      <button type="button" onClick={onAutoWrap}><Maximize2 size={14} /> 包裹画布</button>\n      <button type="button" disabled={!selectedCount} onClick={() => onScaleSelected(.92)}>缩小选中图</button>\n      <button type="button" disabled={!selectedCount} onClick={() => onScaleSelected(1.08)}>放大选中图</button>`, 'Toolbar selected scaling buttons')
  write(file, s)
}

// Figure Composer: defaults, splitters, global controls and selected scaling.
{
  const file = 'src/components/figure-composer/FigureComposer.tsx'
  let s = read(file)
  s = replace(s, `import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'`, `import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'`, 'Composer React types')
  s = replace(s, `import FigureExportPanel from './FigureExportPanel'`, `import FigureExportPanel from './FigureExportPanel'\nimport FigureGlobalLayoutPanel from './FigureGlobalLayoutPanel'`, 'Composer global panel import')
  s = replace(s, `function panelFromAsset(asset: RuntimeFigureAsset, index: number): FigurePanel {\n  const originalAspectRatio = asset.naturalWidth / Math.max(1, asset.naturalHeight)\n  const width = 280`, `function panelFromAsset(asset: RuntimeFigureAsset, index: number, project: FigureProject): FigurePanel {\n  const originalAspectRatio = asset.naturalWidth / Math.max(1, asset.naturalHeight)\n  const width = Math.max(100, project.canvas.panelWidth) * Math.max(.25, project.canvas.layoutScale / 100)`, 'Composer panel defaults signature')
  s = replace(s, `    x: 16 + index * 12,\n    y: 16 + index * 12,`, `    x: project.canvas.margin + index * 12,\n    y: project.canvas.margin + index * 12,`, 'Composer panel origin')
  s = replace(s, `    label: { ...DEFAULT_LABEL_SETTINGS },\n    border: { ...DEFAULT_BORDER_SETTINGS },`, `    label: { ...DEFAULT_LABEL_SETTINGS, ...project.labelDefaults },\n    border: { ...DEFAULT_BORDER_SETTINGS, ...project.borderDefaults },`, 'Composer panel defaults')
  s = replace(s, `export default function FigureComposer({ drafts, initialDraftId = null, onDraftFigureCountChange, onBack }: Props) {`, `const PANE_STORAGE_KEY = 'submission-hub.figure-composer.panes'\nconst DEFAULT_PANES = { left: 270, right: 330 }\nfunction readPaneWidths() {\n  try {\n    const value = JSON.parse(localStorage.getItem(PANE_STORAGE_KEY) || 'null')\n    return { left: Math.max(210, Math.min(460, Number(value?.left) || DEFAULT_PANES.left)), right: Math.max(260, Math.min(520, Number(value?.right) || DEFAULT_PANES.right)) }\n  } catch { return DEFAULT_PANES }\n}\n\nexport default function FigureComposer({ drafts, initialDraftId = null, onDraftFigureCountChange, onBack }: Props) {`, 'Composer pane storage')
  s = replace(s, `  const [textDraft, setTextDraft] = useState('')`, `  const [textDraft, setTextDraft] = useState('')\n  const [paneWidths, setPaneWidths] = useState(readPaneWidths)`, 'Composer pane state')
  s = replace(s, `  useEffect(() => { assetsRef.current = assets }, [assets])`, `  useEffect(() => { assetsRef.current = assets }, [assets])\n  useEffect(() => { localStorage.setItem(PANE_STORAGE_KEY, JSON.stringify(paneWidths)) }, [paneWidths])`, 'Composer pane persistence')
  s = replace(s, `        panels: [...project.panels, ...result.assets.map((asset, index) => panelFromAsset(asset, project.panels.length + index))],`, `        panels: [...project.panels, ...result.assets.map((asset, index) => panelFromAsset(asset, project.panels.length + index, project))],`, 'Composer imported panel defaults')
  const insertBefore = `  const handleExport = async () => {`
  if (!s.includes(insertBefore)) throw new Error('Missing Composer handler insertion point')
  const handlers = `  const patchCanvas = (patch: Partial<FigureProject['canvas']>, reflow = false) => {\n    let next: FigureProject = { ...project, canvas: { ...project.canvas, ...patch } }\n    if (reflow && next.canvas.layoutMode === 'grid') next = applyGridLayout(next)\n    replace(next)\n  }\n\n  const patchLabelDefaults = (patch: Partial<FigureProject['labelDefaults']>) => replace({ ...project, labelDefaults: { ...project.labelDefaults, ...patch } })\n  const patchBorderDefaults = (patch: Partial<FigureProject['borderDefaults']>) => replace({ ...project, borderDefaults: { ...project.borderDefaults, ...patch } })\n  const applyLabelsToAll = () => replace({ ...project, panels: project.panels.map(panel => ({ ...panel, label: { ...project.labelDefaults, textOverride: panel.label.textOverride } })) })\n  const applyBordersToAll = () => replace({ ...project, panels: project.panels.map(panel => ({ ...panel, border: { ...project.borderDefaults } })) })\n  const scaleSelected = (factor: number) => {\n    if (!project.selectedPanelIds.length) return\n    replace({ ...project, canvas: { ...project.canvas, layoutMode: 'manual' }, panels: project.panels.map(panel => project.selectedPanelIds.includes(panel.id) ? resizePanel(panel, { width: Math.max(20, panel.width * factor), editedDimension: 'width' }) : panel) })\n  }\n\n  const beginPaneResize = (side: 'left' | 'right', event: ReactPointerEvent<HTMLDivElement>) => {\n    event.preventDefault()\n    const startX = event.clientX\n    const initial = paneWidths\n    const move = (moveEvent: PointerEvent) => {\n      const delta = moveEvent.clientX - startX\n      setPaneWidths(side === 'left'\n        ? { ...initial, left: Math.max(210, Math.min(460, initial.left + delta)) }\n        : { ...initial, right: Math.max(260, Math.min(520, initial.right - delta)) })\n    }\n    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }\n    window.addEventListener('pointermove', move)\n    window.addEventListener('pointerup', stop, { once: true })\n  }\n\n  const resetPaneWidths = () => setPaneWidths(DEFAULT_PANES)\n\n`
  s = s.replace(insertBefore, handlers + insertBefore)

  s = replace(s, `    <div className="figure-composer__workspace">`, `    <div className="figure-composer__workspace" style={{ '--fc-left-pane': \`${'${paneWidths.left}'}px\`, '--fc-right-pane': \`${'${paneWidths.right}'}px\` } as CSSProperties}>`, 'Composer workspace columns')
  s = replace(s, `        onRemovePanel={removePanel}\n      />\n\n      <main className="figure-composer__center">`, `        onRemovePanel={removePanel}\n        globalControls={<FigureGlobalLayoutPanel project={project} onCanvas={patchCanvas} onLabelDefaults={patchLabelDefaults} onBorderDefaults={patchBorderDefaults} onApplyLabelsToAll={applyLabelsToAll} onApplyBordersToAll={applyBordersToAll} />}\n      />\n\n      <div className="figure-composer__splitter" role="separator" aria-orientation="vertical" aria-label="调整左侧面板宽度" aria-valuenow={paneWidths.left} tabIndex={0} onPointerDown={event => beginPaneResize('left', event)} onDoubleClick={resetPaneWidths} />\n\n      <main className="figure-composer__center">`, 'Composer left splitter')
  s = replace(s, `          onAutoWrap={() => replace(autoWrapProject(project))}\n        />`, `          onAutoWrap={() => replace(autoWrapProject(project))}\n          onScaleSelected={scaleSelected}\n        />`, 'Composer toolbar scaling')
  s = replace(s, `      </main>\n\n      <aside className="figure-composer__right">`, `      </main>\n\n      <div className="figure-composer__splitter" role="separator" aria-orientation="vertical" aria-label="调整右侧面板宽度" aria-valuenow={paneWidths.right} tabIndex={0} onPointerDown={event => beginPaneResize('right', event)} onDoubleClick={resetPaneWidths} />\n\n      <aside className="figure-composer__right">`, 'Composer right splitter')
  write(file, s)
}

// Architecture contract now expects a truly separate Journal Center.
{
  const file = 'tests/preparation-unified-contract.mjs'
  let s = read(file)
  s = replace(s, `expect(dashboardSource.includes("tab === 'journals'") && dashboardSource.includes('workspaceMode="journal-center"') && dashboardSource.includes('section="match"'), 'The journals tab must render the standalone Journal Center workspace.')`, `expect(dashboardSource.includes("tab === 'journals'") && dashboardSource.includes('JournalCenterWorkspace') && !dashboardSource.includes('workspaceMode="journal-center"'), 'The journals tab must render the independent Journal Center workspace.')`, 'Unified contract Journal Center')
  write(file, s)
}

console.log('workspace recovery patch applied')
