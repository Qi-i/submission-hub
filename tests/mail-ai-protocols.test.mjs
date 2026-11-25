import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {normalizeEndpoint,checkedEndpoint,buildAiRequest,extractAiText,authOf,routeFields} from '../supabase/functions/_shared/ai-protocol.mjs'
import {taskPolicy,endpointEligible} from '../supabase/functions/_shared/ai-task-policy.mjs'
import {modelBase,modelCatalogRequest,catalogPage,sharedModelUrl} from '../supabase/functions/_shared/ai-model-catalog.mjs'
import {ledgerEvidenceId,buildLedgerDraft} from '../supabase/functions/_shared/ai-ledger-draft.mjs'

const fixtures=[
 {protocol:'chat',auth:'bearer',model:'test-chat',base:'https://api.example.com/v1',url:'https://api.example.com/v1/chat/completions',response:{choices:[{finish_reason:'stop',message:{content:'OK'}}]}},
 {protocol:'messages',auth:'x-api-key',model:'test-claude',base:'https://api.example.com/v1',url:'https://api.example.com/v1/messages',response:{stop_reason:'end_turn',content:[{type:'thinking',thinking:'private'},{type:'text',text:'O'},{type:'text',text:'K'}]}},
 {protocol:'responses',auth:'bearer',model:'test-responses',base:'https://api.example.com/v1',url:'https://api.example.com/v1/responses',response:{status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'O'},{type:'output_text',text:'K'}]}]}},
 {protocol:'gemini',auth:'x-goog-api-key',model:'test-gemini',base:'https://api.example.com/v1beta',url:'https://api.example.com/v1beta/models/test-gemini:generateContent',response:{candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private'},{text:'OK'}]}}]}}
]
test('all four protocols build correct requests and extract only visible complete text',()=>{
 for(const f of fixtures){
  assert.equal(normalizeEndpoint(f.base,f.protocol,f.model),f.url)
  assert.equal(normalizeEndpoint(f.url,f.protocol,f.model),f.url)
  const request=buildAiRequest({...f,key:'synthetic-test-key'},{system:'system rules',user:'input text',maxTokens:512,temperature:0})
  assert.equal(request.headers['Content-Type'],'application/json')
  if(f.auth==='bearer')assert.equal(request.headers.Authorization,'Bearer synthetic-test-key')
  else assert.equal(request.headers[f.auth],'synthetic-test-key')
  if(f.protocol==='chat'){assert.equal(request.body.max_tokens,512);assert.equal(request.body.messages[0].role,'system')}
  if(f.protocol==='messages'){assert.equal(request.headers['anthropic-version'],'2023-06-01');assert.equal(request.body.system,'system rules');assert.equal(request.body.max_tokens,512)}
  if(f.protocol==='responses'){assert.equal(request.body.max_output_tokens,512);assert.equal(request.body.instructions,'system rules');assert.equal(request.body.store,false);assert.equal(request.body.input,'input text');assert.ok(!('messages' in request.body))}
  if(f.protocol==='gemini'){assert.equal(request.body.generationConfig.maxOutputTokens,512);assert.equal(request.body.systemInstruction.parts[0].text,'system rules')}
  assert.equal(extractAiText(f.protocol,f.response),'OK')
 }
 const newChat=buildAiRequest({model:'test',key:'test-key',tokenField:'max_completion_tokens'},{user:'hello',temperature:0,maxTokens:128})
 assert.equal(newChat.body.max_completion_tokens,128)
 assert.ok(!('max_tokens' in newChat.body)&&!('temperature' in newChat.body))
 assert.deepEqual(routeFields({}),{protocol:'chat',auth:'bearer',tokenField:'max_tokens'})
 assert.equal(authOf('messages','bearer'),'bearer')
 assert.throws(()=>authOf('chat','x-api-key'))
})
test('rejects refusals, truncation, tool-only and provider errors instead of caching partial translations',()=>{
 assert.equal(extractAiText('chat',{choices:[{finish_reason:'length',message:{content:'partial'}}]}),null)
 assert.equal(extractAiText('chat',{choices:[{finish_reason:'stop',message:{content:'no',refusal:'refused'}}]}),null)
 assert.equal(extractAiText('messages',{stop_reason:'max_tokens',content:[{type:'text',text:'partial'}]}),null)
 assert.equal(extractAiText('messages',{stop_reason:'tool_use',content:[{type:'text',text:'partial'}]}),null)
 assert.equal(extractAiText('responses',{status:'incomplete',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'partial'}]}]}),null)
 assert.equal(extractAiText('responses',{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'no'}]}]}),null)
 assert.equal(extractAiText('gemini',{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'partial'}]}}]}),null)
 assert.equal(extractAiText('chat',{error:'bad request'}),null)
})
test('custom destinations must be HTTPS, protocol-matched, public DNS with no embedded credentials',async()=>{
 for(const raw of ['http://api.example.com/v1','https://127.0.0.1/v1','https://foo.local/v1','https://user:password@api.example.com/v1','https://api.example.com/v1?api_key=secret','https://api.example.com:8080/v1','https://api.example.com/v1/messages']){
  assert.throws(()=>normalizeEndpoint(raw,'chat','m'))
 }
 const resolver=addresses=>async(_,type)=>type==='A'?addresses:[]
 assert.equal(await checkedEndpoint(fixtures[0].url,'chat','m',resolver(['8.8.8.8'])),fixtures[0].url)
 for(const addresses of [[],['10.0.0.1'],['169.254.169.254'],['8.8.8.8','192.168.0.1'],['100.64.0.1']]){
  await assert.rejects(checkedEndpoint(fixtures[0].url,'chat','m',resolver(addresses)))
 }
 await assert.rejects(checkedEndpoint(fixtures[0].url,'chat','m',async(_,type)=>type==='AAAA'?['::ffff:127.0.0.1']:[]))
})
test('server integration shares one adapter, keeps credentials version-bound and forbids paid translation',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
 for(const name of ['mail-translate','mail-ai-analyze','mail-ai-settings']){
  const source=read('supabase/functions/'+name+'/index.ts')
  assert.match(source,/buildAiRequest\(/);assert.match(source,/extractAiText\(/)
  assert.match(source,/mail_read_endpoint_key_for_config/)
  assert.match(source,/redirect:'error'/)
 }
 const translate=read('supabase/functions/mail-translate/index.ts')
 assert.match(translate,/endpointEligible\(ep,'mail_translation',policy\)/)
 const sql=read('supabase/044_mail_ai_protocols.sql')
 assert.match(sql,/api_protocol text not null default 'chat'/)
 assert.match(sql,/config_revision=p_revision for update/)
 assert.match(sql,/revoke insert, update, delete on public\.mail_ai_endpoints from authenticated/)
 assert.match(sql,/revoke all on function public\.mail_read_endpoint_key_for_config\(uuid,uuid\) from public,anon,authenticated/)
})

test('all four task policies can inherit, diverge, disable and preserve ordered candidates',()=>{
 const a='endpoint:11111111-1111-1111-1111-111111111111'
 const b='endpoint:22222222-2222-2222-2222-222222222222'
 const pref={ai_endpoint_id:a.slice(9),ai_task_routes:{
   mail_analysis:{routes:[b,a,b],allowPaid:true},
   ledger_text:{routes:[a],allowPaid:true},ledger_vision:{routes:[],allowPaid:false}
 }}
 assert.deepEqual(taskPolicy(pref,'mail_translation').routes,[a])
 assert.deepEqual(taskPolicy(pref,'mail_analysis').routes,[b,a])
 assert.equal(taskPolicy(pref,'mail_analysis').fallback,true)
 assert.deepEqual(taskPolicy(pref,'ledger_vision').routes,[])
 const verified={key_ready:true,last_test_status:'ok',declared_free:false,allow_paid:true,vision_test_status:'ok'}
 assert.equal(endpointEligible(verified,'mail_translation',taskPolicy(pref,'mail_translation'),{consent:true}),false)
 assert.equal(endpointEligible(verified,'mail_analysis',taskPolicy(pref,'mail_analysis')),false)
 assert.equal(endpointEligible(verified,'ledger_text',taskPolicy(pref,'ledger_text')),false)
 assert.equal(endpointEligible(verified,'ledger_text',taskPolicy(pref,'ledger_text'),{consent:true}),true)
 assert.equal(endpointEligible({...verified,declared_free:true,vision_test_status:null},'ledger_vision',taskPolicy(pref,'ledger_vision')),false)
 assert.equal(endpointEligible({...verified,declared_free:true},'ledger_vision',taskPolicy(pref,'ledger_vision')),true)
 assert.equal(endpointEligible({...verified,key_ready:false},'ledger_text',taskPolicy(pref,'ledger_text'),{consent:true}),false)
})
test('multimodal inputs map to the actual image structures of all four protocols',()=>{
 const image={mime:'image/png',data:'aGVsbG8='}
 for(const f of fixtures){
  const r=buildAiRequest({...f,key:'test-key'},{user:'bill image',images:[image]})
  const body=r.body
  if(f.protocol==='chat')assert.equal(body.messages.at(-1).content[1].image_url.url,'data:image/png;base64,aGVsbG8=')
  if(f.protocol==='messages')assert.deepEqual(body.messages[0].content[1].source,{type:'base64',media_type:'image/png',data:'aGVsbG8='})
  if(f.protocol==='responses')assert.equal(body.input[0].content[1].type,'input_image')
  if(f.protocol==='gemini')assert.deepEqual(body.contents[0].parts[1].inlineData,{mimeType:'image/png',data:'aGVsbG8='})
 }
 assert.throws(()=>buildAiRequest({model:'test',key:'test-key'},{user:'bill',images:[{mime:'text/html',data:'aGVsbG8='}]}))
})

test('model discovery uses only the existing provider base and preserves protocol-specific auth',()=>{
 for(const f of fixtures){
  const e={api_url:f.url,model:f.model,api_protocol:f.protocol,auth_scheme:f.auth}
  assert.equal(modelBase(e),f.base)
  const r=modelCatalogRequest(e,'test-key','https://evil.example/next')
  assert.equal(new URL(r.url).origin,new URL(f.url).origin)
  assert.equal(new URL(r.url).pathname,new URL(f.base+'/models').pathname)
  assert.equal(r.headers.Authorization??r.headers[f.auth],f.auth==='bearer'?'Bearer test-key':'test-key')
  assert.equal(sharedModelUrl(e,'new-model'),f.protocol==='gemini'?f.base+'/models/new-model:generateContent':f.url)
 }
 assert.deepEqual(catalogPage('messages',{data:[{id:'model-a',display_name:'A'},{id:'model-a'},{id:'bad id'}],has_more:true,last_id:'model-a'}),{models:[{id:'model-a',label:'A'}],next:'model-a'})
 assert.deepEqual(catalogPage('gemini',{models:[{name:'models/vision',supportedGenerationMethods:['generateContent']},{name:'models/embed',supportedGenerationMethods:['embedContent']}]}).models,[{id:'vision',label:'vision'}])
 assert.throws(()=>sharedModelUrl({api_url:fixtures[3].url,model:fixtures[3].model,api_protocol:'gemini'},'../redirect'))
})
test('shared credentials remain owner-scoped and version-bound; deleted default pauses inherited tasks',()=>{
 const sql=readFileSync(new URL('../supabase/044_mail_ai_protocols.sql',import.meta.url),'utf8')
 assert.match(sql,/root.user_id=e.user_id and root.credential_source_id is null and root.key_ready/)
 assert.match(sql,/where c.credential_source_id=new.id and c.user_id=new.user_id/)
 assert.match(sql,/if exists\(select 1 from public.mail_ai_endpoints where credential_source_id=p_id\) then return false/)
 assert.match(sql,/delete from vault.secrets where id=sid/)
 assert.deepEqual(taskPolicy({ai_shared_disabled:true},'ledger_text').routes,[])
 assert.deepEqual(taskPolicy({ai_task_routes:{ledger_text:{oops:true}}},'ledger_text').routes,[])
})
test('all clients receive one stable sparse import batch without inventing dates or currency',async()=>{
 const batchId=await ledgerEvidenceId('  lunch  ',[{data:'aGVsbG8='},{data:'d29ybGQ='}])
 assert.equal(batchId,await ledgerEvidenceId('lunch',[{data:'d29ybGQ='},{data:'aGVsbG8='}]))
 const evidence={name:'午餐',amount:12.5,income:false,kind:'ordinary',date:'2026-11-25',operation:{currency:'CNY',amountMinor:1250,occurredAt:'2026-11-25',source:{platform:'test',orderId:'a'}}}
 const batch=await buildLedgerDraft(batchId,[evidence,evidence,{name:'unknown',amount:5,kind:'refund',operation:{currency:'JPY',amountMinor:5,originalTransactionRef:'old'}}])
 assert.equal(batch.operations[0].amountMinor,1250)
 assert.equal(batch.operations[0].occurredAt,undefined)
 assert.notEqual(batch.operations[0].clientId,batch.operations[1].clientId)
 assert.equal(batch.operations[2].amountMinor,5)
 assert.equal(batch.operations[2].type,'refund.create')
 assert.equal(batch.operations[2].originalTransactionRef,'old')
 assert.deepEqual(await buildLedgerDraft(batchId,[evidence]),await buildLedgerDraft(batchId,[evidence]))
 const missing=(await buildLedgerDraft(batchId,[{name:'unknown',amount:8,kind:'ordinary'}])).operations[0]
 assert.equal(missing.currency,null);assert.equal(missing.amountMinor,null);assert.equal(missing.type,null)
 const conflict=(await buildLedgerDraft(batchId,[{...evidence,operation:{currency:'CNY',amountMinor:100}}])).operations[0]
 assert.equal(conflict.amountMinor,null)
})
