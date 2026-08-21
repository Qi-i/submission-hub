from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing replacement target: {label}')
    return text.replace(old, new, 1)


# Online shell owns data only; remove duplicate top-level Figure Composer strip/state.
path = 'src/components/OnlinePreparationWorkspace.tsx'
s = read(path)
s = replace_once(s, "import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'", "import { useCallback, useEffect, useRef, useState } from 'react'", 'online react imports')
s = replace_once(s, "import { ArrowRight, Images } from 'lucide-react'\n", '', 'online lucide imports')
s = replace_once(s, "const FigureComposer = lazy(() => import('./figure-composer/FigureComposer'))\n", '', 'duplicate FigureComposer lazy import')
s = replace_once(s, "  const [workspaceMode, setWorkspaceMode] = useState<'preparation' | 'figures'>('preparation')\n", '', 'duplicate workspaceMode')
pattern = re.compile(r'''  return <div className="online-preparation-shell" data-tool=\{workspaceMode\}>.*?\n  </div>\n\}''', re.S)
replacement = '''  return <div className="online-preparation-shell">
    {error
      ? <div className="prep-load-error"><h3>投稿准备数据暂时无法加载</h3><p>请检查网络连接后重试。</p><button className="btn btn-primary btn-sm" onClick={() => void load()}>重新加载</button></div>
      : <PreparationWorkspaceSuite snapshot={snapshot} loading={loading} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} onLookupJournalRanks={lookupJournalRanks} onDraftFigureCountChange={syncDraftFigureCount} />}
  </div>
}'''
s, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit('failed to replace duplicate online Figure Composer shell')
write(path, s)

# Preparation owns the single secondary Figure Composer route.
path = 'src/components/PreparationWorkspace.tsx'
s = read(path)
marker = "  if (loading) return <div className=\"prep-loading\" role=\"status\" aria-live=\"polite\">"
entry = '''  const figureToolEntry = <button
    type="button"
    className={`prep-figure-tool-entry${section === 'figures' ? ' active' : ''}`}
    onClick={() => setSection('figures')}
    aria-label="打开科研组图工作区"
    aria-pressed={section === 'figures'}
  >
    <span className="prep-figure-tool-entry__icon" aria-hidden="true"><Images size={19} strokeWidth={2.4} /></span>
    <span className="prep-figure-tool-entry__label">科研组图</span>
    <ArrowRight className="prep-figure-tool-entry__arrow" size={13} strokeWidth={2.2} />
  </button>

'''
if marker not in s or 'const figureToolEntry =' in s:
    raise SystemExit('unexpected Preparation figure entry state')
s = s.replace(marker, entry + marker, 1)
s = replace_once(s, '''        <div className="prep-top-actions prep-top-actions-portal">
          <div className="prep-search">''', '''        <div className="prep-top-actions prep-top-actions-portal">
          {figureToolEntry}
          <div className="prep-search">''', 'portal figure entry')
s = replace_once(s, '''        <div className="prep-top-actions">
          <div className="prep-search">''', '''        <div className="prep-top-actions">
          {figureToolEntry}
          <div className="prep-search">''', 'normal figure entry')
s = replace_once(s, '''      <button data-tone="figures" className={section === 'figures' ? 'active' : ''} onClick={() => setSection('figures')}><Images size={14} /> 科研组图</button>
''', '', 'remove first-class figure nav')
old_bridge = '''    {section === 'figures' && <div className="prep-figure-bridge"><Suspense fallback={<div className="prep-loading"><div className="prep-loading-shell"><LoaderCircle className="prep-loading-icon" size={22} /><div className="prep-loading-copy"><strong>正在加载科研组图工作区</strong><span>图像处理仍在当前浏览器完成。</span></div></div></div>}><FigureComposer drafts={normalized.drafts} onDraftFigureCountChange={onDraftFigureCountChange} /></Suspense></div>}'''
new_bridge = '''    {section === 'figures' && <div className="prep-figure-bridge prep-figure-secondary-workspace"><Suspense fallback={<div className="prep-loading"><div className="prep-loading-shell"><LoaderCircle className="prep-loading-icon" size={22} /><div className="prep-loading-copy"><strong>正在加载科研组图工作区</strong><span>图像处理仍在当前浏览器完成。</span></div></div></div>}><FigureComposer drafts={normalized.drafts} onDraftFigureCountChange={onDraftFigureCountChange} onBack={() => setSection('overview')} /></Suspense></div>}'''
s = replace_once(s, old_bridge, new_bridge, 'secondary Figure Composer bridge')
write(path, s)

# Luminous X proxy contains business workspaces only.
path = 'src/components/LuminousXStatusBar.tsx'
s = read(path)
s = replace_once(s, "  { label: '科研组图', match: '科研组图' },\n", '', 'Luminous X figure proxy')
write(path, s)

# Five business routes in standard Luminous.
path = 'src/preparation-nav-balance.css'
s = read(path).replace('Six first-class preparation workspaces', 'Five business preparation workspaces').replace('repeat(6, minmax(0, 1fr))', 'repeat(5, minmax(0, 1fr))')
write(path, s)

path = 'src/final-contract-hotfix.css'
s = read(path).replace('repeat(6, minmax(0, 1fr))', 'repeat(5, minmax(0, 1fr))')
s = s.replace("html[data-ui='luminous'] body .preparation-workspace > .prep-nav-primary > button[data-tone='figures'] { order: 3 !important; }\n", '')
s = s.replace("button[data-tone='materials'] { order: 4 !important; }", "button[data-tone='materials'] { order: 3 !important; }")
s = s.replace("button[data-tone='match'] { order: 5 !important; }", "button[data-tone='match'] { order: 4 !important; }")
s = s.replace("button[data-tone='check'] { order: 6 !important; }", "button[data-tone='check'] { order: 5 !important; }")
write(path, s)

# Last-loaded stylesheet owns the prominent integrated entry and secondary mode.
path = 'src/figure-composer.css'
s = read(path)
css = r'''

/* Submission Hub integrated Figure Composer entry. Secondary tool, not a primary Preparation route. */
.prep-figure-tool-entry{appearance:none;min-height:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:4px 11px 4px 6px;border:1px solid rgba(89,88,232,.34);border-radius:11px;background:linear-gradient(135deg,#1978ed 0%,#585be8 56%,#7c3aed 100%);color:#fff;font:inherit;font-size:12px;font-weight:850;letter-spacing:.01em;white-space:nowrap;cursor:pointer;box-shadow:0 8px 20px rgba(70,84,220,.22),0 0 0 1px rgba(255,255,255,.08) inset;transition:transform 160ms ease,filter 160ms ease,box-shadow 160ms ease}
.prep-figure-tool-entry__icon{width:28px;height:28px;display:grid;place-items:center;flex:0 0 28px;border:1px solid rgba(255,255,255,.32);border-radius:8px;background:rgba(255,255,255,.17);box-shadow:0 1px 0 rgba(255,255,255,.16) inset,0 3px 9px rgba(28,35,110,.18)}
.prep-figure-tool-entry__icon svg{width:19px;height:19px;filter:drop-shadow(0 1px 1px rgba(20,30,90,.22))}
.prep-figure-tool-entry__label{line-height:1}.prep-figure-tool-entry__arrow{opacity:.82;margin-left:1px}
.prep-figure-tool-entry:hover{transform:translateY(-1px);filter:brightness(1.06);box-shadow:0 11px 24px rgba(70,84,220,.28),0 0 0 1px rgba(255,255,255,.12) inset}
.prep-figure-tool-entry:focus-visible{outline:3px solid color-mix(in srgb,#585be8 28%,transparent);outline-offset:2px}
.prep-figure-tool-entry.active{box-shadow:0 0 0 2px rgba(255,255,255,.82),0 0 0 4px rgba(88,91,232,.32),0 10px 24px rgba(70,84,220,.26)}
.preparation-workspace[data-section='figures']>.prep-topbar,.preparation-workspace[data-section='figures']>.prep-nav-primary{display:none!important}
.preparation-workspace[data-section='figures']{padding-top:12px!important}.prep-figure-secondary-workspace{min-width:0}
html[data-ui='luminous-x'] .prep-top-actions-portal>.prep-figure-tool-entry{flex:0 0 auto}
@media(max-width:760px){.prep-figure-tool-entry{min-width:44px;padding-right:7px}.prep-figure-tool-entry__arrow{display:none}}
'''
if 'Submission Hub integrated Figure Composer entry' not in s:
    s += css
write(path, s)

# Browser contracts: five business routes + heading tool entry.
path = 'tests/visual/luminous-x-compact-check.mjs'
s = read(path)
s = s.replace("const required = ['总览', '论文准备', '科研组图', '投稿材料', '期刊匹配', '投稿前检查']", "const required = ['总览', '论文准备', '投稿材料', '期刊匹配', '投稿前检查']")
s = s.replace('expected six proxy routes', 'expected five proxy routes').replace('prepLayout.labels.length !== 6', 'prepLayout.labels.length !== 5')
s = s.replace("  await prepProxy.getByRole('button', { name: /科研组图/ }).click()", "  const figureEntry = prep.locator('.prep-figure-tool-entry:visible').first()\n  await figureEntry.waitFor({ state: 'visible', timeout: 5000 })\n  const entryIcon = await figureEntry.locator('.prep-figure-tool-entry__icon svg').evaluate(element => element.getBoundingClientRect().toJSON())\n  if (entryIcon.width < 18 || entryIcon.height < 18) failures.push(`preparation: Figure Composer entry icon is not prominent (${entryIcon.width}×${entryIcon.height}px)`)\n  await figureEntry.click()")
s = s.replace('expected six routes', 'expected five routes').replace('narrow.labels.length !== 6', 'narrow.labels.length !== 5')
write(path, s)

path = 'tests/visual/header-action-coherence-check.mjs'
s = read(path)
s = s.replace("const tones = ['overview', 'paper', 'figures', 'materials', 'match', 'check']", "const tones = ['overview', 'paper', 'materials', 'match', 'check']")
s = s.replace('primaryGeometry.buttons.length !== 6', 'primaryGeometry.buttons.length !== 5').replace('六个一级工作区', '五个一级工作区')
s = s.replace("    ['figures', 'figures'],\n", '')
s = s.replace("    if (tone === 'figures') {\n      await preparationLuminous.locator('.figure-composer').waitFor({ state: 'visible', timeout: 10000 })\n    }\n", '')
anchor = "  const preparationActive = await activeStyle(preparationLuminous, 'preparation')"
extra = "  const figureEntry = preparationLuminous.locator('.prep-figure-tool-entry:visible').first()\n  await figureEntry.waitFor({ state: 'visible', timeout: 10000 })\n  await figureEntry.click()\n  await preparationLuminous.locator('.figure-composer').waitFor({ state: 'visible', timeout: 10000 })\n  await preparationLuminous.getByRole('button', { name: /返回投稿准备/ }).click()\n  await preparationLuminous.locator(\".preparation-workspace[data-section='overview']\").waitFor({ state: 'visible', timeout: 10000 })\n\n"
s = replace_once(s, anchor, extra + anchor, 'Luminous figure entry browser test')
s = s.replace('luminous six primary workspaces remain clickable', 'luminous five business workspaces and secondary Figure Composer entry remain clickable')
write(path, s)

path = 'tests/visual/ui-geometry-contract-check.mjs'
s = read(path)
s = s.replace("const required = ['总览', '论文准备', '科研组图', '投稿材料', '期刊匹配', '投稿前检查']", "const required = ['总览', '论文准备', '投稿材料', '期刊匹配', '投稿前检查']")
s = s.replace('report.prepLabels.length !== 6', 'report.prepLabels.length !== 5').replace('exactly six core routes', 'exactly five business routes')
s = re.sub(r"\n        const figureRoute = report\.prepLabels\.findIndex\(item => item\.includes\('科研组图'\)\)\n        if \(figureRoute !== 2\) fail\(`\$\{ui\}: Figure Composer is not the third first-class Preparation route`\)", '', s)
write(path, s)

path = 'tests/visual/journal-center-header-filter-check.mjs'
s = read(path)
s = s.replace("const requiredRoutes = ['总览', '论文准备', '科研组图', '投稿材料', '期刊匹配', '投稿前检查']", "const requiredRoutes = ['总览', '论文准备', '投稿材料', '期刊匹配', '投稿前检查']")
s = s.replace('preparation.labels.length !== 6', 'preparation.labels.length !== 5').replace('可见菜单不是 6 个', '可见菜单不是 5 个')
s = s.replace('preparation.columns !== 6', 'preparation.columns !== 5').replace('不是六列', '不是五列')
write(path, s)

# Documentation follows the actual hierarchy.
path = 'README.md'
s = read(path)
s = s.replace('“投稿准备”调整为六个一级工作区：', '“投稿准备”保留五个业务一级工作区：')
s = s.replace('**总览 → 论文准备 → 科研组图 → 投稿材料 → 期刊匹配 → 投稿前检查**', '**总览 → 论文准备 → 投稿材料 → 期刊匹配 → 投稿前检查**')
s = s.replace('原有选题、草稿、期刊库和期刊比较能力继续保留，并归入相应一级工作区；科研组图不再作为边缘小卡片，而是直接进入独立专业工作区。', '原有选题、草稿、期刊库和期刊比较能力继续保留，并归入相应业务工作区；**科研组图**作为“投稿准备”标题区的显著二级工具入口，点击后进入同页专业工作区。')
write(path, s)

path = 'docs/releases/v2.1.0.md'
s = read(path)
s = s.replace('- “投稿准备”重构为六个一级工作区：**总览、论文准备、科研组图、投稿材料、期刊匹配、投稿前检查**；原有选题、草稿、期刊库和期刊比较能力继续保留在对应工作流中。', '- “投稿准备”保留五个业务一级工作区：**总览、论文准备、投稿材料、期刊匹配、投稿前检查**；**科研组图**调整为标题区的显著二级工具入口，进入同页专业工作区。')
s = s.replace('- 科研组图同时保留投稿准备顶部快捷入口，进入后使用独立桌面工作区，而不是普通表单卡片。', '- 科研组图只保留投稿准备内部的单一入口，不再额外占用页面顶部横幅或一级导航；进入后使用独立桌面工作区。')
write(path, s)
