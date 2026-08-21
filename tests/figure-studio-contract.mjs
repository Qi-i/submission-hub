import fs from 'node:fs'

const failures = []
const assert = (condition, message) => { if (!condition) failures.push(message) }
const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
const exists = path => fs.existsSync(path)

const components = [
  'src/components/figure-composer/FigureComposer.tsx',
  'src/components/figure-composer/FigureCanvas.tsx',
  'src/components/figure-composer/FigureToolbar.tsx',
  'src/components/figure-composer/FigureSidebar.tsx',
  'src/components/figure-composer/FigurePanelInspector.tsx',
  'src/components/figure-composer/FigureExportPanel.tsx',
  'src/components/figure-composer/FigurePreflightPanel.tsx',
]
const libraries = [
  'src/lib/figure-composer/types.ts',
  'src/lib/figure-composer/units.ts',
  'src/lib/figure-composer/geometry.ts',
  'src/lib/figure-composer/layout.ts',
  'src/lib/figure-composer/snapping.ts',
  'src/lib/figure-composer/image-import.ts',
  'src/lib/figure-composer/project.ts',
  'src/lib/figure-composer/validation.ts',
  'src/lib/figure-composer/export.ts',
]

for (const path of [...components, ...libraries]) assert(exists(path), `missing Figure Composer module: ${path}`)
assert(!exists('src/components/FigureStudio.tsx'), 'temporary monolithic FigureStudio.tsx must be removed')
assert(exists('src/figure-composer.css'), 'Figure Composer must use one scoped integrated stylesheet')
assert(!exists('src/figure-studio.css'), 'temporary Figure Studio stylesheet must be retired')

const preparation = read('src/components/PreparationWorkspace.tsx')
for (const key of ["'overview'", "'paper'", "'figures'", "'materials'", "'match'", "'check'"]) {
  assert(preparation.includes(key), `Preparation section missing: ${key}`)
}
for (const label of ['总览', '论文准备', '科研组图', '投稿材料', '期刊匹配', '投稿前检查']) {
  assert(preparation.includes(label), `Preparation navigation label missing: ${label}`)
}
assert(preparation.includes('lazy(') && preparation.includes('FigureComposer'), 'Figure Composer must be lazy-loaded from Preparation')

const types = read('src/lib/figure-composer/types.ts')
for (const field of ['naturalWidth', 'naturalHeight', 'originalAspectRatio', 'lockAspectRatio', 'rowSpan', 'colSpan', 'gridRow', 'gridColumn']) {
  assert(types.includes(field), `typed panel model missing ${field}`)
}
assert(types.includes("'main'") && types.includes("'supplementary'"), 'figure project role must distinguish main and supplementary figures')
assert(types.includes('draftId'), 'figure project must support Manuscript Draft association')

const layout = read('src/lib/figure-composer/layout.ts')
assert(layout.includes('hero-right-stack'), 'non-uniform A|B/C preset is missing')
assert(layout.includes('rowSpan') && layout.includes('colSpan'), 'grid span layout logic is missing')
assert(layout.includes('autoWrap'), 'auto-wrap canvas logic is missing')

const geometry = read('src/lib/figure-composer/geometry.ts')
for (const token of ['lockAspectRatio', 'alignPanels', 'distributePanels']) assert(geometry.includes(token), `geometry core missing ${token}`)
const snapping = read('src/lib/figure-composer/snapping.ts')
assert(snapping.includes('guides') && snapping.includes('gap'), 'snapping must expose visible guides and uniform-gap candidates')

const composer = read('src/components/figure-composer/FigureComposer.tsx')
assert(composer.includes('useReducer'), 'Figure Composer must use reducer-owned project state')
assert(composer.includes('Times New Roman'), 'default label font must be Times New Roman')
assert(composer.includes('(a)') || read('src/lib/figure-composer/types.ts').includes('parena'), 'default labels must be (a), (b), (c)')

const canvas = read('src/components/figure-composer/FigureCanvas.tsx')
assert(canvas.includes('ctrlKey') || canvas.includes('metaKey'), 'canvas selection must support Ctrl/Cmd multi-select')
assert(canvas.includes('shiftKey'), 'canvas selection must support Shift range selection')
assert(canvas.includes('guides'), 'canvas must render snap guide lines')

const inspector = read('src/components/figure-composer/FigurePanelInspector.tsx')
for (const field of ['X', 'Y', 'W', 'H', 'rowSpan', 'colSpan']) assert(inspector.includes(field), `panel inspector missing ${field}`)

const units = read('src/lib/figure-composer/units.ts')
assert(units.includes('BASE_DPI') && units.includes('96'), 'logical coordinate system must use a 96 DPI base')
for (const unit of ['mm', 'cm', 'inch']) assert(units.includes(unit), `publication unit missing: ${unit}`)

const importer = read('src/lib/figure-composer/image-import.ts')
for (const marker of ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/tiff', 'application/pdf']) {
  assert(importer.includes(marker), `image importer missing ${marker}`)
}
assert(importer.includes('URL.revokeObjectURL'), 'image importer/project lifecycle must revoke object URLs')

const project = read('src/lib/figure-composer/project.ts')
assert(project.includes('indexedDB'), 'figure project assets must persist in browser IndexedDB')
assert(!project.toLowerCase().includes('supabase'), 'figure project image persistence must not upload to Supabase')

const validation = read('src/lib/figure-composer/validation.ts')
for (const check of ['resolution', 'overlap', 'stretch', 'caption', 'bounds']) assert(validation.toLowerCase().includes(check), `preflight missing ${check} check`)

const exporter = read('src/lib/figure-composer/export.ts')
for (const format of ['png', 'jpeg', 'webp', 'tiff', 'pdf', 'svg']) assert(exporter.toLowerCase().includes(format), `export engine missing ${format}`)
assert(exporter.includes('preserveAspectRatio'), 'SVG export must preserve explicit aspect-ratio semantics')

const online = read('src/components/OnlinePreparationWorkspace.tsx')
assert(online.includes('figure_count'), 'online draft integration must synchronize figure_count')

if (failures.length) {
  console.error('Figure Composer migration contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}
console.log('Figure Composer migration contract passed.')
