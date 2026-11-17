import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

// Execute the production three-way merge without a database or Actions.
const source=readFileSync(new URL('../src/lib/paper-field-merge.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
}).outputText
const {changedPaperFields,rebasePaperFields,paperFieldEqual}=await import(
  'data:text/javascript;base64,'+Buffer.from(js).toString('base64'))

const base={
  title:'Landslide susceptibility',notes:'Initial note',status:'preparing',
  authors:['A','B'],deadline:null,files:[],updated_at:'2026-11-16T09:00:00Z',
}
assert.deepEqual(changedPaperFields(base,{
  ...base,deadline:'',files:null,
  updated_at:'2026-11-17T15:00:00Z',
}),{},'Empty strings and empty collections are no-op; timestamps are not edits')

const notesOnly=changedPaperFields(base,{...base,notes:'Revised note'})
assert.deepEqual(notesOnly,{notes:'Revised note'},
  'Full-form save must send only the changed notes field')
const remoteStatus={...base,status:'under_review',updated_at:'2026-11-17T10:00:00Z'}
assert.deepEqual(rebasePaperFields(base,remoteStatus,notesOnly),{
  patch:{notes:'Revised note'},conflicts:[],
},'Editing notes must not conflict with a simultaneous review-status update')

assert.deepEqual(rebasePaperFields(base,{
  ...remoteStatus,notes:'Revised note',
},notesOnly),{patch:{},conflicts:[]},
'An already-applied identical edit must not be written twice')

assert.deepEqual(rebasePaperFields(base,{
  ...remoteStatus,notes:'Changed by colleague',
},notesOnly),{patch:{},conflicts:['notes']},
'Only a truly overlapping, differently edited field requires review')

const fields=changedPaperFields(base,{
  ...base,authors:['A','B','C'],notes:'Initial note',status:'preparing',
})
assert.deepEqual(fields,{authors:['A','B','C']})
assert.equal(paperFieldEqual({a:1,b:2},{b:2,a:1}),true,
  'Object property order is not a business change')
assert.equal(paperFieldEqual(['A','B'],['B','A']),false,
  'Author order is meaningful')
console.log('Manuscript CAS field merge: no-op, partial edit, safe rebase, real conflicts passed')
