import fs from 'node:fs'

const failures = []
const assert = (condition, message) => { if (!condition) failures.push(message) }
const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
const exists = path => fs.existsSync(path)

const pkg = JSON.parse(read('package.json'))
const quality = read('.github/workflows/quality.yml')
const readme = read('README.md')

assert(!pkg.scripts?.['build:offline'], 'build:offline must be retired after the final offline freeze')
assert(!pkg.scripts?.['check:offline'], 'check:offline must be retired after the final offline freeze')
assert(!String(pkg.scripts?.verify || '').includes('offline'), 'verify must validate the online application only')
assert(!exists('.github/workflows/release-offline.yml'), 'ongoing offline Release workflow must be removed')
assert(!exists('vite.config.offline.ts'), 'offline Vite configuration must be removed from the maintained source')
assert(!exists('offline.html'), 'offline HTML entry must be removed from the maintained source')
assert(!exists('src/offline.tsx'), 'offline React entry must be removed from the maintained source')
assert(!quality.includes('Build offline app') && !quality.includes('check:offline'), 'quality workflow must not rebuild the frozen offline edition')
assert(readme.includes('offline-final-v2.0.0'), 'README must point to the immutable final offline release')
assert(readme.includes('后续版本仅维护在线版'), 'README must state the online-only maintenance policy')

if (failures.length) {
  console.error('Online-only maintenance contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}
console.log('Online-only maintenance contract passed.')
