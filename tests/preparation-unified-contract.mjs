import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const exists = p => fs.existsSync(path.join(root, p))
const failures = []
const expect = (ok, message) => { if (!ok) failures.push(message) }

const composer = read('src/components/figure-composer/FigureComposer.tsx')
const sidebar = read('src/components/figure-composer/FigureSidebar.tsx')
const types = read('src/lib/figure-composer/types.ts')
const prep = read('src/components/PreparationWorkspace.tsx')
const suite = read('src/components/PreparationWorkspaceSuite.tsx')
const lx = read('src/components/LuminousXStatusBar.tsx')
const styles = read('src/app-styles.ts')

// P0: universal Figure Composer identity.
expect(!composer.includes('drafts[0]'), 'Figure Composer must never implicitly bind drafts[0].')
expect(!composer.includes('const firstDraftId'), 'Figure Composer must not derive a firstDraftId from the draft list.')
expect(types.includes("name: '未命名组图'"), 'New figure projects must default to 未命名组图.')
expect(types.includes('publicationLabel'), 'FigureProject must separate optional publicationLabel from project name.')
expect(!types.includes('name: figureDisplayName(role, sequence)'), 'New project identity must not default to Figure 1/Supplementary Figure S1.')
expect(sidebar.includes('未关联草稿'), 'Draft association must remain explicitly optional.')
expect(composer.includes('投稿准备') && composer.includes('科研组图'), 'Workbench must expose 投稿准备 / 科研组图 context.')

// P0: five business routes only; figures is a tool workspace.
for (const label of ['总览', '论文准备', '投稿材料', '期刊匹配', '投稿前检查']) {
  expect(prep.includes(label), `Preparation business navigation must include ${label}.`)
}
expect(prep.includes("section !== 'figures'"), 'Business navigation/header chrome must be conditionally hidden in figures mode.')
expect(prep.includes('prep-nav-item__icon') && prep.includes('prep-nav-item__label') && prep.includes('prep-nav-item__meta'), 'All five business navigation buttons must use icon/label/meta slots.')

// P0: shared state; no DOM-proxy navigation in Luminous X.
for (const forbidden of ['findControlButton', 'document.querySelector', 'MutationObserver']) {
  expect(!lx.includes(forbidden), `Luminous X preparation controls must not use ${forbidden}.`)
}
expect(lx.includes('preparationSection') && lx.includes('onPreparationSectionChange'), 'Luminous X must consume the shared preparation section state directly.')

// P0: no dynamic DOM injection for overview modules.
for (const forbidden of ['MutationObserver', 'document.createElement', 'appendChild', 'createPortal']) {
  expect(!suite.includes(forbidden), `PreparationWorkspaceSuite must not use ${forbidden}.`)
}

// Unified preparation style system must exist and be loaded as the terminal preparation layer.
for (const file of [
  'src/styles/preparation/tokens.css',
  'src/styles/preparation/shell.css',
  'src/styles/preparation/components.css',
  'src/styles/preparation/workbench.css',
  'src/styles/preparation/luminous.css',
  'src/styles/preparation/luminous-x.css',
  'src/styles/preparation/responsive.css',
]) expect(exists(file), `Missing unified preparation style file: ${file}`)
expect(styles.includes("./styles/preparation/tokens.css") && styles.includes("./styles/preparation/workbench.css"), 'app-styles.ts must load the unified preparation style system.')

if (failures.length) {
  console.error(`Unified Preparation contract failed (${failures.length}):`)
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`))
  process.exit(1)
}

console.log('Unified Preparation architecture contract passed.')
