import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await readFile(new URL('../src/lib/journal-auto-catalog.ts', import.meta.url), 'utf8')
const compiled = await transform(source, { loader: 'ts', format: 'esm', target: 'es2022' })
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`
const { deriveAutomaticJournalProfiles, normalizeJournalIdentity, isAutomaticallyCataloguedJournal } = await import(moduleUrl)

const submitted = {
  id: 'paper-a',
  journal: ' Journal of Rock Mechanics and Geotechnical Engineering ',
  status: 'submitted',
  submitted_date: '2026-01-10',
  updated_at: '2026-07-01T00:00:00Z',
  journal_url: 'https://example.com/jrmge',
  apc_amount: 2400,
  apc_currency: 'USD',
  quartile_jcr: 'Q1',
  quartile_cas: '一区',
  journal_apc_note: 'OA optional',
}
const duplicateSpelling = {
  id: 'paper-b',
  journal: 'journal  of rock mechanics and geotechnical engineering',
  status: 'revision',
  submitted_date: '2026-02-10',
  updated_at: '2026-06-01T00:00:00Z',
}
const preparing = {
  id: 'paper-c',
  journal: 'Draft Target Journal',
  status: 'preparing',
  submitted_date: null,
}
const statusOnly = {
  id: 'paper-d',
  journal: 'Status Only Journal',
  status: 'under_review',
  submitted_date: null,
  updated_at: '2026-07-03T00:00:00Z',
}

const additions = deriveAutomaticJournalProfiles(
  [submitted, duplicateSpelling, preparing, statusOnly],
  [],
  'user-1',
)

const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(additions.length === 2, `expected 2 catalog additions, received ${additions.length}`)
const main = additions.find(item => normalizeJournalIdentity(item.name) === normalizeJournalIdentity(submitted.journal))
const statusRecord = additions.find(item => item.name === 'Status Only Journal')
expect(!!main, 'submitted journal was not catalogued')
expect(!!statusRecord, 'non-preparing status without submitted date was not catalogued')
expect(!additions.some(item => item.name === 'Draft Target Journal'), 'preparing-only journal was incorrectly catalogued')
expect(main?.is_favorite === false, 'automatic record must not be marked as a favorite/priority journal')
expect(main?.priority === 'low', 'automatic record must use ordinary-record priority')
expect(main?.website_url === submitted.journal_url, 'journal website was not transferred')
expect(main?.apc_amount === 2400 && main?.apc_currency === 'USD', 'APC data was not transferred')
expect(main?.jcr_quartile === 'Q1' && main?.cas_quartile === '一区', 'quartile data was not transferred')
expect(isAutomaticallyCataloguedJournal(main), 'automatic source tag is missing')
expect(main?.selection_notes?.includes('2 条投稿记录'), 'duplicate historical submissions were not aggregated')

const existing = [{ id: 'journal-existing', name: 'JOURNAL OF ROCK MECHANICS AND GEOTECHNICAL ENGINEERING', selection_tags: [] }]
const noDuplicate = deriveAutomaticJournalProfiles([submitted], existing, 'user-1')
expect(noDuplicate.length === 0, 'existing journal profile was duplicated')

if (failures.length) {
  console.error('Automatic journal catalog check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Automatic journal catalog check passed.')
console.log(`- added=${additions.map(item => item.name).join(' | ')}`)
console.log(`- favorite=${main?.is_favorite}; source=${main?.selection_tags?.join(',')}`)
