import {createClient} from 'npm:@supabase/supabase-js@2.49.4'
const decoder=new TextDecoder()
const encoder=new TextEncoder()
const json=(x:any,status=200)=>new Response(status===204?null:JSON.stringify(x),{status,headers:{
 'Content-Type':'application/json','Cache-Control':'no-store',
 'Access-Control-Allow-Origin':'https://qi-i.github.io',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type'
}})
async function ensurePublic(host:string){
 if(!/^(?=.{4,190}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host)||/(^|\.)(local|localhost|internal|lan|home|onion|arpa|test|invalid)$/.test(host))throw Error('Unsafe SMTP hostname')
 const a=await Deno.resolveDns(host,'A').catch(()=>[] as string[]) as string[]
 const b=await Deno.resolveDns(host,'AAAA').catch(()=>[] as string[]) as string[]
 if(!a.length&&!b.length)throw Error('SMTP DNS lookup failed')
 if(a.some(ip=>{const p=ip.split('.').map(Number),[x,y]=p;return p.length!==4||p.some(n=>n<0||n>255)||x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||x===192&&y===168||x===100&&y>=64&&y<=127||x===192&&y===0||x===198&&y>=18&&y<=19})||b.some(ip=>/^(::|::1|f[cd]|fe[89ab]|ff|2001:db8)/i.test(ip)||/::ffff:/i.test(ip)))throw Error('Blocked private SMTP address')
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
  constructor(public conn:Deno.Conn){}
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
 if(!a.smtp_host)return json({error:'请先配置 SMTP 服务器'},422)
 const port=Number(a.smtp_port||465),security=a.smtp_security||'ssl'
 if(!(port===465&&security==='ssl'||port===587&&security==='starttls'))return json({error:'安全端口必须为 SMTP 465/SSL 或587/STARTTLS'},422)
 try{await ensurePublic(a.smtp_host)}catch(e){return json({error:e instanceof Error?e.message:'SMTP 地址不安全'},422)}
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
  let conn:Deno.Conn
  if(security==='starttls'){
    const raw=await Deno.connect({hostname:a.smtp_host,port})
    try{
      const start=new SMTP(raw)
      await start.expect(220)
      await start.cmd('EHLO submission-hub.local',250)
      await start.cmd('STARTTLS',220)
      conn=await Deno.startTls(raw,{hostname:a.smtp_host})
    }catch(e){try{raw.close()}catch{}throw e}
  }else{conn=await Deno.connectTls({hostname:a.smtp_host,port})}
  client=new SMTP(conn)
  if(security==='ssl')await client.expect(220)
  await client.cmd('EHLO submission-hub.local',250)
  await client.cmd('AUTH LOGIN',334)
  await client.cmd(encodeBase64(a.smtp_username||a.address),334)
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
