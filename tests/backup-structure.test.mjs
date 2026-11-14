import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Execute the actual production parser; only TypeScript type annotations
// are stripped. No mock implementation or cloud access.
const source = readFileSync(new URL('../src/lib/backup.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const { parseBackupBundle, createBackup } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)
const sample = {
  journals: [{ id: 'example-journal', name: 'Example Journal' }],
  topics: [{ id: 'example-topic', title: 'Example Topic' }],
  drafts: [{ id: 'example-draft', title: 'Example Draft' }],
}
const valid = createBackup([], 'offline', sample)
assert.deepEqual(parseBackupBundle(valid).preparation, sample)
assert.equal(parseBackupBundle('[]').version, 1)
assert.equal(parseBackupBundle(JSON.stringify({
  schema: 'submission-hub-backup', version: 2, papers: [],
})).preparation, null)
assert.deepEqual(parseBackupBundle(JSON.stringify({
  schema: 'submission-hub-backup', version: 2, papers: [],
  preparation: { journals: sample.journals },
})).preparation, { journals: sample.journals, topics: [], drafts: [] })
for (const invalid of [
  'not-a-snapshot', false, 123, [], { journals: 'corrupt' },
  { topics: null }, { drafts: [null] }, { journals: [[]] },
]) {
  const backup = JSON.stringify({
    schema: 'submission-hub-backup', version: 3, papers: [],
    preparation: invalid,
  })
  assert.throws(() => parseBackupBundle(backup), /备份/)
}
console.log('Backup structure: legacy compatibility and fail-closed checks passed.')
