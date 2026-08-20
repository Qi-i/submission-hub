import fs from 'node:fs'

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
const preparation = read('src/components/PreparationWorkspace.tsx')
const online = read('src/components/OnlinePreparationWorkspace.tsx')
const studio = read('src/components/FigureStudio.tsx')
const styles = read('src/figure-studio.css')

assert(studio.length > 0, 'FigureStudio component is missing')
assert(online.includes('FigureStudio'), 'online preparation workspace does not render FigureStudio')
assert(online.includes('科研组图'), 'online preparation workspace does not provide a prominent 科研组图 entry')
assert(!preparation.includes("'figures'"), 'the fixed five-entry preparation navigation must not gain a sixth section')
assert(studio.includes("labelStyle: 'parena'"), 'default panel label style must be (a), (b), (c)')
assert(studio.includes("labelFont: 'Times New Roman'"), 'default panel label font must be Times New Roman')
assert(studio.includes('image/png') && studio.includes('image/jpeg') && studio.includes('image/svg+xml'), 'core scientific image import types are missing')
assert(studio.includes('download') && studio.includes('toDataURL'), 'browser-side export path is missing')
assert(styles.includes('.figure-studio'), 'FigureStudio must have a scoped style root')

const fixedEntries = ['总览', '选题池', '草稿准备', '期刊库', '期刊比较']
for (const entry of fixedEntries) assert(preparation.includes(entry), `fixed preparation entry missing: ${entry}`)

if (failures.length) {
  console.error('Figure Studio migration contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Figure Studio migration contract passed.')
