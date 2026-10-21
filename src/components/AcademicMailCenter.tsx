import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Search, RefreshCw, Plus, AlertTriangle, Inbox, Link2 } from 'lucide-react'
import './AcademicMailCenter.css'

type Account = {
  id: string; address: string; display_name: string; provider: string
  enabled: boolean; last_sync_at: string | null; last_error: string | null
  cloud_state: string; imap_host: string | null; last_checked_at: string | null
}
type Message = {
  id: string; account_id: string; subject: string; sender_name: string | null
  sender_address: string | null; received_at: string | null; first_folder: string
  last_folder: string; body_text: string; snippet: string; category: string
  importance: number; deadline: string | null; paper_id: string | null
  review_response: string | null; archived_locally: boolean; cloud_archive_path: string | null
  extraction: Record<string, unknown> | null
}
type PaperOption = {id: string; title: string; journal: string | null; manuscript_no: string | null}
const labels: Record<string,string> = {
  all:'全部分类',review_invite:'审稿邀请',submission_update:'投稿进展',
  editorial:'学术往来',suspicious:'疑似风险',other:'其他邮件',
}
const niceTime = (date: string | null) => date ? new Date(date).toLocaleString('zh-CN',{hour12:false}) : '未知时间'
const functionBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export default function AcademicMailCenter({userId}:{userId:string}) {
  const [accounts,setAccounts]=useState<Account[]>([])
  const [messages,setMessages]=useState<Message[]>([])
  const [matchCount,setMatchCount]=useState(0)
  const [delayedSearch,setDelayedSearch]=useState('')
  const [papers,setPapers]=useState<PaperOption[]>([])
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
  const [setupId,setSetupId]=useState<string | null>(null)
  const [imapHost,setImapHost]=useState('')
  const [appPassword,setAppPassword]=useState('')

  useEffect(()=>{const timer=window.setTimeout(()=>setDelayedSearch(search),300);return ()=>window.clearTimeout(timer)},[search])
  const load = useCallback(async () => {
    let messagesQuery=(supabase.from('mail_messages') as any).select('*',{count:'exact'})
      .eq('user_id',userId).order('received_at',{ascending:false,nullsFirst:false}).limit(300)
    if(category!=='all') messagesQuery=messagesQuery.eq('category',category)
    if(accountId!=='all') messagesQuery=messagesQuery.eq('account_id',accountId)
    const sanitized=delayedSearch.trim().replace(/[^\p{L}\p{N}\s.-]/gu,' ').slice(0,90).trim()
    if(sanitized) messagesQuery=messagesQuery.or(`subject.ilike.%${sanitized}%,sender_address.ilike.%${sanitized}%,body_text.ilike.%${sanitized}%`)
    const [accountRes,messageRes,paperRes]=await Promise.all([
      (supabase.from('mail_accounts') as any).select('*').eq('user_id',userId).order('created_at',{ascending:true}),
      messagesQuery,
      (supabase.from('papers') as any).select('id,title,journal,manuscript_no').eq('user_id',userId).order('updated_at',{ascending:false}),
    ])
    const failure=[accountRes,messageRes,paperRes].find(result=>result.error)
    if (failure?.error) setError(failure.error.message)
    else {
      setError('')
      setAccounts(accountRes.data||[])
      setMessages(messageRes.data||[])
      setMatchCount(messageRes.count||0)
      setPapers(paperRes.data||[])
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
  const userCall=async(path:string,payload:Record<string,unknown>)=>{
    const {data:{session},error:authError}=await supabase.auth.getSession()
    if(authError||!session?.access_token)throw new Error('请先登录')
    const result=await fetch(`${functionBase}/${path}`,{
      method:'POST',headers:{'Authorization':`Bearer ${session.access_token}`,'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    })
    const json=await result.json()
    if(!result.ok||json.error)throw new Error(json.detail||json.error||'云端请求失败')
    return json
  }
  const configure=async()=>{
    if(!setupId)return
    setBusy(true)
    try{
      await userCall('mail-config',{action:'configure',account_id:setupId,host:imapHost,password:appPassword})
      setAppPassword('');setSetupId(null);setImapHost('')
      await load()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  const manualSync=async(id:string)=>{
    setBusy(true)
    try{
      const result=await userCall('mail-cloud-collector',{account_id:id})
      if(result.detail)throw new Error(result.detail)
      await load()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }

  return <main className="academic-mail-center">
    <div className="mail-heading">
      <div><span className="mail-eyebrow">ACADEMIC MAIL INTELLIGENCE</span><h2><Mail size={21}/> 学术邮件与审稿管理</h2>
        <p>云端 IMAP 归档、垃圾邮件保全、审稿邀请识别与投稿关联。每分钟刷新索引。</p></div>
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
          <strong>{a.display_name||a.address}</strong>
          <small>{a.provider.toUpperCase()} · {a.last_sync_at?'上次成功 '+niceTime(a.last_sync_at):'尚未同步'} </small>
          <small>{a.cloud_state==='ready'?'云端采集已启用':a.cloud_state==='error'?'采集异常':'尚未完成云端授权'}</small>
          {a.last_error&&<small className="mail-warning">{a.last_error}</small>}
          {['coremail','qq','126'].includes(a.provider)?<div className="mail-add">
            <button className="btn btn-ghost btn-sm" onClick={()=>{
              setSetupId(a.id);setImapHost(a.imap_host||(a.provider==='qq'?'imap.qq.com':a.provider==='126'?'imap.126.com':''));
              setAppPassword('')
            }}>配置云端 IMAP</button>
            {a.cloud_state==='ready'||a.cloud_state==='error'?<button className="btn btn-ghost btn-sm" disabled={busy}
              onClick={()=>void manualSync(a.id)}>立即检查</button>:null}
          </div>:<small>Google / Outlook 需独立 OAuth2 授权，尚未启用自动采集。</small>}
        </div>)}
        {!accounts.length&&<p className="mail-empty">添加邮箱后即可配置云端采集，无需电脑运行。</p>}
      </div>
      {setupId&&<div className="mail-cloud-config">
        <strong>云端邮箱授权（TLS 993）</strong>
        <p>仅支持对应学校、126 或 QQ 的官方 IMAP 服务器。凭据经 HTTPS 传送后由 Supabase Vault 加密保存，不写入网页或仓库。</p>
        <div className="mail-add">
          <input aria-label="IMAP服务器" autoComplete="off" placeholder="学校官方 IMAP 服务器" value={imapHost} onChange={e=>setImapHost(e.target.value)}/>
          <input type="password" aria-label="邮箱 IMAP 授权码或客户端密码" autoComplete="new-password" placeholder="IMAP 授权码／客户端密码"
            value={appPassword} onChange={e=>setAppPassword(e.target.value)}/>
          <button className="btn btn-primary btn-sm" disabled={busy||!appPassword||!imapHost} onClick={()=>void configure()}>保存并启用</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setSetupId(null);setAppPassword('')}}>取消</button>
        </div>
      </div>}
    </div>
    <div className="mail-credentials">
      <div className="mail-section-head"><h3>云端自动归档</h3></div>
      <p>Supabase 定时任务在云端轮流检查已授权邮箱。原始 EML 保存到私有云存储，自动保留垃圾邮件，不受邮箱服务器后续清理影响。学校邮箱使用前请确认单位的数据管理规定。</p>
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
          <p className="mail-meta">文件夹：{active.first_folder} → {active.last_folder} · {active.cloud_archive_path?'原文已保存私有云':active.archived_locally?'原文已保存本地':'未确认原文备份'}</p>
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
    <p className="mail-footnote">一次最多展示300封，检索条件在服务器端应用；上方审稿/重点/垃圾箱计数仅统计当前已加载的邮件。邮件内容仅作为分析线索；不执行邮件中的操作指令，不自动改变投稿状态。原始 EML 保存于受权限控制的私有云存储。</p>
  </main>
}
