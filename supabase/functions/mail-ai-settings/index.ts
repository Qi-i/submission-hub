import {createClient} from 'npm:@supabase/supabase-js@2.49.4'
const cors={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'https://qi-i.github.io','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'}
const reply=(data:unknown,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:cors})
const validHost=(h:string)=>/^(?=.{4,190}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(h)&&!/(^|\.)(local|localhost|internal|lan|home|onion|arpa|test|invalid)$/.test(h)
async function verifyUrl(raw:string){
 const u=new URL(raw)
 if(u.protocol!=='https:'||u.port||u.username||u.password||u.search||u.hash||!validHost(u.hostname))
  throw Error('API 地址必须是无附加凭据的公网 HTTPS URL（443 端口）')
 const a=await (typeof Deno.resolveDns==='function'?Deno.resolveDns(u.hostname,'A').catch(()=>[] as string[]):Promise.resolve([] as string[])) as string[]
 const b=await (typeof Deno.resolveDns==='function'?Deno.resolveDns(u.hostname,'AAAA').catch(()=>[] as string[]):Promise.resolve([] as string[])) as string[]
 // Advisory DNS data may be unavailable at Edge; HTTPS + cert verifies the API endpoint.
 if(a.some(ip=>{const p=ip.split('.').map(Number),[x,y]=p;return p.length!==4||p.some(n=>n<0||n>255)||x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||x===192&&y===168||x===100&&y>=64&&y<=127||x===192&&y===0||x===198&&y>=18&&y<=19})||b.some(ip=>/^(::|::1|f[cd]|fe[89ab]|ff|2001:db8)/i.test(ip)||/::ffff:/i.test(ip)))throw Error('API 地址解析到内网或保留地址')
 if(!u.pathname.endsWith('/chat/completions'))throw Error('请输入完整的 OpenAI 兼容 /chat/completions 地址')
 return u.href
}
const glmEndpoints={
 zai:'https://api.z.ai/api/paas/v4/chat/completions',
 bigmodel:'https://open.bigmodel.cn/api/paas/v4/chat/completions'
} as const
type GlmPlatform=keyof typeof glmEndpoints
function codeInfo(status:number,code:string,reason:string){
 if(status===429){
  if(code==='1113')return {category:'billing',message:'已连通服务商，但账户额度不足或 API Key 所属平台不匹配；这是额度/平台错误，不是请求限流。'}
  if(code==='1305')return {category:'busy',message:'服务端负载过高（1305），稍后重试；不需要重新填写 API Key。'}
  if(code==='1302')return {category:'rate_limited',message:'服务商限制了当前请求频率（1302），请稍后重试；不代表接口配置错误。'}
  return {category:'rate_limited',message:'接口返回 HTTP 429；需要查看业务错误码以区分额度、限流或服务繁忙。'+(reason?' '+reason:'')}
 }
 if(status===401)return {category:'auth',message:'API Key 被此平台拒绝（401）；请检查是国内 BigModel 还是国际 Z.AI 的 Key。'}
 if(status===403)return {category:'permission',message:'接口已访问，但当前 Key 无模型权限（403）。'}
 if(status===402)return {category:'billing',message:'服务商要求付费（402），未执行付费回退。'}
 if(status===400||status===404)return {category:'config',message:'模型或请求参数被服务商拒绝（HTTP '+status+'）。'+(reason?' '+reason:'')}
 return {category:'server',message:'服务商返回 HTTP '+status+(reason?'：'+reason:'')}
}
async function modelTest(url:string,model:string,key:string,timeoutMs=60000){
 await verifyUrl(url)
 const t0=Date.now(),controller=new AbortController()
 const timer=setTimeout(()=>controller.abort(),Math.min(80000,Math.max(15000,timeoutMs)))
 try{
  const result=await fetch(url,{method:'POST',redirect:'error',signal:controller.signal,headers:{
   Authorization:'Bearer '+key,'Content-Type':'application/json'
  },body:JSON.stringify({model,messages:[{role:'user',content:'连接测试。请回复 OK'}],max_tokens:16})})
  const raw=await result.text()
  let data:Record<string,any>={}
  try{data=JSON.parse(raw.slice(0,6000))}catch{}
  if(!result.ok){
   const biz=String(data?.error?.code??data?.code??'').slice(0,20)
   const hint=String(data?.error?.message??data?.message??'').replace(/https?:\/\/\S+/g,'[url]').slice(0,120)
   const info=codeInfo(result.status,biz,hint)
   const retryRaw=result.headers.get('retry-after')
   const retryNum=retryRaw?Number(retryRaw):NaN
   return {ok:false,reachable:true,http_status:result.status,code:biz||null,
    category:info.category,message:info.message,
    retry_after_seconds:Number.isFinite(retryNum)?Math.min(3600,Math.max(0,retryNum)):null,
    latency_ms:Date.now()-t0}
  }
  const ok=Array.isArray(data?.choices)&&data.choices.length>0
  return {ok,reachable:true,category:ok?'ok':'format',
   message:ok?'模型接口正常，已返回有效响应':'HTTP 200，但服务商响应结构与 Chat Completions 不一致',
   latency_ms:Date.now()-t0}
 }catch(e){return {ok:false,reachable:false,category:'network',
   message:'连接测试请求失败：'+(e instanceof Error?e.message.slice(0,110):'网络异常'),latency_ms:Date.now()-t0}}
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
  const prefs=await db.from('mail_preferences').select('ai_model,ai_glm_platform,ai_max_wait_seconds,ai_slow_mode,ai_glm_probe_times').eq('user_id',userId).maybeSingle()
  const model=String(body.model||prefs.data?.ai_model||'glm-4.7-flash')
  if(!['glm-4.7-flash','glm-4.5-flash'].includes(model))return reply({error:'此测试仅支持 GLM 免费 Flash 模型'},422)
  const secret=await db.rpc('mail_read_ai_key',{p_user_id:userId})
  if(!secret.data)return reply({error:'请先保存 GLM API Key'},422)
  const preferred:GlmPlatform=prefs.data?.ai_glm_platform==='bigmodel'?'bigmodel':'zai'
  const timeoutMs=Math.min(80000,Math.max(20000,Number(prefs.data?.ai_max_wait_seconds||65)*1000))
  const first=await modelTest(glmEndpoints[preferred],model,secret.data,timeoutMs)
  if(first.ok){
   await db.from('mail_preferences').update({ai_glm_probe_ms:Math.round(first.latency_ms),ai_glm_probe_times:{...(prefs.data?.ai_glm_probe_times||{}),[model]:Math.round(first.latency_ms)}}).eq('user_id',userId)
   return reply({...first,platform:preferred})
  }
  if(body.auto_detect===true){
   const alternative:GlmPlatform=preferred==='zai'?'bigmodel':'zai'
   const second=await modelTest(glmEndpoints[alternative],model,secret.data,timeoutMs)
   if(second.ok){
    await db.from('mail_preferences').update({ai_glm_platform:alternative,ai_glm_probe_ms:Math.round(second.latency_ms),ai_glm_probe_times:{...(prefs.data?.ai_glm_probe_times||{}),[model]:Math.round(second.latency_ms)},ai_enabled:false})
     .eq('user_id',userId)
    return reply({...second,platform:alternative,switched:true,
      message:'自动检测成功：此 Key 可在'+(alternative==='bigmodel'?'国内 BigModel':'国际 Z.AI')+'使用。平台已切换，后台自动分析保持关闭。'})
   }
   return reply({...first,platform:preferred,
    alternate:{platform:alternative,category:second.category,http_status:second.http_status,code:second.code},
    message:first.message+' 另一官方平台同样未通过测试（'+second.category+'）。可手动选择平台后重试。'})
  }
  return reply({...first,platform:preferred})
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
  const pref=await db.from('mail_preferences').select('ai_max_wait_seconds').eq('user_id',userId).maybeSingle()
  const timeoutMs=Math.min(80000,Math.max(20000,Number(pref.data?.ai_max_wait_seconds||65)*1000))
  const result=await modelTest(endpoint.api_url,endpoint.model,keyInfo.data,timeoutMs)
  await db.from('mail_ai_endpoints').update({last_test_at:new Date().toISOString(),last_test_status:result.ok?'ok':'error: '+result.message,last_test_latency_ms:result.ok?Math.round(result.latency_ms):endpoint.last_test_latency_ms}).eq('id',id).eq('user_id',userId)
  return reply(result)
 }
 return reply({error:'未知操作'},400)
})