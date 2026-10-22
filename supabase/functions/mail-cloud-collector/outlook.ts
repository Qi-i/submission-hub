import PostalMime from 'npm:postal-mime@4.0.7'
import {mailStoragePolicy,safeGraphWebLink,textPreview} from './storage-policy.ts'
const GRAPH='https://graph.microsoft.com/v1.0'
const MAX_RAW=8*1024*1024,MAX_SCAN=24,MAX_FOLDERS=55
const digest=async (input:Uint8Array|string)=>{
 const bytes=typeof input==='string'?new TextEncoder().encode(input):input
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
  .map(x=>x.toString(16).padStart(2,'0')).join('')
}
const classify=(subject:string,body:string):[string,number]=>{
 const t=subject+'\n'+body.slice(0,3500)
 if(/invitation to review|invite.{0,15}review|reviewer invitation|审稿邀请|邀请.{0,8}审稿/i.test(t))return ['review_invite',3]
 if(/manuscript (decision|accepted|rejected)|major revision|minor revision|修回|退修|稿件.{0,8}(录用|拒稿|返修)/i.test(t))return ['submission_update',3]
 if(/editorial manager|scholarone|editorial office|期刊编辑部/i.test(t))return ['editorial',2]
 if(/gift card|bitcoin payment/i.test(t))return ['suspicious',1]
 return ['other',0]
}
const deadline=(s:string)=>{
 const m=/(?:review deadline|review due|reply by|respond by|审稿截止|回复截止)[^\n]{0,90}?(\d{4})[年/.\-]\s*(\d{1,2})[月/.\-]\s*(\d{1,2})/i.exec(s.slice(0,11000))
 if(!m)return null
 const [y,mo,d]=m.slice(1).map(Number),value=new Date(Date.UTC(y,mo-1,d))
 if(value.getUTCFullYear()!==y||value.getUTCMonth()+1!==mo||value.getUTCDate()!==d)return null
 return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0')
}
const excerpt=(s:string,n:number)=>s.replace(/\s+/g,' ').slice(0,n)
export async function outlookAccess(admin:any,account:any){
 if(account.provider!=='outlook'||account.auth_kind!=='oauth2'||!account.oauth_client_id)
  throw Error('Outlook OAuth2 未授权')
 const ref=await admin.rpc('mail_read_cloud_secret',{p_account_id:account.id})
 if(ref.error||!ref.data)throw Error('Outlook OAuth2 刷新令牌缺失，请重新授权')
 const res=await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token',{
  method:'POST',redirect:'error',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:account.oauth_client_id,
   grant_type:'refresh_token',refresh_token:ref.data,scope:'offline_access User.Read Mail.Read Mail.Send'})
 })
 let body:Record<string,any>={}
 try{body=await res.json()}catch{}
 if(!res.ok||!body.access_token){
  const code=String(body.error||res.status)
  if(['invalid_grant','interaction_required','consent_required'].includes(code))throw Error('Outlook 登录授权失效，请重新连接 Microsoft 账户')
  throw Error('Microsoft OAuth2 刷新失败：'+code.slice(0,55))
 }
 if(body.refresh_token&&body.refresh_token!==ref.data){
  const updated=await admin.rpc('mail_save_cloud_secret',{
   p_account_id:account.id,p_secret:String(body.refresh_token)
  })
  if(updated.error)throw Error('OAuth2 刷新令牌轮换保存失败')
 }
 return String(body.access_token)
}
const allowedUrl=(url:string)=>{
 const u=new URL(url)
 return u.protocol==='https:'&&u.hostname==='graph.microsoft.com'&&
  !u.username&&!u.password&&!u.port&&!u.hash&&u.pathname.startsWith('/v1.0/me/')
}
async function graph(token:string,url:string){
 if(!allowedUrl(url))throw Error('Invalid Graph paging URL')
 const res=await fetch(url,{redirect:'error',headers:{
  Authorization:'Bearer '+token,Prefer:'IdType="ImmutableId"'
 }})
 if(!res.ok){
  if(res.status===429)throw Error('Microsoft Graph 限流，请稍后重试')
  if(res.status===401||res.status===403)throw Error('Microsoft Graph 邮件权限不足或授权已失效')
  throw Error('Microsoft Graph API 返回 HTTP '+res.status)
 }
 return res
}
async function listFolders(token:string){
 const result:{id:string;name:string;spam:boolean}[]=[]
 const visited=new Set<string>()
 const queue=[GRAPH+'/me/mailFolders?includeHiddenFolders=true&$top=100']
 let queries=0
 while(queue.length&&result.length<MAX_FOLDERS&&queries++<80){
  const target=queue.shift()!
  const data=await (await graph(token,target)).json()
  for(const folder of data.value||[]){
   if(typeof folder.id!=='string'||visited.has(folder.id))continue
   visited.add(folder.id)
   const name=String(folder.displayName||'').slice(0,300)
   const spam=/junk|spam|垃圾/i.test(name)||folder.wellKnownName==='junkemail'
   result.push({id:folder.id,name,spam})
   if(Number(folder.childFolderCount||0)>0)queue.push(
    GRAPH+'/me/mailFolders/'+encodeURIComponent(folder.id)+'/childFolders?includeHiddenFolders=true&$top=100')
   if(result.length>=MAX_FOLDERS)break
  }
  if(data['@odata.nextLink'])queue.push(data['@odata.nextLink'])
 }
 return result.sort((a,b)=>Number(b.spam)-Number(a.spam))
}
async function archive(admin:any,account:any,token:string,folder:{id:string;name:string;spam:boolean},item:any){
 if(typeof item.id!=='string')return false
 // Graph returns internetMessageId in the lightweight folder listing. Skip the
 // expensive MIME download when this immutable message is already archived.
 const knownMessageId=String(item.internetMessageId||'').trim()
 if(knownMessageId){
  const knownKey=await digest(knownMessageId)
  const known=await admin.from('mail_messages').select('id,last_folder')
   .eq('account_id',account.id).eq('remote_key',knownKey).maybeSingle()
  if(known.error)throw Error('Outlook 邮件索引查询失败')
  if(known.data){
   if(known.data.last_folder!==folder.name)await admin.from('mail_messages')
    .update({last_folder:folder.name,last_seen_at:new Date().toISOString()})
    .eq('id',known.data.id).eq('user_id',account.user_id)
   return false
  }
 }
 const subjectHint=String(item.subject||'').replaceAll(String.fromCharCode(0),'').slice(0,1024)
 const senderHint=String(item.from?.emailAddress?.address||'').replaceAll(String.fromCharCode(0),'')
 const senderName=String(item.from?.emailAddress?.name||'').replaceAll(String.fromCharCode(0),'')
 const policy=mailStoragePolicy('outlook',folder.name,subjectHint,senderHint)
 const bytesHint=Number(item.size||0)
 const link=safeGraphWebLink(item.webLink)
 const lightweight=policy.tier==='index'||bytesHint>MAX_RAW||
   (policy.tier==='text'&&bytesHint>256*1024)
 if(lightweight){
  const remoteKey=await digest(knownMessageId||folder.id+':'+item.id)
  const existing=await admin.from('mail_messages').select('id').eq('account_id',account.id)
   .eq('remote_key',remoteKey).maybeSingle()
  if(existing.error)throw Error('Graph header index lookup failed')
  if(existing.data)return false
  const added=await admin.from('mail_messages').insert({
   user_id:account.user_id,account_id:account.id,remote_key:remoteKey,
   internet_message_id:knownMessageId.slice(0,512),first_folder:folder.spam?'Junk':folder.name,
   last_folder:folder.name,received_at:item.receivedDateTime||null,
   sender_name:senderName,sender_address:senderHint,recipient_address:account.address,
   subject:subjectHint,snippet:bytesHint>MAX_RAW?'大邮件 · 源邮箱查看原文':policy.label+' · 源邮箱查看原文',
   body_text:'',category:'other',importance:0,storage_tier:'index',ai_state:'skipped',
   extraction:{storage_tier:'index',storage_reason:policy.label,original_size_bytes:bytesHint,
    attachments_not_copied:true,graph_message_id:item.id,...(link?{webmail_url:link}:{})},
   cloud_archive_path:null,archived_locally:false
  })
  if(added.error&&!/duplicate key/i.test(added.error.message||''))throw Error('Graph header index save failed')
  return !added.error
 }
 const raw=await graph(token,GRAPH+'/me/messages/'+encodeURIComponent(item.id)+'/$value')
 const len=Number(raw.headers.get('content-length')||0)
 if(len>MAX_RAW)throw Error('Outlook 附件超过当前扫描上限；返回后使用轻量索引')
 const bytes=new Uint8Array(await raw.arrayBuffer())
 if(bytes.length>MAX_RAW)throw Error('Outlook 邮件大小超过标称值，请在原邮箱查看')
 const parsed=await PostalMime.parse(bytes)
 const sha=await digest(bytes)
 const messageId=String(parsed.messageId||item.internetMessageId||'').trim()
 const remoteKey=await digest(messageId||sha)
 const prev=await admin.from('mail_messages').select('id,last_folder').eq('account_id',account.id)
   .eq('remote_key',remoteKey).maybeSingle()
 if(prev.error)throw Error('Outlook 邮件去重检查失败')
 if(prev.data){
  if(prev.data.last_folder!==folder.name)await admin.from('mail_messages')
    .update({last_folder:folder.name,last_seen_at:new Date().toISOString()})
    .eq('id',prev.data.id).eq('user_id',account.user_id)
  return false
 }
 const archivePath=policy.tier==='full'?account.user_id+'/'+account.id+'/'+sha+'.eml':null
 if(archivePath){
  const saved=await admin.storage.from('mail-originals').upload(archivePath,bytes,
   {contentType:'application/octet-stream',upsert:false})
  if(saved.error&&!/already exists|duplicate|409/i.test(saved.error.message||''))throw Error('Outlook MIME 存储失败')
 }
 const body=String(parsed.text||parsed.html||'').replace(/<[^>]*>/g,' ').slice(0,60000)
 const subject=String(parsed.subject||item.subject||'').slice(0,1024)
 const [category,importance]=classify(subject,body)
 const sender=parsed.from&&'address' in parsed.from?parsed.from:null
 const matched=/(?:manuscript\s*(?:id|number|no\.?|#)|稿号|稿件编号)\s*[:：#]?\s*([\w.\-/]{5,70})/i.exec(subject+' '+body.slice(0,2500))
 const date=parsed.date||item.receivedDateTime
 const row={
  user_id:account.user_id,account_id:account.id,remote_key:remoteKey,
  internet_message_id:messageId.slice(0,512),
  first_folder:folder.spam?'Junk':folder.name,last_folder:folder.name,
  received_at:date&&!Number.isNaN(Date.parse(date))?new Date(date).toISOString():null,
  sender_name:sender?.name||'',sender_address:sender?.address||'',
  recipient_address:account.address,subject,
  snippet:excerpt(body,800),body_text:policy.tier==='text'?body.slice(0,12000):body,category,importance,
  storage_tier:policy.tier,
  extraction:{...(matched?{manuscript_no:matched[1]}:{}),
   graph_message_id:item.id,storage_tier:policy.tier,storage_reason:policy.label,
   attachments_not_copied:policy.tier!=='full',...(link?{webmail_url:link}:{})},
  deadline:deadline(subject+'\n'+body),
  cloud_archive_path:archivePath,archived_locally:false
 }
 const insert=await admin.from('mail_messages').insert(row)
 if(insert.error&&!/duplicate key/i.test(insert.error.message||''))throw Error('Outlook 邮件索引保存失败')
 return !insert.error
}
export async function scanOutlookGraph(admin:any,account:any){
 const token=await outlookAccess(admin,account)
 const started=Date.now()
 const folders=await listFolders(token)
 const stored=await admin.rpc('mail_get_outlook_cursors',{p_account_id:account.id})
 if(stored.error)throw Error('Outlook 文件夹断点无法读取')
 const cursors=new Map((stored.data||[]).map((x:any)=>[x.folder_id,x.next_link]))
 let processed=0
 for(const folder of folders){
  if(processed>=MAX_SCAN||Date.now()-started>85000)break
  const prefix=GRAPH+'/me/mailFolders/'+encodeURIComponent(folder.id)+'/messages'
  const newestUrl=prefix+'?$top=6&$select=id,subject,internetMessageId,receivedDateTime,from,webLink,bodyPreview,hasAttachments,size&$orderby=receivedDateTime%20desc'
  const newest=await (await graph(token,newestUrl)).json()
  for(const item of newest.value||[]){
   if(processed>=MAX_SCAN||Date.now()-started>85000)break
   if(await archive(admin,account,token,folder,item))processed++
  }
  // Continue historical backfill without skipping a page on partial or failed uploads.
  const continuation=cursors.get(folder.id) as string|null|undefined
  if(continuation&&Date.now()-started<65000&&processed<MAX_SCAN){
   const page=await (await graph(token,continuation)).json()
   let completed=true
   for(const item of page.value||[]){
    if(processed>=MAX_SCAN||Date.now()-started>85000){completed=false;break}
    if(await archive(admin,account,token,folder,item))processed++
   }
   if(completed){
    const next=page['@odata.nextLink']||null
    const r=await admin.rpc('mail_save_outlook_cursor',{p_account_id:account.id,
      p_folder_id:folder.id,p_folder_name:folder.name,p_next_link:next})
    if(r.error)throw Error('Graph 历史归档断点保存失败')
   }
  }else if(continuation===undefined && newest['@odata.nextLink']){
   const r=await admin.rpc('mail_save_outlook_cursor',{p_account_id:account.id,
    p_folder_id:folder.id,p_folder_name:folder.name,p_next_link:newest['@odata.nextLink']})
   if(r.error)throw Error('Graph 初始归档断点保存失败')
  }
 }
 return {processed,checkedFolders:folders.length}
}