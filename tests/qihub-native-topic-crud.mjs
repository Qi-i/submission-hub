import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(
  new URL('../src/integrations/qihubResearchTopicCrud.ts', import.meta.url),
  'utf8',
)
const exported = {}
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
new Function('exports', 'require', compiled)(exported, name => {
  if (name === '../lib/supabase') return { supabase: {} }
  throw Error('Unexpected native CRUD import: ' + name)
})
const { mutateQiHubResearchTopic, validateQiHubResearchTopic } = exported

const account = '11111111-1111-1111-1111-111111111111'
const other = '22222222-2222-2222-2222-222222222222'
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const firstStamp = '2026-11-18T06:00:00.000Z'

const validInput = {
  title: 'Deep-seated landslide mechanics',
  research_question: 'Why do old landslides reactivate?',
  objective: 'Find the mechanism',
  novelty: 'Physical coupling',
  background: 'Field and numerical evidence',
  keywords: ['landslide', 'rock mechanics'],
  methods: ['monitoring', 'inversion'],
  data_sources: ['field records'],
  target_audience: 'Engineering geology',
  expected_output: 'Research paper',
  status: 'literature',
  priority: 'high',
  novelty_score: 5,
  feasibility_score: 4,
  data_score: 3,
  method_score: 4,
  timeline_score: 2,
  deadline: '2026-12-31',
  links: [{ label: 'data', url: 'https://example.edu/data' }],
  notes: 'A real native edit',
}

let identity = account
let topic = null
let hasDraft = false
let remoteWrites = []
let raceBeforeUpdate = false
const query = (table, verb, payload) => {
  const where = {}
  return {
    eq(field, value) { where[field] = value; return this },
    select() { return this },
    async maybeSingle() {
      if (table === 'manuscript_drafts') {
        return { data: hasDraft && where.topic_id === id &&
            where.user_id === account ? { id: 'linked-draft' } : null,
          error: null }
      }
      assert.equal(table, 'research_topics')
      if (verb === 'insert') {
        assert.equal(payload.user_id, account)
        assert.equal(topic, null, 'Only one item in this fixture')
        topic = { ...payload, id, updated_at: firstStamp,
          created_at: firstStamp }
        remoteWrites.push({ verb, payload })
        return { data: structuredClone(topic), error: null }
      }
      const match = !!topic && (!where.id || where.id === topic.id) &&
        (!where.user_id || where.user_id === topic.user_id) &&
        (!where.updated_at || where.updated_at === topic.updated_at)
      if (!match) return { data: null, error: null }
      if (verb === 'update') {
        if (raceBeforeUpdate) {
          topic.updated_at = '2026-11-18T08:00:00.000Z'
          raceBeforeUpdate = false
          return { data: null, error: null }
        }
        topic = { ...topic, ...payload }
        remoteWrites.push({ verb, payload })
      }
      if (verb === 'delete') {
        remoteWrites.push({ verb })
        const deleted = structuredClone(topic)
        topic = null
        return { data: deleted, error: null }
      }
      return { data: structuredClone(topic), error: null }
    },
  }
}
const db = {
  auth: {
    async getUser() {
      return { data: { user: identity ? { id: identity } : null },
        error: null }
    },
  },
  from(table) {
    return {
      select: () => query(table, 'read'),
      insert: fields => query(table, 'insert', fields),
      update: fields => query(table, 'update', fields),
      delete: () => query(table, 'delete'),
    }
  },
}

assert.deepEqual(Object.keys(validateQiHubResearchTopic(validInput)).sort(),
  [
    'title', 'research_question', 'objective', 'novelty', 'background',
    'target_audience', 'expected_output', 'notes', 'keywords', 'methods',
    'data_sources', 'novelty_score', 'feasibility_score', 'data_score',
    'method_score', 'timeline_score', 'status', 'priority', 'deadline', 'links',
  ].sort())
for (const invalid of [
  { ...validInput, user_id: other },
  { ...validInput, id },
  { ...validInput, priority: 'secret' },
  { ...validInput, novelty_score: 9 },
  { ...validInput, keywords: [123] },
  { ...validInput, links: [{ label: 'X', url: 'javascript:alert(1)' }] },
]) {
  assert.throws(() => validateQiHubResearchTopic(invalid))
}
assert.equal(remoteWrites.length, 0)

const created = await mutateQiHubResearchTopic({
  operation: 'create', fields: validInput,
}, db)
assert.equal(created.ok, true)
assert.equal(created.record.id, id)
assert.equal(topic.title, validInput.title)
assert.deepEqual(topic.links, validInput.links)
assert.equal(remoteWrites.length, 1)
assert.equal(Object.hasOwn(remoteWrites[0].payload, 'id'), false)

let expected = topic.updated_at
const revised = await mutateQiHubResearchTopic({
  operation: 'update', id, expectedUpdatedAt: expected,
  fields: { ...validInput, title: 'Reactivation mechanism confirmed' },
}, db)
assert.equal(revised.ok, true)
assert.equal(topic.title, 'Reactivation mechanism confirmed')
assert.ok(Date.parse(topic.updated_at) > Date.parse(firstStamp))
assert.equal(remoteWrites.length, 2)
assert.deepEqual(Object.keys(remoteWrites[1].payload).sort(),
  [...Object.keys(validateQiHubResearchTopic(validInput)), 'updated_at'].sort())

const stale = await mutateQiHubResearchTopic({
  operation: 'update', id, expectedUpdatedAt: expected,
  fields: validInput,
}, db)
assert.equal(stale.ok, false)
assert.equal(stale.conflict, true)
assert.equal(remoteWrites.length, 2)
assert.equal(topic.title, 'Reactivation mechanism confirmed')

expected = topic.updated_at
raceBeforeUpdate = true
const concurrent = await mutateQiHubResearchTopic({
  operation: 'update', id, expectedUpdatedAt: expected,
  fields: validInput,
}, db)
assert.equal(concurrent.conflict, true)
assert.equal(remoteWrites.length, 2)

expected = topic.updated_at
hasDraft = true
await assert.rejects(mutateQiHubResearchTopic({
  operation: 'delete', id, expectedUpdatedAt: expected,
}, db), /QIHUB_TOPIC_REFERENCED_BY_DRAFT/)
assert.ok(topic)
assert.equal(remoteWrites.length, 2)
hasDraft = false
identity = other
const foreign = await mutateQiHubResearchTopic({
  operation: 'delete', id, expectedUpdatedAt: expected,
}, db)
assert.equal(foreign.conflict, true)
assert.ok(topic)
identity = account

const deleted = await mutateQiHubResearchTopic({
  operation: 'delete', id, expectedUpdatedAt: expected,
}, db)
assert.equal(deleted.ok, true)
assert.equal(deleted.record.id, id)
assert.equal(topic, null)
assert.equal(remoteWrites.length, 3)
const missing = await mutateQiHubResearchTopic({
  operation: 'delete', id, expectedUpdatedAt: expected,
}, db)
assert.equal(missing.conflict, true)
assert.equal(remoteWrites.length, 3)

console.log('QiHub research topics real Supabase CRUD: all fields, CAS, RLS, linked-draft guard PASS')
