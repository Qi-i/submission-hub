import {createClient} from 'npm:@supabase/supabase-js@2.49.4'
const enc=new TextEncoder(),dec=new TextDecoder()
const heads={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'https://qi-i.github.io','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS'}
const answer=(body:unknown,status=200)=>new Response(status===204?null:JSON.stringify(body),{status,headers:heads})
const validHost=(h:string)=>/^(?=.{4,190}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(h)&&!/(^|\.)(local|localhost|internal|lan|home|onion|arpa|test|invalid)$/.test(h)
const safe4=(s:string)=>{const p=s.split('.').map(Number);if(p.length!==4||p.some(n=>n<0||n>255||!Number.isInteger(n)))return false;const [a,b]=p;return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===192&&b===0||a===198&&b>=18&&b<=19)}
const safe6=(s:string)=>!(/^(::|::1|f[cd]|fe[89ab]|ff|2001:db8)/i.test(s)||/::ffff:/i.test(s))
async function guard(host:string){if(!validHost(host))throw Error('请输入规范的公网邮件服务器域名（不支持内网域名或 IP）');/* Do not block settings saves on runtime DNS availability. Actual TLS login validates reachability and certificate. */}
const quote=(s:string)=>'"'+s.replace(/[\r\n\0]/g,'').replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"'
const b64=(s:string)=>{const v=enc.encode(s);let x='';for(const b of v)x+=String.fromCharCode(b);return btoa(x)}
class Lines{
 buf=''
 constructor(public conn:Deno.Conn){}
 async line(){while(!this.buf.includes('\n')){const b=new Uint8Array(8192);const n=await this.conn.read(b);if(n===null)throw Error('服务器断开连接');this.buf+=dec.decode(b.subarray(0,n));if(this.buf.length>65536)throw Error('响应太长')}const i=this.buf.indexOf('\n'),v=this.buf.slice(0,i).replace(/\r$/,'');this.buf=this.buf.slice(i+1);return v}
 async write(s:string){await this.conn.write(enc.encode(s+'\r\n'))}
 async smtp(code:number){for(let i=0;i<40;i++){const l=await this.line();if(!/^\d{3}[ -]/.test(l))throw Error('SMTP 响应错误');if(Number(l.slice(0,3))!==code)throw Error('SMTP 返回 '+l.slice(0,3));if(l[3]===' ')return}throw Error('SMTP 多行响应超限')}
 async imap(tag:string){for(let i=0;i<40;i++){const l=await this.line();if(l.startsWith(tag+' ')){if(!new RegExp('^'+tag+' OK\\b','i').test(l))throw Error('IMAP 验证失败');return}}throw Error('IMAP 无最终响应')}
}
async function open(host:string,port:number,security:string,kind:'imap'|'smtp'){
 await guard(host)
 if(security==='ssl')return Deno.connectTls({hostname:host,port})
 const sock=await Deno.connect({hostname:host,port})
 try{const l=new Lines(sock);if(kind==='imap'){if(!/^\* OK/i.test(await l.line()))throw Error('IMAP 未就绪');await l.write('A001 STARTTLS');await l.imap('A001')}else{await l.smtp(220);await l.write('EHLO submission-hub.local');await l.smtp(250);await l.write('STARTTLS');await l.smtp(220)}return await Deno.startTls(sock,{hostname:host})}catch(e){try{sock.close()}catch{};throw e}
}
async function verify(host:string,port:number,security:string,kind:'imap'|'smtp',username:string,password:string){
 const conn=await open(host,port,security,kind)
 try{const l=new Lines(conn)
  if(kind==='imap'){if(security==='ssl'&&!/^\* OK/i.test(await l.line()))throw Error('IMAP 未就绪');await l.write('A002 LOGIN '+quote(username)+' '+quote(password));await l.imap('A002')}
  else{if(security==='ssl')await l.smtp(220);await l.write('EHLO submission-hub.local');await l.smtp(250);await l.write('AUTH LOGIN');await l.smtp(334);await l.write(b64(username));await l.smtp(334);await l.write(b64(password));await l.smtp(235)}
 }finally{try{conn.close()}catch{}}
}
async function discover(address:string,provider:string){
 const domain=address.split('@')[1].toLowerCase()
 const roots:Record<string,[string,string,number,string]>={qq:['imap.qq.com','smtp.qq.com',465,'ssl'],'126':['imap.126.com','smtp.126.com',465,'ssl'],gmail:['imap.gmail.com','smtp.gmail.com',465,'ssl'],outlook:['outlook.office365.com','smtp.office365.com',587,'starttls']}
 const result:any[]=[]
 const put=(type:string,host:string,port:number,security:string,source:string)=>{if(validHost(host)&&!result.some(x=>x.type===type&&x.host===host&&x.port===port))result.push({type,host,port,security,source})}
 if(roots[provider]){const [im,sm,p,sec]=roots[provider];put('imap',im,993,'ssl','服务商预设');put('smtp',sm,p,sec,'服务商预设')}
 else{for(const p of ['mail','imap'])put('imap',p+'.'+domain,993,'ssl','按域名推测，需测试');for(const p of ['mail','smtp'])put('smtp',p+'.'+domain,465,'ssl','按域名推测，需测试')}
 for(const [key,type] of [['_imaps._tcp.','imap'],['_submission._tcp.','smtp'],['_submissions._tcp.','smtp']] as const){const records=await Deno.resolveDns(key+domain,'SRV').catch(()=>[]) as Deno.SrvRecord[];for(const r of records.slice(0,3)){const port=Number(r.port);if(type==='imap'?[993,143].includes(port):[465,587].includes(port))put(type,r.target.replace(/\.$/,''),port,[993,465].includes(port)?'ssl':'starttls','DNS SRV')}}
 return result
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return answer(null,204)
 if(req.method!=='POST')return answer({error:'POST only'},405)
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!key)return answer({error:'服务端未配置'},500)
 const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 const auth=await db.auth.getUser(jwt)
 if(auth.error||!auth.data.user)return answer({error:'登录已过期'},401)
 let body:Record<string,unknown>
 try{body=await req.json()}catch{return answer({error:'请求格式不正确'},400)}
 const id=String(body.account_id||'')
 if(!/^[a-f0-9-]{36}$/i.test(id))return answer({error:'邮箱编号无效'},400)
 const found=await db.from('mail_accounts').select('*').eq('id',id).eq('user_id',auth.data.user.id).maybeSingle()
 if(found.error||!found.data)return answer({error:'找不到对应邮箱'},404)
 const a=found.data
 if(body.action==='discover')return answer({candidates:await discover(a.address,a.provider)})
 if(body.action==='configure'){
  if(!['coremail','qq','126','other'].includes(a.provider))return answer({error:'该服务商需要 OAuth2 授权，暂不支持密码方式'},422)
  const host=String(body.host||'').trim().toLowerCase(),smtp=String(body.smtp_host||'').trim().toLowerCase()
  const imapPort=Number(body.imap_port||993),smtpPort=Number(body.smtp_port||465)
  const imapSecurity=String(body.imap_security||'ssl'),smtpSecurity=String(body.smtp_security||'ssl')
  if(!([993,143].includes(imapPort)&&[465,587].includes(smtpPort)&&
    (imapPort===993?imapSecurity==='ssl':imapSecurity==='starttls')&&
    (smtpPort===465?smtpSecurity==='ssl':smtpSecurity==='starttls')))return answer({error:'支持的安全组合：IMAP 993/SSL 或143/STARTTLS；SMTP 465/SSL 或587/STARTTLS'},422)
  try{await guard(host);if(smtp)await guard(smtp)}catch(e){return answer({error:e instanceof Error?e.message:'服务器地址错误'},422)}
  const pwd=String(body.password||'')
  if(pwd&& (pwd.length<4||pwd.length>4096))return answer({error:'客户端授权码长度不正确'},422)
  const old=await db.rpc('mail_read_cloud_secret',{p_account_id:id})
  if(!pwd&&!old.data)return answer({error:'请填写客户端授权码'},422)
  if(pwd){const stored=await db.rpc('mail_save_cloud_secret',{p_account_id:id,p_secret:pwd});if(stored.error)return answer({error:'加密保存 IMAP 授权失败'},500)}
  const smtpPassword=String(body.smtp_password||'')
  if(smtpPassword && (smtpPassword.length<4||smtpPassword.length>4096))return answer({error:'SMTP 专用授权码长度不正确'},422)
  if(smtpPassword){
    const stored=await db.rpc('mail_save_smtp_secret',{p_account_id:id,p_secret:smtpPassword})
    if(stored.error)return answer({error:'SMTP 授权码加密保存失败'},500)
  }else if(body.smtp_use_imap_credential===true && a.smtp_has_separate_key){
    const removed=await db.rpc('mail_remove_smtp_secret',{p_account_id:id})
    if(removed.error)return answer({error:'无法切换回共用授权码'},500)
  }
  const separate=!!smtpPassword || (a.smtp_has_separate_key && body.smtp_use_imap_credential!==true)
  const update=await db.from('mail_accounts').update({
   imap_host:host,imap_port:imapPort,imap_security:imapSecurity,
   imap_username:String(body.imap_username||a.address).trim().slice(0,320),
   smtp_host:smtp||null,smtp_port:smtpPort,smtp_security:smtpSecurity,
   smtp_username:String(body.smtp_username||a.address).trim().slice(0,320),
   smtp_has_separate_key:separate,cloud_state:'not_configured',enabled:true,
   last_error:null,consecutive_failures:0,next_attempt_at:null
  }).eq('id',id).eq('user_id',auth.data.user.id)
  return update.error?answer({error:'保存失败'},500):answer({ok:true,message:'配置已保存，请运行登录测试'})
 }
 if(body.action==='test'){
  const secret=await db.rpc('mail_read_cloud_secret',{p_account_id:id})
  if(!secret.data)return answer({error:'请先保存客户端授权码'},422)
  const results:Record<string,unknown>={}
  for(const kind of ['imap','smtp'] as const){const host=kind==='imap'?a.imap_host:a.smtp_host;if(!host)continue
   try{
    let loginSecret=secret.data
    if(kind==='smtp' && a.smtp_has_separate_key){
      const independent=await db.rpc('mail_read_smtp_secret',{p_account_id:id})
      if(independent.error||!independent.data)throw Error('SMTP 独立授权码尚未配置')
      loginSecret=independent.data
    }
    await verify(host,Number(kind==='imap'?a.imap_port:a.smtp_port),
      kind==='imap'?a.imap_security||'ssl':a.smtp_security||'ssl',kind,
      kind==='imap'?a.imap_username||a.address:a.smtp_username||a.address,loginSecret)
    results[kind]={ok:true,message:'TLS 连接及身份验证通过'+(kind==='smtp'?'（未实际发送邮件）':'')}
   }
   catch(e){results[kind]={ok:false,message:e instanceof Error?e.message:'连接失败'}}
  }
  const ok=!!(results.imap as any)?.ok
  await db.from('mail_accounts').update({
   cloud_state:ok?'ready':'not_configured',
   last_error:ok?null:String((results.imap as any)?.message||'IMAP 尚未通过安全登录测试').slice(0,160),
   last_checked_at:new Date().toISOString(),consecutive_failures:0,next_attempt_at:null
  }).eq('id',id).eq('user_id',auth.data.user.id)
  return answer({ok,results})
 }
 if(body.action==='disable'){
   const r=await db.from('mail_accounts').update({enabled:false}).eq('id',id).eq('user_id',auth.data.user.id)
   return r.error?answer({error:'暂停失败'},500):answer({ok:true,enabled:false})
 }
 if(body.action==='enable'){
   if(!a.imap_host)return answer({error:'请先配置 IMAP 收信服务器'},422)
   const secret=await db.rpc('mail_read_cloud_secret',{p_account_id:id})
   if(!secret.data)return answer({error:'缺少 IMAP 授权码'},422)
   try{
     await verify(a.imap_host,Number(a.imap_port||993),a.imap_security||'ssl','imap',
       a.imap_username||a.address,secret.data)
   }catch(e){return answer({error:'恢复采集前 IMAP 验证失败：'+String(e instanceof Error?e.message:e).slice(0,150)},422)}
   const updated=await db.from('mail_accounts').update({
     enabled:true,cloud_state:'ready',last_error:null,
     consecutive_failures:0,next_attempt_at:null,last_checked_at:new Date().toISOString()
   }).eq('id',id).eq('user_id',auth.data.user.id)
   return updated.error?answer({error:'恢复失败'},500):answer({ok:true,enabled:true})
 }
 return answer({error:'不支持的操作'},400)
})