import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import {
  AlertCircle, Archive, ArrowLeft, Check, ChevronRight, Clock3, Download,
  FileText, Inbox, Link2, Mail, MailCheck, Plus, RefreshCw, Search, Settings2,
  ShieldCheck, Sparkles, PauseCircle, PlayCircle, KeyRound, Copy, ExternalLink, CheckCircle2, Folder, Tag, Languages, StickyNote, Trash2, X
} from 'lucide-react'
import MailPersonalization, {DEFAULT_MAIL_VIEWS,MAIL_VIEW_KINDS,type MailViewKind,type MailSettings} from './MailPersonalization'
import MailToast, {type MailToastKind} from './MailToast'
import './AcademicMailCenter.css'

type Account = {
  id: string
  address: string
  display_name: string
  provider: string
  enabled: boolean
  last_sync_at: string | null
  last_error: string | null
  cloud_state: string
  imap_host: string | null
  smtp_host: string | null
  imap_port: number; smtp_port: number; imap_security: string; smtp_security: string
  imap_username: string | null; smtp_username: string | null
  last_checked_at: string | null
  consecutive_failures: number
  next_attempt_at: string | null
  last_processed: number
  last_scanned_folders: number
  smtp_has_separate_key: boolean
  oauth_client_id: string | null
  oauth_identity: string | null
  auth_kind: string
  short_label: string
  logo_symbol: string
  logo_url: string | null
}
type Message = {
  id: string
  account_id: string
  subject: string
  sender_name: string | null
  sender_address: string | null
  received_at: string | null
  first_folder: string
  last_folder: string
  body_text?: string
  snippet: string
  storage_tier: 'full'|'text'|'index'
  category: string
  importance: number
  deadline: string | null
  paper_id: string | null
  review_response: string | null
  archived_locally: boolean
  cloud_archive_path: string | null
  extraction: Record<string, unknown> | null
  ai_category: string | null
  ai_summary: string | null
  ai_tags: string[] | null
  ai_action: string | null
  ai_priority: number | null
  ai_state: string
  user_note: string
  user_labels: string[]
  virtual_folder_id: string | null
  internet_message_id?: string | null
}
type MailFolder = {id:string; name:string; color:string; sort_order:number}
type MailLabel = {id:string; name:string; color:string}
type MailTranslation = {translated_text:string; source_hash:string; model_name:string}
type AccountProgress = {account_id:string;archived_count:number;full_count:number;text_count:number;index_count:number;scanned_folders:number;backfill_pending:number;history_complete:boolean;last_added_at:string|null;last_added_count:number}
type Paper = { id: string; title: string; journal: string | null; manuscript_no: string | null }
type Scope = MailViewKind
type Workspace = 'inbox' | 'accounts' | 'personalize'
type CountSummary = { all: number; review: number; pending: number; important: number; spam: number; submission: number }
const PAGE_SIZE = 40
const categories: Record<string, string> = {
  review_invite: '审稿邀请', submission_update: '投稿进展', editorial: '编辑往来',
  suspicious: '疑似风险', other: '其他',
}
const responseLabels: Record<string,string> = {
  pending: '待答复', accepted: '已接受', declined: '已拒绝', completed: '已完成',
}
const providerSymbols:Record<string,string> = {coremail:'C',qq:'Q','126':'126',gmail:'G',outlook:'O',other:'@'}
const folderColors=['#4F83E9','#9B75D9','#36A897','#E6A465','#E37A91']
const logoLabel=(a:Account)=>a.short_label?.trim()||a.display_name?.trim()||a.address.split('@')[0]
const providerLabels: Record<string,string> = {
  other: '自定义 IMAP / SMTP',
  coremail: 'Coremail', qq: 'QQ 邮箱', '126': '126 邮箱',
  gmail: 'Gmail', outlook: 'Outlook',
}
const webmailHome=(account:Account):string|null=>{
 const address=account.address.toLowerCase()
 if(account.provider==='qq')return 'https://mail.qq.com/'
 if(account.provider==='126')return 'https://mail.126.com/'
 if(account.provider==='gmail')return 'https://mail.google.com/mail/?authuser='+encodeURIComponent(account.address)
 if(account.provider==='outlook')return /@(?:[a-z0-9.-]*onmicrosoft\.com|[a-z0-9.-]*edu\.[a-z]+)$/i.test(address)
   ?'https://outlook.office.com/mail/':'https://outlook.live.com/mail/'
 if(address.endsWith('@email.cugb.edu.cn'))return 'https://www.email.cugb.edu.cn/coremail/index.jsp?nodetect=true'
 if(address.endsWith('@xju.edu.cn'))return 'https://mail.xju.edu.cn/coremail/index.jsp'
 if(address.endsWith('@mail.cugb.edu.cn'))return 'https://mail.cugb.edu.cn/'
 return null
}
const messageSourceUrl=(account:Account,message:Message):string|null=>{
 if(account.provider==='outlook'){
  const raw=message.extraction?.webmail_url
  if(typeof raw==='string'){
   try{
    const u=new URL(raw)
    if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
       ['outlook.office.com','outlook.live.com','outlook.office365.com'].includes(u.hostname.toLowerCase()))
     return u.href
   }catch{}
  }
 }
 return webmailHome(account)
}
const niceDate = (date?: string | null) => date
  ? new Date(date).toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '尚无记录'
const shortDate = (date?: string | null) => date ? new Date(date).toLocaleDateString('zh-CN') : '未知日期'
const isSpam = (message: Message) => /spam|junk|垃圾/i.test(message.first_folder + ' ' + message.last_folder)
const isSupported = (account: Account) => ['coremail','qq','126','gmail','other'].includes(account.provider)
const describeStatus = (account: Account) => {
  if (!account.enabled) return '已暂停'
  if (account.provider==='outlook')return account.cloud_state==='ready'?'Graph 已连接':account.cloud_state==='error'?'Graph 连接异常':'等待 Microsoft 授权'
  if (!isSupported(account)) return '需要 OAuth2 授权'
  if (account.cloud_state === 'error') return account.last_sync_at?'同步中断':'连接待排查'
  if (account.cloud_state === 'ready') return '自动采集中'
  return '待配置'
}
const folderQuery = 'first_folder.ilike.%junk%,first_folder.ilike.%spam%,first_folder.ilike.%垃圾%,last_folder.ilike.%junk%,last_folder.ilike.%spam%,last_folder.ilike.%垃圾%'
/** Display-time HTML entity repair for imported plaintext email; React still escapes all text. */
const readableMailText = (input?: string | null) => {
  if (!input) return ''
  return input
    .replace(/&(?:amp;)?nbsp;|&#(?:160|x0*a0);/gi, ' ')
    .replace(/&(?:amp;)?#(?:160|x0*a0);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&hellip;/gi, '…')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]{3,}/g, '  ')
    // Imported MIME often starts with dozens of blank lines, which became a
    // large empty block above the message in the scrollable reader.
    .replace(/\r\n?/g, '\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
    .trim()
}

export default function AcademicMailCenter({userId}: {userId: string}) {
  const [workspace, setWorkspace] = useState<Workspace>('inbox')
  const [pref,setPref] = useState<MailSettings|null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountProgress,setAccountProgress]=useState<Record<string,AccountProgress>>({})
  const [folders,setFolders] = useState<MailFolder[]>([])
  const [labels,setLabels] = useState<MailLabel[]>([])
  const [folderFilter,setFolderFilter] = useState('all')
  const [labelFilter,setLabelFilter] = useState('all')
  const [folderNew,setFolderNew] = useState('')
  const [labelNew,setLabelNew] = useState('')
  const [manageCollections,setManageCollections] = useState(false)
  const [noteDraft,setNoteDraft] = useState('')
  const [translation,setTranslation] = useState<MailTranslation|null>(null)
  const [translationLang,setTranslationLang] = useState<'zh'|'en'>('zh')
  const [translationVisible,setTranslationVisible] = useState(false)
  const [translationLoading,setTranslationLoading] = useState(false)
  const [translationProgress,setTranslationProgress] = useState<{done:number;total:number}|null>(null)
  const translationJob=useRef(0)
  const [brandEditing,setBrandEditing] = useState<string|null>(null)
  const [brandShort,setBrandShort] = useState('')
  const [brandSymbol,setBrandSymbol] = useState('')
  const [brandUrl,setBrandUrl] = useState('')
  const [oauthClientId,setOauthClientId] = useState('')
  const [oauthPanelId,setOauthPanelId] = useState<string|null>(null)
  const [oauth,setOauth] = useState<{accountId:string;userCode:string;interval:number;
    expiresAt:number;verificationUri:string;waiting:boolean}|null>(null)
  const [papers, setPapers] = useState<Paper[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [counts, setCounts] = useState<CountSummary>({all:0,review:0,pending:0,important:0,spam:0,submission:0})
  const [scope, setScope] = useState<Scope>('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [activeBody, setActiveBody] = useState('')
  const [bodyLoading, setBodyLoading] = useState(false)
  const [mobileDetail, setMobileDetail] = useState(false)
  const readerRef = useRef<HTMLElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [warning, setWarning] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [newProvider, setNewProvider] = useState('coremail')
  const [setupId, setSetupId] = useState<string | null>(null)
  const [detailAccountId,setDetailAccountId] = useState<string|null>(null)
  const [imapHost, setImapHost] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [smtpHost,setSmtpHost] = useState('')
  const [smtpPassword,setSmtpPassword] = useState('')
  const [smtpUseImapCredential,setSmtpUseImapCredential] = useState(true)
  const [imapPort,setImapPort] = useState(993)
  const [smtpPort,setSmtpPort] = useState(465)
  const [imapSecurity,setImapSecurity] = useState('ssl')
  const [smtpSecurity,setSmtpSecurity] = useState('ssl')
  const [imapUsername,setImapUsername] = useState('')
  const [smtpUsername,setSmtpUsername] = useState('')
  const [suggestions,setSuggestions] = useState<{type:'imap'|'smtp';host:string;port:number;security:string;source:string}[]>([])
  const [connectionResults,setConnectionResults] = useState<Record<string,{ok:boolean;message:string}>>({})
  const [showCompose,setShowCompose] = useState(false)
  const [composeAccount,setComposeAccount] = useState('')
  const [composeTo,setComposeTo] = useState('')
  const [composeSubject,setComposeSubject] = useState('')
  const [composeBody,setComposeBody] = useState('')
  const [replyId,setReplyId] = useState('')
  const listSequence = useRef(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])
  useEffect(() => { setPage(0); setSelected(null); setMobileDetail(false) },
    [scope, accountFilter, folderFilter, labelFilter, debouncedSearch])

  const loadMetadata = useCallback(async () => {
    const accountQuery = (supabase.from('mail_accounts') as any)
      .select('id,address,display_name,provider,enabled,last_sync_at,last_error,cloud_state,imap_host,smtp_host,imap_port,smtp_port,imap_security,smtp_security,imap_username,smtp_username,last_checked_at,consecutive_failures,next_attempt_at,last_processed,last_scanned_folders,smtp_has_separate_key,oauth_client_id,oauth_identity,auth_kind,short_label,logo_symbol,logo_url')
      .eq('user_id', userId).order('created_at', {ascending: true})
    const papersQuery = (supabase.from('papers') as any)
      .select('id,title,journal,manuscript_no').eq('user_id', userId)
      .order('updated_at',{ascending:false}).limit(300)
    const base = () => (supabase.from('mail_messages') as any).select('id',{count:'exact',head:true}).eq('user_id',userId)
    const [a,p,all,review,pending,important,spam,submission,prefResult,folderResult,labelResult,progressResult] = await Promise.all([
      accountQuery, papersQuery, base().neq('storage_tier','index'), base().or('category.eq.review_invite,ai_category.eq.review_invite'),
      base().or('category.eq.review_invite,ai_category.eq.review_invite').or('review_response.is.null,review_response.eq.pending'),
      base().or('importance.gte.2,ai_priority.gte.2'), base().or(folderQuery),
       base().or('category.eq.submission_update,ai_category.eq.submission_update'),
      (supabase.from('mail_preferences') as any).select('*').eq('user_id',userId).maybeSingle(),
       (supabase.from('mail_folders') as any).select('id,name,color,sort_order').eq('user_id',userId).order('sort_order').order('name'),
       (supabase.from('mail_labels') as any).select('id,name,color').eq('user_id',userId).order('name'),
       (supabase as any).rpc('mail_account_progress'),
    ])
    const failed = [a,p,all,review,pending,important,spam,submission,prefResult,folderResult,labelResult,progressResult].find(x=>x.error)
    if (failed?.error) {setError(failed.error.message); return}
    setAccounts(a.data||[])
    setAccountProgress(Object.fromEntries(((progressResult.data||[]) as AccountProgress[]).map(v=>[v.account_id,v])))
    setFolders(folderResult.data||[])
    setLabels(labelResult.data||[])
    setPref(prefResult.data||null)
    setPapers(p.data||[])
    setCounts({all:all.count||0,review:review.count||0,pending:pending.count||0,important:important.count||0,spam:spam.count||0,submission:submission.count||0})
  }, [userId])

  const loadMessages = useCallback(async () => {
    const sequence = ++listSequence.current
    setLoading(true)
    let q=(supabase.from('mail_messages') as any)
      .select('id,account_id,subject,sender_name,sender_address,received_at,first_folder,last_folder,snippet,storage_tier,category,importance,deadline,paper_id,review_response,archived_locally,cloud_archive_path,internet_message_id,extraction,ai_category,ai_summary,ai_tags,ai_action,ai_priority,ai_state,user_note,user_labels,virtual_folder_id',
        {count:'exact'})
      .eq('user_id',userId).order('received_at',{ascending:false,nullsFirst:false})
      .range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1)
    if(scope==='review_invite'||scope==='pending'||scope==='submission_update'){const target=scope==='pending'?'review_invite':scope;q=q.or('category.eq.'+target+',ai_category.eq.'+target)}
    if(scope==='pending') q=q.or('review_response.is.null,review_response.eq.pending')
    if(scope==='important') q=q.or('importance.gte.2,ai_priority.gte.2')
    if(scope==='all'&&accountFilter==='all'&&!debouncedSearch)q=q.neq('storage_tier','index')
    if(accountFilter!=='all') q=q.eq('account_id',accountFilter)
    if(folderFilter==='unfiled')q=q.is('virtual_folder_id',null)
    else if(folderFilter!=='all')q=q.eq('virtual_folder_id',folderFilter)
    if(labelFilter!=='all')q=q.contains('user_labels',[labelFilter])
    const term=debouncedSearch.replace(/[^一-鿿\p{L}\p{N}\s._-]/gu,' ').slice(0,100).trim()
    const keywordOr=term?'subject.ilike.%'+term+'%,sender_address.ilike.%'+term+'%,body_text.ilike.%'+term+'%':''
    if(scope==='spam'&&keywordOr) q=q.or('and(or('+folderQuery+'),or('+keywordOr+'))')
    else if(scope==='spam') q=q.or(folderQuery)
    else if(keywordOr) q=q.or(keywordOr)
    const result=await q
    if(sequence!==listSequence.current) return
    setLoading(false)
    if(result.error) {setError(result.error.message);return}
    const items=(result.data||[]) as Message[]
    setMessages(items)
    setTotal(result.count||0)
    setSelected(current=>current && items.some(m=>m.id===current) ? current : items[0]?.id||null)
  },[userId,page,scope,accountFilter,folderFilter,labelFilter,debouncedSearch])

  useEffect(()=>{void loadMetadata()},[loadMetadata])
  useEffect(()=>{void loadMessages()},[loadMessages])
  // Do not poll the database continuously while the user reads a message.
  // Refresh on returning to the tab; manual refresh remains available.
  useEffect(()=>{
    const onReturn=()=>{if(document.visibilityState==='visible'){
      void loadMetadata();void loadMessages()
    }}
    document.addEventListener('visibilitychange',onReturn)
    return ()=>{
      document.removeEventListener('visibilitychange',onReturn)
    }
  },[loadMetadata,loadMessages])

  // New archived messages appear without refreshing every minute.
  // Coalesce a batch of Supabase INSERT events into one metadata/list query.
  useEffect(()=>{
    let scheduled:ReturnType<typeof setTimeout>|undefined
    const channel=supabase.channel('academic-mail-insert-'+userId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'mail_messages',
        filter:'user_id=eq.'+userId},()=>{
        if(scheduled!==undefined)window.clearTimeout(scheduled)
        scheduled=window.setTimeout(()=>{void loadMetadata();void loadMessages()},800)
      }).subscribe()
    return ()=>{
      if(scheduled!==undefined)window.clearTimeout(scheduled)
      void supabase.removeChannel(channel)
    }
  },[userId,loadMetadata,loadMessages])

  const active=useMemo(()=>messages.find(m=>m.id===selected)||null,[messages,selected])
  useEffect(()=>{
    if(!selected){setActiveBody('');setBodyLoading(false);return}
    let cancelled=false
    setActiveBody('')
    setBodyLoading(true)
    void (async()=>{
      const {data,error:detailError}=await (supabase.from('mail_messages') as any)
        .select('body_text').eq('user_id',userId).eq('id',selected).maybeSingle()
      if(cancelled)return
      setBodyLoading(false)
      if(detailError){setError(detailError.message);return}
      setActiveBody(data?.body_text||'')
    })()
    return ()=>{cancelled=true}
  },[selected,userId])
  // Each selected message starts at its title; do not carry over the scroll
  // offset from a previously viewed long newsletter or review correspondence.
  useEffect(()=>{if(readerRef.current)readerRef.current.scrollTop=0},[selected])
  useEffect(()=>{setNoteDraft(active?.user_note||'')},[active?.id,active?.user_note])
  useEffect(()=>{
    setTranslation(null)
    if(!selected||!translationVisible)return
    let cancelled=false
    void (async()=>{
      const r=await (supabase.from('mail_translations') as any)
       .select('translated_text,source_hash,model_name').eq('user_id',userId)
       .eq('message_id',selected).eq('target_language',translationLang).maybeSingle()
      if(!cancelled&&r.data)setTranslation(r.data)
    })()
    return ()=>{cancelled=true}
  },[userId,selected,translationLang,translationVisible])
  const selectedAccount=useMemo(()=>accounts.find(a=>a.id===active?.account_id),[accounts,active])
  const suggestedPaper = useMemo(()=>{
    if(!active?.extraction?.manuscript_no||active.paper_id)return null
    const target=String(active.extraction.manuscript_no).trim().toLowerCase()
    return papers.find(p=>p.manuscript_no?.trim().toLowerCase()===target)||null
  },[active,papers])
  const canGoNext=(page+1)*PAGE_SIZE<total
  const savedViews=(pref?.workspace?.views?.length?pref.workspace.views:DEFAULT_MAIL_VIEWS).filter(v=>v&&MAIL_VIEW_KINDS[v.kind])
  const cloudReady=accounts.filter(a=>a.enabled&&a.cloud_state==='ready').length

  const callFunction=async(path:string,payload:Record<string,unknown>)=>{
    const {data,error:authError}=await supabase.auth.getSession()
    if(authError||!data.session?.access_token) throw new Error('登录已失效，请重新登录')
    const response=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/'+path,{
      method:'POST',
      headers:{'authorization':'Bearer '+data.session.access_token,'content-type':'application/json'},
      body:JSON.stringify(payload),
    })
    const result=await response.json()
    if(!response.ok||result.error)throw new Error(result.detail||result.error||'云端操作失败')
    return result
  }
  const addAccount=async()=>{
    const address=newAddress.trim().toLowerCase()
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){setError('请输入有效的邮箱地址');return}
    setBusy('add')
    try{
      const {error:saveError}=await (supabase.from('mail_accounts') as any).insert({
        user_id:userId,address,display_name:address,provider:newProvider,
      })
      if(saveError)throw saveError
      setShowAdd(false);setNewAddress('');setNotice('邮箱已添加，请完成 IMAP 授权')
      await loadMetadata()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  const showOutlook=(a:Account)=>{
    setOauthPanelId(a.id);setOauthClientId(a.oauth_client_id||'')
  }
  const startOutlook=async(a:Account)=>{
    setBusy('oauth-'+a.id)
    try{
      const data=await callFunction('mail-outlook-oauth',{
       action:'start',account_id:a.id,client_id:oauthClientId.trim()
      })
      setOauth({accountId:a.id,userCode:data.user_code,interval:Math.max(5,Number(data.interval||7)),
       expiresAt:Date.now()+Number(data.expires_in||900)*1000,
       verificationUri:data.verification_uri,waiting:true})
      setNotice('微软授权码已生成。点击「打开微软授权」并输入验证码，同意权限后会自动检测。')
      await loadMetadata()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  const disconnectOutlook=async(a:Account)=>{
    if(!window.confirm('断开 Microsoft OAuth2 授权？本系统保存的令牌将被撤销，既有邮件归档保留。'))return
    setBusy('disconnect-'+a.id)
    try{
     const data=await callFunction('mail-outlook-oauth',{action:'disconnect',account_id:a.id})
     setOauth(null);setOauthPanelId(null)
     setNotice(data.message||'已断开 Outlook')
     await loadMetadata()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  useEffect(()=>{
    if(!oauth?.waiting)return
    let cancelled=false,timeout:ReturnType<typeof setTimeout>|undefined
    const poll=async()=>{
      if(cancelled)return
      if(Date.now()>oauth.expiresAt){
        setOauth(null);setError('Microsoft 授权码已过期，重新点击「开始授权」即可。');return
      }
      try{
        const data=await callFunction('mail-outlook-oauth',{action:'poll',account_id:oauth.accountId})
        if(cancelled)return
        if(data.connected){
          const id=oauth.accountId
          setOauth(null)
          setNotice('Outlook 已完成 OAuth2 授权；开始首次归档邮件。')
          await loadMetadata()
          await manualSync(id)
          return
        }
        const next=Math.max(oauth.interval,Number(data.interval||oauth.interval))
        timeout=setTimeout(poll,next*1000)
      }catch(e){
        if(cancelled)return
        setOauth(null)
        setError(e instanceof Error?e.message:String(e))
      }
    }
    timeout=setTimeout(poll,Math.max(5,oauth.interval)*1000)
    return()=>{cancelled=true;if(timeout)clearTimeout(timeout)}
  // Bind only to the current authorization session; avoid resetting timers on every rerender.
  },[oauth?.accountId,oauth?.expiresAt,oauth?.interval,oauth?.waiting])
    const setupAccount=(a:Account)=>{
    setSetupId(a.id)
    setImapHost(a.imap_host||(a.provider==='qq'?'imap.qq.com':a.provider==='126'?'imap.126.com':a.provider==='gmail'?'imap.gmail.com':''))
    setSmtpHost(a.smtp_host||(a.provider==='qq'?'smtp.qq.com':a.provider==='126'?'smtp.126.com':a.provider==='gmail'?'smtp.gmail.com':''))
    setImapPort(a.imap_port||993);setSmtpPort(a.smtp_port||465)
    setImapSecurity(a.imap_security||'ssl');setSmtpSecurity(a.smtp_security||'ssl')
    setImapUsername(a.imap_username||a.address);setSmtpUsername(a.smtp_username||a.address)
    setAppPassword('');setSmtpPassword('');setSmtpUseImapCredential(!a.smtp_has_separate_key)
    setSuggestions([]);setConnectionResults({})
  }
  const discover=async(id:string)=>{
    setBusy('discover')
    try{
      const data=await callFunction('mail-config',{action:'discover',account_id:id})
      setSuggestions(data.candidates||[])
      setNotice((data.candidates||[]).length?'已获取服务商及 DNS 配置建议，选择后请测试连接':'未发现公开的自动配置记录，请手动填写官方参数')
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  const testAccount=async(id:string)=>{
    setBusy('test-'+id);setConnectionResults({})
    try{
      const data=await callFunction('mail-config',{action:'test',account_id:id})
      setConnectionResults(data.results||{})
      await loadMetadata()
      if(!data.ok)setError('IMAP 登录验证未通过，查看下方具体错误')
      const entries=Object.entries(data.results||{}) as [string,{ok:boolean;message:string}][]
      setNotice(entries.length?entries.map(([kind,result])=>kind.toUpperCase()+': '+(result.ok?'验证成功':'验证失败')).join('，'):'尚未保存服务器配置')
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  const saveConfiguration=async()=>{
    if(!setupId||!imapHost)return
    setBusy('configure')
    try{
      const existing=accounts.find(a=>a.id===setupId)
      if(!smtpUseImapCredential&&!smtpPassword&&!existing?.smtp_has_separate_key)
        throw Error('已选用独立 SMTP 授权码，请填写对应的授权码')
      await callFunction('mail-config',{action:'configure',account_id:setupId,
        host:imapHost.trim(),imap_port:imapPort,imap_security:imapSecurity,imap_username:imapUsername.trim(),
        smtp_host:smtpHost.trim(),smtp_port:smtpPort,smtp_security:smtpSecurity,smtp_username:smtpUsername.trim(),
        password:appPassword,smtp_password:smtpUseImapCredential?'':smtpPassword,
        smtp_use_imap_credential:smtpUseImapCredential})
      setAppPassword('');setSmtpPassword('')
      const tested=await callFunction('mail-config',{action:'test',account_id:setupId})
      setConnectionResults(tested.results||{})
      await loadMetadata()
      if(tested.ok){
        const smtpResult=tested.results?.smtp
        setNotice(smtpResult&&!smtpResult.ok?'IMAP 登录成功，已启动收信；SMTP 验证失败，请检查独立发信授权':'IMAP/SMTP 已完成验证，自动收信已启用')
      }else{
        setError('设置已保存，但 IMAP 登录测试未通过；后台不会使用此配置自动重试，请检查下方连接结果')
      }
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  const manualSync=async(accountId:string)=>{
    setBusy('sync-'+accountId)
    try{
      const result=await callFunction('mail-cloud-collector',{account_id:accountId})
      if(result.error)throw Error(result.detail||result.error)
      if(!result.checked)throw Error('未找到可同步的已授权邮箱；请先验证 IMAP 或恢复采集')
      setNotice('扫描完成：本次处理 '+(result.processed||0)+' 封邮件，检查 '+(result.folders||0)+' 个文件夹')
      await Promise.all([loadMetadata(),loadMessages()])
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  const toggleCollection=async(a:Account)=>{
    setBusy('toggle-'+a.id)
    try{
      await callFunction('mail-config',{action:a.enabled?'disable':'enable',account_id:a.id})
      setNotice(a.enabled?'已暂停此邮箱的自动收取；已有归档保留':'IMAP 已重新验证，自动收取已恢复')
      await loadMetadata()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  const saveMessage=async(changes:Record<string,unknown>)=>{
    if(!active)return
    const id=active.id
    setBusy('message')
    try{
      const {error:saveError}=await (supabase.from('mail_messages') as any)
        .update(changes).eq('id',id).eq('user_id',userId)
      if(saveError)throw saveError
      setMessages(current=>current.map(m=>m.id===id?{...m,...changes} as Message:m))
      setNotice('邮件信息已更新')
      void loadMetadata()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  const addFolder=async()=>{
    const name=folderNew.trim()
    if(!name||name.length>40)return
    setBusy('folder')
    try{
      const {error:e}=await (supabase.from('mail_folders') as any).insert({
        user_id:userId,name,color:folderColors[folders.length%folderColors.length],sort_order:folders.length
      })
      if(e)throw e
      setFolderNew('');await loadMetadata();setNotice('跨邮箱文件夹已建立，不会移动原邮箱的邮件')
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(null)}
  }
  const deleteFolder=async(folder:MailFolder)=>{
    if(!window.confirm('删除文件夹「'+folder.name+'」？邮件保留，仅取消虚拟归类。'))return
    const {error:e}=await (supabase.from('mail_folders') as any).delete().eq('id',folder.id).eq('user_id',userId)
    if(e)setError(e.message)
    else{if(folderFilter===folder.id)setFolderFilter('all');await loadMetadata();void loadMessages()}
  }
  const addLabel=async()=>{
    const name=labelNew.trim()
    if(!name||name.length>28)return
    setBusy('label')
    try{
      const {error:e}=await (supabase.from('mail_labels') as any).insert({
        user_id:userId,name,color:folderColors[(labels.length+1)%folderColors.length]
      })
      if(e)throw e
      setLabelNew('');await loadMetadata();setNotice('跨邮箱标签已创建')
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(null)}
  }
  const deleteLabel=async(label:MailLabel)=>{
    if(!window.confirm('删除标签「'+label.name+'」及所有邮件上的这一标签？邮件本身不会删除。'))return
    const {error:e}=await (supabase as any).rpc('mail_delete_label',{p_label_id:label.id})
    if(e)setError(e.message)
    else{if(labelFilter===label.name)setLabelFilter('all');await Promise.all([loadMetadata(),loadMessages()])}
  }
  const toggleLabel=async(name:string)=>{
    if(!active)return
    const current=active.user_labels||[]
    const next=current.includes(name)?current.filter(v=>v!==name):[...current,name]
    await saveMessage({user_labels:next})
  }
  const saveBrand=async(account:Account)=>{
    if(brandShort.trim().length>18||brandSymbol.trim().length>8){
      setError('来源简称或图标过长');return
    }
    const link=brandUrl.trim()
    if(link&&!/^https:\/\/[a-z0-9.-]+\/[\S]{0,570}$/i.test(link)){
      setError('Logo 请使用公开的 HTTPS 图片地址');return
    }
    setBusy('brand')
    try{
      const {error:e}=await (supabase.from('mail_accounts') as any).update({
        short_label:brandShort.trim(),logo_symbol:brandSymbol.trim(),logo_url:link||null
      }).eq('user_id',userId).eq('id',account.id)
      if(e)throw e
      setBrandEditing(null);await loadMetadata();setNotice('来源简称及图标已更新')
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(null)}
  }
  const runTranslation=async()=>{
    if(!active||translationLoading)return
    const job=++translationJob.current
    const id=active.id,lang=translationLang
    setTranslationLoading(true)
    setTranslationProgress(null)
    try{
      let index=0
      for(let attempts=0;attempts<100;attempts++){
        const r=await callFunction('mail-translate',{
          message_id:id,target_language:lang,chunk_index:index
        })
        if(job!==translationJob.current)return
        setTranslationProgress({done:r.completed??index+1,total:r.chunk_total??1})
        if(r.complete){
          setTranslation({translated_text:r.translation,source_hash:'',model_name:r.model||''})
          setTranslationVisible(true)
          setNotice(r.cached?'已加载完整译文':'整封邮件翻译完成')
          return
        }
        if(!Number.isSafeInteger(r.next_index)||r.next_index<=index)
          throw Error('分段翻译进度无效')
        index=r.next_index
        // One in-flight request at a time; don't flood free-model concurrency.
        if(!r.cached)await new Promise<void>(done=>window.setTimeout(done,1500))
      }
      throw Error('段落过多，请再次点击以续传')
    }catch(e){
      if(job===translationJob.current)
        setError((e instanceof Error?e.message:String(e))+'；已完成段落会保留，再次点击可继续')
    }finally{
      if(job===translationJob.current)setTranslationLoading(false)
    }
  }
    const downloadOriginal=async()=>{
    if(!active?.cloud_archive_path)return
    setBusy('download')
    try{
      const {data,error:downloadError}=await supabase.storage.from('mail-originals')
        .createSignedUrl(active.cloud_archive_path,120)
      if(downloadError||!data?.signedUrl)throw new Error(downloadError?.message||'无法访问私有归档文件')
      window.open(data.signedUrl,'_blank','noopener,noreferrer')
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
    const savePref=async(change:Partial<MailSettings>):Promise<void>=>{
    setBusy('pref')
    try{
      const next={...pref,...change,user_id:userId}
      const {error:err}=await (supabase.from('mail_preferences') as any)
        .upsert(next,{onConflict:'user_id'})
      if(err)throw err
      setPref(next as MailSettings)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  const saveAIKey=async(key:string):Promise<void>=>{
    setBusy('ai-key')
    try{
      await callFunction('mail-ai-settings',{action:'save_key',api_key:key})
      setNotice('API Key 已在云端加密保存')
      await loadMetadata()
    }catch(e){setError(e instanceof Error?e.message:String(e));throw e}
    finally{setBusy(null)}
  }
    const compose=(reply=false)=>{
    setComposeAccount(active?.account_id||accounts.find(a=>a.enabled&&(a.smtp_host||(a.provider==='outlook'&&a.cloud_state==='ready')))?.id||'')
    setComposeTo(reply?(active?.sender_address||''):'')
    setComposeSubject(reply?(active?.subject?.startsWith('Re:')?active.subject:'Re: '+(active?.subject||'')):'')
    setComposeBody('')
    setReplyId(reply?(active?.internet_message_id||''):'')
    setShowCompose(true)
  }
  const sendMail=async()=>{
    if(!composeAccount||!composeTo.trim()||!composeSubject.trim()||!composeBody.trim())return
    if(!confirm('确认使用选定邮箱发送邮件？发送后无法撤回。'))return
    setBusy('send')
    try{
      const response=await callFunction('mail-send',{account_id:composeAccount,to:composeTo.trim(),
        subject:composeSubject.trim(),content:composeBody,reply_to:replyId})
      setShowCompose(false);setComposeBody('')
      setNotice(response.message||'邮件已被服务器接受，稍后可在已发送文件夹核对')
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
    const pickScope=(next:Scope)=>{setScope(next);setPage(0)}
  const showToast=useCallback((kind:MailToastKind,message:string)=>{
    if(kind==='error')setError(message)
    else if(kind==='warning')setWarning(message)
    else setNotice(message)
  },[])
  const dismissError=useCallback(()=>setError(''),[])
  const dismissNotice=useCallback(()=>setNotice(''),[])
  const dismissWarning=useCallback(()=>setWarning(''),[])
    const goToAccounts=()=>{setWorkspace('accounts');setNotice('');setError('')}
  const refresh=async()=>{setNotice('');await Promise.all([loadMessages(),loadMetadata()])}

  return <main className={'academic-mail-center am-mode-'+workspace}>
    <header className="am-header am-command-header">
      <div className="am-header-copy">
        <h2>学术邮件与审稿</h2>
      </div>
      <nav className="am-tabs" aria-label="邮件中心导航">
        <button type="button" className={workspace==='inbox'?'active':''} onClick={()=>setWorkspace('inbox')}><Inbox size={16}/> 邮件工作台</button>
        <button type="button" className={workspace==='accounts'?'active':''} onClick={goToAccounts}><Settings2 size={16}/> 邮箱与同步</button>
        <button type="button" className={workspace==='personalize'?'active':''} onClick={()=>{setWorkspace('personalize');setNotice('');setError('')}}><Sparkles size={16}/> 自定义与 AI</button>
      </nav>
      <div className="am-header-actions">
        <div className="am-command-status" aria-label="邮件服务状态">
          <span className="am-status-account" title="已连接并启用自动采集的邮箱"><span className="am-status-dot"/>邮箱 {cloudReady}/{accounts.length}</span>
        </div>
        <button type="button" className="am-icon-button" onClick={()=>void refresh()} title="刷新数据" aria-label="刷新数据"><RefreshCw size={17}/></button>
        <button type="button" className="am-main-button" onClick={()=>compose(false)}><Plus size={15}/> 写邮件</button>
      </div>
    </header>

    <MailToast error={error} notice={notice} warning={warning}
      onDismissError={dismissError} onDismissNotice={dismissNotice} onDismissWarning={dismissWarning}/>

    {workspace==='inbox'?<>
      <div className={"am-filterbar"+(pref?.workspace?.show_statistics===false?" no-views":"")}>
        {pref?.workspace?.show_statistics!==false&&<div className="am-stats am-dynamic-views">
        {savedViews.map(view=><button type="button" key={view.id} className={scope===view.kind?'active':''} onClick={()=>pickScope(view.kind)}><span>{view.title}</span>
          <strong>{view.kind==='all'?counts.all:view.kind==='important'?counts.important:view.kind==='spam'?counts.spam:view.kind==='pending'?counts.pending:view.kind==='review_invite'?counts.review:view.kind==='submission_update'?counts.submission:0}</strong></button>)}
      </div>}

      <div className="am-controls">
        <label className="am-search"><Search size={17}/><input aria-label="跨邮箱全文检索" placeholder="搜索稿件编号、期刊、主题、发件人或正文…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" onClick={()=>setSearch('')} aria-label="清空搜索"><X size={14}/></button>}</label>
        <select aria-label="选择邮箱" value={accountFilter} onChange={e=>setAccountFilter(e.target.value)}>
          <option value="all">所有邮箱</option>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.address}</option>)}
        </select>
        <select aria-label="邮件类型" value={scope} onChange={e=>pickScope(e.target.value as Scope)}>
          <option value="all">所有类型</option>
          <option value="pending">待答复邀请</option><option value="review_invite">全部审稿邀请</option><option value="submission_update">投稿进展</option>
          <option value="important">重点关注</option><option value="spam">垃圾邮件来源</option>
        </select>
      </div>
      </div>
      <div className="am-organizer-bar" aria-label="跨邮箱虚拟文件夹与标签">
        <div className="am-organizer-folders">
          <Folder size={14}/>
          <button type="button" className={folderFilter==='all'?'active':''} onClick={()=>setFolderFilter('all')}>全部邮件</button>
          <button type="button" className={folderFilter==='unfiled'?'active':''} onClick={()=>setFolderFilter('unfiled')}>未整理</button>
          {folders.map(folder=><button key={folder.id} type="button" className={folderFilter===folder.id?'active':''}
            onClick={()=>setFolderFilter(folder.id)}><span className="am-color-point" style={{background:folder.color}}/>{folder.name}</button>)}
        </div>
        <select aria-label="按自定义标签筛选" value={labelFilter} onChange={e=>setLabelFilter(e.target.value)}>
          <option value="all">所有标签</option>{labels.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
        <button type="button" className={'am-organizer-manage '+(manageCollections?'active':'')} onClick={()=>setManageCollections(v=>!v)}>
          <Settings2 size={13}/>整理
        </button>
      </div>
      {manageCollections&&<div className="am-organizer-manager">
        <section><strong><Folder size={15}/>管理虚拟文件夹</strong>
          <p>跨邮箱统一分类，不移动或删除服务器邮件。</p>
          <div className="am-inline-create"><input value={folderNew} maxLength={40} placeholder="例如：投稿进展、审稿、学术交流" onChange={e=>setFolderNew(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void addFolder()}}/>
            <button type="button" disabled={!!busy||!folderNew.trim()} onClick={()=>void addFolder()}><Plus size={13}/>新建</button></div>
          <div className="am-managed-items">{folders.map(t=><span key={t.id}><i style={{background:t.color}}/>{t.name}<button type="button" title={'删除 '+t.name} onClick={()=>void deleteFolder(t)}><Trash2 size={13}/></button></span>)}</div>
        </section>
        <section><strong><Tag size={15}/>管理跨邮箱标签</strong>
          <p>同一封邮件可以同时使用多个标签。</p>
          <div className="am-inline-create"><input value={labelNew} maxLength={28} placeholder="例如：重要、待回复、需要翻译" onChange={e=>setLabelNew(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void addLabel()}}/>
            <button type="button" disabled={!!busy||!labelNew.trim()} onClick={()=>void addLabel()}><Plus size={13}/>新建</button></div>
          <div className="am-managed-items">{labels.map(t=><span key={t.id}><i style={{background:t.color}}/>{t.name}<button type="button" title={'删除 '+t.name} onClick={()=>void deleteLabel(t)}><Trash2 size={13}/></button></span>)}</div>
        </section>
      </div>}

      {accounts.length===0&&<div className="am-onboarding">
        <div className="am-onboarding-icon"><MailCheck size={25}/></div>
        <div><strong>先接入第一个学术邮箱</strong><p>在网页内配置 Coremail、QQ 或 126 邮箱。云端自动检查和独立保全垃圾邮件，不需要电脑常开。</p></div>
        <button type="button" className="am-main-button" onClick={()=>{setWorkspace('accounts');setShowAdd(true)}}>添加邮箱 <ChevronRight size={16}/></button>
      </div>}

      <section className={'am-workspace '+(mobileDetail?'show-detail':'')+(pref?.workspace?.compact?' am-compact':'')} aria-label="邮件列表和阅读区">
        <aside className="am-list-pane">
          <div className="am-list-heading"><span>邮件列表 <small>{total.toLocaleString('zh-CN')} 封匹配</small></span><span>{page+1} / {Math.max(1,Math.ceil(total/PAGE_SIZE))} 页</span></div>
          <div className="am-message-list" aria-busy={loading}>
            {loading&&<div className="am-empty"><RefreshCw size={20}/>正在读取邮件索引…</div>}
            {!loading&&!messages.length&&<div className="am-empty"><Inbox size={27}/><strong>没有匹配的邮件</strong><span>可以更换筛选条件或先同步邮箱</span></div>}
            {!loading&&messages.map(m=><button type="button" key={m.id} className={'am-message '+(selected===m.id?'selected':'')} data-category={m.category} data-spam={isSpam(m)?'true':'false'} onClick={()=>{setSelected(m.id);setMobileDetail(true)}}>
              <div className="am-msg-from"><div className="am-from-group">
                {accounts.find(a=>a.id===m.account_id)&&<span className="am-source-badge"
                  title={accounts.find(a=>a.id===m.account_id)?.address}>
                  {accounts.find(a=>a.id===m.account_id)?.logo_symbol||providerSymbols[accounts.find(a=>a.id===m.account_id)?.provider||'other']}
                  </span>}
                <strong>{m.sender_name||m.sender_address||'未知发件人'}</strong>
                </div><time>{shortDate(m.received_at)}</time></div>
              <div className="am-msg-subject">{m.subject||'（无主题）'}</div>
              <p>{readableMailText(m.ai_summary||m.snippet||'无邮件预览')}</p>
              <div className="am-msg-labels"><span className={'am-chip am-cat-'+m.category}>{categories[m.category]||'其他'}</span>{(m.ai_priority??m.importance)>=2&&<span className="am-chip">重要</span>}{isSpam(m)&&<span className="am-chip am-spam">垃圾箱来源</span>}{m.deadline&&<span className="am-chip am-deadline"><Clock3 size={11}/>{m.deadline}</span>}{m.ai_category&&m.ai_category!=='other'&&<span className="am-chip am-ai-label">AI：{categories[m.ai_category]||m.ai_category}</span>}
              <span className="am-chip am-source-name" title={accounts.find(a=>a.id===m.account_id)?.address}>{logoLabel(accounts.find(a=>a.id===m.account_id)||{address:'?',display_name:'',short_label:''} as Account)}</span>
              {m.virtual_folder_id&&folders.find(f=>f.id===m.virtual_folder_id)&&<span className="am-chip am-folder-chip"><Folder size={10}/>{folders.find(f=>f.id===m.virtual_folder_id)?.name}</span>}
              {(m.user_labels||[]).slice(0,3).map(tag=><span key={tag} className="am-chip am-user-tag">{tag}</span>)}
              {m.user_note&&<span className="am-chip am-note-icon" title="有备注"><StickyNote size={11}/></span>}</div>
            </button>)}
          </div>
          <div className="am-pager"><button type="button" disabled={page===0} onClick={()=>setPage(n=>Math.max(0,n-1))}>上一页</button><span>{total?Math.min(page*PAGE_SIZE+1,total)+'–'+Math.min((page+1)*PAGE_SIZE,total):'0'} / {total}</span><button type="button" disabled={!canGoNext} onClick={()=>setPage(n=>n+1)}>下一页</button></div>
        </aside>
        <article className="am-reader" ref={readerRef}>
          {!active?<div className="am-reader-empty"><FileText size={28}/><strong>选择一封邮件</strong><span>查看正文、来源邮箱、审稿状态及投稿关联</span></div>:<>
            <button type="button" className="am-back" onClick={()=>setMobileDetail(false)}><ArrowLeft size={15}/> 返回列表</button>
            <div className="am-reader-top"><div className="am-reader-subtype"><span className={'am-chip am-cat-'+active.category}>{categories[active.category]||'其他'}</span>{isSpam(active)&&<span className="am-chip am-spam">原垃圾箱邮件</span>}</div><h3>{active.subject||'（无主题）'}</h3></div>
            <div className="am-meta">
              <div><span>发件人</span><strong>{active.sender_name||'未填写'} <small>{active.sender_address||''}</small></strong></div>
              <div><span>收件时间</span><strong>{niceDate(active.received_at)}</strong></div>
              <div><span>来源邮箱 / 服务器文件夹</span><strong className="am-reader-source">
                  <span className="am-source-badge">{selectedAccount?.logo_symbol||providerSymbols[selectedAccount?.provider||'other']}</span>
                  {selectedAccount?logoLabel(selectedAccount):'未知邮箱'} · {active.first_folder}</strong>
                  <small title={selectedAccount?.address}>{selectedAccount?.address}</small></div>
              <div><span>保存方式</span><strong>{active.storage_tier==='index'?'仅索引 · 原邮箱查看':active.storage_tier==='text'?'正文 · 不存附件':active.cloud_archive_path?'完整原文归档':'正文记录'}</strong>
               {selectedAccount&&messageSourceUrl(selectedAccount,active)&&<a className="am-source-webmail" href={messageSourceUrl(selectedAccount,active)||undefined} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> {active.extraction?.webmail_url?'在原邮箱查看此邮件':'打开原邮箱'}</a>}</div>
            </div>
            {active.deadline&&<div className="am-deadline-note"><Clock3 size={17}/> 相关截止日期：<strong>{active.deadline}</strong></div>}
            {active.ai_category&&<div className="am-ai-category-suggestion"><Sparkles size={14}/> AI 识别：{categories[active.ai_category]||active.ai_category} · 分类建议独立保存，不会覆盖手动分类</div>}
            {active.ai_summary&&<div className="am-ai-result">
              <div className="am-ai-result-title"><Sparkles size={15}/> AI 分析</div>
              <p>{active.ai_summary}</p>
              {!!active.ai_tags?.length&&<div className="am-ai-tags">{active.ai_tags.map(tag=><span key={tag}>{tag}</span>)}</div>}
              {active.ai_action&&<div className="am-ai-action"><strong>建议：</strong>{active.ai_action}</div>}
            </div>}
            {suggestedPaper&&<div className="am-link-suggestion">
              <div><Link2 size={16}/><span>根据稿件编号，可能关联：<strong>{suggestedPaper.title}</strong></span></div>
              <button type="button" disabled={busy==='message'} onClick={()=>void saveMessage({paper_id:suggestedPaper.id})}>确认关联</button>
            </div>}

            <div className="am-reader-content"><div className="am-reader-content-head"><span>邮件正文</span>
              <div className="am-reader-actions">
                <button type="button" className={translationVisible?'active':''} onClick={()=>setTranslationVisible(v=>!v)}><Languages size={14}/> {translationVisible?'关闭对照':'翻译对照'}</button>
                <button type="button" disabled={!active.sender_address} onClick={()=>compose(true)}>回复</button>
                {active.cloud_archive_path&&<button type="button" disabled={busy==='download'} onClick={()=>void downloadOriginal()}><Download size={14}/> 原始 EML</button>}
              </div></div>
              {translationVisible&&<div className="am-translate-bar">
                <label>译文语言 <select value={translationLang} onChange={e=>setTranslationLang(e.target.value as 'zh'|'en')}>
                  <option value="zh">简体中文</option><option value="en">English</option></select></label>
                <button type="button" disabled={translationLoading||bodyLoading} onClick={()=>void runTranslation()}>
                 <Languages size={14}/>{translationLoading?'翻译中…':translation?'重新查询 / 生成':'生成译文'}</button>
                {translationProgress&&<span>已完成 {translationProgress.done}/{translationProgress.total} 段</span>}
              </div>}
              <div className={translationVisible?'am-parallel-text':'am-single-text'}>
                <div className="am-original-col"><strong>原文</strong><pre>{bodyLoading?'正在读取邮件正文…':readableMailText(activeBody||active.snippet||'无可读取的正文')}</pre></div>
                {translationVisible&&<div className="am-translation-col"><strong>译文 · {translationLang==='zh'?'中文':'English'} {translation?.model_name?'· '+translation.model_name:''}</strong>
                  <pre>{translation?.translated_text||'尚无译文。选择目标语言并点击「生成译文」。'}</pre></div>}
              </div>
            </div>
            <div className="am-annotation-panel">
              <div className="am-annotation-title"><StickyNote size={15}/>备注与跨邮箱整理</div>
              <div className="am-annotation-grid">
                <label><Folder size={13}/> 虚拟文件夹
                  <select value={active.virtual_folder_id||''} disabled={busy==='message'} onChange={e=>void saveMessage({virtual_folder_id:e.target.value||null})}>
                    <option value="">未整理</option>{folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}
                  </select>
                </label>
                <div className="am-label-chooser"><span><Tag size={13}/> 自定义标签</span>
                  <div>{labels.length?labels.map(t=><button type="button" key={t.id} disabled={busy==='message'}
                    className={(active.user_labels||[]).includes(t.name)?'selected':''}
                    onClick={()=>void toggleLabel(t.name)} style={{'--tag-color':t.color} as CSSProperties}>
                    <span className="am-color-point" style={{background:t.color}}/>{t.name}{(active.user_labels||[]).includes(t.name)&&<Check size={12}/>}</button>):
                    <button type="button" onClick={()=>setManageCollections(true)}>先在顶部「整理」中新建标签</button>}</div>
                </div>
              </div>
              <label className="am-note-editor">私人备注
                <textarea rows={2} maxLength={10000} value={noteDraft} onChange={e=>setNoteDraft(e.target.value)}
                  placeholder="记录回复计划、处理进度、稿件关联线索……"/>
              </label>
              <div className="am-annotation-save"><button type="button" disabled={busy==='message'||noteDraft===(active.user_note||'')}
                onClick={()=>void saveMessage({user_note:noteDraft})}><Check size={14}/>保存备注</button></div>
            </div>
            <div className="am-review-controls">
              <label>学术邮件类型<select value={active.category} disabled={busy==='message'} onChange={e=>void saveMessage({category:e.target.value})}>{Object.entries(categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
              {active.category==='review_invite'&&<label>审稿处理状态<select value={active.review_response||'pending'} disabled={busy==='message'} onChange={e=>void saveMessage({review_response:e.target.value})}>{Object.entries(responseLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>}
              <label><Link2 size={13}/> 关联投稿<select value={active.paper_id||''} disabled={busy==='message'} onChange={e=>void saveMessage({paper_id:e.target.value||null})}><option value="">暂不关联稿件</option>{papers.map(p=><option value={p.id} key={p.id}>{p.title} · {p.journal||p.manuscript_no||'未指定期刊'}</option>)}</select></label>
            </div>
          </>}
        </article>
      </section>
    </>:workspace==='accounts'?<>
      <div className="am-settings-heading"><div><h3>邮箱连接与同步</h3></div><button type="button" className="am-main-button" onClick={()=>setShowAdd(true)}><Plus size={15}/> 添加邮箱</button></div>
      {showAdd&&<div className="am-account-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&busy===null)setShowAdd(false)}}>
        <div className="am-account-dialog am-account-add-dialog" role="dialog" aria-modal="true" aria-label="添加邮箱">
         <header className="am-dialog-header"><strong>添加邮箱</strong><button type="button" aria-label="关闭添加邮箱" onClick={()=>setShowAdd(false)}><X size={18}/></button></header>
         <div className="am-form-panel"><strong>邮箱账户信息</strong><div className="am-add-form">
        <label>邮箱地址<input type="email" placeholder="name@stu.xju.edu.cn" value={newAddress} onChange={e=>setNewAddress(e.target.value)} autoComplete="email"/></label>
        <label>服务商<select value={newProvider} onChange={e=>setNewProvider(e.target.value)}><option value="coremail">Coremail（新疆大学 / CUGB）</option><option value="qq">QQ 邮箱</option><option value="126">126 邮箱</option><option value="gmail">Gmail（应用专用密码）</option><option value="outlook">Outlook / Hotmail（Microsoft OAuth2）</option><option value="other">其他邮箱（自定义 IMAP/SMTP）</option></select></label>
        <button type="button" className="am-main-button" disabled={busy!==null} onClick={()=>void addAccount()}>保存账户</button><button type="button" className="am-quiet-button" onClick={()=>setShowAdd(false)}>取消</button>
      </div></div></div></div>}
      <div className="am-account-overview" aria-label="多邮箱连接概览">
        {accounts.length===0&&<div className="am-empty"><Mail size={24}/>尚未添加任何邮箱</div>}
        {accounts.map(a=>{
          const stats=accountProgress[a.id]
          const home=webmailHome(a)
          return <article key={a.id} className="am-account-summary" data-state={!a.enabled?'paused':a.cloud_state}>
           <div className="am-account-mark am-brand-mark">{a.logo_symbol||providerSymbols[a.provider]||<Mail size={18}/>}</div>
           <div className="am-account-summary-main">
            <strong>{logoLabel(a)}</strong><small title={a.address}>{a.address}</small>
            <div className="am-account-metrics">
             <span>归档 <b>{stats?.archived_count??0}</b> 封</span>
             <span>完整 {stats?.full_count??0}</span>
             <span>轻量 {(stats?.text_count??0)+(stats?.index_count??0)}</span>
            </div>
            <span>上次新增 {stats?.last_added_at?niceDate(stats.last_added_at)+' · '+stats.last_added_count+' 封':'暂无记录'}</span>
            <span>成功同步 {niceDate(a.last_sync_at)}{a.cloud_state==='error'?' · 最近检查失败':''}</span>
            <span>{stats?.history_complete?'历史归档已完成':
             '历史归档进行中 · 已记录 '+(stats?.scanned_folders??0)+'/'+(a.last_scanned_folders||0)+' 个文件夹'}</span>
           </div>
           <div className="am-account-summary-actions">
            <span className={'am-account-state '+(a.cloud_state==='ready'?'ready':a.cloud_state==='error'?'error':'')}>{describeStatus(a)}</span>
            {home&&<a href={home} target="_blank" rel="noopener noreferrer" title="在邮箱服务商官方网站查看原始邮件">原邮箱 <ExternalLink size={13}/></a>}
            <button type="button" className="am-account-open" onClick={()=>{setDetailAccountId(a.id);setSetupId(null);setOauthPanelId(null);setBrandEditing(null);setConnectionResults({})}}><Settings2 size={14}/> 设置</button>
           </div>
          </article>
        })}
      </div>
      {detailAccountId&&<div className="am-account-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&busy===null)setDetailAccountId(null)}}>
       <div className="am-account-dialog" role="dialog" aria-modal="true" aria-label="邮箱详情与设置">
        <header className="am-dialog-header"><strong>邮箱详情与设置</strong><button type="button" aria-label="关闭邮箱设置" onClick={()=>{setDetailAccountId(null);setSetupId(null);setOauthPanelId(null);setBrandEditing(null)}}><X size={18}/></button></header>
        <div className="am-account-list">
        {accounts.length===0&&<div className="am-empty"><Mail size={24}/>尚未添加任何邮箱</div>}
        {accounts.filter(a=>a.id===detailAccountId).map(a=><section key={a.id} className="am-account-card" data-provider={a.provider}>
          <div className="am-account-heading"><div className="am-account-mark am-brand-mark">{a.logo_symbol||providerSymbols[a.provider]||<Mail size={19}/>}</div>
             <div className="am-account-name"><strong>{logoLabel(a)}</strong><small>{a.address} · {providerLabels[a.provider]||a.provider}</small></div>
             <span className={'am-account-state '+(a.cloud_state==='ready'?'ready':a.cloud_state==='error'?'error':'')}>{describeStatus(a)}</span></div>
          <div className="am-account-data">
              <div><span>上次成功检查</span><strong>{niceDate(a.last_sync_at)}</strong></div>
              <div><span>最近检查 / 本次新增</span><strong>{niceDate(a.last_checked_at)} · 新增 {a.last_processed||0} 封</strong></div>
              <div><span>{a.provider==='outlook'?'Microsoft Graph / 文件夹':'服务器 / 扫描文件夹'}</span>
               <strong>{a.provider==='outlook'?'Graph OAuth2':a.imap_host||'尚未设置'} · {a.last_scanned_folders||0} 个</strong></div>
            </div>
            {a.cloud_state==='error'&&<p className="am-account-retry"><AlertCircle size={14}/> 最近采集中断，自动重试已停止；此前归档保留。可点击“立即检查”重新验证，不必重新输入凭据。</p>}
          {a.last_error&&<p className="am-account-error"><AlertCircle size={14}/>{a.last_error}</p>}
          <div className="am-account-actions">
            <button type="button" onClick={()=>{
              setBrandEditing(v=>v===a.id?null:a.id);
              setBrandShort(a.short_label||'');setBrandSymbol(a.logo_symbol||'');setBrandUrl(a.logo_url||'')
            }}><Tag size={14}/>自定义简称 / Logo</button>
            {isSupported(a)?<>
              <button type="button" onClick={()=>setupAccount(a)}><Settings2 size={14}/>{a.cloud_state==='ready'?'编辑连接':'配置收发信'}</button>
              {a.imap_host&&<button type="button" disabled={busy!==null} onClick={()=>void testAccount(a.id)}>测试连接</button>}
              {a.enabled&&['ready','error'].includes(a.cloud_state)&&<button type="button" disabled={busy!==null} onClick={()=>void manualSync(a.id)}><RefreshCw size={14}/>{busy==='sync-'+a.id?'检查中…':'立即检查'}</button>}
              {(a.cloud_state==='ready'||a.cloud_state==='error'||!a.enabled)&&<button type="button" disabled={busy!==null} onClick={()=>void toggleCollection(a)}>
                {a.enabled?<PauseCircle size={14}/>:<PlayCircle size={14}/>} {a.enabled?'暂停采集':'恢复采集'}
              </button>}
            </>:a.provider==='outlook'?<>
              <button type="button" onClick={()=>showOutlook(a)}><KeyRound size={14}/>{a.cloud_state==='ready'?'管理 Microsoft 授权':'连接 Microsoft 账户'}</button>
              {a.enabled&&a.cloud_state==='ready'&&<button type="button" disabled={busy!==null}
               onClick={()=>void manualSync(a.id)}><RefreshCw size={14}/> 立即同步 Graph</button>}
              {a.cloud_state==='ready'&&<button type="button" disabled={busy!==null}
               onClick={()=>void disconnectOutlook(a)}>断开授权</button>}
            </>:<span>该服务商需要 OAuth2 授权，尚未连接。</span>}
          </div>
          {brandEditing===a.id&&<div className="am-brand-editor">
            <label>来源简称<input maxLength={18} value={brandShort} onChange={e=>setBrandShort(e.target.value)}
              placeholder="例如：新大研究生、CUGB、QQ"/></label>
            <label>简易图标（文字 / Emoji）<input maxLength={8} value={brandSymbol}
              onChange={e=>setBrandSymbol(e.target.value)} placeholder="例如：XU、✉"/></label>
            <label>自定义 Logo 图片 URL（可选）<input value={brandUrl} onChange={e=>setBrandUrl(e.target.value)}
              placeholder="https://example.com/icon.png"/></label>
            <div><button type="button" className="am-main-button" disabled={busy!==null}
              onClick={()=>void saveBrand(a)}>保存来源标识</button>
              <button type="button" className="am-quiet-button" onClick={()=>setBrandEditing(null)}>取消</button></div>
        
          </div>}
          {a.provider==='outlook'&&oauthPanelId===a.id&&<div className="am-oauth-panel">
            <div className="am-oauth-panel-head"><div className="am-oauth-icon"><KeyRound size={18}/></div>
             <div><strong>Microsoft 官方账户授权</strong>
               <p>以 Microsoft Graph 读取所有文件夹（包括垃圾邮件），并在明确确认后发送邮件。无需邮箱密码，也不需要始终开着电脑。</p></div></div>
            <div className="am-oauth-form">
              <button type="button" className="am-main-button" disabled={busy!==null}
               onClick={()=>void startOutlook(a)}>{busy==='oauth-'+a.id?'申请中…':'使用 Microsoft 账户授权'}</button>
              <small>使用微软官方设备登录页完成一次授权；Entra/Azure 仅用于网站管理员首次注册应用，普通用户无需进入。</small>
            </div>
            <details className="am-oauth-help"><summary>高级设置 · Microsoft 公共应用客户端 ID</summary>
              <label>客户端 ID（站点管理员可统一配置；个人一般不用填写）
                <input value={oauthClientId} onChange={e=>setOauthClientId(e.target.value)}
                  placeholder="站点尚未统一配置时，由应用管理员提供" spellCheck={false}/></label>
              <p>网站运营者需先在 Microsoft Entra 注册公共客户端（设备代码授权），并在服务端配置 MAIL_MICROSOFT_CLIENT_ID；仅此配置步骤需访问 Entra。允许个人账户与工作/学校账户，委托权限 User.Read、Mail.Read、Mail.Send、offline_access。</p>
              <a href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer">管理员注册入口</a>
            </details>
            {oauth?.accountId===a.id&&<div className="am-device-auth" aria-live="polite">
              <span>微软设备登录验证码（临时）</span><strong>{oauth.userCode}</strong>
              <div><button type="button" className="am-quiet-button" onClick={()=>void navigator.clipboard.writeText(oauth.userCode)}>
                <Copy size={14}/> 复制验证码</button>
                <a className="am-main-button" href={oauth.verificationUri} target="_blank" rel="noopener noreferrer">
                 <ExternalLink size={14}/> 打开微软授权页</a></div>
              <small>有效期剩余 {Math.max(0,Math.ceil((oauth.expiresAt-Date.now())/60000))} 分钟</small>
            </div>}
            {a.cloud_state==='ready'&&<p className="am-oauth-connected"><CheckCircle2 size={15}/>
              已授权：{a.oauth_identity||a.address} · Microsoft Graph 读取及发送邮件</p>}
          </div>}
          {setupId===a.id&&<div className="am-form-panel am-config-form">
            <div className="am-section-heading"><strong>收发信配置</strong><button type="button" className="am-quiet-button" disabled={busy!==null} onClick={()=>void discover(a.id)}>自动发现服务器</button></div>
            <p>可使用官方参数或 DNS SRV 建议。仅允许加密连接：IMAP 993/SSL、143/STARTTLS；SMTP 465/SSL、587/STARTTLS。当前云端运行环境不支持 SMTP 587/25 出站，请选 465/SSL。</p>
            {a.address.toLowerCase().endsWith('@email.cugb.edu.cn')&&<div className="am-cugb-preset">
              <button type="button" className="am-quiet-button" onClick={()=>{
                setImapHost('imap.email.cugb.edu.cn');setSmtpHost('smtp.email.cugb.edu.cn');
                setImapPort(993);setSmtpPort(465);setImapSecurity('ssl');setSmtpSecurity('ssl')
              }}>填入 CUGB 官方 IMAP / SMTP（993 / 465）</button>
              <button type="button" className="am-quiet-button" onClick={()=>{
                setImapHost('www.email.cugb.edu.cn');setSmtpHost('www.email.cugb.edu.cn');
                setImapPort(993);setSmtpPort(465);setImapSecurity('ssl');setSmtpSecurity('ssl')
              }}>学校公开指南备选（www.email）</button>
              <a href="https://www.cugb.edu.cn/yxsy" target="_blank" rel="noopener noreferrer">学校配置指南</a>
              <small>已按学校公布的独立服务器地址预填；若 TLS 连接成功但认证失败，请检查完整邮箱用户名和客户端协议授权码。</small>
            </div>}
            {!!suggestions.length&&<div className="am-server-suggestions">{suggestions.map((s,i)=>
              <button type="button" key={s.type+s.host+i} onClick={()=>{
                if(s.type==='imap'){setImapHost(s.host);setImapPort(s.port);setImapSecurity(s.security)}
                else{setSmtpHost(s.host);setSmtpPort(s.port);setSmtpSecurity(s.security)}
              }}><span>{s.type.toUpperCase()}</span> {s.host}:{s.port} · {s.security==='ssl'?'SSL/TLS':'STARTTLS'} <small>{s.source}</small></button>)}</div>}
            <div className="am-server-grid">
              <fieldset className="am-server-fieldset"><legend>收信 · IMAP</legend>
                <label>协议<select disabled><option>IMAP（同步文件夹及垃圾箱）</option></select></label>
                <label>服务器<input value={imapHost} onChange={e=>setImapHost(e.target.value)} placeholder="如 mail.xju.edu.cn"/></label>
                <div className="am-server-pair"><label>端口<select value={imapPort} onChange={e=>{const p=Number(e.target.value);setImapPort(p);setImapSecurity(p===993?'ssl':'starttls')}}><option value={993}>993</option><option value={143}>143</option></select></label>
                  <label>安全连接<select value={imapSecurity} onChange={e=>{setImapSecurity(e.target.value);setImapPort(e.target.value==='ssl'?993:143)}}><option value="ssl">SSL/TLS</option><option value="starttls">STARTTLS</option></select></label></div>
                <label>登录用户名<input value={imapUsername} onChange={e=>setImapUsername(e.target.value)} placeholder={a.address}/></label>
              </fieldset>
              <fieldset className="am-server-fieldset"><legend>发信 · SMTP</legend>
                <label>协议<select disabled><option>SMTP（发信及回复）</option></select></label>
                <label>服务器<input value={smtpHost} onChange={e=>setSmtpHost(e.target.value)} placeholder="如 smtp.qq.com"/></label>
                <div className="am-server-pair"><label>端口<select value={smtpPort} onChange={e=>{const p=Number(e.target.value);setSmtpPort(p);setSmtpSecurity(p===465?'ssl':'starttls')}}><option value={465}>465</option><option value={587}>587</option></select></label>
                  <label>安全连接<select value={smtpSecurity} onChange={e=>{setSmtpSecurity(e.target.value);setSmtpPort(e.target.value==='ssl'?465:587)}}><option value="ssl">SSL/TLS</option><option value="starttls">STARTTLS</option></select></label></div>
                <label>登录用户名<input value={smtpUsername} onChange={e=>setSmtpUsername(e.target.value)} placeholder={a.address}/></label>
              </fieldset>
            </div>
            <div className="am-credential-editor">
              <label>IMAP 授权码 / 客户端密码<input type="password" value={appPassword} onChange={e=>setAppPassword(e.target.value)} autoComplete="new-password" placeholder={a.imap_host?'已加密保存，留空保持':'请填写 IMAP 授权码'}/></label>
              <label className="am-option"><input type="checkbox" checked={smtpUseImapCredential} onChange={e=>setSmtpUseImapCredential(e.target.checked)}/> SMTP 与 IMAP 共用授权码</label>
              {!smtpUseImapCredential&&<label>独立 SMTP 授权码<input type="password" value={smtpPassword} onChange={e=>setSmtpPassword(e.target.value)} autoComplete="new-password"
                placeholder={a.smtp_has_separate_key?'已加密保存，留空保持':'请输入独立 SMTP 密码或授权码'}/></label>}
            </div>
            <div className="am-add-form">
              <button type="button" className="am-main-button" disabled={busy!==null||!imapHost||(!a.imap_host&&!appPassword)} onClick={()=>void saveConfiguration()}>{busy==='configure'?'连接验证中…':'保存并测试连接'}</button>
              <button type="button" className="am-quiet-button" disabled={busy!==null||!a.imap_host} onClick={()=>void testAccount(a.id)}>测试连接</button>
              <button type="button" className="am-quiet-button" onClick={()=>{setSetupId(null);setAppPassword('');setSuggestions([])}}>关闭</button></div>
            {!!Object.keys(connectionResults).length&&<div className="am-test-results">{Object.entries(connectionResults).map(([key,result])=><div key={key} className={result.ok?'ok':'error'}><strong>{key.toUpperCase()} {result.ok?'连接成功':'连接失败'}</strong><span>{result.message}</span></div>)}</div>}
          </div>}
        </section>)}
        </div></div></div>}
    </>:<MailPersonalization userId={userId} settings={pref} busy={busy!==null} onUpdate={savePref} onSaveKey={saveAIKey} onToast={showToast} onRefresh={loadMetadata}/>}
    {showCompose&&<div className="am-compose-backdrop" role="dialog" aria-modal="true" aria-label="撰写邮件">
      <div className="am-compose">
        <header><strong>撰写邮件</strong><button type="button" onClick={()=>setShowCompose(false)} aria-label="关闭"><X size={17}/></button></header>
        <label>发件邮箱<select value={composeAccount} onChange={e=>setComposeAccount(e.target.value)}>
          <option value="">请选择已授权发信的邮箱</option>
          {accounts.filter(a=>a.enabled&&(!!a.smtp_host||(a.provider==='outlook'&&a.cloud_state==='ready'))).map(a=><option value={a.id} key={a.id}>{a.address}</option>)}
        </select></label>
        <label>收件人<input type="email" value={composeTo} onChange={e=>setComposeTo(e.target.value)} placeholder="person@example.com"/></label>
        <label>主题<input value={composeSubject} onChange={e=>setComposeSubject(e.target.value)} placeholder="邮件主题"/></label>
        <label>正文<textarea rows={11} value={composeBody} onChange={e=>setComposeBody(e.target.value)} placeholder="输入纯文本邮件…"/></label>
        <footer><span>使用 SSL/TLS SMTP 发出；发送前需确认。</span>
          <button type="button" className="am-quiet-button" onClick={()=>setShowCompose(false)}>取消</button>
          <button type="button" className="am-main-button" disabled={!composeAccount||!composeTo.trim()||!composeSubject.trim()||!composeBody.trim()||busy!==null} onClick={()=>void sendMail()}>{busy==='send'?'发送中…':'确认并发送'}</button>
        </footer>
      </div>
    </div>}
    {workspace!=='inbox'&&<footer className="am-footer"><Archive size={13}/> 邮件正文只作为不可信资料处理，不执行其中的操作指令；识别结果不会自动改写投稿状态。</footer>}
  </main>
}
