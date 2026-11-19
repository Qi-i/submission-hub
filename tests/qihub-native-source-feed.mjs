import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const code = await readFile(
  new URL('../src/integrations/qihubReadOnlySnapshot.ts', import.meta.url),
  'utf8',
)
const exports = {}
const output = ts.transpileModule(code, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
new Function('exports', 'require', output)(exports, (name) => {
  if (name === '../lib/supabase') return { supabase: {} }
  if (name === '../lib/storage') return {
    isManagedStoredFile: reference =>
      typeof reference === 'string' &&
      (reference.startsWith('r2-storage://') ||
       reference.startsWith('supabase-storage://')),
    fetchStoredFile: async () => { throw Error('Unexpected live file fetch') },
  }
  throw Error('Unexpected native-feed import: ' + name)
})
const {
  collectQiHubReadOnlySnapshot,
  listQiHubPrivateAttachmentCandidates,
  readQiHubPrivateAttachment,
} = exports

const ACCOUNT = '11111111-1111-1111-1111-111111111111'
const TABLES = [
  'papers', 'timeline_events', 'journal_profiles',
  'research_topics', 'manuscript_drafts',
]

function makeFake() {
  const data = Object.fromEntries(TABLES.map(name => [name, []]))
  let actor = ACCOUNT
  let reads = 0
  let onRead = () => {}
  const calls = []
  return {
    data, calls,
    setUser: id => { actor = id },
    onRead: fn => { onRead = fn },
    auth: {
      getUser: async () => ({
        data: { user: actor ? { id: actor } : null },
        error: null,
      }),
    },
    from: table => ({
      select(columns) {
        assert.equal(columns, '*')
        assert.ok(TABLES.includes(table))
        return {
          eq(field, owner) {
            assert.equal(field, 'user_id')
            assert.equal(owner, ACCOUNT)
            return {
              order(column, options) {
                assert.equal(column, 'id')
                assert.equal(options.ascending, true)
                return {
                  async range(start, end) {
                    calls.push({ table, start, end })
                    onRead(++reads, table)
                    return {
                      data: data[table].slice(start, end + 1),
                      error: null,
                    }
                  },
                }
              },
            }
          },
        }
      },
    }),
  }
}

const fake = makeFake()
fake.data.papers = Array.from({ length: 210 }, (_, index) => ({
  id: 'paper-' + String(index).padStart(3, '0'),
  user_id: ACCOUNT,
  title: 'Real paper ' + index,
}))
fake.data.journal_profiles = [{
  id: 'journal-01', user_id: ACCOUNT, name: 'Real research journal',
}]
const snapshot = await collectQiHubReadOnlySnapshot(fake)
assert.equal(snapshot.project, 'submission')
assert.equal(snapshot.source, 'supabase-rls')
assert.equal(snapshot.accountId, ACCOUNT)
assert.equal(snapshot.complete, true)
assert.equal(snapshot.collections.papers.length, 210)
assert.equal(snapshot.collections.journal_profiles.length, 1)
assert.equal(fake.calls.filter(row => row.table === 'papers').length, 4,
  '210 records must be fully paged in BOTH independent scans')
assert.equal(fake.calls.some(row => row.start === 200), true)
assert.deepEqual(Object.keys(snapshot.collections), TABLES)
assert.equal(JSON.stringify(snapshot).includes('access_token'), false)

const changed = makeFake()
changed.data.papers = [{
  id: 'paper-1', user_id: ACCOUNT, title: 'Original paper',
}]
changed.onRead((n, table) => {
  if (n === 6 && table === 'papers') changed.data.papers[0].title = 'Updated'
})
await assert.rejects(
  collectQiHubReadOnlySnapshot(changed),
  /QIHUB_SOURCE_INVENTORY_CHANGED/,
)

const wrongOwner = makeFake()
wrongOwner.data.papers = [{
  id: 'paper-1', user_id: 'another-owner', title: 'Other account',
}]
await assert.rejects(
  collectQiHubReadOnlySnapshot(wrongOwner),
  /QIHUB_SOURCE_ACCOUNT_OR_ORDER_CHANGED/,
)

const signedOut = makeFake()
signedOut.setUser(null)
await assert.rejects(
  collectQiHubReadOnlySnapshot(signedOut),
  /QIHUB_SOURCE_SIGN_IN_REQUIRED/,
)

const switched = makeFake()
switched.onRead(n => { if (n === 6) switched.setUser('different-owner') })
await assert.rejects(
  collectQiHubReadOnlySnapshot(switched),
  /QIHUB_SOURCE_INVENTORY_CHANGED/,
)

const fileSource = makeFake()
fileSource.data.papers = [{
  id: 'paper-1',
  user_id: ACCOUNT,
  title: 'Real published manuscript',
  files: [
    {n: 'source.pdf', p: 'r2-storage://papers/private/test.pdf'},
    {n: 'external', p: 'https://example.com/unmanaged.pdf'},
  ],
}]
const refs = await listQiHubPrivateAttachmentCandidates(fileSource)
assert.equal(refs.accountId, ACCOUNT)
assert.deepEqual(refs.items, [{
  paperId: 'paper-1',
  reference: 'r2-storage://papers/private/test.pdf',
  fileName: 'source.pdf',
}])
const realFile = new TextEncoder().encode('GENUINE AUTHOR PAPER CONTENT').buffer
const attachmentClient = {
  auth: fileSource.auth,
  from: table => {
    assert.equal(table, 'papers')
    return {
      select: fields => {
        assert.equal(fields, 'id,user_id,files')
        return {
          eq: (field, owner) => {
            assert.equal(field, 'user_id')
            const ownerMatches = owner === ACCOUNT
            return {
              eq: (idField, id) => {
                assert.equal(idField, 'id')
                return {
                  maybeSingle: async () => ({
                    data: ownerMatches
                      ? fileSource.data.papers.find(p => p.id === id) || null
                      : null,
                    error: null,
                  }),
                }
              },
            }
          },
        }
      },
    }
  },
}
let actualReads = 0
const readSource = async (reference, name) => {
  actualReads++
  assert.equal(reference, 'r2-storage://papers/private/test.pdf')
  assert.equal(name, 'source.pdf')
  const blob = new Blob([realFile], {type: 'application/pdf'})
  return { blob, arrayBuffer: realFile }
}
const downloaded = await readQiHubPrivateAttachment(
  'paper-1', 'r2-storage://papers/private/test.pdf', 'source.pdf',
  attachmentClient, readSource,
)
assert.equal(downloaded.accountId, ACCOUNT)
assert.equal(downloaded.blob.size, realFile.byteLength)
assert.match(downloaded.sha256, /^[a-f0-9]{64}$/)
assert.equal(actualReads, 1)
await assert.rejects(
  readQiHubPrivateAttachment('paper-1', 'r2-storage://papers/not-in-paper',
    'source.pdf', attachmentClient, readSource),
  /QIHUB_ATTACHMENT_NOT_IN_PAPER/,
)
await assert.rejects(
  readQiHubPrivateAttachment('paper-1', 'r2-storage://papers/private/test.pdf',
    'wrong.pdf', attachmentClient, readSource),
  /QIHUB_ATTACHMENT_NOT_IN_PAPER/,
)
assert.equal(actualReads, 1,
  'Foreign/nonexistent references must fail before any storage GET')
fileSource.setUser('different-owner')
await assert.rejects(
  readQiHubPrivateAttachment('paper-1', 'r2-storage://papers/private/test.pdf',
    'source.pdf', attachmentClient, readSource),
  /QIHUB_ATTACHMENT_OWNERSHIP_UNVERIFIED|QIHUB_SOURCE_SIGN_IN_REQUIRED/,
)
console.log('QiHub native authenticated source feed: paginated + scoped + stable')
