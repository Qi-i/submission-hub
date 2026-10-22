import {createClient} from 'npm:@supabase/supabase-js@2.49.4'
const cors={'content-type':'application/json','cache-control':'no-store',
 'access-control-allow-origin':'https://qi-i.github.io',
 'access-control-allow-methods':'POST,OPTIONS',
 'access-control-allow-headers':'authorization,apikey,content-type'}
const result=(data:unknown,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:cors})
const tenant='common',base='https://login.microsoftonline.com/'+tenant+'/oauth2/v2.0/'
const SCOPES='offline_access User.Read Mail.Read Mail.Send'
const guid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
async function microsoft(path:'devicecode'|'token',body:Record<string,string>){
 const response=await fetch(base+path,{method:'POST',redirect:'error',
  headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams(body)})
 const text=await response.text()
 let data:Record<string,any>={}
 try{data=JSON.parse(text)}catch{}
 return {ok:response.ok,code:response.status,data}
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return result(null,204)
 if(req.method!=='POST')return result({error:'POST only'},405)
 const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!secret)return result({error:'Service unavailable'},500)
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})
 const auth=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 const user=await admin.auth.getUser(auth)
 if(user.error||!user.data.user)return result({error:'请先登录 Submission Hub'},401)
 let body:Record<string,unknown>
 try{body=await req.json()}catch{return result({error:'Invalid request'},400)}
 const id=String(body.account_id||'')
 if(!guid.test(id))return result({error:'Invalid account'},422)
 const found=await admin.from('mail_accounts').select('*').eq('id',id)
  .eq('user_id',user.data.user.id).eq('provider','outlook').maybeSingle()
 if(found.error||!found.data)return result({error:'Outlook 账户不存在或没有访问权限'},404)
 const account=found.data,action=String(body.action||'')
 if(action==='status'){
  const stored=await admin.rpc('mail_read_cloud_secret',{p_account_id:id})
  return result({connected:!!stored.data&&account.auth_kind==='oauth2',
    identity:account.oauth_identity||null,cloud_state:account.cloud_state})
 }
 if(action==='disconnect'){
  await admin.rpc('mail_clear_outlook_pending',{p_account_id:id})
  const cleared=await admin.rpc('mail_clear_cloud_secret',{p_account_id:id})
  if(cleared.error)return result({error:'撤销本地 OAuth 凭据失败'},500)
  const updated=await admin.from('mail_accounts').update({
   cloud_state:'oauth_required',auth_kind:'password',oauth_identity:null,oauth_scopes:null,
   last_error:null,next_attempt_at:null,consecutive_failures:0
  }).eq('id',id).eq('user_id',user.data.user.id)
  return updated.error?result({error:'本地连接状态更新失败'},500):result({ok:true,
   message:'已撤销 Submission Hub 保存的令牌；若需取消微软账户授权，请到 Microsoft 账户管理页面撤销应用权限。'})
 }
 if(action==='start'){
  // The website owner may register one public app for everyone. Users should
  // authenticate at Microsoft, not be forced into the Entra developer console.
  const managedId=String(Deno.env.get('MAIL_MICROSOFT_CLIENT_ID')||'').trim()
  const clientId=String(managedId||body.client_id||account.oauth_client_id||'').trim()
  if(!guid.test(clientId))return result({error:'站点尚未配置 Microsoft 公共客户端。网站管理员需配置 MAIL_MICROSOFT_CLIENT_ID，邮箱用户无需前往 Azure / Entra 注册应用。'},422)
  const response=await microsoft('devicecode',{client_id:clientId,scope:SCOPES})
  if(!response.ok)return result({error:'微软拒绝启动授权：'+String(response.data?.error_description||response.data?.error||response.code).slice(0,220)},422)
  const data=response.data
  if(!data.device_code||!data.user_code||!data.verification_uri)return result({error:'Microsoft 未返回完整授权信息'},502)
  const pending=await admin.rpc('mail_save_outlook_pending',{
   p_account_id:id,p_owner_id:user.data.user.id,p_device_code:data.device_code,
   p_seconds:Math.min(1800,Number(data.expires_in||900)),p_interval:Math.min(30,Number(data.interval||7))
  })
  if(pending.error)return result({error:'无法加密保存临时授权，请重试'},500)
  const saved=await admin.from('mail_accounts').update({
   oauth_client_id:clientId,cloud_state:account.cloud_state==='ready'?'ready':'oauth_required'
  }).eq('id',id).eq('user_id',user.data.user.id)
  if(saved.error)return result({error:'应用 ID 保存失败'},500)
  return result({ok:true,user_code:String(data.user_code).slice(0,30),
   verification_uri:'https://microsoft.com/devicelogin',
   expires_in:Number(data.expires_in||900),interval:Math.max(5,Number(data.interval||7)),
   message:'请在微软网页输入验证码并同意 Mail.Read/Mail.Send 权限，之后返回这里完成验证。'})
 }
 if(action==='poll'){
  if(!account.oauth_client_id)return result({error:'尚未配置 Microsoft 客户端 ID'},422)
  const pending=await admin.rpc('mail_load_outlook_pending',{p_account_id:id})
  const session=Array.isArray(pending.data)?pending.data[0]:null
  if(pending.error||!session)return result({error:'授权请求不存在，请重新开始'},404)
  if(Date.parse(session.expires_at)<Date.now()){
   await admin.rpc('mail_clear_outlook_pending',{p_account_id:id})
   return result({error:'授权码已过期，请重新获取'},410)
  }
  const interval=Math.max(5,Number(session.interval_seconds||7))
  if(session.last_polled_at && Date.now()-Date.parse(session.last_polled_at)<(interval-1)*1000)
   return result({pending:true,interval,message:'等待微软授权确认'},200)
  await admin.rpc('mail_poll_outlook_pending',{p_account_id:id})
  const token=await microsoft('token',{
   grant_type:'urn:ietf:params:oauth:grant-type:device_code',
   client_id:account.oauth_client_id,device_code:session.device_code
  })
  if(!token.ok){
   const e=String(token.data?.error||'')
   if(e==='authorization_pending'||e==='slow_down')
    return result({pending:true,interval:e==='slow_down'?interval+5:interval,
      message:e==='slow_down'?'微软要求降低轮询频率':'等待微软账户完成授权'})
   await admin.rpc('mail_clear_outlook_pending',{p_account_id:id})
   return result({error:'微软授权失败：'+String(token.data?.error_description||e||token.code).slice(0,180)},422)
  }
  const access=String(token.data.access_token||''),refresh=String(token.data.refresh_token||'')
  if(!access||!refresh)return result({error:'未取得可续期的 OAuth2 令牌；请确认开启 offline_access 权限'},422)
  const me=await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,id,displayName',
    {headers:{authorization:'Bearer '+access},redirect:'error'})
  if(!me.ok)return result({error:'授权成功，但 Graph /me 验证失败：HTTP '+me.status},422)
  const profile=await me.json()
  const graphEmail=String(profile.mail||profile.userPrincipalName||'').trim().toLowerCase()
  const expected=String(account.address||'').trim().toLowerCase()
  if(!graphEmail || graphEmail!==expected){
   await admin.rpc('mail_clear_outlook_pending',{p_account_id:id})
   return result({error:'已登录微软账户 '+(graphEmail||'(无邮箱)')+'，与当前登记的 '+expected+
    ' 不同。为避免归档错误邮箱，本次不保存令牌；请以该邮箱重新登录或核对账户地址。'},422)
  }
  const saved=await admin.rpc('mail_save_cloud_secret',{p_account_id:id,p_secret:refresh})
  if(saved.error)return result({error:'OAuth2 令牌无法加密存储'},500)
  await admin.rpc('mail_clear_outlook_pending',{p_account_id:id})
  const updated=await admin.from('mail_accounts').update({
   auth_kind:'oauth2',cloud_state:'ready',enabled:true,oauth_identity:graphEmail,
   oauth_scopes:String(token.data.scope||'').slice(0,500),
   last_error:null,next_attempt_at:null,consecutive_failures:0
  }).eq('id',id).eq('user_id',user.data.user.id)
  return updated.error?result({error:'授权完成但更新邮箱连接状态失败'},500):
    result({ok:true,connected:true,identity:graphEmail,message:'Outlook 已通过 OAuth2 授权，云端收信可用'})
 }
 return result({error:'Unsupported action'},400)
})