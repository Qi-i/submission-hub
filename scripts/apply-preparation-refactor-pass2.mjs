import fs from 'node:fs'

function replaceExact(file, before, after) {
  const source = fs.readFileSync(file, 'utf8')
  if (!source.includes(before)) throw new Error(`Missing expected block in ${file}: ${before.slice(0, 140)}`)
  fs.writeFileSync(file, source.replace(before, after))
}

// Dashboard owns the one real Preparation route state.
{
  const file = 'src/components/Dashboard.tsx'
  replaceExact(file,
`import OnlinePreparationWorkspace from './OnlinePreparationWorkspace'`,
`import OnlinePreparationWorkspace from './OnlinePreparationWorkspace'\nimport type { PreparationSection } from './preparation/PreparationNavigation'`)

  replaceExact(file,
`  const [layoutMode, setLayoutMode] = useState<LuminousXLayoutMode>('workflow')\n  const [showSettings, setShowSettings] = useState(false)`,
`  const [layoutMode, setLayoutMode] = useState<LuminousXLayoutMode>('workflow')\n  const [preparationSection, setPreparationSection] = useState<PreparationSection>('overview')\n  const [showSettings, setShowSettings] = useState(false)`)

  replaceExact(file,
`      {uiMode === 'luminous-x' && <LuminousXStatusBar\n        modeLabel={TAB_LABELS[tab]}\n        subtitle={TAB_SUBTITLES[tab]}\n        recordCount={papers.length}\n        layoutMode={layoutMode}\n        onLayoutModeChange={tab === 'dashboard' ? setLayoutMode : undefined}\n      />}`,
`      {uiMode === 'luminous-x' && <LuminousXStatusBar\n        modeLabel={TAB_LABELS[tab]}\n        subtitle={TAB_SUBTITLES[tab]}\n        recordCount={papers.length}\n        layoutMode={layoutMode}\n        onLayoutModeChange={tab === 'dashboard' ? setLayoutMode : undefined}\n        preparationSection={preparationSection}\n        onPreparationSectionChange={tab === 'preparation' ? setPreparationSection : undefined}\n      />}`)

  replaceExact(file,
`      {tab === 'preparation' && user && !isDemo && <OnlinePreparationWorkspace userId={user.id} onPaperCreated={() => { void loadPapers(); void loadJournalProfiles() }} />}`,
`      {tab === 'preparation' && user && !isDemo && <OnlinePreparationWorkspace userId={user.id} section={preparationSection} onSectionChange={setPreparationSection} onPaperCreated={() => { void loadPapers(); void loadJournalProfiles() }} />}`)
}

// Online data adapter forwards the controlled route without owning UI navigation.
{
  const file = 'src/components/OnlinePreparationWorkspace.tsx'
  replaceExact(file,
`import PreparationWorkspaceSuite from './PreparationWorkspaceSuite'`,
`import PreparationWorkspaceSuite from './PreparationWorkspaceSuite'\nimport type { PreparationSection } from './preparation/PreparationNavigation'`)

  replaceExact(file,
`interface Props {\n  userId: string\n  onPaperCreated?: () => void\n}`,
`interface Props {\n  userId: string\n  section: PreparationSection\n  onSectionChange: (section: PreparationSection) => void\n  onPaperCreated?: () => void\n}`)

  replaceExact(file,
`export default function OnlinePreparationWorkspace({ userId, onPaperCreated }: Props) {`,
`export default function OnlinePreparationWorkspace({ userId, section, onSectionChange, onPaperCreated }: Props) {`)

  replaceExact(file,
`      : <PreparationWorkspaceSuite snapshot={snapshot} loading={loading} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} onLookupJournalRanks={lookupJournalRanks} onDraftFigureCountChange={syncDraftFigureCount} />}`,
`      : <PreparationWorkspaceSuite section={section} onSectionChange={onSectionChange} snapshot={snapshot} loading={loading} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} onLookupJournalRanks={lookupJournalRanks} onDraftFigureCountChange={syncDraftFigureCount} />}`)
}

// PreparationWorkspace keeps legacy detail pages local but exposes one controlled primary route.
{
  const file = 'src/components/PreparationWorkspace.tsx'
  replaceExact(file,
`import { lazy, Suspense, useEffect, useMemo, useState } from 'react'`,
`import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'`)

  replaceExact(file,
`import { useTheme } from '../lib/theme'`,
`import { useTheme } from '../lib/theme'\nimport PreparationNavigation, { type PreparationSection } from './preparation/PreparationNavigation'`)

  replaceExact(file,
`type SectionKey = 'overview' | 'paper' | 'figures' | 'materials' | 'match' | 'check' | 'topics' | 'drafts' | 'journals' | 'compare'`,
`type SectionKey = PreparationSection | 'topics' | 'drafts' | 'journals' | 'compare'`)

  replaceExact(file,
`  onDraftFigureCountChange?: (draftId: string, count: number) => Promise<void> | void\n}`,
`  onDraftFigureCountChange?: (draftId: string, count: number) => Promise<void> | void\n  section?: PreparationSection\n  onSectionChange?: (section: PreparationSection) => void\n}`)

  replaceExact(file,
`const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }\nconst safeUrl = (value?: string | null) => !!value && /^https?:\\/\\//i.test(value)`,
`const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }\nconst safeUrl = (value?: string | null) => !!value && /^https?:\\/\\//i.test(value)\n\nfunction primarySectionFor(section: SectionKey): PreparationSection {\n  if (section === 'topics' || section === 'drafts') return 'paper'\n  if (section === 'journals' || section === 'compare') return 'match'\n  return section\n}`)

  replaceExact(file,
`  onSaveDraft, onDeleteDraft,\n  onPromoteDraft, onLookupJournalRanks, onDraftFigureCountChange,\n}: Props) {\n  const [section, setSection] = useState<SectionKey>('overview')`,
`  onSaveDraft, onDeleteDraft,\n  onPromoteDraft, onLookupJournalRanks, onDraftFigureCountChange,\n  section: controlledSection, onSectionChange,\n}: Props) {\n  const [section, setInternalSection] = useState<SectionKey>(controlledSection || 'overview')\n  const lastBusinessSection = useRef<Exclude<PreparationSection, 'figures'>>(controlledSection && controlledSection !== 'figures' ? controlledSection : 'overview')\n  const primarySection = primarySectionFor(section)\n  const setSection = (next: SectionKey) => {\n    const nextPrimary = primarySectionFor(next)\n    setInternalSection(next)\n    if (nextPrimary !== 'figures') lastBusinessSection.current = nextPrimary\n    onSectionChange?.(nextPrimary)\n  }\n  useEffect(() => {\n    if (!controlledSection) return\n    if (controlledSection !== primarySectionFor(section)) setInternalSection(controlledSection)\n  }, [controlledSection, section])`)

  replaceExact(file,
`  return <div className="preparation-workspace" data-section={section}>\n    <div className="prep-topbar">`,
`  return <div className="preparation-workspace" data-section={primarySection}>\n    {section !== 'figures' && <div className="prep-topbar">`)

  const oldNav = `    </div>\n\n    <div className="prep-nav prep-nav-primary" aria-label="投稿准备核心工作区">\n      <button data-tone="overview" className={section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}><LayoutDashboard size={14} /> 总览</button>\n      <button data-tone="paper" className={['paper', 'topics', 'drafts'].includes(section) ? 'active' : ''} onClick={() => setSection('paper')}><FilePenLine size={14} /> 论文准备 <span>{normalized.drafts.length}</span></button>\n      <button data-tone="materials" className={section === 'materials' ? 'active' : ''} onClick={() => setSection('materials')}><PackageCheck size={14} /> 投稿材料</button>\n      <button data-tone="match" className={['match', 'journals', 'compare'].includes(section) ? 'active' : ''} onClick={() => setSection('match')}><Target size={14} /> 期刊匹配 <span>{normalized.journals.length}</span></button>\n      <button data-tone="check" className={section === 'check' ? 'active' : ''} onClick={() => setSection('check')}><ClipboardCheck size={14} /> 投稿前检查</button>\n    </div>`
  const newNav = `    </div>}\n\n    {section !== 'figures' && <PreparationNavigation section={primarySection} draftCount={normalized.drafts.length} journalCount={normalized.journals.length} onChange={next => setSection(next)} />}`
  replaceExact(file, oldNav, newNav)

  replaceExact(file,
`    {section === 'figures' && <div className="prep-figure-bridge prep-figure-secondary-workspace"><Suspense fallback={<div className="prep-loading"><div className="prep-loading-shell"><LoaderCircle className="prep-loading-icon" size={22} /><div className="prep-loading-copy"><strong>正在加载科研组图工作区</strong><span>图像处理仍在当前浏览器完成。</span></div></div></div>}><FigureComposer drafts={normalized.drafts} onDraftFigureCountChange={onDraftFigureCountChange} onBack={() => setSection('overview')} /></Suspense></div>}`,
`    {section === 'figures' && <div className="prep-figure-bridge prep-figure-secondary-workspace"><Suspense fallback={<div className="prep-loading"><div className="prep-loading-shell"><LoaderCircle className="prep-loading-icon" size={22} /><div className="prep-loading-copy"><strong>正在加载科研组图工作区</strong><span>图像处理仍在当前浏览器完成。</span></div></div></div>}><FigureComposer drafts={normalized.drafts} onDraftFigureCountChange={onDraftFigureCountChange} onBack={() => setSection(lastBusinessSection.current)} /></Suspense></div>}`)
}

console.log('Applied shared Preparation route refactor.')
