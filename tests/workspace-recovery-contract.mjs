import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const exists = file => fs.existsSync(path.join(root, file))
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const dashboard = read('src/components/Dashboard.tsx')
const journalCenter = read('src/components/JournalCenterWorkspace.tsx')
const offlineJournalCenter = read('src/components/OfflineJournalCenterWorkspace.tsx')
const journalCard = read('src/components/JournalCatalogCard.tsx')
const appStyles = read('src/app-styles.ts')
const preparation = read('src/components/PreparationWorkspace.tsx')
const navigation = read('src/components/preparation/PreparationNavigation.tsx')
const navCss = read('src/styles/preparation/components.css') + read('src/styles/workspace-recovery.css')
const figureComposer = read('src/components/figure-composer/FigureComposer.tsx')
const figureTypes = read('src/lib/figure-composer/types.ts')
const figureInspector = read('src/components/figure-composer/FigurePanelInspector.tsx')

assert(exists('src/components/JournalCenterWorkspace.tsx'), 'Journal Center must have its own workspace component')
assert(exists('src/components/JournalCatalogCard.tsx'), 'Journal Center and Preparation must share one journal card component')
assert(journalCenter.includes('JournalCatalogCard') && journalCenter.includes('journal-catalog-grid') && !journalCenter.includes('journal-center-workspace preparation-workspace'), 'Journal Center must reuse the shared journal catalog card system without masquerading as Preparation')
assert(offlineJournalCenter.includes('JournalCatalogCard') && offlineJournalCenter.includes('journal-catalog-grid') && !offlineJournalCenter.includes('journal-center-workspace preparation-workspace'), 'Offline Journal Center must use the same shared journal card visual system without Preparation coupling')
assert(journalCard.includes('prep-journal-card') && journalCard.includes('prep-journal-rank-blocks') && journalCard.includes('prep-journal-facts') && journalCard.includes('prep-journal-numbers'), 'Shared journal card must retain colorful rank/fact/metric visual layers')
assert(!exists('src/styles/journal-center-density-contract.css') && !appStyles.includes('journal-center-density-contract.css'), 'Terminal Journal Center density override must stay removed')
assert(dashboard.includes('JournalCenterWorkspace'), 'Dashboard must render JournalCenterWorkspace directly')
assert(!dashboard.includes('workspaceMode="journal-center"'), 'Dashboard must not route Journal Center through PreparationWorkspace match mode')
assert(/next\s*===\s*['"]preparation['"][\s\S]{0,120}setPreparationSection\(['"]overview['"]\)/.test(dashboard), 'Opening 投稿准备 must reset to 总览')

assert(exists('src/components/preparation/JournalMatchWorkspace.tsx'), '投稿准备 must have a dedicated JournalMatchWorkspace')
assert(preparation.includes('JournalMatchWorkspace'), 'PreparationWorkspace must render the dedicated matching workflow')
assert(preparation.includes('onOpenJournalCenter'), 'Journal match must expose a real jump to the first-class Journal Center')

assert(!navigation.includes('data-tone='), 'Preparation business navigation must not encode five large color cards')
assert(navigation.includes('item.meta != null &&'), 'Navigation metadata must not render empty placeholder dots')
assert(/min-height:\s*(3[2-8])px/.test(navCss), 'Business nav should remain a compact 32–38px rail')

assert(figureTypes.includes('panelWidth:'), 'Figure canvas settings must persist default single-panel width')
assert(figureTypes.includes('layoutScale:'), 'Figure canvas settings must persist overall layout scale')
assert(figureTypes.includes('labelDefaults:'), 'Figure project must persist global label defaults')
assert(exists('src/components/figure-composer/FigureGlobalLayoutPanel.tsx'), 'Figure Composer needs a global layout/label control panel')
const globalPanel = exists('src/components/figure-composer/FigureGlobalLayoutPanel.tsx') ? read('src/components/figure-composer/FigureGlobalLayoutPanel.tsx') : ''
for (const label of ['单图宽度', '整体缩放', '图间距', '画布边距', '标签样式', '标签字体', '标签字号', '标签位置', '横向偏移', '纵向偏移', '应用到全部']) {
  assert(globalPanel.includes(label), `Global figure controls must include ${label}`)
}
for (const token of ['aria-label="X"', 'aria-label="Y"', 'aria-label="W"', 'aria-label="H"', 'rowSpan', 'colSpan']) {
  assert(figureInspector.includes(token), `Selected-panel precision control missing: ${token}`)
}
assert(figureComposer.includes('figure-composer__splitter'), 'Figure Composer must render draggable splitters')
assert(figureComposer.includes('role="separator"'), 'Figure Composer splitters must be semantic separators')
assert(figureComposer.includes('submission-hub.figure-composer.panes'), 'Figure pane widths must persist locally')

console.log('workspace recovery contract passed')
// recovery executor trigger
