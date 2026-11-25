import {createClient} from 'npm:@supabase/supabase-js@2.49.4'
import {buildAiRequest,extractAiText,checkedEndpoint,routeFields} from '../_shared/ai-protocol.mjs'
const cors={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'https://qi-i.github.io','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'}
const reply=(data:unknown,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:cors})
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
async function modelTest(url:string,model:string,key:string,timeoutMs=60000,config:{protocol?:string;auth?:string;tokenField?:string}={},vision=false){
 const t0=Date.now(),controller=new AbortController()
 const timer=setTimeout(()=>controller.abort(),Math.min(90000,Math.max(15000,timeoutMs)))
 try{
  const request=buildAiRequest({model,key,...config},vision?{user:'What is the dominant color in the image? Reply with only the English color name.',maxTokens:512,images:[{mime:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAARUlEQVR4nO3OsQEAEADAMPz/M7slI0NzQeYef1mvA7dCUkgKSSEpJIWkkBSSQlJICkkhKSSFpJAUkkJSSApJISkkhaSQHEnhAV+0eRpfAAAAAElFTkSuQmCC'}]}:{user:'连接测试。请回复 OK',maxTokens:512})
  const result=await fetch(url,{method:'POST',redirect:'error',signal:controller.signal,
   headers:request.headers,body:JSON.stringify(request.body)})
  const raw=await result.text()
  let data:Record<string,any>={}
  try{if(raw.length<=256000)data=JSON.parse(raw)}catch{}
  if(!result.ok){
   const biz=String(data?.error?.code??data?.code??'').slice(0,20)
   const hint='' // Do not echo upstream errors, which may contain credentials.
   const info=codeInfo(result.status,biz,hint)
   const retryRaw=result.headers.get('retry-after')
   const retryNum=retryRaw?Number(retryRaw):NaN
   return {ok:false,reachable:true,http_status:result.status,code:biz||null,
    category:info.category,message:info.message,
    retry_after_seconds:Number.isFinite(retryNum)?Math.min(3600,Math.max(0,retryNum)):null,
    latency_ms:Date.now()-t0}
  }
  const output=extractAiText(config.protocol,data)
  const ok=vision?!!output&&/^red[.!\s]*$/i.test(output.trim()):!!output
  return {ok,reachable:true,category:ok?'ok':'format',
   message:ok?'模型接口正常，已返回有效文本':'HTTP 200，但没有获得完整文本，请核对协议、模型和输出参数',
   latency_ms:Date.now()-t0}
 }catch(e){return {ok:false,reachable:false,category:'network',
   message:'连接测试请求失败，请检查网络、TLS 或超时',latency_ms:Date.now()-t0}}
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
  const timeoutMs=Math.min(90000,Math.max(20000,Number(prefs.data?.ai_max_wait_seconds||65)*1000))
  const first=await modelTest(glmEndpoints[preferred],model,secret.data,timeoutMs)
  if(first.ok){
   await db.from('mail_preferences').update({ai_glm_probe_ms:Math.round(first.latency_ms),ai_glm_probe_times:{...(prefs.data?.ai_glm_probe_times||{}),[model]:Math.round(first.latency_ms)}}).eq('user_id',userId)
   return reply({...first,platform:preferred})
  }
  if(body.auto_detect===true){
   const alternative:GlmPlatform=preferred==='zai'?'bigmodel':'zai'
   const second=await modelTest(glmEndpoints[alternative],model,secret.data,Math.min(45000,timeoutMs))
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
 if(action==='save_endpoint_key'||action==='test_endpoint'||action==='test_vision'||action==='delete_endpoint'){
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
  let config:ReturnType<typeof routeFields>,destination:string
  try{config=routeFields(endpoint);destination=await checkedEndpoint(endpoint.api_url,config.protocol,endpoint.model,Deno.resolveDns?.bind(Deno))}
  catch(e){return reply({error:e instanceof Error?e.message:'接口地址不安全'},422)}
  if(action==='save_endpoint_key'){
   if(body.config_revision!==endpoint.config_revision)return reply({error:'接口配置已改变，请重新加载后授权'},409)
   const secret=String(body.api_key||'').trim()
   if(secret.length<8||secret.length>4096)return reply({error:'请输入正确的 API Key'},422)
   const stored=await db.rpc('mail_save_endpoint_key_for_config',{p_endpoint_id:id,p_revision:endpoint.config_revision,p_secret:secret})
   if(stored.error)return reply({error:'加密保存 API Key 失败'},500)
   return stored.data===true?reply({ok:true,key_ready:true}):reply({error:'接口配置已改变，请重新加载后授权'},409)
  }
  if(!endpoint.key_ready)return reply({error:'请先为当前配置保存 Key'},422)
  if(!endpoint.declared_free&&body.allow_paid_test!==true)return reply({error:'此接口可能收费，需明确同意本次测试'},422)
  const keyInfo=await db.rpc('mail_read_endpoint_key_for_config',{p_endpoint_id:id,p_revision:endpoint.config_revision})
  if(!keyInfo.data)return reply({error:'请先保存该模型的 Key'},422)
  const pref=await db.from('mail_preferences').select('ai_max_wait_seconds').eq('user_id',userId).maybeSingle()
  const timeoutMs=Math.min(90000,Math.max(20000,Number(pref.data?.ai_max_wait_seconds||65)*1000))
  const vision=action==='test_vision'
  const result=await modelTest(destination,endpoint.model,keyInfo.data,timeoutMs,config,vision)
  const verified=await db.from('mail_ai_endpoints').update(vision?{vision_test_status:result.ok?'ok':'error: '+result.message}:{last_test_at:new Date().toISOString(),last_test_status:result.ok?'ok':'error: '+result.message,last_test_latency_ms:result.ok?Math.round(result.latency_ms):endpoint.last_test_latency_ms}).eq('id',id).eq('user_id',userId).eq('config_revision',endpoint.config_revision).select('id').maybeSingle()
  if(verified.error||!verified.data)return reply({error:'测试期间配置改变，请重新测试'},409)
  return reply(result)
 }
 return reply({error:'未知操作'},400)
})
