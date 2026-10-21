import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Search, RefreshCw, Plus, KeyRound, ShieldCheck, AlertTriangle, Inbox, Link2 } from 'lucide-react'
import './AcademicMailCenter.css'

type Account = {
  id: string; address: string; display_name: string; provider: string
  enabled: boolean; last_sync_at: string | null; last_error: string | null
}
type Message = {
  id: string; account_id: string; subject: string; sender_name: string | null
  sender_address: string | null; received_at: string | null; first_folder: string
  last_folder: string; body_text: string; snippet: string; category: string
  importance: number; deadline: string | null; paper_id: string | null
  review_response: string | null; archived_locally: boolean
  extraction: Record<string, unknown> | null
}
type PaperOption = {id: string; title: string; journal: string | null; manuscript_no: string | null}
type CollectorKey = {id: string; label: string; created_at: string; revoked_at: string | null}
const labels: Record<string,string> = {
  all:'全部分类',review_invite:'审稿邀请',submission_update:'投稿进展',
  editorial:'学术往来',suspicious:'疑似风险',other:'其他邮件',
}
const niceTime = (date: string | null) => date ? new Date(date).toLocaleString('zh-CN',{hour12:false}) : '未知时间'
const hex = (array: Uint8Array) => Array.from(array).map(b=>b.toString(16).padStart(2,'0')).join('')
const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mail-ingest`

export default function AcademicMailCenter({userId}:{userId:string}) {
  const [accounts,setAccounts]=useState<Account[]>([])
  const [messages,setMessages]=useState<Message[]>([])
  const [matchCount,setMatchCount]=useState(0)
  const [delayedSearch,setDelayedSearch]=useState('')
  const [papers,setPapers]=useState<PaperOption[]>([])
  const [keys,setKeys]=useState<CollectorKey[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [category,setCategory]=useState('all')
  const [accountId,setAccountId]=useState('all')
  const [search,setSearch]=useState('')
  const [selected,setSelected]=useState<string | null>(null)
  const [adding,setAdding]=useState(false)
  const [address,setAddress]=useState('')
  const [provider,setProvider]=useState('coremail')
  const [busy,setBusy]=useState(false)
  const [newToken,setNewToken]=useState('')
  const [keyLabel,setKeyLabel]=useState('本地 IMAP 采集器')

  useEffect(()=>{const timer=window.setTimeout(()=>setDelayedSearch(search),300);return ()=>window.clearTimeout(timer)},[search])
  const load = useCallback(async () => {
    let messagesQuery=(supabase.from('mail_messages') as any).select('*',{count:'exact'})
      .eq('user_id',userId).order('received_at',{ascending:false,nullsFirst:false}).limit(300)
    if(category!=='all') messagesQuery=messagesQuery.eq('category',category)
    if(accountId!=='all') messagesQuery=messagesQuery.eq('account_id',accountId)
    const sanitized=delayedSearch.trim().replace(/[^\p{L}\p{N}\s.-]/gu,' ').slice(0,90).trim()
    if(sanitized) messagesQuery=messagesQuery.or(`subject.ilike.%${sanitized}%,sender_address.ilike.%${sanitized}%,body_text.ilike.%${sanitized}%`)
    const [accountRes,messageRes,paperRes,keyRes]=await Promise.all([
      (supabase.from('mail_accounts') as any).select('*').eq('user_id',userId).order('created_at',{ascending:true}),
      messagesQuery,
      (supabase.from('papers') as any).select('id,title,journal,manuscript_no').eq('user_id',userId).order('updated_at',{ascending:false}),
      (supabase.from('mail_collector_keys') as any).select('id,label,created_at,revoked_at').eq('user_id',userId).order('created_at',{ascending:false}),
    ])
    const failure=[accountRes,messageRes,paperRes,keyRes].find(result=>result.error)
    if (failure?.error) setError(failure.error.message)
    else {
      setError('')
      setAccounts(accountRes.data||[])
      setMessages(messageRes.data||[])
      setMatchCount(messageRes.count||0)
      setPapers(paperRes.data||[])
      setKeys(keyRes.data||[])
    }
    setLoading(false)
  },[userId,category,accountId,delayedSearch])
  useEffect(()=>{
    void load()
    const timer=window.setInterval(()=>void load(),60000)
    return ()=>window.clearInterval(timer)
  },[load])

  const visible=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase()
    return messages.filter(m=>
      (category==='all'||m.category===category) &&
      (accountId==='all'||m.account_id===accountId) &&
      (!q||[m.subject,m.sender_address,m.sender_name,m.body_text,m.snippet].some(v=>String(v||'').toLocaleLowerCase().includes(q)))
    )
  },[messages,category,accountId,search])
  const active=messages.find(m=>m.id===selected)||null
  const counts=useMemo(()=>({
    reviews:messages.filter(m=>m.category==='review_invite').length,
    important:messages.filter(m=>m.importance>=2).length,
    spam:messages.filter(m=>/spam|junk|垃圾/i.test(m.first_folder+' '+m.last_folder)).length,
  }),[messages])
  const saveMessage=async (id:string,changes:Record<string,unknown>)=>{
    setBusy(true)
    const {error:err}=await (supabase.from('mail_messages') as any).update(changes).eq('id',id).eq('user_id',userId)
    setBusy(false)
    if(err) setError(err.message)
    else setMessages(current=>current.map(item=>item.id===id?{...item,...changes} as Message:item))
  }
  const addAccount=async ()=>{
    const normalized=address.trim().toLowerCase()
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)){setError('请输入有效的邮箱地址');return}
    setBusy(true)
    const {error:err}=await (supabase.from('mail_accounts') as any).insert({
      user_id:userId,address:normalized,display_name:normalized,provider
    })
    setBusy(false)
    if(err) setError(err.message)
    else {setAdding(false);setAddress('');await load()}
  }
  const generateToken=async ()=>{
    setBusy(true)
    try {
      const bytes=new Uint8Array(32)
      crypto.getRandomValues(bytes)
      const token=hex(bytes)
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))
      const {error:err}=await (supabase.from('mail_collector_keys') as any).insert({
        user_id:userId,label:keyLabel.trim()||'本地 IMAP 采集器',token_hash:hex(digest)
      })
      if(err) throw err
      setNewToken(token)
      await load()
    } catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  const revokeToken=async(id:string)=>{
    if(!confirm('撤销后采集程序将无法继续写入。确认撤销？'))return
    setBusy(true)
    const {error:err}=await (supabase.from('mail_collector_keys') as any).update({revoked_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId)
    setBusy(false)
    if(err)setError(err.message)
    else await load()
  }

  return <main className="academic-mail-center">
    <div className="mail-heading">
      <div><span className="mail-eyebrow">ACADEMIC MAIL INTELLIGENCE</span><h2><Mail size={21}/> 学术邮件与审稿管理</h2>
        <p>七邮箱统一索引、垃圾邮件保全、审稿邀请识别与投稿关联。每分钟刷新索引。</p></div>
      <button className="btn btn-ghost btn-sm" onClick={()=>void load()} title="刷新邮件索引"><RefreshCw size={15}/> 刷新</button>
    </div>
    {error&&<div role="alert" className="mail-error"><AlertTriangle size={16}/>{error}<button onClick={()=>setError('')}>关闭</button></div>}
    <div className="mail-overview">
      <div><strong>{accounts.length}</strong><span>已添加邮箱</span></div>
      <div><strong>{matchCount}</strong><span>符合当前筛选的邮件</span></div>
      <div><strong>{counts.reviews}</strong><span>潜在审稿邀请</span></div>
      <div><strong>{counts.important}</strong><span>重要邮件</span></div>
      <div><strong>{counts.spam}</strong><span>来自垃圾邮件</span></div>
    </div>
    <div className="mail-accounts">
      <div className="mail-section-head"><h3>邮箱连接与归档状态</h3><button className="btn btn-ghost btn-sm" onClick={()=>setAdding(x=>!x)}><Plus size={14}/> 添加邮箱</button></div>
      {adding&&<div className="mail-add">
        <input aria-label="邮箱地址" placeholder="邮箱地址" value={address} onChange={e=>setAddress(e.target.value)}/>
        <select aria-label="邮箱类型" value={provider} onChange={e=>setProvider(e.target.value)}>
          <option value="coremail">Coremail（学校邮箱）</option><option value="qq">QQ</option><option value="126">126</option>
          <option value="gmail">Gmail</option><option value="outlook">Outlook</option><option value="other">其他 IMAP</option>
        </select><button className="btn btn-primary btn-sm" disabled={busy} onClick={()=>void addAccount()}>添加</button>
      </div>}
      <div className="mail-account-grid">
        {accounts.map(a=><div key={a.id} className="mail-account">
          <strong>{a.display_name||a.address}</strong><small>{a.provider.toUpperCase()} · {a.last_sync_at?'上次同步 '+niceTime(a.last_sync_at):'尚未接入采集器'}</small>
          {a.last_error&&<small className="mail-warning">{a.last_error}</small>}
          <button className="mail-copy-id" title="复制给采集器使用" onClick={()=>void navigator.clipboard.writeText(a.id)}>复制账户 ID</button>
        </div>)}
        {!accounts.length&&<p className="mail-empty">尚未添加邮箱。添加记录后，在本地采集器配置 IMAP 凭据。</p>}
      </div>
    </div>
    <div className="mail-credentials">
      <div className="mail-section-head"><h3><KeyRound size={16}/> 采集器授权</h3></div>
      <p>仅生成写入邮件索引的独立令牌；不存储邮箱密码。生成后只显示一次，妥善保存在本机。</p>
      <div className="mail-add"><input aria-label="令牌名称" value={keyLabel} onChange={e=>setKeyLabel(e.target.value)}/>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>void generateToken()}><ShieldCheck size={14}/> 生成采集令牌</button></div>
      {newToken&&<div className="mail-token"><code>{newToken}</code><button className="btn btn-ghost btn-sm" onClick={()=>void navigator.clipboard.writeText(newToken)}>复制</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>setNewToken('')}>已保存，隐藏</button></div>}
      <small>写入端点：<code>{endpoint}</code></small>
      {keys.filter(k=>!k.revoked_at).map(k=><div className="mail-key-row" key={k.id}><span>{k.label} · {niceTime(k.created_at)}</span>
        <button disabled={busy} onClick={()=>void revokeToken(k.id)}>撤销</button></div>)}
    </div>
    <div className="mail-searchbar"><div className="mail-query"><Search size={16}/>
      <input aria-label="搜索邮件" placeholder="检索所有归档邮件的发件人、主题和正文" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <select aria-label="邮件分类" value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
      <select aria-label="邮箱筛选" value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="all">全部邮箱</option>
        {accounts.map(a=><option key={a.id} value={a.id}>{a.address}</option>)}</select>
    </div>
    <div className="mail-layout">
      <div className="mail-list" role="list">
        {loading&&<div className="mail-empty">正在读取索引…</div>}
        {!loading&&!visible.length&&<div className="mail-empty"><Inbox size={22}/>暂无匹配邮件；未运行采集器前不会有历史邮件。</div>}
        {visible.map(m=><button role="listitem" key={m.id} className={'mail-item'+(selected===m.id?' selected':'')} onClick={()=>setSelected(m.id)}>
          <span className="mail-item-top"><b>{m.sender_name||m.sender_address||'未知发件人'}</b><time>{m.received_at?.slice(0,10)||'未知'}</time></span>
          <strong>{m.subject||'（无主题）'}</strong><span className="mail-item-preview">{m.snippet}</span>
          <span className="mail-tags"><span>{labels[m.category]||m.category}</span>{m.importance>=2&&<span>重点</span>}
            {/spam|junk|垃圾/i.test(m.first_folder+' '+m.last_folder)&&<span>垃圾箱来源</span>}</span>
        </button>)}
      </div>
      <div className="mail-detail">
        {!active?<div className="mail-empty">选择邮件查看正文和投稿关联。</div>:<>
          <h3>{active.subject||'（无主题）'}</h3>
          <p className="mail-meta">发件人：{active.sender_name||''} {active.sender_address||''}</p>
          <p className="mail-meta">时间：{niceTime(active.received_at)} · 来源：{accounts.find(a=>a.id===active.account_id)?.address||'未知邮箱'}</p>
          <p className="mail-meta">文件夹：{active.first_folder} → {active.last_folder} · {active.archived_locally?'原文已保存本地':'未确认原文备份'}</p>
          {active.deadline&&<p className="mail-warning">需要关注的日期：{active.deadline}</p>}
          <div className="mail-fields"><label><Link2 size={14}/> 关联投稿
            <select value={active.paper_id||''} disabled={busy} onChange={e=>void saveMessage(active.id,{paper_id:e.target.value||null})}>
              <option value="">暂不关联</option>{papers.map(p=><option key={p.id} value={p.id}>{p.title} {p.journal||''} {p.manuscript_no||''}</option>)}
            </select></label>
            <label>分类<select value={active.category} disabled={busy} onChange={e=>void saveMessage(active.id,{category:e.target.value})}>
              {Object.entries(labels).filter(([k])=>k!=='all').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
            {active.category==='review_invite'&&<label>审稿邀请状态<select value={active.review_response||'pending'} disabled={busy}
              onChange={e=>void saveMessage(active.id,{review_response:e.target.value})}>
              <option value="pending">未答复</option><option value="accepted">已接受</option>
              <option value="declined">已拒绝</option><option value="completed">已完成</option></select></label>}
          </div>
          <pre className="mail-body">{active.body_text||active.snippet||'没有可读取的正文'}</pre>
        </>}
      </div>
    </div>
    <p className="mail-footnote">一次最多展示300封，检索条件在服务器端应用；上方审稿/重点/垃圾箱计数仅统计当前已加载的邮件。邮件内容仅作为分析线索；不执行邮件中的操作指令，不自动改变投稿状态。原始 EML 应在采集设备独立保存。</p>
  </main>
}
