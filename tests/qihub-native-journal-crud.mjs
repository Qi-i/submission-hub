import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL(
  '../src/integrations/qihubJournalProfileCrud.ts', import.meta.url),
  'utf8')
const exported = {}
new Function('exports', 'require', ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText)(exported, name => {
  if (name === '../lib/supabase') return { supabase: {} }
  throw Error('Unexpected QiHub journal import: ' + name)
})
const { validateQiHubJournalProfile, mutateQiHubJournalProfile } = exported

const account = '11111111-1111-1111-1111-111111111111'
const journalId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const before = '2026-11-19T03:00:00.000Z'
const values = {
  name: 'Earth Surface Processes and Landforms',
  name_zh: '地表过程与地貌',
  official_abbreviation: 'ESPL',
  publisher: 'Wiley',
  website_url: 'https://example.edu/journal',
  author_guide_url: 'https://example.edu/guide',
  submission_url: 'https://example.edu/submission',
  third_party_links: [
    {label:'journal ranking',url:'https://example.edu/ranking'},
  ],
  issn: '0197-9337',
  eissn: '1096-9837',
  scope: 'Geomorphology',
  scope_zh: '地貌学',
  subject_tags: ['geomorphology', 'landslides'],
  selection_tags: ['priority target'],
  indexing: ['SCIE'],
  jcr_quartile: 'Q1',
  cas_quartile: '2',
  impact_factor: 4.2,
  oa_type: 'hybrid',
  apc_amount: 3500,
  apc_currency: 'USD',
  fee_notes: 'Check latest APC',
  first_decision_days: 36,
  total_review_days: 128,
  acceptance_rate: 19,
  risk_level: 'normal',
  is_favorite: true,
  priority: 'high',
  selection_notes: 'Appropriate scope',
  notes: 'Current submission profile',
}
const allowed = validateQiHubJournalProfile(values)
assert.equal(Object.keys(allowed).length, 30)
assert.deepEqual(allowed, values)
for (const invalid of [
  { ...values, id: journalId },
  { ...values, user_id: account },
  { ...values, apc_amount: -3 },
  { ...values, acceptance_rate: 120 },
  { ...values, first_decision_days: 12.5 },
  { ...values, oa_type: 'predatory' },
  { ...values, website_url: 'javascript:alert(1)' },
  { ...values, indexing: [42] },
  { ...values, third_party_links: [{ label: 'bad', url: 'data:plain' }] },
]) {
  assert.throws(() => validateQiHubJournalProfile(invalid))
}

let identity = account
let journal = null
let primaryLinked = false
let targetLinked = false
let race = false
const operations = []
const query = (table, action, payload) => {
  const filters = {}
  return {
    eq(field, value) {filters[field] = value; return this},
    contains(field, value) {filters[field] = value; return this},
    select() {return this},
    async maybeSingle() {
      if (table === 'manuscript_drafts') {
        return {
          data: filters.primary_journal_id === journalId && primaryLinked ||
            Array.isArray(filters.target_journal_ids) && targetLinked
            ? {id:'manuscript-1'} : null,
          error: null,
        }
      }
      assert.equal(table, 'journal_profiles')
      if (action === 'insert') {
        journal = {...payload, id:journalId, updated_at:before}
        operations.push({action,payload})
        return {data:structuredClone(journal),error:null}
      }
      const match = !!journal && (!filters.id || filters.id === journalId) &&
        (!filters.user_id || filters.user_id === account &&
          journal.user_id === account) &&
        (!filters.updated_at || filters.updated_at === journal.updated_at)
      if (!match) return {data:null,error:null}
      if (action === 'update') {
        if (race) {
          race = false
          journal.updated_at = '2026-11-19T05:00:00.000Z'
          return {data:null,error:null}
        }
        journal = {...journal,...payload}
        operations.push({action,payload})
      }
      if (action === 'delete') {
        const old = structuredClone(journal)
        journal = null
        operations.push({action})
        return {data:old,error:null}
      }
      return {data:structuredClone(journal),error:null}
    },
  }
}
const db = {
  auth: {getUser:async()=>({
    data:{user:identity ? {id:identity} : null},
    error:null,
  })},
  from(table) {return {
    select:()=>query(table,'read'),
    insert:payload=>query(table,'insert',payload),
    update:payload=>query(table,'update',payload),
    delete:()=>query(table,'delete'),
  }},
}

const created=await mutateQiHubJournalProfile({
  operation:'create',fields:values,
},db)
assert.equal(created.ok,true)
assert.equal(created.record.id,journalId)
assert.deepEqual(created.record.third_party_links,values.third_party_links)
assert.equal(operations.length,1)

let version=journal.updated_at
const changed=await mutateQiHubJournalProfile({
  operation:'update',id:journalId,expectedUpdatedAt:version,
  fields:{...values,name:'ESPL - revised'},
},db)
assert.equal(changed.ok,true)
assert.equal(journal.name,'ESPL - revised')
assert.equal(operations.length,2)
assert.deepEqual(Object.keys(operations[1].payload).sort(),
  [...Object.keys(values),'updated_at'].sort())
const stale=await mutateQiHubJournalProfile({
  operation:'update',id:journalId,expectedUpdatedAt:version,
  fields:values,
},db)
assert.equal(stale.conflict,true)
assert.equal(operations.length,2)

version=journal.updated_at
race=true
assert.equal((await mutateQiHubJournalProfile({
  operation:'update',id:journalId,expectedUpdatedAt:version,
  fields:values,
},db)).conflict,true)
assert.equal(operations.length,2)
version=journal.updated_at
primaryLinked=true
await assert.rejects(mutateQiHubJournalProfile({
  operation:'delete',id:journalId,expectedUpdatedAt:version,
},db),/QIHUB_JOURNAL_REFERENCED_BY_MANUSCRIPT/)
primaryLinked=false
targetLinked=true
await assert.rejects(mutateQiHubJournalProfile({
  operation:'delete',id:journalId,expectedUpdatedAt:version,
},db),/QIHUB_JOURNAL_REFERENCED_BY_MANUSCRIPT/)
targetLinked=false

identity='22222222-2222-2222-2222-222222222222'
assert.equal((await mutateQiHubJournalProfile({
  operation:'delete',id:journalId,expectedUpdatedAt:version,
},db)).conflict,true)
assert.equal(operations.length,2)
identity=account

const deleted=await mutateQiHubJournalProfile({
  operation:'delete',id:journalId,expectedUpdatedAt:version,
},db)
assert.equal(deleted.ok,true)
assert.equal(journal,null)
assert.equal(operations.length,3)
console.log('QiHub journals: all 30 fields, real server-row CRUD, CAS and reference guards PASS')
