import fs from 'node:fs'

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
const workspace = read('src/components/PreparationWorkspace.tsx')
const studio = read('src/components/FigureStudio.tsx')
const styles = read('src/figure-studio.css')

assert(studio.length > 0, 'FigureStudio component is missing')
assert(workspace.includes("'figures'"), 'PreparationWorkspace does not expose the figure-studio subview')
assert(workspace.includes('FigureStudio'), 'PreparationWorkspace does not render FigureStudio')
assert(workspace.includes('科研组图'), 'PreparationWorkspace does not provide a prominent 科研组图 entry')
assert(studio.includes("labelStyle: 'parena'"), 'default panel label style must be (a), (b), (c)')
assert(studio.includes("labelFont: 'Times New Roman'"), 'default panel label font must be Times New Roman')
assert(studio.includes('image/png') && studio.includes('image/jpeg') && studio.includes('image/svg+xml'), 'core scientific image import types are missing')
assert(studio.includes('download') && studio.includes('toDataURL'), 'browser-side export path is missing')
assert(styles.includes('.figure-studio'), 'FigureStudio must have a scoped style root')

if (failures.length) {
  console.error('Figure Studio migration contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Figure Studio migration contract passed.')
