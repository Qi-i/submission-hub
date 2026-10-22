// Privileged, synthetic-only network probe. Never reads mail bodies, never
// returns provider credentials and never invokes a fee-enabled model.
import {createClient} from 'npm:@supabase/supabase-js@2.49.4'
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',
  'Access-Control-Allow-Origin':'https://qi-i.github.io'}
})
Deno.serve(async req=>{
 if(req.method!=='POST')return response({error:'POST only'},405)
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!key)return response({error:'Service configuration unavailable'},503)
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 if(!bearer)return response({error:'Unauthorized'},401)
 const check=await admin.rpc('mail_check_cron_token',{p_token:bearer})
 if(check.error||check.data!==true)return response({error:'Unauthorized'},403)
 let body:Record<string,unknown>
 try{body=await req.json()}catch{return response({error:'Invalid JSON'},400)}
 if(body.action!=='magiczotero_test')return response({error:'Unsupported diagnostic'},422)
 const medium=body.level==='medium'
 if(body.level!=='short'&&!medium)return response({error:'Invalid test level'},422)
 const dest='https://gpt.magiczotero.top/v1/chat/completions'
 const list=await admin.from('mail_ai_endpoints').select('id,api_url,model,declared_free,allow_paid,key_ready')
  .eq('api_url',dest).eq('model','magic-translate-gpt')
  .eq('declared_free',true).eq('allow_paid',false).eq('key_ready',true).limit(1)
 if(list.error||!list.data?.length)return response({error:'No authorized free MagicZotero endpoint'},422)
 const endpoint=list.data[0]
 const secret=await admin.rpc('mail_read_endpoint_key',{p_endpoint_id:endpoint.id})
 if(secret.error||!secret.data)return response({error:'Saved credential unavailable'},422)
 const synthetic=medium
  ?Array.from({length:7},(_,i)=>'Paragraph '+(i+1)+': The authors conducted a systematic landslide susceptibility evaluation, verified spatial cross-validation, and retained the DOI 10.1016/j.enggeo.2026.123456.').join('\n')
  :'Translate to Chinese: The revised manuscript requires further editing.'
 const controller=new AbortController(),t0=Date.now()
 const timer=setTimeout(()=>controller.abort(),medium?40000:25000)
 try{
  const res=await fetch(dest,{method:'POST',redirect:'error',signal:controller.signal,
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+secret.data},
   body:JSON.stringify({model:endpoint.model,stream:false,temperature:0.3,
    max_tokens:medium?850:90,messages:[{role:'user',content:synthetic}]})})
  const json=await res.json().catch(()=>null)
  const providerCode=String(json?.error?.code??json?.code??'').replace(/[^a-z0-9_-]/gi,'').slice(0,25)||null
  return response({ok:res.ok&&!!json?.choices?.[0]?.message?.content,status:res.status,
   elapsed_ms:Date.now()-t0,provider_code:providerCode,
   served_model:typeof json?.model==='string'?json.model.slice(0,90):null,
   finish_reason:json?.choices?.[0]?.finish_reason??null,
   usage_tokens:Number.isFinite(Number(json?.usage?.total_tokens))?Number(json.usage.total_tokens):null})
 }catch(e){
  const message=e instanceof Error?e.message:'Unknown network error'
  return response({ok:false,network_error:true,elapsed_ms:Date.now()-t0,
   timeout:controller.signal.aborted,
   category:/timed?\s*out|110|Timeout/i.test(message)||controller.signal.aborted?'timeout':'network'})
 }finally{clearTimeout(timer)}
})
