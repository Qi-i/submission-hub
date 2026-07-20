from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing block in {path}: {old[:100]}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


replace(
    'src/components/Dashboard.tsx',
    '        </div>\n\n        <div className="header-actions">',
    '        </div>\n\n        <div id="luminous-header-center-slot" className="luminous-header-center-slot" aria-label="当前页面操作" />\n\n        <div className="header-actions">',
)

replace(
    'src/components/LuminousXStatusBar.tsx',
    '      <div className="lx-status-controls-host" aria-label={`${page.label}页面操作`}>\n        {onLayoutModeChange && (',
    '      <div className="lx-status-controls-host" aria-label={`${page.label}页面操作`}>\n        {page.key === \'preparation\' && <div id="lx-preparation-actions-slot" className="lx-preparation-actions-slot" />}\n        {onLayoutModeChange && (',
)

replace(
    'src/components/PreparationWorkspace.tsx',
    "import { useMemo, useState } from 'react'",
    "import { useEffect, useMemo, useState } from 'react'\nimport { createPortal } from 'react-dom'",
)
replace(
    'src/components/PreparationWorkspace.tsx',
    "import JournalComparison from './JournalComparison'",
    "import JournalComparison from './JournalComparison'\nimport { useTheme } from '../lib/theme'",
)
replace(
    'src/components/PreparationWorkspace.tsx',
    '  const [creatingTopicId, setCreatingTopicId] = useState<string | null>(null)\n',
    "  const [creatingTopicId, setCreatingTopicId] = useState<string | null>(null)\n  const { uiMode } = useTheme()\n  const [luminousXActionSlot, setLuminousXActionSlot] = useState<HTMLElement | null>(null)\n\n  useEffect(() => {\n    setLuminousXActionSlot(uiMode === 'luminous-x' ? document.getElementById('lx-preparation-actions-slot') : null)\n  }, [uiMode])\n",
)

old_actions = '''      <div className="prep-top-actions">
        <div className="prep-search">
          <Search size={15} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索选题、草稿或期刊..." />
        </div>
        <button className="btn btn-journal-primary btn-sm" onClick={() => setEditor({ type: 'journal', value: 'new' })}>
          <Star size={14} /> 收藏期刊
        </button>
        {!['journals', 'compare'].includes(section) && <button className="btn btn-context-new btn-sm" onClick={openContextNew}>
          <Plus size={14} /> {section === 'topics' ? '新增选题' : '新建草稿'}
        </button>}
      </div>'''
new_actions = '''      {(uiMode === 'luminous-x' && luminousXActionSlot ? createPortal(
        <div className="prep-top-actions prep-top-actions-portal">
          <div className="prep-search">
            <Search size={15} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索选题、草稿或期刊..." />
          </div>
          <button className="btn btn-journal-primary btn-sm" onClick={() => setEditor({ type: 'journal', value: 'new' })}>
            <Star size={14} /> 收藏期刊
          </button>
          {!['journals', 'compare'].includes(section) && <button className="btn btn-context-new btn-sm" onClick={openContextNew}>
            <Plus size={14} /> {section === 'topics' ? '新增选题' : '新建草稿'}
          </button>}
        </div>,
        luminousXActionSlot,
      ) :
        <div className="prep-top-actions">
          <div className="prep-search">
            <Search size={15} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索选题、草稿或期刊..." />
          </div>
          <button className="btn btn-journal-primary btn-sm" onClick={() => setEditor({ type: 'journal', value: 'new' })}>
            <Star size={14} /> 收藏期刊
          </button>
          {!['journals', 'compare'].includes(section) && <button className="btn btn-context-new btn-sm" onClick={openContextNew}>
            <Plus size={14} /> {section === 'topics' ? '新增选题' : '新建草稿'}
          </button>}
        </div>)}'''
replace('src/components/PreparationWorkspace.tsx', old_actions, new_actions)

replace(
    'src/components/PersonalStatsUnified.tsx',
    "import { useEffect, useMemo, useState } from 'react'",
    "import { useEffect, useMemo, useState } from 'react'\nimport { createPortal } from 'react-dom'",
)
replace(
    'src/components/PersonalStatsUnified.tsx',
    "import StatsTrendChart from './StatsTrendChart'",
    "import StatsTrendChart from './StatsTrendChart'\nimport { useTheme } from '../lib/theme'",
)
replace(
    'src/components/PersonalStatsUnified.tsx',
    "  const [visible, setVisible] = useState<Record<TrendKey, boolean>>({",
    "  const { uiMode } = useTheme()\n  const [luminousHeaderSlot, setLuminousHeaderSlot] = useState<HTMLElement | null>(null)\n  const [visible, setVisible] = useState<Record<TrendKey, boolean>>({",
)
replace(
    'src/components/PersonalStatsUnified.tsx',
    "  useEffect(() => {\n    try { localStorage.setItem(moduleStorageKey, JSON.stringify(modules)) } catch { /* optional preference */ }\n  }, [modules])",
    "  useEffect(() => {\n    try { localStorage.setItem(moduleStorageKey, JSON.stringify(modules)) } catch { /* optional preference */ }\n  }, [modules])\n\n  useEffect(() => {\n    setLuminousHeaderSlot(uiMode === 'luminous' ? document.getElementById('luminous-header-center-slot') : null)\n  }, [uiMode])",
)

old_controls = '''      <div className="stats-module-controls">
        <button className={modules.overview ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, overview: !previous.overview }))}>核心概览</button>
        <button className={modules.process ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, process: !previous.process }))}>过程指标</button>
        <button className={modules.trend ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, trend: !previous.trend }))}>趋势图</button>
        <button className={modules.charts ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, charts: !previous.charts }))}>分布概览</button>
        <button onClick={() => setModules(defaultModules)}>恢复默认</button>
      </div>'''
new_controls = '''      {(uiMode === 'luminous' && luminousHeaderSlot ? createPortal(
        <div className="stats-module-controls stats-module-controls-portal">
          <button className={modules.overview ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, overview: !previous.overview }))}>核心概览</button>
          <button className={modules.process ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, process: !previous.process }))}>过程指标</button>
          <button className={modules.trend ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, trend: !previous.trend }))}>趋势图</button>
          <button className={modules.charts ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, charts: !previous.charts }))}>分布概览</button>
          <button onClick={() => setModules(defaultModules)}>恢复默认</button>
        </div>,
        luminousHeaderSlot,
      ) :
        <div className="stats-module-controls">
          <button className={modules.overview ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, overview: !previous.overview }))}>核心概览</button>
          <button className={modules.process ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, process: !previous.process }))}>过程指标</button>
          <button className={modules.trend ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, trend: !previous.trend }))}>趋势图</button>
          <button className={modules.charts ? 'active' : ''} onClick={() => setModules(previous => ({ ...previous, charts: !previous.charts }))}>分布概览</button>
          <button onClick={() => setModules(defaultModules)}>恢复默认</button>
        </div>)}'''
replace('src/components/PersonalStatsUnified.tsx', old_controls, new_controls)

path = Path('src/luminous-x-rebuild-corrections.css')
text = path.read_text(encoding='utf-8')
old_bg = """html[data-ui='luminous-x'][data-theme='light'] body {
  background:
    radial-gradient(circle at 12% -8%, rgba(60, 245, 255, .08), transparent 25%),
    radial-gradient(circle at 96% 0%, rgba(255, 79, 159, .06), transparent 24%),
    linear-gradient(180deg, #ffffff 0%, #f8fbff 100%) !important;
}"""
new_bg = """html[data-ui='luminous-x'][data-theme='light'] body {
  background: #f7f8fb !important;
}"""
if old_bg not in text:
    raise SystemExit('missing Luminous X light body block')
text = text.replace(old_bg, new_bg, 1)
text += r'''

/* Screenshot-driven alignment: real actions occupy the center lane, subsection controls stay right. */
html[data-ui='luminous-x'] .lx-status-bar[data-page='preparation'] .lx-status-controls-host {
  display: grid !important;
  grid-template-columns: minmax(360px, 1fr) auto !important;
  align-items: center !important;
  gap: 12px !important;
  overflow: visible !important;
}

html[data-ui='luminous-x'] .lx-preparation-actions-slot {
  min-width: 0;
  width: 100%;
}

html[data-ui='luminous-x'] .lx-preparation-actions-slot:empty {
  display: none;
}

html[data-ui='luminous-x'] .lx-preparation-actions-slot .prep-top-actions-portal {
  width: 100% !important;
  min-width: 0 !important;
  display: grid !important;
  grid-template-columns: minmax(220px, 1fr) auto auto !important;
  align-items: center !important;
  gap: 8px !important;
}

html[data-ui='luminous-x'] .lx-preparation-actions-slot .prep-search {
  width: 100% !important;
  min-width: 0 !important;
  height: 38px !important;
  margin: 0 !important;
}

html[data-ui='luminous-x'] .lx-preparation-actions-slot .btn {
  min-height: 38px !important;
  height: 38px !important;
  white-space: nowrap !important;
}

html[data-ui='luminous-x'] .lx-status-bar[data-page='preparation'] .lx-page-proxy-controls {
  justify-self: end !important;
}

html[data-ui='luminous-x'] .preparation-workspace[data-section='overview'] > .prep-topbar {
  display: none !important;
}

html[data-ui='luminous-x'] .stats-panel.stats-panel-unified {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

html[data-ui='luminous-x'] .lx-workflow-view {
  align-items: stretch !important;
}

html[data-ui='luminous-x'] .lx-workflow-view > .paper-card-v3 {
  height: 100% !important;
  align-self: stretch !important;
}

html[data-ui='luminous-x'] .preparation-workspace .prep-overview-draft-list .prep-draft-card.compact h3 {
  min-height: 31px !important;
  display: -webkit-box !important;
  overflow: hidden !important;
  -webkit-box-orient: vertical !important;
  -webkit-line-clamp: 2 !important;
  white-space: normal !important;
  text-overflow: clip !important;
}

@media (max-width: 1220px) {
  html[data-ui='luminous-x'] .lx-status-bar[data-page='preparation'] .lx-status-controls-host {
    grid-template-columns: 1fr !important;
  }
  html[data-ui='luminous-x'] .lx-preparation-actions-slot {
    display: none !important;
  }
  html[data-ui='luminous-x'] .preparation-workspace[data-section='overview'] > .prep-topbar {
    display: flex !important;
  }
}
'''
path.write_text(text, encoding='utf-8')

path = Path('src/luminous-ui.css')
text = path.read_text(encoding='utf-8')
text = text.replace('  --bg-base: #edf3ff;', '  --bg-base: #f7f8fb;', 1)
text = text.replace(
    '  --gradient-page: radial-gradient(circle at 8% 8%, rgba(60, 245, 255, 0.2), transparent 28%), radial-gradient(circle at 90% 4%, rgba(255, 79, 159, 0.17), transparent 30%), radial-gradient(circle at 52% 100%, rgba(139, 92, 246, 0.16), transparent 34%), linear-gradient(145deg, #f8fbff 0%, #edf3ff 48%, #f7f1ff 100%);',
    '  --gradient-page: linear-gradient(180deg, #fbfcfe 0%, #f6f7fa 100%);',
    1,
)
text += r'''

/* Neutral canvas keeps colored modules legible instead of tinting the whole page blue. */
html[data-ui='luminous'][data-theme='light'] body {
  background: #f7f8fb !important;
}

html[data-ui='luminous'][data-theme='light'] body::before {
  opacity: .12 !important;
}

html[data-ui='luminous'] .app-header .luminous-header-center-slot {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 10px;
}

html[data-ui='luminous'] .luminous-header-center-slot .stats-module-controls-portal {
  max-width: 100%;
  margin: 0 !important;
  justify-self: auto !important;
}

html[data-ui='luminous'] .stats-panel.stats-panel-unified {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

html[data-ui='luminous'] .paper-grid {
  align-items: stretch !important;
}

html[data-ui='luminous'] .paper-grid > .paper-card-v3 {
  height: 100% !important;
  align-self: stretch !important;
}

html[data-ui='luminous'][data-theme='light'] .paper-card-v3:has(.paper-status-area[data-status='preparing']) {
  background: linear-gradient(rgba(239, 248, 255, .96), rgba(239, 248, 255, .96)) padding-box, linear-gradient(135deg, rgba(56, 189, 248, .36), rgba(139, 92, 246, .22)) border-box !important;
}
html[data-ui='luminous'][data-theme='light'] .paper-card-v3:has(.paper-status-area[data-status='submitted']) {
  background: linear-gradient(rgba(238, 246, 255, .97), rgba(238, 246, 255, .97)) padding-box, linear-gradient(135deg, rgba(59, 130, 246, .38), rgba(60, 245, 255, .24)) border-box !important;
}
html[data-ui='luminous'][data-theme='light'] .paper-card-v3:has(.paper-status-area[data-status='under_review']) {
  background: linear-gradient(rgba(255, 249, 235, .97), rgba(255, 249, 235, .97)) padding-box, linear-gradient(135deg, rgba(245, 158, 11, .42), rgba(139, 92, 246, .22)) border-box !important;
}
html[data-ui='luminous'][data-theme='light'] .paper-card-v3:has(.paper-status-area[data-status='revision']) {
  background: linear-gradient(rgba(248, 244, 255, .97), rgba(248, 244, 255, .97)) padding-box, linear-gradient(135deg, rgba(139, 92, 246, .42), rgba(255, 79, 159, .22)) border-box !important;
}
html[data-ui='luminous'][data-theme='light'] .paper-card-v3:has(.paper-status-area[data-status='accepted']) {
  background: linear-gradient(rgba(239, 251, 244, .97), rgba(239, 251, 244, .97)) padding-box, linear-gradient(135deg, rgba(34, 197, 94, .40), rgba(60, 245, 255, .22)) border-box !important;
}
html[data-ui='luminous'][data-theme='light'] .paper-card-v3:has(.paper-status-area[data-status='rejected']) {
  background: linear-gradient(rgba(255, 241, 243, .97), rgba(255, 241, 243, .97)) padding-box, linear-gradient(135deg, rgba(239, 68, 68, .38), rgba(255, 79, 159, .24)) border-box !important;
}
html[data-ui='luminous'][data-theme='light'] .paper-card-v3:has(.paper-status-area[data-status='withdrawn']) {
  background: linear-gradient(rgba(244, 246, 250, .98), rgba(244, 246, 250, .98)) padding-box, linear-gradient(135deg, rgba(100, 116, 139, .34), rgba(139, 92, 246, .18)) border-box !important;
}

html[data-ui='luminous'] .preparation-workspace .prep-overview-draft-list .prep-draft-card.compact h3 {
  min-height: 31px !important;
  display: -webkit-box !important;
  overflow: hidden !important;
  -webkit-box-orient: vertical !important;
  -webkit-line-clamp: 2 !important;
  white-space: normal !important;
  text-overflow: clip !important;
}

@media (max-width: 980px) {
  html[data-ui='luminous'] .app-header .luminous-header-center-slot {
    display: none !important;
  }
  html[data-ui='luminous'] .stats-panel > .stats-module-controls {
    display: flex !important;
  }
}
'''
path.write_text(text, encoding='utf-8')

path = Path('tests/visual/luminous-coherence-check.mjs')
text = path.read_text(encoding='utf-8')
text = text.replace(
    "      cardMaterial: getComputedStyle(document.documentElement).getPropertyValue('--coh-card-bg').trim(),",
    "      cardMaterial: getComputedStyle(document.documentElement).getPropertyValue('--coh-card-bg').trim(),\n      draftTitle: (() => { const element = document.querySelector('.prep-overview-draft-list .prep-draft-card.compact h3'); const style = element ? getComputedStyle(element) : null; return element && style ? { whiteSpace: style.whiteSpace, height: element.getBoundingClientRect().height, scrollHeight: element.scrollHeight } : null })(),\n      prepPortal: !!document.querySelector('#lx-preparation-actions-slot .prep-top-actions-portal'),",
    1,
)
text = text.replace(
    "    if (!geometry.switchRect) failures.push(`${name}: UI switcher is missing`)",
    "    if (ui === 'luminous-x' && !geometry.prepPortal) failures.push(`${name}: preparation actions were not moved into the Luminous X header`)\n    if (!geometry.draftTitle || geometry.draftTitle.whiteSpace === 'nowrap' || geometry.draftTitle.height < 26) failures.push(`${name}: compact draft title is still restricted to one line`)\n\n    if (!geometry.switchRect) failures.push(`${name}: UI switcher is missing`)",
    1,
)
path.write_text(text, encoding='utf-8')
