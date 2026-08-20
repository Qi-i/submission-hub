import fs from 'node:fs'

const failures = []
const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
const assert = (condition, message) => { if (!condition) failures.push(message) }

const pkg = JSON.parse(read('package.json') || '{}')
const offlineEntry = read('src/offline.tsx')
const offlineDashboard = read('src/components/OfflineDashboard.tsx')
const localStore = read('src/lib/local-store.ts')
const prepStore = read('src/lib/local-preparation-store.ts')
const backup = read('src/lib/backup.ts')
const theme = read('src/lib/theme.tsx') || read('src/lib/theme.ts')

for (const path of [
  'offline.html',
  'vite.config.offline.ts',
  'src/offline.tsx',
  'src/components/OfflineDashboard.tsx',
  'src/components/OfflinePreparationWorkspace.tsx',
  'src/components/OfflinePaperCard.tsx',
  'src/components/OfflinePaperForm.tsx',
  'scripts/check-offline-build.mjs',
]) assert(fs.existsSync(path), `${path} must exist in the final offline freeze`)

assert(typeof pkg.scripts?.['build:offline'] === 'string', 'build:offline script must remain available for the frozen release')
assert(typeof pkg.scripts?.['check:offline'] === 'string', 'check:offline script must remain available for the frozen release')
assert(offlineEntry.includes('OfflineDashboard'), 'offline entry must render OfflineDashboard')
assert(offlineEntry.includes('ThemeProvider'), 'offline entry must retain the shared theme provider')
assert(!/supabase/i.test(offlineEntry), 'offline entry must not import or initialize Supabase')
assert(offlineDashboard.includes("../lib/local-store"), 'offline dashboard must use the local paper store')
assert(offlineDashboard.includes("../lib/local-preparation-store"), 'offline dashboard must use the local preparation store')
assert(offlineDashboard.includes('createBackup') && offlineDashboard.includes('parseBackupBundle'), 'offline dashboard must retain backup import/export compatibility')
assert(/localStorage/.test(localStore), 'paper store must persist through localStorage')
assert(/localStorage/.test(prepStore), 'preparation store must persist through localStorage')
assert(/version\s*:\s*3|BACKUP_VERSION\s*=\s*3/.test(backup), 'offline backup path must retain the current v3-compatible bundle contract')
assert(/dark/.test(theme) && /light/.test(theme) && /system/.test(theme), 'theme system must retain light, dark and system modes')

if (failures.length) {
  console.error('Final offline freeze contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Final offline freeze contract passed.')
