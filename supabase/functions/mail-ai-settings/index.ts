import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
const headers=(origin:string)=>({
 'content-type':'application/json','cache-control':'no-store',
 'access-control-allow-origin': origin==='https://qi-i.github.io'?'https://qi-i.github.io':'https://qi-i.github.io',
 'access-control-allow-headers':'authorization,apikey,content-type',
 'access-control-allow-methods':'POST,OPTIONS'
})
const json=(body:any,status=200,origin='')=>new Response(status===204?null:JSON.stringify(body),{status,headers:headers(origin)})
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||''
 if(req.method==='OPTIONS')return json(null,204,origin)
 if(req.method!=='POST')return json({error:'POST only'},405,origin)
 const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!key)return json({error:'Backend not configured'},500,origin)
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
 const auth=await admin.auth.getUser(jwt)
 if(auth.error||!auth.data.user)return json({error:'请先登录'},401,origin)
 let payload:{action?:string;api_key?:string}
 try{payload=await req.json()}catch{return json({error:'无效的配置'},400,origin)}
 const id=auth.data.user.id
 if(payload.action==='save_key'){
  const candidate=String(payload.api_key||'').trim()
  if(candidate.length<12||candidate.length>2048)return json({error:'请输入有效的 Z.AI API Key'},422,origin)
  const saved=await admin.rpc('mail_save_ai_key',{p_user_id:id,p_secret:candidate})
  if(saved.error)return json({error:'API Key 加密保存失败'},500,origin)
  const setting=await admin.from('mail_preferences').upsert({user_id:id,ai_key_ready:true},{onConflict:'user_id'})
  if(setting.error)return json({error:'更新授权状态失败'},500,origin)
  return json({ok:true,configured:true},200,origin)
 }
 if(payload.action==='check_key'){
  const result=await admin.rpc('mail_read_ai_key',{p_user_id:id})
  return json({configured:!!result.data},200,origin)
 }
 return json({error:'不支持的操作'},400,origin)
})
