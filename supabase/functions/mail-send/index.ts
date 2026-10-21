import {createClient} from 'npm:@supabase/supabase-js@2.49.4'
const decoder=new TextDecoder()
const encoder=new TextEncoder()
const json=(x:any,status=200)=>new Response(status===204?null:JSON.stringify(x),{status,headers:{
 'Content-Type':'application/json','Cache-Control':'no-store',
 'Access-Control-Allow-Origin':'https://qi-i.github.io',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type'
}})
function allowed(host:string,provider:string){
 const suffix:Record<string,string[]>={
  coremail:['xju.edu.cn','cugb.edu.cn'],qq:['smtp.qq.com'],'126':['smtp.126.com']
 }
 return /^[a-z0-9.-]{4,180}$/.test(host)&&!host.includes('..')&&
  (suffix[provider]||[]).some(s=>host===s||host.endsWith('.'+s))
}
function encodeBase64(str:string){
 const bytes=encoder.encode(str)
 let b='';for(let i=0;i<bytes.length;i+=8192)b+=String.fromCharCode(...bytes.slice(i,i+8192))
 return btoa(b)
}
function fold64(value:string){return value.match(/.{1,76}/g)?.join('\r\n')||''}
function safeAddress(value:unknown){
 const v=String(value||'').trim()
 if(!/^[a-zA-Z0-9.!#$%&'*+\/?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(v)||v.length>254)throw new Error('Invalid email address')
 return v
}
class SMTP{
  buf=''
  constructor(public conn:Deno.TlsConn){}
  async line(){
   while(!this.buf.includes('\n')){
    const b=new Uint8Array(4096);const n=await this.conn.read(b)
    if(n===null)throw Error('SMTP disconnected')
    this.buf+=decoder.decode(b.subarray(0,n))
    if(this.buf.length>65536)throw Error('SMTP response too long')
   }
   const index=this.buf.indexOf('\n')
   const line=this.buf.slice(0,index).replace(/\r$/,'')
   this.buf=this.buf.slice(index+1)
   return line
  }
  async expect(code:number){
   let current=''
   for(let i=0;i<100;i++){
    current=await this.line()
    if(!/^\d{3}[- ]/.test(current))throw Error('Invalid SMTP greeting')
    const num=Number(current.slice(0,3))
    if(num!==code)throw Error('SMTP returned '+num+' (expected '+code+')')
    if(current[3]===' ')return
   }
   throw Error('SMTP multiline response too long')
  }
  async cmd(value:string,code:number){
   await this.conn.write(encoder.encode(value+'\r\n'))
   await this.expect(code)
  }
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return json(null,204)
 if(req.method!=='POST')return json({error:'POST required'},405)
 const url=Deno.env.get('SUPABASE_URL'),role=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!role)return json({error:'Backend unavailable'},500)
 const admin=createClient(url,role,{auth:{autoRefreshToken:false,persistSession:false}})
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 const auth=await admin.auth.getUser(jwt)
 if(auth.error||!auth.data.user)return json({error:'请先登录'},401)
 let body:Record<string,unknown>
 try{body=await req.json()}catch{return json({error:'Invalid request'},400)}
 const id=String(body.account_id||'')
 if(!/^[a-f0-9-]{36}$/i.test(id))return json({error:'Invalid account'},400)
 const account=await admin.from('mail_accounts').select('*').eq('id',id).eq('user_id',auth.data.user.id).eq('enabled',true).maybeSingle()
 if(account.error||!account.data)return json({error:'Account unavailable'},404)
 const a=account.data
 if(!a.smtp_host||!allowed(a.smtp_host,a.provider))return json({error:'请先为此邮箱设置官方 SMTP 服务器'},422)
 let to='',subject='',content='',replyTo=''
 try{
  to=safeAddress(body.to)
  subject=String(body.subject||'').trim()
  content=String(body.content||'')
  replyTo=String(body.reply_to||'').trim()
  if(!subject||subject.length>500||!content.trim()||content.length>100000)throw Error('Invalid subject or text')
  if(replyTo && !/^<[^\r\n<>]{3,300}>$/.test(replyTo))throw Error('Invalid In-Reply-To header')
 }catch{return json({error:'收件人、主题或正文无效'},422)}
 const secret=await admin.rpc('mail_read_cloud_secret',{p_account_id:id})
 if(secret.error||!secret.data)return json({error:'请先配置邮箱授权码'},422)
 let client:SMTP|null=null
 try{
  const conn=await Deno.connectTls({hostname:a.smtp_host,port:465})
  client=new SMTP(conn)
  await client.expect(220)
  await client.cmd('EHLO submission-hub.local',250)
  await client.cmd('AUTH LOGIN',334)
  await client.cmd(encodeBase64(a.address),334)
  await client.cmd(encodeBase64(secret.data),235)
  await client.cmd('MAIL FROM:<'+safeAddress(a.address)+'>',250)
  await client.cmd('RCPT TO:<'+to+'>',250)
  await client.cmd('DATA',354)
  const message=[
    'From: <'+safeAddress(a.address)+'>','To: <'+to+'>',
    'Subject: =?UTF-8?B?'+encodeBase64(subject)+'?=',
    'Date: '+new Date().toUTCString(),
    'Message-ID: <'+crypto.randomUUID()+'@submission-hub.local>',
    ...(replyTo?['In-Reply-To: '+replyTo,'References: '+replyTo]:[]),
    'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64','',''+fold64(encodeBase64(content)),
  ].join('\r\n')+'\r\n.\r\n'
  await conn.write(encoder.encode(message))
  await client.expect(250)
  try{await client.cmd('QUIT',221)}catch{}
  return json({sent:true})
 }catch(e){
  const message=e instanceof Error?e.message:String(e)
  return json({error:'SMTP 发送失败：'+message.replace(/\S+@\S+/g,'[address]').slice(0,140)},502)
 }finally{try{client?.conn.close()}catch{}}
})
