import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import PostalMime from 'npm:postal-mime@4.0.7'
import {scanOutlookGraph} from './outlook.ts'
import {mailStoragePolicy,textPreview} from './storage-policy.ts'

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
async function withDeadline<T>(work:Promise<T>,phase:string,ms:number,onTimeout?:()=>void):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined
 try{
  return await Promise.race([work,new Promise<never>((_,reject)=>{
   timer=setTimeout(()=>{
    try{onTimeout?.()}catch{}
    reject(new Error('IMAP '+phase+' timed out after '+Math.ceil(ms/1000)+'s'))
   },ms)
  })])
 }finally{if(timer!==undefined)clearTimeout(timer)}
}
class Imap {
 conn:Deno.Conn
 buffer:Uint8Array=new Uint8Array()
 nextTag=0
 constructor(conn:Deno.Conn){this.conn=conn}
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
  if(n>MAX_MESSAGE)throw new Error('Message exceeds 8 MiB archive limit')
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
  const fetch=command.startsWith('UID FETCH')
  return await withDeadline(this.runCmd(command,wantLiteral),
   fetch?'message FETCH':command.split(' ')[0]+' command',
   fetch?45000:30000,()=>{try{this.conn.close()}catch{}})
 }
 private async runCmd(command:string,wantLiteral=false){
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
   if(size){
    const raw=await this.bytes(Number(size[1]))
    if(wantLiteral)literal=raw
    else {
      if(raw.length>4096)throw new Error('Oversized IMAP folder response')
      const name=decoder.decode(raw).replace(/[\r\n]/g,' ')
      lines.push(line.replace(/\{\d+\}$/,'')+'"'+name.replace(/"/g,'\\"')+'"')
      continue
    }
   }
   lines.push(line)
  }
 }
 async close(){try{await this.cmd('LOGOUT')}catch{}try{this.conn.close()}catch{}}
}
function decodeModifiedUtf7(raw:string){
 return raw.replace(/&([A-Za-z0-9+,]*)-/g,(_m,segment:string)=>{
  if(!segment)return '&'
  try{
   const base64=segment.replace(/,/g,'/')+'='.repeat((4-segment.length%4)%4)
   const decoded=atob(base64)
   return new TextDecoder('utf-16be').decode(Uint8Array.from(decoded,c=>c.charCodeAt(0)))
  }catch{return '&'+segment+'-'}
 })
}
type Folder={name:string,display:string,spam:boolean}
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
  const display=decodeModifiedUtf7(name)
  list.push({name,display,spam:/spam|junk|垃圾|\\Junk/i.test(line+' '+display)})
 }
 return list.sort((a,b)=>Number(b.spam)-Number(a.spam)).slice(0,30)
}
function extract(body:string){
 const candidate=/(?:manuscript\s*(?:id|number|no\.?|#)|稿件编号|稿号)\s*[:：#]?\s*([\w.\-/]{5,70})/i.exec(body)
 return candidate?{manuscript_no:candidate[1]}:{}
}
function extractDeadline(source:string):string|null{
  // Only explicit deadlines, not arbitrary dates in the body.
  const pattern=/(?:review\s+(?:due|deadline)|response\s+deadline|respond\s+by|reply\s+by|please\s+respond\s+by|审稿截止(?:日期|时间)?|回复截止(?:日期|时间)?|请于)[^\n]{0,80}?(\d{4})[年/.\-]\s*(\d{1,2})[月/.\-]\s*(\d{1,2})日?/i
  const match=pattern.exec(source.slice(0,12000))
  if(!match)return null
  const [year,month,day]=match.slice(1,4).map(Number)
  const date=new Date(Date.UTC(year,month-1,day))
  if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)return null
  return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')
}
function validHost(h:string){return /^(?=.{4,190}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(h)&&!/(^|\.)(local|localhost|internal|lan|home|onion|arpa|test|invalid)$/.test(h)}
async function ensurePublic(host:string){
 if(!validHost(host))throw Error('Blocked unsafe IMAP host')
 const a=await (typeof Deno.resolveDns==='function'?Deno.resolveDns(host,'A').catch(()=>[] as string[]):Promise.resolve([] as string[])) as string[]
 const b=await (typeof Deno.resolveDns==='function'?Deno.resolveDns(host,'AAAA').catch(()=>[] as string[]):Promise.resolve([] as string[])) as string[]
 // DNS resolver may be unavailable at the Edge; actual TLS socket verifies reachability and certificate.
 if(a.some(ip=>{const p=ip.split('.').map(Number),[x,y]=p;return p.length!==4||p.some(n=>n<0||n>255)||x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||x===192&&y===168||x===100&&y>=64&&y<=127||x===192&&y===0||x===198&&y>=18&&y<=19})||b.some(ip=>/^(::|::1|f[cd]|fe[89ab]|ff|2001:db8)/i.test(ip)||/::ffff:/i.test(ip)))throw Error('Blocked private or reserved mail server IP')
}
function cleanError(e:unknown){return String(e instanceof Error?e.message:e).replace(/password|token|secret/gi,'[credential]').slice(0,200)}
async function dialImap(host:string,port:number,security:'ssl'|'starttls'):Promise<Deno.Conn>{
 const stage=security==='ssl'?'TLS connection':'TCP connection'
 let expired=false
 const pending=security==='ssl'?Deno.connectTls({hostname:host,port}):Deno.connect({hostname:host,port})
 const guarded=pending.then(conn=>{
  if(expired){try{conn.close()}catch{};throw new Error('Late IMAP connection discarded')}
  return conn
 })
 try{return await withDeadline(guarded,stage,30000)}
 catch(error){
  expired=true
  throw new Error('IMAP '+stage+' failed: '+cleanError(error))
 }
}
async function scanAccount(admin:any,account:any){
 const secretRes=await admin.rpc('mail_read_cloud_secret',{p_account_id:account.id})
 if(secretRes.error||!secretRes.data)throw new Error('Mailbox credential not configured')
 const host=String(account.imap_host||'')
 const port=Number(account.imap_port||993),security=account.imap_security||'ssl'
 if(!(port===993&&security==='ssl'||port===143&&security==='starttls'))throw Error('Unsafe IMAP security configuration')
 await ensurePublic(host)
 let conn:Deno.Conn
 let imap:Imap
 if(security==='starttls'){
  const raw=await dialImap(host,port,'starttls')
  try{
   const bootstrap=new Imap(raw)
   if(!/^\* OK/i.test(await withDeadline(bootstrap.line(),'server greeting',15000,()=>{try{raw.close()}catch{}})))throw Error('IMAP greeting unavailable')
   await bootstrap.cmd('STARTTLS')
   conn=await withDeadline(Deno.startTls(raw,{hostname:host}),'STARTTLS handshake',30000,()=>{try{raw.close()}catch{}})
   imap=new Imap(conn)
  }catch(e){try{raw.close()}catch{}throw e}
 }else{
  conn=await dialImap(host,port,'ssl')
  try{
   imap=new Imap(conn)
   if(!/^\* OK/i.test(await withDeadline(imap.line(),'server greeting',15000,()=>{try{conn.close()}catch{}})))throw Error('IMAP greeting unavailable')
  }catch(error){try{conn.close()}catch{}throw error}
 }
 const now=Date.now()
 let processed=0
 let openedFolders=0, advertisedMessages=0, foundUids=0, unindexedEmptySearch=0, folderOpenErrors=0, firstOpenStatus='unknown'
 let newMessages=0
 try{
  if(account.auth_kind==='xoauth2'){

   await imap.cmd('AUTHENTICATE XOAUTH2 '+btoa('user='+account.address+String.fromCharCode(1)+'auth=Bearer '+secretRes.data+String.fromCharCode(1,1)))
  }else await imap.cmd('LOGIN '+imapString(account.imap_username||account.address)+' '+imapString(secretRes.data))
  // NetEase 126 requires the RFC 2971 IMAP ID client declaration before
  // SELECT/EXAMINE; otherwise it can respond NO Unsafe Login after LOGIN.
  if(account.provider==='126'){
   await imap.cmd('ID ("name" "Submission Hub" "version" "1.0" "vendor" "Qi-i")')
  }
  const directory=await folders(imap)
  // The canonical INBOX must always be addressable even when a gateway
  // returns a non-standard LIST suffix that the folder-name parser misses.
  if(account.provider==='126'&&!directory.some(f=>f.name.toUpperCase()==='INBOX')){
   directory.unshift({name:'INBOX',display:'收件箱',spam:false})
  }
  const state=await admin.rpc('mail_get_scan_state',{p_account_id:account.id})
  if(state.error)throw new Error('Unable to load scan cursor')
  const byName=new Map((state.data||[]).map((s:any)=>[s.folder_key,s]))
  for(const folder of directory){
   if(processed>=MAX_PER_RUN||Date.now()-now>TIME_BUDGET_MS)break
   let examined: {lines:string[];literal:Uint8Array|null}
   try{
    examined=await imap.cmd('EXAMINE '+imapString(folder.name))
   }catch{
    // Some 126 IMAP gateways reject EXAMINE but allow SELECT. The collector
    // All fetched messages use BODY.PEEK[]; the scanner never changes remote mail flags.
    if(account.provider!=='126'){folderOpenErrors++;continue}
    try{examined=await imap.cmd('SELECT '+imapString(folder.name))}
    catch(e){
     folderOpenErrors++
     if(firstOpenStatus==='unknown'){
      const response=String(e instanceof Error?e.message:e)
      firstOpenStatus=response.includes(' BAD ')?'BAD':response.includes(' NO ')?'NO':'transport'
     }
     continue
    }
   }
   openedFolders++
   const folderMessages=Number(/\* (\d+) EXISTS/i.exec(examined.lines.join(' '))?.[1]||0)
   advertisedMessages+=folderMessages
   const uidv=/UIDVALIDITY\s+(\d+)/i.exec(examined.lines.join(' '))?.[1]
   if(!uidv)throw new Error('IMAP server omitted UIDVALIDITY; refusing unsafe incremental cursor')
   const hash=await digest(folder.name)
   const key=hash.slice(0,32)+'-'+uidv
   const stored:any=byName.get(key)
   const savedRecent=Math.max(0,Number(stored?.recent_uid||0))
   const savedBefore=Number(stored?.backfill_before||0)
   // A new folder needs one full UID inventory; after that only new UIDs and
   // unfinished historical backfill are queried. Completed history is not rescanned.
   const searchIds=async (criteria:string):Promise<number[]>=>{
    const response=await imap.cmd('UID SEARCH '+criteria)
    const found:number[]=[]
    for(const line of response.lines){
     if(/^\* SEARCH(?:\s|$)/i.test(line))for(const value of line.slice(8).trim().split(/\s+/)){
      const id=Number(value)
      if(Number.isSafeInteger(id)&&id>0)found.push(id)
     }
    }
    return found
   }
   // IMAP commands share one socket and read buffer. Never run them concurrently:
   // a parallel search could consume the other command's tagged response.
   const searches: number[][]=[]
   if(stored){
    searches.push(await searchIds('UID '+(savedRecent+1)+':*'))
    if(savedBefore>1)searches.push(await searchIds('UID 1:'+(savedBefore-1)))
   }else searches.push(await searchIds('ALL'))
   // A completed mailbox may legitimately have no new UIDs.
   // An unindexed nonempty folder whose UID query finds nothing is inconsistent.
   if(folderMessages>0&&(!stored||(savedRecent===0&&savedBefore===0))&&searches.every(group=>group.length===0)){
    unindexedEmptySearch++
   }
   // IMAP UID n:* may return the last existing UID even when n is higher.
   const ids=[...new Set(searches.flat())]
    .filter(uid=>!stored||uid>savedRecent||(savedBefore>1&&uid<savedBefore))
    .sort((a,b)=>a-b)
   foundUids+=ids.length
   if(!ids.length){
    // Empty folders still need a completed checkpoint. Without it the progress
    // summary would treat them as unvisited and never show history complete.
    if(!stored||savedBefore>0){
     const finished=await admin.rpc('mail_save_scan_state',{p_account_id:account.id,
      p_folder_key:key,p_recent:savedRecent,p_before:0})
     if(finished.error)throw new Error('Unable to finish empty historical cursor')
    }
    continue
   }
   // Bootstrap near the newest messages, then complete the older range.
   const bootstrap=ids[Math.max(0,ids.length-13)]-1
   const cursor:any=stored||{recent_uid:bootstrap,backfill_before:bootstrap+1}
   const recent=Number(cursor.recent_uid||0)
   const bound=cursor.backfill_before===null?Infinity:Number(cursor.backfill_before)
   const newUids=ids.filter(v=>v>recent).slice(0,Math.min(4,MAX_FOLDER))
   const selected=new Set(newUids)
   const oldUids=ids.filter(v=>v<bound&&!selected.has(v)).reverse().slice(0,MAX_FOLDER-newUids.length)
   const candidates=[...newUids,...oldUids].slice(0,Math.min(MAX_FOLDER,MAX_PER_RUN-processed))
   let completed=true
   const processedNew:number[]=[]
   const processedOld:number[]=[]
   for(const uid of candidates){
    if(Date.now()-now>TIME_BUDGET_MS){completed=false;break}
    // Fetch only RFC822 metadata first. Bulk mail, receipts and messages
    // carrying large attachments do not require downloading the MIME body.
    const meta=await imap.cmd('UID FETCH '+uid+' (RFC822.SIZE BODY.PEEK[HEADER])',true)
    const bytes=Number(/RFC822\.SIZE\s+(\d+)/i.exec(meta.lines.join(' '))?.[1]||0)
    if(!meta.literal){completed=false;break}
    const header=await PostalMime.parse(meta.literal)
    const headerId=String(header.messageId||'').replaceAll(String.fromCharCode(0),'').trim()
    const headerSubject=String(header.subject||'').replaceAll(String.fromCharCode(0),'').slice(0,1024)
    const sender=header.from&&'address' in header.from?header.from:null
    const senderName=String(sender?.name||'').replaceAll(String.fromCharCode(0),'')
    const senderAddress=String(sender?.address||'').replaceAll(String.fromCharCode(0),'')
    const policy=mailStoragePolicy(String(account.provider||''),folder.display,headerSubject,senderAddress)
    const sizeBound=bytes>MAX_MESSAGE || (policy.tier==='text'&&bytes>256*1024)
    const lightweight=policy.tier==='index'||sizeBound
    if(lightweight){
     const keyId=await digest(headerId||key+':'+uid)
     const exists=await admin.from('mail_messages').select('id')
       .eq('account_id',account.id).eq('remote_key',keyId).maybeSingle()
     if(exists.error)throw Error('Mail metadata lookup failed')
     if(!exists.data){
      const mode: 'index'='index'
      const preview=bytes>MAX_MESSAGE?'大邮件 '+Math.ceil(bytes/1048576)+' MiB · 源邮箱保留原文':
        policy.label+' · 源邮箱查看原文'
      const inserted=await admin.from('mail_messages').insert({
       user_id:account.user_id,account_id:account.id,remote_key:keyId,
       internet_message_id:headerId.slice(0,512),
       first_folder:folder.spam?'Junk':folder.display.replaceAll(String.fromCharCode(0),''),
       last_folder:folder.display.replaceAll(String.fromCharCode(0),''),
       received_at:header.date&&!Number.isNaN(Date.parse(header.date))?new Date(header.date).toISOString():null,
       sender_name:senderName,sender_address:senderAddress,recipient_address:account.address,
       subject:headerSubject,snippet:preview,body_text:'',category:'other',importance:0,
       extraction:{storage_tier:mode,storage_reason:policy.label,original_size_bytes:bytes,
        attachments_not_copied:true},
       cloud_archive_path:null,archived_locally:false,storage_tier:mode,
       ai_state:'skipped'
      })
      if(inserted.error&&!/duplicate key/i.test(inserted.error.message||''))
       throw Error('Light mail index save failed (DB '+String(inserted.error.code||'unknown')+')')
      if(!inserted.error)newMessages++
     }
    }else{
     const fetched=await imap.cmd('UID FETCH '+uid+' (BODY.PEEK[])',true)
     if(!fetched.literal){completed=false;break}
     const raw=fetched.literal
     const md=await digest(raw)
     const parsed=await PostalMime.parse(raw)
     const messageId=String(parsed.messageId||headerId).replaceAll(String.fromCharCode(0),'').trim()
     const remoteKey=await digest(messageId||md)
     const exists=await admin.from('mail_messages').select('id')
       .eq('account_id',account.id).eq('remote_key',remoteKey).maybeSingle()
     if(exists.error)throw Error('Mail duplicate lookup failed')
     if(!exists.data){
      const full=policy.tier==='full'
      const archivePath=full?account.user_id+'/'+account.id+'/'+md+'.eml':null
      if(archivePath){
       const storedMail=await admin.storage.from('mail-originals').upload(archivePath,raw,{
        contentType:'application/octet-stream',upsert:false
       })
       if(storedMail.error&&!/already exists|duplicate|409/i.test(storedMail.error.message||''))
        throw Error('Private archive upload failed')
      }
      const body=String(parsed.text||parsed.html||'').replaceAll(String.fromCharCode(0),'')
       .replace(/<[^>]*>/g,' ').slice(0,full?60000:80000)
      const subject=String(parsed.subject||headerSubject).replaceAll(String.fromCharCode(0),'').slice(0,1024)
      const [category,importance]=classify(subject,body)
      const inserted=await admin.from('mail_messages').insert({
       user_id:account.user_id,account_id:account.id,remote_key:remoteKey,
       internet_message_id:messageId.slice(0,512),
       first_folder:folder.spam?'Junk':folder.display.replaceAll(String.fromCharCode(0),''),
       last_folder:folder.display.replaceAll(String.fromCharCode(0),''),
       received_at:parsed.date&&!Number.isNaN(Date.parse(parsed.date))?new Date(parsed.date).toISOString():null,
       sender_name:senderName,sender_address:senderAddress,recipient_address:account.address,
       subject,snippet:textPreview(body,800),body_text:body,category,importance,
       extraction:{...extract(subject+' '+body.slice(0,2500)),
         storage_tier:full?'full':'text',storage_reason:policy.label,original_size_bytes:bytes,
         attachments_not_copied:!full},
       deadline:extractDeadline(subject+'\n'+body.slice(0,12000)),
       cloud_archive_path:archivePath,archived_locally:false,
       storage_tier:full?'full':'text'
      })
      if(inserted.error&&!/duplicate key/i.test(inserted.error.message||''))
       throw Error('Mail index save failed (DB '+String(inserted.error.code||'unknown').replace(/[^A-Za-z0-9]/g,'').slice(0,12)+')')
      if(!inserted.error)newMessages++
     }
    }
    processed++
    // Move cursors only after the archive and message index are both durable.
    if(uid>recent)processedNew.push(uid)
    else if(uid<bound)processedOld.push(uid)
   }
   // A shortened batch must not skip UIDs selected but not actually saved.
   const nextBefore=processedOld.length?Math.min(...processedOld):
     (oldUids.length?Number(cursor.backfill_before):
      cursor.backfill_before===0?0:ids.some(v=>v<bound&&!selected.has(v))?bound:0)
   const save=await admin.rpc('mail_save_scan_state',{p_account_id:account.id,p_folder_key:key,
     p_recent:Math.max(recent,...processedNew,0),p_before:Number.isFinite(nextBefore)?nextBefore:0})
   if(save.error)throw new Error('Scan cursor update failed')
   if(!completed)break
  }
  if(directory.length>0&&openedFolders===0)throw new Error('IMAP found folders but EXAMINE/SELECT failed (response '+firstOpenStatus+'); check folder names and mailbox permissions')
  if(folderOpenErrors>0)throw new Error('IMAP could not open '+folderOpenErrors+' of '+directory.length+' folders; refusing incomplete sync')
  if(unindexedEmptySearch>0)throw new Error('IMAP search returned no UIDs in '+unindexedEmptySearch+' nonempty folders without a saved cursor; refusing incomplete sync')
  return {processed:newMessages,checkedFolders:openedFolders,openedFolders,folderOpenErrors,advertisedMessages,foundUids}
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
 let query=admin.from('mail_accounts').select('*').eq('enabled',true)
 if(!isCron){
  if(!preferred)return apiResponse({error:'account_id required'},400)
  // Allow an explicit user-triggered check of an error account.
  query=query.eq('user_id',userId).eq('id',preferred).in('cloud_state',['ready','error'])
 }else{
  // Automatic retries back off instead of hammering bad credentials every 10 minutes.
  // Errors require explicit user intervention. Do not schedule automatic retries.
  query=query.eq('cloud_state','ready')
 }
 const rows=await query.order('last_checked_at',{ascending:true,nullsFirst:true}).limit(10)
 if(rows.error)return apiResponse({error:'Account scan lookup failed'},500)
 const account=(rows.data||[])[0]
 if(!account)return apiResponse({checked:0,processed:0})
 await admin.from('mail_accounts').update({last_checked_at:new Date().toISOString()}).eq('id',account.id)
 try{
  const result=account.provider==='outlook'&&account.auth_kind==='oauth2'
     ?await scanOutlookGraph(admin,account):await scanAccount(admin,account)
  const update:Record<string,unknown>={
   last_sync_at:new Date().toISOString(),last_error:null,cloud_state:'ready',
   consecutive_failures:0,next_attempt_at:null,
   last_processed:result.processed,last_added_count:result.processed,
   last_scanned_folders:result.checkedFolders
  }
  if(result.processed>0){
   update.last_added_at=new Date().toISOString()
   update.last_added_count=result.processed
  }
  await admin.from('mail_accounts').update(update).eq('id',account.id)
  return apiResponse({checked:1,processed:result.processed,folders:result.checkedFolders,
   opened_folders:result.openedFolders??null,folder_open_errors:result.folderOpenErrors??null,
   advertised_messages:result.advertisedMessages??null,discovered_uids:result.foundUids??null})
 }catch(e){
  const err=cleanError(e)
  const failures=Math.min(8,Number(account.consecutive_failures||0)+1)
  // Preserve last_sync_at and archived MIME: a transient failure must never
  // be presented as loss of historical connection or automatically retried.
  await admin.from('mail_accounts').update({
    last_error:err,cloud_state:'error',consecutive_failures:failures,
    next_attempt_at:null,last_processed:0
  }).eq('id',account.id)
  return apiResponse({checked:1,error:'Mailbox scan failed',detail:err,
    retry_paused:true,message:'自动重试已停止；保留既有归档，可手动检查连接'},200)
 }
})