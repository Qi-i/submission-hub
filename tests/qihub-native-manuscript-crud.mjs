import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL(
  '../src/integrations/qihubManuscriptDraftCrud.ts', import.meta.url,
), 'utf8')
const exported = {}
new Function('exports', 'require', ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText)(exported, name => {
  if (name === '../lib/supabase') return { supabase: {} }
  throw Error('Unexpected Manuscript import: ' + name)
})
const { validateQiHubManuscriptDraft, mutateQiHubManuscriptDraft } = exported
const owner = '11111111-1111-1111-1111-111111111111'
const other = '22222222-2222-2222-2222-222222222222'
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const topicId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const journalId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const paperId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const initial = '2026-11-20T00:00:00.000Z'
const input = {
  topic_id: topicId,
  title: 'Long-term landslide reactivation under monsoon rainfall',
  article_type: 'Research Article',
  language: 'en',
  stage: 'writing',
  abstract: 'Aims, methods and significant results',
  keywords: ['landslide', 'rainfall', 'long-term deformation'],
  outline: 'Introduction\nMethods\nResults',
  authors: ['Zhiqi Liu', 'Kai Chen'],
  target_word_count: 8000,
  current_word_count: 3200,
  figure_count: 4,
  table_count: 2,
  reference_count: 86,
  deadline: '2027-03-15',
  external_links: [{ label: 'Data repository', url: 'https://example.edu/data' }],
  target_journal_ids: [journalId],
  primary_journal_id: journalId,
  checklist: [
    { id: 'title', category: 'manuscript', label: 'Title prepared', required: true, done: true },
    { id: 'data', category: 'data', label: 'Data repository', required: false, done: false, note: 'pending' },
  ],
  notes: 'Include field validation',
  submitted_paper_id: paperId,
}
const expectedKeys = Object.keys(input).sort()
assert.deepEqual(Object.keys(validateQiHubManuscriptDraft(input)).sort(), expectedKeys)
for (const incorrect of [
  { ...input, id },
  { ...input, user_id: owner },
  { ...input, updated_at: initial },
  { ...input, title: '' },
  { ...input, target_word_count: -1 },
  { ...input, reference_count: 0.4 },
  { ...input, stage: 'not-a-stage' },
  { ...input, deadline: '2027-02-30' },
  { ...input, target_journal_ids: [journalId, journalId] },
  { ...input, target_journal_ids: ['not-uuid'] },
  { ...input, checklist: [{ id: 'x', done: true }] },
  { ...input, checklist: [{ ...input.checklist[0], private_data: 'oops' }] },
  { ...input, external_links: [{ label: 'x', url: 'javascript:alert(1)' }] },
]) assert.throws(() => validateQiHubManuscriptDraft(incorrect))

let actor = owner
let linkedTopic = true
let linkedJournal = true
let linkedPaper = true
let current = null
let race = false
const writes = []
const checked = []
function query(table, action, payload) {
  const filters = {}
  return {
    eq(field, value) { filters[field] = value; return this },
    select() { return this },
    async maybeSingle() {
      if (table !== 'manuscript_drafts') {
        checked.push({ table, filters: { ...filters } })
        const allowed = table === 'research_topics'
          ? linkedTopic && filters.id === topicId
          : table === 'journal_profiles'
            ? linkedJournal && filters.id === journalId
            : table === 'papers' && linkedPaper && filters.id === paperId
        return { data: allowed && filters.user_id === owner
          ? { id: filters.id, user_id: owner } : null, error: null }
      }
      if (action === 'insert') {
        current = { ...payload, id, updated_at: initial }
        writes.push({ action, payload })
        return { data: structuredClone(current), error: null }
      }
      const matches = current &&
        (!filters.id || current.id === filters.id) &&
        (!filters.user_id || current.user_id === filters.user_id) &&
        (!filters.updated_at || current.updated_at === filters.updated_at)
      if (!matches) return { data: null, error: null }
      if (action === 'update') {
        if (race) {
          race = false
          current.updated_at = '2026-11-20T03:00:00.000Z'
          return { data: null, error: null }
        }
        current = { ...current, ...payload }
        writes.push({ action, payload })
      }
      if (action === 'delete') {
        writes.push({ action })
        const deleted = structuredClone(current)
        current = null
        return { data: deleted, error: null }
      }
      return { data: structuredClone(current), error: null }
    },
  }
}
const db = {
  auth: { getUser: async () => ({
    data: { user: actor ? { id: actor } : null }, error: null,
  }) },
  from(table) {
    return {
      select: () => query(table, 'read'),
      insert: input => query(table, 'insert', input),
      update: input => query(table, 'update', input),
      delete: () => query(table, 'delete'),
    }
  },
}
const create = await mutateQiHubManuscriptDraft({
  operation: 'create', fields: input,
}, db)
assert.equal(create.ok, true)
assert.equal(create.record.title, input.title)
assert.deepEqual(create.record.checklist, input.checklist)
assert.deepEqual(create.record.target_journal_ids, input.target_journal_ids)
assert.equal(writes.length, 1)
assert.equal(checked.length, 4)
assert.equal(writes[0].payload.user_id, owner)
assert.equal(Object.hasOwn(writes[0].payload, 'id'), false)
assert.equal(Object.hasOwn(writes[0].payload, 'updated_at'), false)

let old = current.updated_at
const update = await mutateQiHubManuscriptDraft({
  operation: 'update', id, expectedUpdatedAt: old,
  fields: { ...input, title: 'Revised regional early-warning mechanics', current_word_count: 4000 },
}, db)
assert.equal(update.ok, true)
assert.equal(current.title, 'Revised regional early-warning mechanics')
assert.equal(current.current_word_count, 4000)
assert.equal(writes.length, 2)
assert.deepEqual(Object.keys(writes[1].payload).sort(),
  [...expectedKeys, 'updated_at'].sort())

const stale = await mutateQiHubManuscriptDraft({
  operation: 'update', id, expectedUpdatedAt: old, fields: input,
}, db)
assert.equal(stale.conflict, true)
assert.equal(writes.length, 2)
old = current.updated_at
linkedTopic = false
await assert.rejects(mutateQiHubManuscriptDraft({
  operation: 'update', id, expectedUpdatedAt: old, fields: input,
}, db), /INVALID_OWNED_REFERENCE_research_topics/)
assert.equal(writes.length, 2)
linkedTopic = true
linkedJournal = false
await assert.rejects(mutateQiHubManuscriptDraft({
  operation: 'update', id, expectedUpdatedAt: old, fields: input,
}, db), /INVALID_OWNED_REFERENCE_journal_profiles/)
assert.equal(writes.length, 2)
linkedJournal = true
linkedPaper = false
await assert.rejects(mutateQiHubManuscriptDraft({
  operation: 'update', id, expectedUpdatedAt: old, fields: input,
}, db), /INVALID_OWNED_REFERENCE_papers/)
assert.equal(writes.length, 2)
linkedPaper = true

race = true
assert.equal((await mutateQiHubManuscriptDraft({
  operation: 'update', id, expectedUpdatedAt: old, fields: input,
}, db)).conflict, true)
assert.equal(writes.length, 2)
old = current.updated_at
actor = other
assert.equal((await mutateQiHubManuscriptDraft({
  operation: 'delete', id, expectedUpdatedAt: old,
}, db)).conflict, true)
actor = owner
assert.equal((await mutateQiHubManuscriptDraft({
  operation: 'delete', id, expectedUpdatedAt: old,
}, db)).ok, true)
assert.equal(current, null)
assert.equal(writes.length, 3)

console.log('QiHub manuscript CRUD: all 21 fields, linked rows, source CAS and ownership PASS')
