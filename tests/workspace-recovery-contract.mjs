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
const journalCardCss = read('src/components/JournalCatalogCard.css')
const journalCardDetailCss = exists('src/components/JournalCatalogCardDetail.css') ? read('src/components/JournalCatalogCardDetail.css') : ''
const appStyles = read('src/app-styles.ts')
const preparation = read('src/components/PreparationWorkspace.tsx')
const navigation = read('src/components/preparation/PreparationNavigation.tsx')
const navCss = read('src/styles/preparation/components.css') + read('src/styles/workspace-recovery.css')
const figureComposer = read('src/components/figure-composer/FigureComposer.tsx')
const figureTypes = read('src/lib/figure-composer/types.ts')
const figureInspector = read('src/components/figure-composer/FigurePanelInspector.tsx')

assert(exists('src/styles/application-ui-contract.css'), 'Application must have one cross-page UI contract')
assert(exists('src/styles/submission-family-card-coherence.css'), 'Application must have a final Submission Management card-family coherence layer')
assert(exists('src/styles/journal-tier-contrast-final.css'), 'Journal Center must have a terminal Q1-Q3 semantic tier layer')
const applicationUiContract = exists('src/styles/application-ui-contract.css') ? read('src/styles/application-ui-contract.css') : ''
const familyCoherence = exists('src/styles/submission-family-card-coherence.css') ? read('src/styles/submission-family-card-coherence.css') : ''
assert(appStyles.includes("import './styles/application-ui-contract.css'"), 'Cross-page UI contract must remain loaded')
assert(appStyles.trim().endsWith("import './styles/journal-tier-contrast-final.css'"), 'Q1-Q3 Journal Center semantic tier layer must be the terminal stylesheet import')
assert(appStyles.indexOf("import './styles/application-ui-contract.css'") < appStyles.indexOf("import './styles/submission-family-card-coherence.css'"), 'Final card-family layer must load after the general application contract')
assert(appStyles.indexOf("import './styles/submission-family-card-coherence.css'") < appStyles.indexOf("import './styles/journal-tier-contrast-final.css'"), 'Journal tier identity must load after card-family geometry without changing the shared layout contract')
for (const token of ['--app-font-sans', '--app-page-width', '--app-page-gutter', '--app-control-height', '--app-panel-radius', '--app-card-radius']) {
  assert(applicationUiContract.includes(token), `Cross-page UI contract is missing token ${token}`)
}
for (const token of ["html[data-ui='luminous']", "html[data-ui='luminous-x']", '.journal-center-workspace', '.preparation-workspace', '.stats-panel', '.paper-grid']) {
  assert(applicationUiContract.includes(token), `Cross-page UI contract is missing shared page rule ${token}`)
}
for (const token of ['journal-center-grid.paper-grid.journal-catalog-grid', 'repeat(3', 'repeat(4', 'repeat(5', '.journal-match-candidate-grid', 'minmax(280px', '--journal-card-accent']) {
  assert(familyCoherence.includes(token), `Final card-family coherence layer is missing ${token}`)
}

assert(exists('src/components/JournalCenterWorkspace.tsx'), 'Journal Center must have its own workspace component')
assert(exists('src/components/JournalCatalogCard.tsx'), 'Journal Center and Preparation must share one journal card component')
assert(exists('src/components/JournalCatalogCard.css'), 'Shared journal card must own a dedicated canonical stylesheet')
assert(exists('src/components/JournalCatalogCardDetail.css'), 'Standalone Journal Center must own a detail-geometry stylesheet')
assert(journalCenter.includes('JournalCatalogCard') && journalCenter.includes('journal-catalog-grid') && !journalCenter.includes('journal-center-workspace preparation-workspace'), 'Journal Center must reuse the shared journal catalog card system without masquerading as Preparation')
assert(offlineJournalCenter.includes('JournalCatalogCard') && offlineJournalCenter.includes('journal-catalog-grid') && !offlineJournalCenter.includes('journal-center-workspace preparation-workspace'), 'Offline Journal Center must use the same shared journal card visual system without Preparation coupling')

// First-class Journal Center participates in the Submission Management shell without
// inheriting workflow-only internals that distort catalogue details.
assert(journalCenter.includes('journal-center-grid paper-grid journal-catalog-grid'), 'Online Journal Center must use the same paper-grid layout contract as Submission Management')
assert(offlineJournalCenter.includes('journal-center-grid paper-grid journal-catalog-grid'), 'Offline Journal Center must use the same paper-grid layout contract as Submission Management')
for (const token of ['paper-card-v3', 'paper-card-head', 'paper-status-area', 'paper-action-rail', 'title-block', 'card-title', 'card-subtitle']) {
  assert(journalCard.includes(token), `Journal Center card must share Submission Management structure: ${token}`)
}
assert(journalCard.includes('journal-center-card__links'), 'Journal Center must use a dedicated inline footer action rail')
assert(!journalCard.includes('paper-card-footer'), 'Journal Center footer must not inherit Submission Management workflow footer geometry')
assert(journalCard.includes("import './JournalCatalogCard.css'") && journalCard.includes("import './JournalCatalogCardDetail.css'"), 'Journal Center must load canonical card styles followed by its detail-geometry contract')
assert(journalCard.indexOf("import './JournalCatalogCard.css'") < journalCard.indexOf("import './JournalCatalogCardDetail.css'"), 'Journal Center detail geometry must load after the canonical card stylesheet')
assert(journalCardDetailCss.includes('.journal-catalog-card__oa-label') && journalCardDetailCss.includes('.journal-catalog-card__metrics') && journalCardDetailCss.includes('.journal-center-card__links'), 'Journal Center detail stylesheet must own OA, metric and footer geometry')

assert(journalCard.includes('journal-catalog-card__status') && journalCard.includes('journal-catalog-card__substatus') && journalCard.includes('journal-catalog-card__title-block'), 'Shared journal card must use the submission-management information hierarchy')
assert(journalCard.includes('prep-journal-rank-blocks') && journalCard.includes('prep-journal-facts') && journalCard.includes('prep-journal-numbers'), 'Shared journal card must retain colorful rank/fact/metric visual layers')
assert(journalCardCss.includes('--release-page-width') && journalCardCss.includes('.journal-priority-status') && journalCardCss.includes("[data-tone='selection']") && journalCardCss.includes("[data-tone='decision']") && journalCardCss.includes('.journal-center-card::before'), 'Journal Center stylesheet must only map journal semantics and visible color layers onto the shared Submission Management shell')
assert(!/journal-center-grid[^\{]*\{[^\}]*grid-template-columns:\s*repeat\(auto-(?:fit|fill)/s.test(journalCardCss), 'Journal Center must not define an independent auto-fit/auto-fill desktop column system')
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