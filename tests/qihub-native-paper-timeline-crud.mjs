import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/integrations/qihubPaperTimelineCrud.ts', import.meta.url), 'utf8')
const module = {exports:{}}
new Function('module','exports','require',ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText)(module,module.exports,name=>{
  if (name === '../lib/supabase') return {supabase:{}}
  throw Error('Unexpected import '+name)
})
const {validateQiHubPaperFields,validateQiHubTimelineFields,
  mutateQiHubPaper,mutateQiHubTimelineEvent} = module.exports
const user='11111111-1111-1111-1111-111111111111'
const stranger='22222222-2222-2222-2222-222222222222'
const paperId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const eventId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const stamp='2026-11-20T12:00:00.000Z'
const fields={
  title:'Alpine landslide processes',title_zh:'高山滑坡过程',journal:'Landslides',
  manuscript_no:'LAN-2026-001',submission_system:'Editorial Manager',
  system_status:'With Editor',last_status_date:'2026-11-20',
  next_action:'等待编辑处理',reminder_level:'watch',apc_amount:3000,
  apc_currency:'USD',revision_round:1,followup_log:'Sent query',
  doi:null,publication_info:null,citation:null,journal_url:'https://example.com',
  journal_apc_note:'Hybrid OA',status:'under_review',lang:'en',
  quartile_jcr:'Q1',quartile_cas:'一区',quartile_new:'无',quartile_cust:'无',
  quartile_zh:['CSCD'],authors:['Zhiqi Liu','Kai Chen'],
  corresponding_author:'Kai Chen',submitted_date:'2026-11-02',resolve_date:null,
  deadline:null,tracking_url:'https://example.com/track',published_url:null,
  timeline:'2026-11-02 Submitted',notes:'Original supporting material',prev_id:null,
}
assert.equal(Object.keys(validateQiHubPaperFields(fields)).length,35)
for (const wrong of [
  {...fields,id:paperId}, {...fields,files:[]}, {...fields,user_id:user},
  {...fields,title:''}, {...fields,apc_amount:-4}, {...fields,revision_round:1.5},
  {...fields,deadline:'2026-02-31'}, {...fields,tracking_url:'file:///x'},
  {...fields,status:'imaginary'}, {...fields,authors:[8]},
]) assert.throws(()=>validateQiHubPaperFields(wrong))
const timelineFields={paper_id:paperId,event_date:'2026-11-20',
  event_label:'With Editor',event_note:'Editor assigned'}
assert.deepEqual(validateQiHubTimelineFields(timelineFields),timelineFields)
assert.throws(()=>validateQiHubTimelineFields({...timelineFields,updated_at:stamp}))

let actor=user, paper=null, event=null, race=false
const writes=[]
function query(name,action,patch) {
  const filters={}
  return {
    eq(key,val){filters[key]=val;return this},
    is(key,val){filters[key]=val;return this},
    select(){return this},
    async maybeSingle(){
      if (name==='manuscript_drafts') return {data:null,error:null}
      const current=name==='papers'?paper:event
      if (action==='insert') {
        const row={...patch,id:name==='papers'?paperId:eventId,
          ...(name==='papers'?{updated_at:stamp}:{}),created_at:stamp}
        if (name==='papers') paper=row
        else event=row
        writes.push([name,action,patch])
        return {data:{...row},error:null}
      }
      if (!current || Object.entries(filters).some(([key,val])=>
        current[key]!==val)) return {data:null,error:null}
      if (action==='update') {
        if (race) {race=false;paper.updated_at='2026-11-20T13:00:00.000Z';return {data:null,error:null}}
        const row={...current,...patch}
        if (name==='papers') paper=row
        else event=row
        writes.push([name,action,patch])
        return {data:{...row},error:null}
      }
      if (action==='delete') {
        if (name==='papers') paper=null
        else event=null
        writes.push([name,action])
        return {data:{...current},error:null}
      }
      return {data:{...current},error:null}
    },
  }
}
const db={
  auth:{getUser:async()=>({data:{user:actor?{id:actor}:null},error:null})},
  from(table){return {
    select:()=>query(table,'read'),insert:data=>query(table,'insert',data),
    update:data=>query(table,'update',data),delete:()=>query(table,'delete'),
  }},
}
let created=await mutateQiHubPaper({operation:'create',fields},db)
assert.equal(created.ok,true)
assert.equal(created.record.files.length,0)
assert.equal(writes.length,1)
assert.equal(Object.hasOwn(writes[0][2],'updated_at'),false)
assert.equal(writes[0][2].user_id,user)
let old=paper.updated_at
let updated=await mutateQiHubPaper({operation:'update',id:paperId,
  expectedUpdatedAt:old,fields:{...fields,notes:'Android edited notes'}},db)
assert.equal(updated.ok,true)
assert.equal(paper.notes,'Android edited notes')
assert.equal(Object.hasOwn(writes[1][2],'files'),false)
assert.equal((await mutateQiHubPaper({operation:'update',id:paperId,
  expectedUpdatedAt:old,fields},db)).conflict,true)
old=paper.updated_at
race=true
assert.equal((await mutateQiHubPaper({operation:'update',id:paperId,
  expectedUpdatedAt:old,fields},db)).conflict,true)
old=paper.updated_at
actor=stranger
assert.equal((await mutateQiHubPaper({operation:'delete',id:paperId,
  expectedUpdatedAt:old},db)).conflict,true)
actor=user
paper.files=[{n:'manuscript.pdf',p:'private/real-file'}]
await assert.rejects(mutateQiHubPaper({operation:'delete',id:paperId,
  expectedUpdatedAt:old},db),/HAS_ATTACHMENTS/)
paper.files=[]

const e=await mutateQiHubTimelineEvent({operation:'create',fields:timelineFields},db)
assert.equal(e.ok,true)
assert.equal(event.paper_id,paperId)
await assert.rejects(mutateQiHubPaper({operation:'delete',id:paperId,
  expectedUpdatedAt:old},db),/HAS_LINKED_timeline_events/)
const oldEvent={...timelineFields}
const changed=await mutateQiHubTimelineEvent({operation:'update',id:eventId,
  previous:oldEvent,fields:{...timelineFields,event_label:'Out for Review',event_note:null}},db)
assert.equal(changed.ok,true)
assert.equal(event.event_note,null)
assert.equal((await mutateQiHubTimelineEvent({operation:'update',id:eventId,
  previous:oldEvent,fields:timelineFields},db)).conflict,true)
assert.equal((await mutateQiHubTimelineEvent({operation:'delete',id:eventId,
  previous:{...timelineFields,event_label:'Out for Review',event_note:null}},db)).ok,true)
assert.equal(event,null)
assert.equal((await mutateQiHubPaper({operation:'delete',id:paperId,
  expectedUpdatedAt:old},db)).ok,true)
assert.equal(paper,null)
console.log('QiHub original papers 35 fields + timeline source-owned CRUD/CAS PASS')
