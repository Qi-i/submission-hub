import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/paper-field-merge.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { changedPaperFields, paperFieldEqual, rebasePaperFields, nextPaperUpdatedAt } =
  await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

test('unchanged editor fields are not submitted as complete snapshots', () => {
  const opened = {
    title: 'Fictional field study', notes: null, status: 'under_review',
    authors: ['A', 'B'], files: [], updated_at: '2026-11-19T01:00:00Z',
  }
  assert.deepEqual(changedPaperFields(opened, {
    ...opened, notes: '', files: null, updated_at: '2026-11-19T01:10:00Z',
  }), {})
  assert.deepEqual(changedPaperFields(opened, { ...opened, notes: 'Revised' }), { notes: 'Revised' })
  assert.ok(paperFieldEqual({ a: 1, b: 2 }, { b: 2, a: 1 }))
  assert.equal(paperFieldEqual(['A', 'B'], ['B', 'A']), false)
})

test('disjoint edits can be rebased while overlapping edits remain blocked', () => {
  const opened = { notes: 'Original', status: 'under_review', files: [{ n: 'old', p: 'r2-storage://demo/old' }] }
  const changes = changedPaperFields(opened, { ...opened, notes: 'New note' })
  assert.deepEqual(rebasePaperFields(opened, { ...opened, status: 'revision' }, changes), {
    patch: { notes: 'New note' }, conflicts: [],
  })
  assert.deepEqual(rebasePaperFields(opened, { ...opened, notes: 'New note' }, changes), {
    patch: {}, conflicts: [],
  })
  assert.deepEqual(rebasePaperFields(opened, { ...opened, notes: 'Another device' }, changes), {
    patch: {}, conflicts: ['notes'],
  })
  assert.deepEqual(changedPaperFields(opened, {
    ...opened, files: [{ n: 'replacement', p: 'r2-storage://demo/new' }],
  }), { files: [{ n: 'replacement', p: 'r2-storage://demo/new' }] })
})

test('the client timestamp never moves backwards even with a skewed device clock', () => {
  assert.equal(nextPaperUpdatedAt('2026-11-19T10:00:00.000Z', Date.parse('2026-11-19T09:00:00Z')),
    '2026-11-19T10:00:00.001Z')
  assert.equal(nextPaperUpdatedAt(null, Date.parse('2026-11-19T10:00:00Z')),
    '2026-11-19T10:00:00.000Z')
})

test('dashboard uses row-scoped CAS, preserves drafts on conflict, and rejects stale deletion', () => {
  const dashboard = readFileSync(new URL('../src/components/Dashboard.tsx', import.meta.url), 'utf8')
  assert.match(dashboard, /changedPaperFields\(opened,/)
  assert.match(dashboard, /rebasePaperFields\(opened, latest, changes\)/)
  assert.match(dashboard, /const initialLatest = await readCurrent\(\)/)
  assert.match(dashboard, /rebasePaperFields\(opened, initialLatest, changes\)/)
  assert.ok(dashboard.indexOf('const initialLatest = await readCurrent()') <
    dashboard.indexOf('const first = await saveChangedFields('),
    'a legacy writer must be checked by reading current fields before the first write')
  assert.match(dashboard, /\.eq\('updated_at', observedAt\)/)
  assert.match(dashboard, /\.select\('id, updated_at'\)/)
  assert.match(dashboard, /if \(!first\.data\?\.length\)/)
  assert.match(dashboard, /if \(!retry\.data\?\.length\)/)
  assert.match(dashboard, /\.delete\(\)\.eq\('id', id\)/)
  assert.match(dashboard, /const \{ data: current, error: readError \} = await/)
  assert.match(dashboard, /current\.updated_at !== editing\.updated_at/)
  assert.match(dashboard, /if \(!deleted\?\.length\)/)
  assert.doesNotMatch(dashboard, /\.update\(updateData\)\.eq\('id'/)
})
