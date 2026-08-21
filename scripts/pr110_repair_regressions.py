from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'MISSING in {path}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))

def replace_all(path, old, new, minimum=1):
    text = read(path)
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f'MISSING x{minimum} in {path}: {old[:120]!r}; got {count}')
    write(path, text.replace(old, new))

# ---------------------------------------------------------------------------
# 1. Global Journal Center is a real first-class route, never a DOM-injected
#    alias that secretly clicks Preparation -> Journal Match.
# ---------------------------------------------------------------------------
write('src/global-navigation-search-enhancements.ts', r'''const MAIN_NAV_SELECTOR = '.header-tabs, .tab-bar'
const SEARCH_INPUT_SELECTOR = [
  'input[type="search"]',
  '.search-wrap input',
  '.prep-search input',
  'input[placeholder*="搜索"]',
  'input[placeholder*="检索"]',
].join(', ')

let frame = 0

function compactText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '')
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (setter) setter.call(input, value)
  else input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function syncClearButton(input: HTMLInputElement, button: HTMLButtonElement) {
  const hasValue = input.value.length > 0
  button.hidden = !hasValue
  button.setAttribute('aria-hidden', String(!hasValue))
  button.tabIndex = hasValue ? 0 : -1
}

function enhanceSearchInput(input: HTMLInputElement) {
  if (input.dataset.globalSearchClear === 'true' || input.disabled || input.readOnly) return
  const host = input.parentElement
  if (!host) return

  input.dataset.globalSearchClear = 'true'
  input.classList.add('has-global-search-clear')
  host.classList.add('global-search-clear-host')

  host.querySelector<HTMLButtonElement>(':scope > .global-search-clear')?.remove()
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'global-search-clear'
  button.title = '清空搜索'
  button.setAttribute('aria-label', '清空搜索内容')
  button.textContent = '×'

  const sync = () => syncClearButton(input, button)
  input.addEventListener('input', sync)
  input.addEventListener('change', sync)
  button.addEventListener('pointerdown', event => event.preventDefault())
  button.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    setNativeInputValue(input, '')
    input.focus({ preventScroll: true })
    sync()
  })
  host.appendChild(button)
  sync()
}

function ensureMainNavKeys(nav: HTMLElement) {
  const mapping = [
    ['投稿准备', 'preparation'],
    ['期刊中心', 'journals'],
    ['投稿管理', 'dashboard'],
    ['个人统计', 'stats'],
    ['后台管理', 'admin'],
  ] as const
  const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>(':scope > button'))
  for (const [label, key] of mapping) {
    const button = buttons.find(item => compactText(item.textContent).includes(label))
    if (button) button.dataset.mainNavKey = key
  }
}

function enhance() {
  frame = 0
  document.querySelectorAll<HTMLElement>(MAIN_NAV_SELECTOR).forEach(ensureMainNavKeys)
  document.querySelectorAll<HTMLInputElement>(SEARCH_INPUT_SELECTOR).forEach(enhanceSearchInput)
}

function scheduleEnhance() {
  if (frame) return
  frame = window.requestAnimationFrame(enhance)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true })
else enhance()

new MutationObserver(scheduleEnhance).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'hidden'],
})
''')

# ---------------------------------------------------------------------------
# 2. Online dashboard: first-class Journal Center tab.
# ---------------------------------------------------------------------------
p = 'src/components/Dashboard.tsx'
replace_once(p,
"import { Search, Plus, Download, Upload, LogOut, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, Shield, X, Settings, Lightbulb } from 'lucide-react'",
"import { Search, Plus, Download, Upload, LogOut, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, Shield, X, Settings, Lightbulb, BookOpen } from 'lucide-react'")
replace_once(p, "type Tab = 'preparation' | 'dashboard' | 'stats' | 'admin'", "type Tab = 'preparation' | 'journals' | 'dashboard' | 'stats' | 'admin'")
replace_once(p,
"const TAB_LABELS: Record<Tab, string> = {\n  preparation: '投稿准备工作区',\n  dashboard: '投稿管理控制台',",
"const TAB_LABELS: Record<Tab, string> = {\n  preparation: '投稿准备工作区',\n  journals: '期刊中心',\n  dashboard: '投稿管理控制台',")
replace_once(p,
"const TAB_SUBTITLES: Record<Tab, string> = {\n  preparation: '组织选题、论文草稿和目标期刊，形成清晰的投稿前流程。',\n  dashboard:",
"const TAB_SUBTITLES: Record<Tab, string> = {\n  preparation: '组织选题、论文草稿和目标期刊，形成清晰的投稿前流程。',\n  journals: '集中管理期刊档案、投稿入口、评价指标、费用与横向比较。',\n  dashboard:")
replace_once(p,
"    if (tab === 'preparation' && isDemo) setTab('dashboard')",
"    if ((tab === 'preparation' || tab === 'journals') && isDemo) setTab('dashboard')")
replace_once(p,
"{!isDemo && <button className={tab === 'preparation' ? 'active' : ''} onClick={() => changeTab('preparation')}><Lightbulb size={14} /> 投稿准备</button>}\n            <button className={tab === 'dashboard' ? 'active' : ''}",
"{!isDemo && <button className={tab === 'preparation' ? 'active' : ''} onClick={() => changeTab('preparation')}><Lightbulb size={14} /> 投稿准备</button>}\n            {!isDemo && <button className={tab === 'journals' ? 'active' : ''} onClick={() => changeTab('journals')}><BookOpen size={14} /> 期刊中心</button>}\n            <button className={tab === 'dashboard' ? 'active' : ''}")
replace_once(p, "recordCount={papers.length}\n        layoutMode={layoutMode}", "recordCount={tab === 'journals' ? journalProfiles.length : papers.length}\n        layoutMode={layoutMode}")
replace_once(p,
"{tab === 'preparation' && user && !isDemo && <OnlinePreparationWorkspace userId={user.id} section={preparationSection} onSectionChange={setPreparationSection} onPaperCreated={() => { void loadPapers(); void loadJournalProfiles() }} />}\n\n      {tab === 'dashboard'",
"{tab === 'preparation' && user && !isDemo && <OnlinePreparationWorkspace userId={user.id} section={preparationSection} onSectionChange={setPreparationSection} onPaperCreated={() => { void loadPapers(); void loadJournalProfiles() }} />}\n\n      {tab === 'journals' && user && !isDemo && <OnlinePreparationWorkspace userId={user.id} section=\"match\" onSectionChange={() => {}} workspaceMode=\"journal-center\" onPaperCreated={() => { void loadPapers(); void loadJournalProfiles() }} />}\n\n      {tab === 'dashboard'")

# ---------------------------------------------------------------------------
# 3. Online/Offline preparation wrappers accept a standalone Journal Center mode.
# ---------------------------------------------------------------------------
p = 'src/components/OnlinePreparationWorkspace.tsx'
replace_once(p, "  onPaperCreated?: () => void\n}", "  onPaperCreated?: () => void\n  workspaceMode?: 'preparation' | 'journal-center'\n}")
replace_once(p,
"export default function OnlinePreparationWorkspace({ userId, section, onSectionChange, onPaperCreated }: Props)",
"export default function OnlinePreparationWorkspace({ userId, section, onSectionChange, onPaperCreated, workspaceMode = 'preparation' }: Props)")
replace_once(p,
"<PreparationWorkspaceSuite section={section} onSectionChange={onSectionChange} snapshot={snapshot}",
"<PreparationWorkspaceSuite section={section} onSectionChange={onSectionChange} workspaceMode={workspaceMode} snapshot={snapshot}")

p = 'src/components/OfflinePreparationWorkspace.tsx'
replace_once(p, "import PreparationWorkspaceSuite from './PreparationWorkspaceSuite'", "import PreparationWorkspaceSuite from './PreparationWorkspaceSuite'\nimport type { PreparationSection } from './preparation/PreparationNavigation'")
replace_once(p,
"  onPaperCreated?: () => void\n}",
"  onPaperCreated?: () => void\n  section?: PreparationSection\n  onSectionChange?: (section: PreparationSection) => void\n  workspaceMode?: 'preparation' | 'journal-center'\n}")
replace_once(p,
"export default function OfflinePreparationWorkspace({ authorName, refreshToken, onPaperCreated }: Props)",
"export default function OfflinePreparationWorkspace({ authorName, refreshToken, onPaperCreated, section, onSectionChange, workspaceMode = 'preparation' }: Props)")
replace_once(p,
"return <PreparationWorkspaceSuite snapshot={snapshot}",
"return <PreparationWorkspaceSuite section={section} onSectionChange={onSectionChange} workspaceMode={workspaceMode} snapshot={snapshot}")

# ---------------------------------------------------------------------------
# 4. Preparation workspace can share journal data/components without sharing
#    page identity. Standalone Journal Center has its own shell and no business tabs.
# ---------------------------------------------------------------------------
p = 'src/components/PreparationWorkspace.tsx'
replace_once(p,
"  section?: PreparationSection\n  onSectionChange?: (section: PreparationSection) => void\n}",
"  section?: PreparationSection\n  onSectionChange?: (section: PreparationSection) => void\n  workspaceMode?: 'preparation' | 'journal-center'\n}")
replace_once(p,
"  onPromoteDraft, onLookupJournalRanks, onDraftFigureCountChange,\n  section: controlledSection, onSectionChange,\n}: Props) {\n  const [section, setInternalSection] = useState<SectionKey>(controlledSection || 'overview')",
"  onPromoteDraft, onLookupJournalRanks, onDraftFigureCountChange,\n  section: controlledSection, onSectionChange, workspaceMode = 'preparation',\n}: Props) {\n  const standaloneJournalCenter = workspaceMode === 'journal-center'\n  const [section, setInternalSection] = useState<SectionKey>(controlledSection || (standaloneJournalCenter ? 'match' : 'overview'))")
replace_once(p,
"return <div className=\"preparation-workspace\" data-section={primarySection}>",
"return <div className={`preparation-workspace${standaloneJournalCenter ? ' journal-center-workspace' : ''}`} data-section={primarySection} data-workspace-mode={workspaceMode}>")
replace_once(p,
"<span className=\"prep-eyebrow\">PRE-SUBMISSION WORKSPACE</span>\n        <h1>投稿准备</h1>\n        <p>把选题、草稿与目标期刊组织成一条清晰的投稿前流程。</p>",
"<span className=\"prep-eyebrow\">{standaloneJournalCenter ? 'JOURNAL INTELLIGENCE CENTER' : 'PRE-SUBMISSION WORKSPACE'}</span>\n        <h1>{standaloneJournalCenter ? '期刊中心' : '投稿准备'}</h1>\n        <p>{standaloneJournalCenter ? '集中管理期刊档案、投稿入口、评价指标、费用与横向比较。' : '把选题、草稿与目标期刊组织成一条清晰的投稿前流程。'}</p>")
replace_all(p, "{figureToolEntry}", "{!standaloneJournalCenter && figureToolEntry}", minimum=2)
replace_all(p, "placeholder=\"搜索选题、草稿或期刊...\"", "placeholder={standaloneJournalCenter ? '搜索期刊名称、缩写、出版商或标签...' : '搜索选题、草稿或期刊...'}", minimum=2)
replace_once(p,
"{section !== 'figures' && <PreparationNavigation section={primarySection} draftCount={normalized.drafts.length} journalCount={normalized.journals.length} onChange={next => setSection(next)} />}",
"{!standaloneJournalCenter && section !== 'figures' && <PreparationNavigation section={primarySection} draftCount={normalized.drafts.length} journalCount={normalized.journals.length} onChange={next => setSection(next)} />}")
replace_once(p,
"{section === 'match' && <><div className=\"prep-primary-section-head\"><div><h2>期刊匹配</h2><p>把收藏期刊、关键分区、费用、审稿周期和横向比较放在同一工作区。</p></div>",
"{section === 'match' && <><div className=\"prep-primary-section-head\"><div><h2>{standaloneJournalCenter ? '期刊库' : '期刊匹配'}</h2><p>{standaloneJournalCenter ? '检索、筛选并维护期刊档案；投稿准备中的期刊匹配直接复用这里的数据。' : '把收藏期刊、关键分区、费用、审稿周期和横向比较放在同一工作区。'}</p></div>")

# ---------------------------------------------------------------------------
# 5. Offline visual shell follows the same first-class IA so browser tests are
#    representative of the online product.
# ---------------------------------------------------------------------------
p = 'src/components/OfflineDashboard.tsx'
replace_once(p,
"import { Search, Plus, Download, Upload, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, X, Lightbulb, Settings, HardDrive } from 'lucide-react'",
"import { Search, Plus, Download, Upload, ChevronDown, FileText, Filter, Sun, Moon, Monitor, BarChart3, X, Lightbulb, Settings, HardDrive, BookOpen } from 'lucide-react'")
replace_once(p, "type Tab = 'preparation' | 'dashboard' | 'stats'", "type Tab = 'preparation' | 'journals' | 'dashboard' | 'stats'")
replace_once(p,
"const TAB_LABELS: Record<Tab, string> = {\n  preparation: '投稿准备工作区',\n  dashboard:",
"const TAB_LABELS: Record<Tab, string> = {\n  preparation: '投稿准备工作区',\n  journals: '期刊中心',\n  dashboard:")
replace_once(p,
"const TAB_SUBTITLES: Record<Tab, string> = {\n  preparation: '在本地组织选题、草稿和目标期刊，所有数据仅保存在当前浏览器。',\n  dashboard:",
"const TAB_SUBTITLES: Record<Tab, string> = {\n  preparation: '在本地组织选题、草稿和目标期刊，所有数据仅保存在当前浏览器。',\n  journals: '集中管理期刊档案、投稿入口、评价指标、费用与横向比较。',\n  dashboard:")
replace_once(p,
"<button className={`tab-btn ${tab === 'preparation' ? 'active' : ''}`} onClick={() => { setTab('preparation'); setShowTools(false) }}><Lightbulb size={14} /> 投稿准备</button>\n        <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`}",
"<button className={`tab-btn ${tab === 'preparation' ? 'active' : ''}`} onClick={() => { setTab('preparation'); setShowTools(false) }}><Lightbulb size={14} /> 投稿准备</button>\n        <button className={`tab-btn ${tab === 'journals' ? 'active' : ''}`} onClick={() => { setTab('journals'); setShowTools(false) }}><BookOpen size={14} /> 期刊中心</button>\n        <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`}")
replace_once(p, "recordCount={papers.length}\n        layoutMode={layoutMode}", "recordCount={tab === 'journals' ? prepStore.getPreparationSnapshot().journals.length : papers.length}\n        layoutMode={layoutMode}")
replace_once(p,
"{tab === 'preparation' && <OfflinePreparationWorkspace authorName={authorName} refreshToken={prepRefresh} onPaperCreated={refreshPapers} />}\n\n      {tab === 'dashboard'",
"{tab === 'preparation' && <OfflinePreparationWorkspace authorName={authorName} refreshToken={prepRefresh} onPaperCreated={refreshPapers} />}\n\n      {tab === 'journals' && <OfflinePreparationWorkspace authorName={authorName} refreshToken={prepRefresh} section=\"match\" onSectionChange={() => {}} workspaceMode=\"journal-center\" onPaperCreated={refreshPapers} />}\n\n      {tab === 'dashboard'")

# Luminous X recognises Journal Center as its own page.
p = 'src/components/LuminousXStatusBar.tsx'
replace_once(p, "type PageKey = 'preparation' | 'dashboard' | 'stats' | 'admin'", "type PageKey = 'preparation' | 'journals' | 'dashboard' | 'stats' | 'admin'")
replace_once(p,
"function pageMeta(modeLabel: string): { key: PageKey; label: string } {\n  if (modeLabel.includes('准备'))",
"function pageMeta(modeLabel: string): { key: PageKey; label: string } {\n  if (modeLabel.includes('期刊')) return { key: 'journals', label: '期刊中心' }\n  if (modeLabel.includes('准备'))")
replace_once(p,
"  const page = pageMeta(modeLabel)\n\n  return (",
"  const page = pageMeta(modeLabel)\n  const countLabel = page.key === 'journals' ? '期刊档案' : '记录总数'\n  const countUnit = page.key === 'journals' ? '本' : '篇'\n\n  return (")
replace_once(p, "<small>记录总数</small>\n        <span><b>{recordCount}</b><em>篇</em></span>", "<small>{countLabel}</small>\n        <span><b>{recordCount}</b><em>{countUnit}</em></span>")

# ---------------------------------------------------------------------------
# 6. Journal runtime sends filters to the correct Luminous X status bar.
# ---------------------------------------------------------------------------
p = 'src/journal-center-runtime.ts'
replace_once(p,
"    const statusHost = document.querySelector<HTMLElement>('.lx-status-bar[data-page=\"preparation\"] .lx-status-controls-host')",
"    const statusPage = workspace.classList.contains('journal-center-workspace') ? 'journals' : 'preparation'\n    const statusHost = document.querySelector<HTMLElement>(`.lx-status-bar[data-page=\"${statusPage}\"] .lx-status-controls-host`)")
replace_once(p,
"  const statusBar = document.querySelector<HTMLElement>('.lx-status-bar[data-page=\"preparation\"]')",
"  const statusPage = workspace.classList.contains('journal-center-workspace') ? 'journals' : 'preparation'\n  const statusBar = document.querySelector<HTMLElement>(`.lx-status-bar[data-page=\"${statusPage}\"]`)")

# ---------------------------------------------------------------------------
# 7. Navigation memory knows Journal Center is a peer page; legacy Preparation
#    sections still migrate to canonical paper/match.
# ---------------------------------------------------------------------------
p = 'src/components/NavigationMemory.tsx'
replace_once(p, "type MainPage = 'preparation' | 'dashboard' | 'stats' | 'admin'", "type MainPage = 'preparation' | 'journals' | 'dashboard' | 'stats' | 'admin'")
replace_once(p,
"const MAIN_LABELS: Record<MainPage, string> = {\n  preparation: '投稿准备',\n  dashboard:",
"const MAIN_LABELS: Record<MainPage, string> = {\n  preparation: '投稿准备',\n  journals: '期刊中心',\n  dashboard:")

# Canonical navigation-memory fixture (old values are only seed inputs, not UI).
write('tests/visual/navigation-memory.tsx', r'''import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import NavigationMemory from '../../src/components/NavigationMemory'

type Page = 'preparation' | 'journals' | 'dashboard' | 'stats'
type Section = 'overview' | 'paper' | 'materials' | 'match' | 'check'
type Layout = 'workflow' | 'board' | 'journal'

const scope = new URLSearchParams(window.location.search).get('scope') || 'visual'

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [section, setSection] = useState<Section>('overview')
  const [layout, setLayout] = useState<Layout>('workflow')

  return <main data-current-page={page} data-current-layout={layout}>
    <NavigationMemory scope={scope} />
    <nav className="header-tabs" aria-label="主导航">
      <button className={page === 'preparation' ? 'active' : ''} onClick={() => setPage('preparation')}>投稿准备</button>
      <button className={page === 'journals' ? 'active' : ''} onClick={() => setPage('journals')}>期刊中心</button>
      <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>投稿管理</button>
      <button className={page === 'stats' ? 'active' : ''} onClick={() => setPage('stats')}>个人统计</button>
    </nav>

    {page === 'dashboard' && <section className="lx-status-bar" data-page="dashboard"><div className="lx-view-switch" role="group" aria-label="投稿记录视图">
      <button className={layout === 'workflow' ? 'active' : ''} onClick={() => setLayout('workflow')}>工作流视图</button>
      <button className={layout === 'board' ? 'active' : ''} onClick={() => setLayout('board')}>看板视图</button>
      <button className={layout === 'journal' ? 'active' : ''} onClick={() => setLayout('journal')}>按期刊视图</button>
    </div></section>}

    {page === 'journals' && <section className="journal-center-workspace" data-page="journals">独立期刊中心</section>}

    {page === 'preparation' && <div className="preparation-workspace" data-section={section}>
      <div className="prep-nav prep-nav-primary prep-business-nav">
        <button data-tone="overview" onClick={() => setSection('overview')}>总览</button>
        <button data-tone="paper" onClick={() => setSection('paper')}>论文准备</button>
        <button data-tone="materials" onClick={() => setSection('materials')}>投稿材料</button>
        <button data-tone="match" onClick={() => setSection('match')}>期刊匹配</button>
        <button data-tone="check" onClick={() => setSection('check')}>投稿前检查</button>
      </div>
    </div>}
  </main>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
''')

# ---------------------------------------------------------------------------
# 8. Visual system: enforce the same global content lane online, make idle route
#    tones visibly different, prevent nav overlap, and stop journal card stretching.
# ---------------------------------------------------------------------------
p = 'src/styles/preparation/components.css'
text = read(p)
text += r'''

/* P0 navigation visibility contract: idle routes must be distinguishable before hover. */
.preparation-workspace:not([data-section='figures']) > .prep-business-nav {
  min-height: 0 !important;
  height: auto !important;
  grid-template-columns: repeat(5,minmax(0,1fr)) !important;
  grid-auto-flow: column !important;
  align-items: stretch !important;
  overflow: visible !important;
}
.preparation-workspace:not([data-section='figures']) > .prep-business-nav > .prep-nav-item {
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  height: 44px !important;
  min-height: 44px !important;
  justify-self: stretch !important;
  box-sizing: border-box !important;
  background: linear-gradient(135deg,
    color-mix(in srgb,var(--prep-nav-tone) 20%,var(--prep-surface-elevated)),
    color-mix(in srgb,var(--prep-nav-tone) 11%,var(--prep-surface-elevated))) !important;
  border-color: color-mix(in srgb,var(--prep-nav-tone) 34%,var(--prep-border-strong)) !important;
}
.preparation-workspace:not([data-section='figures']) > .prep-business-nav > .prep-nav-item .prep-nav-item__icon {
  background: color-mix(in srgb,var(--prep-nav-tone) 20%,transparent) !important;
  box-shadow: inset 0 0 0 1px color-mix(in srgb,var(--prep-nav-tone) 18%,transparent);
}
.preparation-workspace:not([data-section='figures']) > .prep-business-nav > .prep-nav-item.active {
  background: linear-gradient(135deg,
    color-mix(in srgb,var(--prep-nav-tone) 31%,var(--prep-surface-elevated)),
    color-mix(in srgb,var(--prep-nav-tone) 18%,var(--prep-surface-elevated))) !important;
  border-color: color-mix(in srgb,var(--prep-nav-tone) 58%,var(--prep-border-strong)) !important;
}

/* Journal cards are content-height items; one dense card must not stretch peers. */
.preparation-workspace[data-section='match'] .journal-grid,
.journal-center-workspace .journal-grid {
  align-items: start !important;
  grid-auto-rows: auto !important;
}
.preparation-workspace[data-section='match'] .journal-grid > .prep-journal-card,
.journal-center-workspace .journal-grid > .prep-journal-card {
  align-self: start !important;
  height: auto !important;
  min-height: 0 !important;
}
'''
write(p, text)

p = 'src/styles/preparation/shell.css'
text = read(p)
text += r'''

/* OnlinePreparationWorkspace is the actual direct child of .app-layout online. */
html[data-ui='luminous'] body .app-layout > .online-preparation-shell {
  width: calc(100% - (var(--ui-shell-gutter) * 2)) !important;
  max-width: var(--ui-shell-max) !important;
  margin: var(--ui-gap-page) auto 0 !important;
  box-sizing: border-box !important;
}
html[data-ui='luminous'] body .online-preparation-shell > .preparation-suite,
html[data-ui='luminous'] body .online-preparation-shell .preparation-workspace {
  width: 100% !important;
  max-width: none !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  box-sizing: border-box !important;
}
@media (min-width: 981px) {
  html[data-ui='luminous-x'] body .app-layout > .online-preparation-shell {
    width: 100% !important;
    max-width: none !important;
    margin: var(--ui-gap-page) 0 0 !important;
    box-sizing: border-box !important;
  }
}

.journal-center-workspace > .prep-business-nav { display: none !important; }
'''
write(p, text)

# ---------------------------------------------------------------------------
# 9. Browser contracts follow the new IA instead of asserting the old alias.
# ---------------------------------------------------------------------------
p = 'tests/visual/journal-center-header-filter-check.mjs'
replace_once(p,
"await page.locator('.preparation-workspace[data-section=\"match\"] .journal-grid').waitFor({ state: 'visible', timeout: 15000 })",
"await page.locator('.journal-center-workspace[data-section=\"match\"] .journal-grid').waitFor({ state: 'visible', timeout: 15000 })")
replace_once(p,
"const workspace = document.querySelector('.preparation-workspace[data-section=\"match\"]')",
"const workspace = document.querySelector('.journal-center-workspace[data-section=\"match\"]')")
replace_once(p,
"? document.querySelector('.lx-status-bar[data-page=\"preparation\"] .lx-status-controls-host')",
"? document.querySelector('.lx-status-bar[data-page=\"journals\"] .lx-status-controls-host')")
replace_once(p,
"if (placement.navDisplay === 'none' || placement.navDisplay === 'missing') fail(`${ui}: 期刊中心缺少统一投稿准备菜单行`)",
"if (placement.navDisplay !== 'missing') fail(`${ui}: 独立期刊中心不应显示投稿准备五业务条`)")
replace_all(p,
"document.querySelector('.preparation-workspace[data-section=\"match\"]')",
"document.querySelector('.journal-center-workspace[data-section=\"match\"]')",
minimum=1)
replace_all(p,
"document.querySelectorAll('.preparation-workspace[data-section=\"match\"] .prep-journal-card')",
"document.querySelectorAll('.journal-center-workspace[data-section=\"match\"] .prep-journal-card')",
minimum=1)

p = 'tests/visual/submission-card-actions-check.mjs'
replace_once(p,
"const grid = page.locator(\".preparation-workspace[data-section='match'] .journal-grid, .preparation-workspace[data-section='match'] .journal-grid\").first()",
"const grid = page.locator(\".journal-center-workspace[data-section='match'] .journal-grid\").first()")

p = 'tests/visual/header-action-coherence-check.mjs'
# X top-level Journal Center is now a standalone page.
replace_once(p,
"await preparationX.locator('.preparation-workspace[data-section=\"match\"]').waitFor({ state: 'visible', timeout: 15000 })",
"await preparationX.locator('.journal-center-workspace[data-section=\"match\"]').waitFor({ state: 'visible', timeout: 15000 })")
# Luminous Preparation tests its internal match route directly; top-level Journal Center remains separate.
replace_once(p,
"  const preparationActive = await activeStyle(preparationLuminous, 'preparation')\n  await preparationLuminous.locator(\"button[data-main-nav-key='journals']\").click()\n  await preparationLuminous.locator('.preparation-workspace[data-section=\"match\"]').waitFor({ state: 'visible', timeout: 15000 })\n  await preparationLuminous.waitForTimeout(300)",
"  const preparationActive = await activeStyle(preparationLuminous, 'preparation')\n  await preparationLuminous.locator(\".preparation-workspace > .prep-nav-primary > button[data-tone='match']\").click()\n  await preparationLuminous.locator(\".preparation-workspace:not(.journal-center-workspace)[data-section='match']\").waitFor({ state: 'visible', timeout: 15000 })\n  await preparationLuminous.waitForTimeout(300)")
replace_once(p,
"  const journalActive = await activeStyle(preparationLuminous, 'journals')\n  compareStyles('luminous active navigation', journalActive, preparationActive, [",
"  await preparationLuminous.locator(\"button[data-main-nav-key='journals']\").click()\n  await preparationLuminous.locator(\".journal-center-workspace[data-section='match']\").waitFor({ state: 'visible', timeout: 15000 })\n  const journalActive = await activeStyle(preparationLuminous, 'journals')\n  compareStyles('luminous active navigation', journalActive, preparationActive, [")

print('PR110 regression repair prepared.')
