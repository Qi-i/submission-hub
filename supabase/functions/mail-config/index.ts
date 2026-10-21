import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
const ORIGINS=['https://qi-i.github.io','http://localhost:5173','http://127.0.0.1:5173']
function response(body:unknown,status=200,origin=''){
  return new Response(status===204?null:JSON.stringify(body),{status,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'Access-Control-Allow-Origin':ORIGINS.includes(origin)?origin:'https://qi-i.github.io',
    'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type'
  }})
}
function allowedHost(host:string,provider:string){
  const suffixes:Record<string,string[]>={
    coremail:['xju.edu.cn','cugb.edu.cn'],
    qq:['imap.qq.com'], '126':['imap.126.com'],
  }
  if(!/^[a-z0-9.-]{4,180}$/.test(host)||host.includes('..'))return false
  return (suffixes[provider]||[]).some(s=> host===s||host.endsWith('.'+s))
}
Deno.serve(async req=>{
  const origin=req.headers.get('origin')||''
  if(req.method==='OPTIONS')return response(null,204,origin)
  if(req.method!=='POST')return response({error:'POST only'},405,origin)
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer /i,'')
  if(!jwt)return response({error:'Sign in required'},401,origin)
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!service)return response({error:'Server is not configured'},500,origin)
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const auth=await admin.auth.getUser(jwt)
  if(auth.error||!auth.data.user)return response({error:'Invalid login'},401,origin)
  const userId=auth.data.user.id
  let body:Record<string,unknown>
  try {body=await req.json()} catch{return response({error:'Invalid JSON'},400,origin)}
  const id=String(body.account_id||'')
  if(!/^[a-f\d-]{36}$/i.test(id))return response({error:'Invalid account id'},400,origin)
  const {data:account,error:lookup}=await admin.from('mail_accounts')
     .select('id,user_id,provider,address').eq('id',id).eq('user_id',userId).maybeSingle()
  if(lookup||!account)return response({error:'Account not found'},404,origin)
  if(body.action==='configure'){
    if(!['coremail','qq','126'].includes(account.provider))
      return response({error:'Gmail/Outlook require OAuth2; app-password setup is disabled.'},422,origin)
    const host=String(body.host||'').trim().toLowerCase()
    const smtpHost=String(body.smtp_host||'').trim().toLowerCase()
    if(smtpHost && !allowedHost(smtpHost,account.provider))
      return response({error:'SMTP host is not approved for this provider'},422,origin)
    const password=String(body.password||'')
    if(!allowedHost(host,account.provider))return response({error:'IMAP host is not approved for this provider'},422,origin)
    if(password.length<4||password.length>4096)return response({error:'Missing app password or IMAP authorization code'},422,origin)
    const saved=await admin.rpc('mail_save_cloud_secret',{p_account_id:id,p_secret:password})
    if(saved.error)return response({error:'Credential storage failed'},500,origin)
    const updated=await admin.from('mail_accounts').update({
      imap_host:host,imap_port:993,smtp_host:smtpHost||null,smtp_port:465,auth_kind:'password',
      cloud_state:'ready',last_error:null,enabled:true
    }).eq('id',id).eq('user_id',userId)
    if(updated.error)return response({error:'Mailbox settings failed'},500,origin)
    return response({ok:true,cloud_state:'ready'},200,origin)
  }
  if(body.action==='disable'){
    const result=await admin.from('mail_accounts').update({enabled:false}).eq('id',id).eq('user_id',userId)
    if(result.error)return response({error:'Unable to disable'},500,origin)
    return response({ok:true},200,origin)
  }
  return response({error:'Unknown action'},400,origin)
})