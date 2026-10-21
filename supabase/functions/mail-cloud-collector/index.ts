import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import PostalMime from 'npm:postal-mime@4.0.7'

const PROJECT=Deno.env.get('SUPABASE_URL')||''
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const encoder=new TextEncoder()
const decoder=new TextDecoder()
const MAX_MESSAGE=8*1024*1024
const MAX_PER_RUN=25
const MAX_FOLDER=7
const TIME_BUDGET_MS=90000
const classify=(subject:string,body:string)=>{
 const sample=(subject+'\n'+body.slice(0,4000))
 if(/invitation to review|invite(?:d|s)? you to review|reviewer invitation|willing to review|审稿邀请|邀请.{0,8}审稿|邀请.{0,8}评审/i.test(sample))return ['review_invite',3]
 if(/manuscript (?:decision|accepted|rejected)|major revision|minor revision|revision requested|稿件.{0,8}(录用|拒稿|退修|返修|修改)|录用通知|审稿意见|投稿成功/i.test(sample))return ['submission_update',3]
 if(/editorial manager|scholarone|editor-in-chief|editorial office|期刊编辑部|编辑来信/i.test(sample))return ['editorial',2]
 if(/gift card|bitcoin payment|wire transfer|pay a processing fee before review/i.test(sample))return ['suspicious',1]
 return ['other',0]
}
async function digest(data:Uint8Array|string){
 const buffer=await crypto.subtle.digest('SHA-256',typeof data==='string'?encoder.encode(data):data)
 return Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,'0')).join('')
}
function imapString(value:string){
 if(/[\r\n\x00]/.test(value))throw new Error('Invalid IMAP argument')
 return '"'+value.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"'
}
class Imap {
 conn:Deno.TlsConn
 buffer:Uint8Array=new Uint8Array()
 nextTag=0
 constructor(conn:Deno.TlsConn){this.conn=conn}
 async fill(){
  const chunk=new Uint8Array(65536)
  const n=await this.conn.read(chunk)
  if(n===null)throw new Error('IMAP disconnected')
  if(!n)return
  const data=new Uint8Array(this.buffer.length+n)
  data.set(this.buffer);data.set(chunk.subarray(0,n),this.buffer.length);this.buffer=data
 }
 async line(){
  while(true){
    const at=this.buffer.indexOf(10)
    if(at>=0){
      const value=decoder.decode(this.buffer.subarray(0,at+1)).replace(/\r?\n$/,'')
      this.buffer=this.buffer.subarray(at+1)
      return value
    }
    if(this.buffer.length>2500000)throw new Error('IMAP response line too long')
    await this.fill()
  }
 }
 async bytes(n:number){
  if(n>MAX_MESSAGE)throw new Error('Message exceeds 8 MiB safety limit')
  const out=new Uint8Array(n)
  let offset=0
  while(offset<n){
   if(!this.buffer.length)await this.fill()
   const used=Math.min(this.buffer.length,n-offset)
   out.set(this.buffer.subarray(0,used),offset)
   this.buffer=this.buffer.subarray(used);offset+=used
  }
  return out
 }
 async cmd(command:string,wantLiteral=false){
  const tag='A'+String(++this.nextTag).padStart(4,'0')
  await this.conn.write(encoder.encode(tag+' '+command+'\r\n'))
  const lines:string[]=[]
  let literal:Uint8Array|null=null
  while(true){
   const line=await this.line()
   if(line.startsWith(tag+' ')){
    if(!new RegExp('^'+tag+' OK\\b','i').test(line))
      throw new Error('IMAP command failed: '+command.split(' ')[0]+' ('+line.slice(0,120)+')')
    return {lines,literal}
   }
   const size=/\{(\d+)\}$/.exec(line)
   if(size&&wantLiteral)literal=await this.bytes(Number(size[1]))
   lines.push(line)
  }
 }
 async close(){try{await this.cmd('LOGOUT')}catch{}try{this.conn.close()}catch{}}
}
type Folder={name:string,spam:boolean}
async function folders(imap:Imap):Promise<Folder[]>{
 const result=await imap.cmd('LIST "" "*"')
 const list:Folder[]=[]
 for(const line of result.lines){
  if(!/^\* LIST /i.test(line)||/\\Noselect/i.test(line))continue
  const m=/(?:^|\s)("(?:\\.|[^"])*"|\S+)\s*$/.exec(line)
  if(!m)continue
  let name=m[1]
  if(name.startsWith('"'))name=name.slice(1,-1).replace(/\\(["\\])/g,'$1')
  if(name.length>300||/\r|\n/.test(name))continue
  list.push({name,spam:/spam|junk|垃圾|\\Junk/i.test(line)})
 }
 return list.sort((a,b)=>Number(b.spam)-Number(a.spam)).slice(0,30)
}
function extract(body:string){
 const candidate=/(?:manuscript\s*(?:id|number|no\.?|#)|稿件编号|稿号)\s*[:：#]?\s*([\w.\-/]{5,70})/i.exec(body)
 return candidate?{manuscript_no:candidate[1]}:{}
}
function allowed(host:string,provider:string){
 const allow:Record<string,string[]>={
  coremail:['xju.edu.cn','cugb.edu.cn'],qq:['imap.qq.com'],'126':['imap.126.com'],
  gmail:['imap.gmail.com'],outlook:['outlook.office365.com']
 }
 return /^[a-z0-9.-]{4,180}$/.test(host)&&!host.includes('..')&&
   (allow[provider]||[]).some(s=>host===s||host.endsWith('.'+s))
}
function cleanError(e:unknown){return String(e instanceof Error?e.message:e).replace(/password|token|secret/gi,'[credential]').slice(0,200)}
async function scanAccount(admin:any,account:any){
 const secretRes=await admin.rpc('mail_read_cloud_secret',{p_account_id:account.id})
 if(secretRes.error||!secretRes.data)throw new Error('Mailbox credential not configured')
 if(!allowed(account.imap_host||'',account.provider))throw new Error('Unsafe or unconfigured IMAP host')
 const conn=await Deno.connectTls({hostname:account.imap_host,port:993})
 const imap=new Imap(conn)
 const now=Date.now()
 let processed=0
 try{
  const banner=await imap.line()
  if(!/^\* OK/i.test(banner))throw new Error('IMAP greeting unavailable')
  if(account.auth_kind==='xoauth2'){

   await imap.cmd('AUTHENTICATE XOAUTH2 '+btoa('user='+account.address+String.fromCharCode(1)+'auth=Bearer '+secretRes.data+String.fromCharCode(1,1)))
  }else await imap.cmd('LOGIN '+imapString(account.address)+' '+imapString(secretRes.data))
  const directory=await folders(imap)
  const state=await admin.rpc('mail_get_scan_state',{p_account_id:account.id})
  if(state.error)throw new Error('Unable to load scan cursor')
  const byName=new Map((state.data||[]).map((s:any)=>[s.folder_key,s]))
  for(const folder of directory){
   if(processed>=MAX_PER_RUN||Date.now()-now>TIME_BUDGET_MS)break
   try{
    const examined=await imap.cmd('EXAMINE '+imapString(folder.name))
   }catch{continue}
   const status=await imap.cmd('UID SEARCH ALL')
   const ids:number[]=[]
   for(const line of status.lines){
    if(line.startsWith('* SEARCH'))for(const value of line.slice(8).trim().split(/\s+/)){
      const id=Number(value);if(Number.isSafeInteger(id)&&id>0)ids.push(id)
    }
   }
   if(!ids.length)continue
   ids.sort((a,b)=>a-b)
   const uidv=/UIDVALIDITY\s+(\d+)/i.exec(examined.lines.join(' '))?.[1]||'0'
   const hash=await digest(folder.name)
   const key=hash.slice(0,32)+'-'+uidv
   const cursor:any=byName.get(key)||{recent_uid:0,backfill_before:null}
   const recent=Number(cursor.recent_uid||0)
   const bound=cursor.backfill_before===null?Infinity:Number(cursor.backfill_before)
   const max=ids[ids.length-1]
   const newUids=ids.filter(v=>v>recent).reverse().slice(0,Math.min(4,MAX_FOLDER))
   const selected=new Set(newUids)
   const oldUids=ids.filter(v=>v<bound&&!selected.has(v)).reverse().slice(0,MAX_FOLDER-newUids.length)
   const candidates=[...newUids,...oldUids].slice(0,Math.min(MAX_FOLDER,MAX_PER_RUN-processed))
   let completed=true
   for(const uid of candidates){
    if(Date.now()-now>TIME_BUDGET_MS){completed=false;break}
    const fetched=await imap.cmd('UID FETCH '+uid+' (BODY.PEEK[])',true)
    if(!fetched.literal){completed=false;break}
    const raw=fetched.literal
    const md=await digest(raw)
    const parsed=await PostalMime.parse(raw)
    const messageId=String(parsed.messageId||'').trim()
    const remoteKey=await digest(messageId||md)
    const exists=await admin.from('mail_messages').select('id').eq('account_id',account.id).eq('remote_key',remoteKey).maybeSingle()
    if(exists.error)throw new Error('Duplicate check failed')
    if(!exists.data){
     const archivePath=account.user_id+'/'+account.id+'/'+md+'.eml'
     const saved=await admin.storage.from('mail-originals').upload(archivePath,raw,{
      contentType:'application/octet-stream',upsert:false
     })
     if(saved.error&&!/already exists|duplicate|409/i.test(saved.error.message||''))throw new Error('Private archive upload failed')
     const body=String(parsed.text||parsed.html||'').replace(/<[^>]*>/g,' ').slice(0,60000)
     const subject=String(parsed.subject||'').slice(0,1024)
     const [category,importance]=classify(subject,body)
     const sender=parsed.from && 'address' in parsed.from ? parsed.from : null
     const inserted=await admin.from('mail_messages').insert({
       user_id:account.user_id,account_id:account.id,remote_key:remoteKey,
       internet_message_id:messageId.slice(0,512),
       first_folder:folder.spam?'Junk':folder.name,
       last_folder:folder.name,
       received_at:parsed.date && !Number.isNaN(Date.parse(parsed.date)) ? new Date(parsed.date).toISOString():null,
       sender_name:sender?.name||'',sender_address:sender?.address||'',
       recipient_address:account.address,subject,
       snippet:body.replace(/\s+/g,' ').slice(0,800),body_text:body,
       category,importance,extraction:extract(subject+' '+body.slice(0,2500)),
       cloud_archive_path:archivePath,archived_locally:false
     })
     if(inserted.error&&!/duplicate key/i.test(inserted.error.message||''))throw new Error('Mail index save failed')
    }
    processed++
   }
   if(!completed)break
   const nextBefore=oldUids.length?Math.min(...oldUids): (cursor.backfill_before===0?0:ids.some(v=>v<bound&&!selected.has(v))?bound:0)
   const save=await admin.rpc('mail_save_scan_state',{p_account_id:account.id,p_folder_key:key,
     p_recent:Math.max(recent,...newUids,0),p_before:Number.isFinite(nextBefore)?nextBefore:0})
   if(save.error)throw new Error('Scan cursor update failed')
  }
  return {processed,checkedFolders:directory.length}
 }finally{try{conn.close()}catch{}}
}
const apiResponse=(data:unknown,status=200)=>new Response(status===204?null:JSON.stringify(data),{
 status,headers:{
  'content-type':'application/json','cache-control':'no-store',
  'Access-Control-Allow-Origin':'https://qi-i.github.io',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS'
 }
})
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return apiResponse(null,204)
 if(req.method!=='POST')return apiResponse({error:'POST only'},405)
 if(!PROJECT||!SERVICE)return apiResponse({error:'Project configuration missing'},500)
 const admin=createClient(PROJECT,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}})
 const auth=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 if(!auth)return apiResponse({error:'Authentication required'},401)
 let isCron=false, userId=''
 const cron=await admin.rpc('mail_check_cron_token',{p_token:auth})
 if(!cron.error && cron.data===true)isCron=true
 else{
  const check=await admin.auth.getUser(auth)
  if(check.error||!check.data.user)return apiResponse({error:'Invalid credentials'},401)
  userId=check.data.user.id
 }
 let preferred=''
 try {const body=await req.json(); preferred=String(body.account_id||'')}catch{}
 let query=admin.from('mail_accounts').select('*').in('cloud_state',['ready','error']).eq('enabled',true)
 if(!isCron){
  if(!preferred)return apiResponse({error:'account_id required'},400)
  query=query.eq('user_id',userId).eq('id',preferred)
 }
 const rows=await query.order('last_checked_at',{ascending:true,nullsFirst:true}).limit(10)
 if(rows.error)return apiResponse({error:'Account scan lookup failed'},500)
 const account=(rows.data||[])[0]
 if(!account)return apiResponse({checked:0,processed:0})
 await admin.from('mail_accounts').update({last_checked_at:new Date().toISOString()}).eq('id',account.id)
 try{
  const result=await scanAccount(admin,account)
  await admin.from('mail_accounts').update({
   last_sync_at:new Date().toISOString(),last_error:null,cloud_state:'ready'
  }).eq('id',account.id)
  return apiResponse({checked:1,processed:result.processed,folders:result.checkedFolders})
 }catch(e){
  const err=cleanError(e)
  await admin.from('mail_accounts').update({last_error:err,cloud_state:'error'}).eq('id',account.id)
  return apiResponse({checked:1,error:'Mailbox scan failed',detail:err},200)
 }
})