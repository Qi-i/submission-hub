import {createClient} from 'npm:@supabase/supabase-js@2.49.4'
const cors={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'https://qi-i.github.io','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'}
const reply=(data:unknown,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:cors})
const validHost=(h:string)=>/^(?=.{4,190}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(h)&&!/(^|\.)(local|localhost|internal|lan|home|onion|arpa|test|invalid)$/.test(h)
async function verifyUrl(raw:string){
 const u=new URL(raw)
 if(u.protocol!=='https:'||u.port||u.username||u.password||u.search||u.hash||!validHost(u.hostname))
  throw Error('API 地址必须是无附加凭据的公网 HTTPS URL（443 端口）')
 const a=await Deno.resolveDns(u.hostname,'A').catch(()=>[] as string[]) as string[]
 const b=await Deno.resolveDns(u.hostname,'AAAA').catch(()=>[] as string[]) as string[]
 // Advisory DNS data may be unavailable at Edge; HTTPS + cert verifies the API endpoint.
 if(a.some(ip=>{const p=ip.split('.').map(Number),[x,y]=p;return p.length!==4||p.some(n=>n<0||n>255)||x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||x===192&&y===168||x===100&&y>=64&&y<=127||x===192&&y===0||x===198&&y>=18&&y<=19})||b.some(ip=>/^(::|::1|f[cd]|fe[89ab]|ff|2001:db8)/i.test(ip)||/::ffff:/i.test(ip)))throw Error('API 地址解析到内网或保留地址')
 if(!u.pathname.endsWith('/chat/completions'))throw Error('请输入完整的 OpenAI 兼容 /chat/completions 地址')
 return u.href
}
const preset='https://api.z.ai/api/paas/v4/chat/completions'
async function modelTest(url:string,model:string,key:string){
 await verifyUrl(url)
 const t0=Date.now(),controller=new AbortController()
 const timer=setTimeout(()=>controller.abort(),19000)
 try{
  const result=await fetch(url,{method:'POST',redirect:'error',signal:controller.signal,headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content:'连接测试。请回复 OK'}],max_tokens:12,temperature:0})})
  if(!result.ok)return {ok:false,http_status:result.status,message:result.status===401?'API Key 无效或服务商拒绝授权':result.status===402?'服务商要求付费，已停止':result.status===403?'当前 Key 未获模型权限':result.status===429?'服务商限流':'模型服务返回 HTTP '+result.status,latency_ms:Date.now()-t0}
  const body=await result.json()
  const ok=Array.isArray(body?.choices)&&body.choices.length>0
  return {ok,message:ok?'模型 API 已返回有效响应':'接口返回成功，但响应结构与 OpenAI 格式不一致',latency_ms:Date.now()-t0}
 }catch(e){return {ok:false,message:e instanceof Error?e.message.slice(0,160):'连接失败',latency_ms:Date.now()-t0}}
 finally{clearTimeout(timer)}
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return reply(null,204)
 if(req.method!=='POST')return reply({error:'POST only'},405)
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!key)return reply({error:'Backend unavailable'},500)
 const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 const auth=await db.auth.getUser(jwt)
 if(auth.error||!auth.data.user)return reply({error:'登录已过期'},401)
 const userId=auth.data.user.id
 let body:Record<string,unknown>
 try{body=await req.json()}catch{return reply({error:'JSON 格式无效'},400)}
 const action=String(body.action||'')
 if(action==='save_key'){
  const secret=String(body.api_key||'').trim()
  if(secret.length<12||secret.length>2048)return reply({error:'请输入有效的 GLM API Key'},422)
  const saved=await db.rpc('mail_save_ai_key',{p_user_id:userId,p_secret:secret})
  if(saved.error)return reply({error:'API Key 保存失败'},500)
  const prefs=await db.from('mail_preferences').upsert({user_id:userId,ai_key_ready:true},{onConflict:'user_id'})
  return prefs.error?reply({error:'授权状态保存失败'},500):reply({ok:true,configured:true})
 }
 if(action==='check_key'){
  const r=await db.rpc('mail_read_ai_key',{p_user_id:userId})
  return reply({configured:!!r.data})
 }
 if(action==='test'){
  const prefs=await db.from('mail_preferences').select('ai_model').eq('user_id',userId).maybeSingle()
  const model=prefs.data?.ai_model||'glm-4.7-flash'
  if(!['glm-4.7-flash','glm-4.5-flash'].includes(model))return reply({error:'此测试仅支持 GLM 免费 Flash 模型'},422)
  const secret=await db.rpc('mail_read_ai_key',{p_user_id:userId})
  if(!secret.data)return reply({error:'请先保存 GLM API Key'},422)
  return reply(await modelTest(preset,model,secret.data))
 }
 if(action==='save_endpoint_key'||action==='test_endpoint'||action==='delete_endpoint'){
  const id=String(body.endpoint_id||'')
  if(!/^[a-f0-9-]{36}$/i.test(id))return reply({error:'模型服务编号无效'},422)
  const lookup=await db.from('mail_ai_endpoints').select('*').eq('id',id).eq('user_id',userId).maybeSingle()
  if(lookup.error||!lookup.data)return reply({error:'找不到当前用户的模型接口'},404)
  const endpoint=lookup.data
  if(action==='delete_endpoint'){
   const affected=await db.from('mail_preferences').select('ai_endpoint_id').eq('user_id',userId).maybeSingle()
   if(affected.data?.ai_endpoint_id===id)await db.from('mail_preferences').update({ai_endpoint_id:null,ai_enabled:false,ai_allow_paid:false}).eq('user_id',userId)
   const removed=await db.rpc('mail_destroy_endpoint_secret',{p_endpoint_id:id})
   if(removed.error)return reply({error:'无法清理加密凭据'},500)
   const deleted=await db.from('mail_ai_endpoints').delete().eq('id',id).eq('user_id',userId)
   return deleted.error?reply({error:'删除接口失败'},500):reply({ok:true})
  }
  try{await verifyUrl(endpoint.api_url)}catch(e){return reply({error:e instanceof Error?e.message:'接口地址不安全'},422)}
  if(action==='save_endpoint_key'){
   const secret=String(body.api_key||'').trim()
   if(secret.length<8||secret.length>4096)return reply({error:'请输入正确的 API Key'},422)
   const stored=await db.rpc('mail_save_endpoint_key',{p_endpoint_id:id,p_secret:secret})
   if(stored.error)return reply({error:'加密保存 API Key 失败'},500)
   const update=await db.from('mail_ai_endpoints').update({key_ready:true}).eq('id',id).eq('user_id',userId)
   return update.error?reply({error:'更新 Key 状态失败'},500):reply({ok:true,key_ready:true})
  }
  const keyInfo=await db.rpc('mail_read_endpoint_key',{p_endpoint_id:id})
  if(!keyInfo.data)return reply({error:'请先保存该模型的 Key'},422)
  const result=await modelTest(endpoint.api_url,endpoint.model,keyInfo.data)
  await db.from('mail_ai_endpoints').update({last_test_at:new Date().toISOString(),last_test_status:result.ok?'ok':'error: '+result.message}).eq('id',id).eq('user_id',userId)
  return reply(result)
 }
 return reply({error:'未知操作'},400)
})