import {useCallback,useEffect,useState} from 'react'
import {AlertCircle,ArrowDown,ArrowUp,Plus,Settings2,Sparkles,Trash2,X} from 'lucide-react'
import {supabase} from '../lib/supabase'
import type {MailToastKind} from './MailToast'
export type MailViewKind='all'|'important'|'review_invite'|'pending'|'submission_update'|'spam'
export type MailView={id:string;title:string;kind:MailViewKind}
export type MailSettings={
 user_id:string;workspace:{compact?:boolean;show_statistics?:boolean;views?:MailView[]};
 ai_enabled:boolean;ai_model:string;ai_daily_limit:number;ai_analyze_existing:boolean;ai_started_at?:string|null;
 ai_key_ready:boolean;last_ai_error:string|null;ai_endpoint_id?:string|null;ai_system_prompt?:string;ai_allow_paid?:boolean;ai_glm_platform?:'zai'|'bigmodel';
 ai_failover_enabled?:boolean;ai_route_order?:string[];ai_slow_mode?:boolean;ai_max_wait_seconds?:number;ai_glm_probe_ms?:number|null;ai_glm_probe_times?:Record<string,number>
}
type Endpoint={id:string;label:string;api_url:string;model:string;declared_free:boolean;allow_paid:boolean;key_ready:boolean;last_test_at:string|null;last_test_status:string|null;last_test_latency_ms?:number|null}
export const DEFAULT_MAIL_VIEWS:MailView[]=[
 {id:'all',title:'全部邮件',kind:'all'},
 {id:'important',title:'重要邮件',kind:'important'},
 {id:'submission',title:'投稿往来',kind:'submission_update'},
 {id:'spam',title:'垃圾邮件备份',kind:'spam'}
]
export const MAIL_VIEW_KINDS:Record<MailViewKind,string>={
 all:'全部邮件',important:'重要邮件',review_invite:'审稿邀请',
 pending:'待答复审稿',submission_update:'投稿往来',spam:'垃圾邮件'
}
const DEFAULT_PROMPT='请概述邮件主题、关键事实与待处理事项，并判断重要性、可能的处理期限及与投稿论文的关联。没有依据的信息不要推测。'
type Props={userId:string;settings:MailSettings|null;busy:boolean;
 onUpdate:(changes:Partial<MailSettings>)=>Promise<void>;
 onSaveKey:(key:string)=>Promise<void>;onToast:(kind:MailToastKind,message:string)=>void;onRefresh:()=>Promise<void>}
export default function MailPersonalization({userId,settings,busy,onUpdate,onSaveKey,onToast,onRefresh}:Props){
 const [newTitle,setNewTitle]=useState('')
 const [newKind,setNewKind]=useState<MailViewKind>('review_invite')
 const [apiKey,setApiKey]=useState('')
 const [prompt,setPrompt]=useState(DEFAULT_PROMPT)
 const [endpoints,setEndpoints]=useState<Endpoint[]>([])
 const [editId,setEditId]=useState<string|null>(null)
 const [label,setLabel]=useState('')
 const [url,setUrl]=useState('')
 const [model,setModel]=useState('')
 const [free,setFree]=useState(false)
 const [paid,setPaid]=useState(false)
 const [endpointKey,setEndpointKey]=useState('')
 const [testing,setTesting]=useState<string|null>(null)
 const [testResult,setTestResult]=useState('')
 const [localError,setLocalError]=useState('')
 const [saving,setSaving]=useState(false)
 useEffect(()=>setPrompt(settings?.ai_system_prompt||DEFAULT_PROMPT),[settings?.ai_system_prompt])
 useEffect(()=>{if(localError)onToast('error',localError)},[localError,onToast])
 useEffect(()=>{if(testResult){
   const kind:MailToastKind=testResult.startsWith('连接失败')?'error':
     testResult.startsWith('连接已响应')?'warning':'success'
   onToast(kind,testResult)
 }},[testResult,onToast])
 const reload=useCallback(async()=>{
  const r=await (supabase.from('mail_ai_endpoints') as any).select('id,label,api_url,model,declared_free,allow_paid,key_ready,last_test_at,last_test_status').eq('user_id',userId).order('created_at',{ascending:true})
  if(r.error)setLocalError(r.error.message)
  else setEndpoints((r.data||[]) as Endpoint[])
 },[userId])
 useEffect(()=>{void reload()},[reload])
 const call=async(action:string,details:Record<string,unknown>={})=>{
  const {data,error}=await supabase.auth.getSession()
  if(error||!data.session?.access_token)throw Error('请先重新登录')
  const response=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/mail-ai-settings',{
   method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},
   body:JSON.stringify({action,...details})
  })
  const result=await response.json()
  if(!response.ok||result.error)throw Error(result.error||result.message||'操作失败')
  return result
 }
 const views=(settings?.workspace?.views?.length?settings.workspace.views:DEFAULT_MAIL_VIEWS).filter(v=>v&&MAIL_VIEW_KINDS[v.kind])
 const updateViews=(next:MailView[])=>onUpdate({workspace:{...(settings?.workspace||{}),views:next}})
 const updateWorkspace=(fields:Partial<MailSettings['workspace']>)=>onUpdate({workspace:{...(settings?.workspace||{}),...fields}})
 const resetDraft=()=>{setEditId(null);setLabel('');setUrl('');setModel('');setFree(false);setPaid(false);setEndpointKey('')}
 const normalizeUrl=(s:string)=>{const candidate=s.trim().replace(/\/+$/,'');return candidate.endsWith('/chat/completions')?candidate:candidate+'/chat/completions'}
 const saveEndpoint=async()=>{
  setLocalError('');setTestResult('')
  let candidate=''
  try{
   candidate=normalizeUrl(url)
   const parsed=new URL(candidate)
   if(parsed.protocol!=='https:'||parsed.port||parsed.username||parsed.password||parsed.search||parsed.hash||!/^[a-z\d.-]+\.[a-z]{2,}$/i.test(parsed.hostname))throw Error('必须填写公网 HTTPS API 地址，不支持 IP、内网、非标准端口')
   if(!label.trim()||!model.trim())throw Error('请填写服务名称与模型 ID')
  }catch(e){setLocalError(e instanceof Error?e.message:String(e));return}
  setSaving(true)
  try{
   let id=editId
   if(id){const r=await (supabase.from('mail_ai_endpoints') as any).update({label:label.trim().slice(0,80),api_url:candidate,model:model.trim().slice(0,128),declared_free:free,allow_paid:paid,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId);if(r.error)throw r.error}
   else{const r=await (supabase.from('mail_ai_endpoints') as any).insert({user_id:userId,label:label.trim().slice(0,80),api_url:candidate,model:model.trim().slice(0,128),declared_free:free,allow_paid:paid}).select('id').single();if(r.error)throw r.error;id=r.data.id}
   if(editId && settings?.ai_endpoint_id===editId)await onUpdate({ai_enabled:false,ai_allow_paid:false})
   if(endpointKey.trim())await call('save_endpoint_key',{endpoint_id:id,api_key:endpointKey.trim()})
   await reload();resetDraft()
   setTestResult('模型配置已保存。如修改了接口地址、模型或费用属性，必须重新保存对应 Key，然后点击测试；自动分析需重新主动启用。')
  }catch(e){setLocalError(e instanceof Error?e.message:String(e))}
  finally{setSaving(false)}
 }
 const startEdit=(e:Endpoint)=>{setEditId(e.id);setLabel(e.label);setUrl(e.api_url);setModel(e.model);setFree(e.declared_free);setPaid(e.allow_paid);setEndpointKey('');setTestResult('');setLocalError('')}
 const test=async(id:string|null,autoDetect=false,modelOverride?:string)=>{
  setTesting(id||'default');setLocalError('');setTestResult('')
  try{
   const r=await call(id?'test_endpoint':'test',id?{endpoint_id:id}:{auto_detect:autoDetect,model:modelOverride||settings?.ai_model})
   setTestResult((r.ok?'连接成功：':r.reachable?'连接已响应但模型未就绪：':'连接失败：')+
    (r.message||'未知响应')+(r.code?' · 业务码 '+r.code:'')+
    (r.retry_after_seconds?' · 建议 '+r.retry_after_seconds+' 秒后重试':'')+
    (r.latency_ms?' · '+r.latency_ms+'ms':''))
   if(id)await reload()
   await onRefresh()
   if(!id&&r.switched)await onUpdate({ai_glm_platform:r.platform,ai_enabled:false})
  }catch(e){setLocalError(e instanceof Error?e.message:String(e))}
  finally{setTesting(null)}
 }
 const remove=async(id:string)=>{
  if(!confirm('删除这个模型接口？删除后该接口不再参与自动分析。'))return
  setSaving(true)
  try{if(settings?.ai_endpoint_id===id)await onUpdate({ai_endpoint_id:null,ai_enabled:false})
   await call('delete_endpoint',{endpoint_id:id})
   if(editId===id)resetDraft()
   await reload()
  }catch(e){setLocalError(e instanceof Error?e.message:String(e))}
  finally{setSaving(false)}
 }
 const availableRoutes=[
  {id:'glm:glm-4.7-flash',label:'GLM-4.7-Flash · '+(settings?.ai_glm_platform==='bigmodel'?'BigModel':'Z.AI'),
   keyReady:!!settings?.ai_key_ready,free:true,latency:settings?.ai_glm_probe_times?.['glm-4.7-flash']??null},
  {id:'glm:glm-4.5-flash',label:'GLM-4.5-Flash · '+(settings?.ai_glm_platform==='bigmodel'?'BigModel':'Z.AI'),
   keyReady:!!settings?.ai_key_ready,free:true,latency:settings?.ai_glm_probe_times?.['glm-4.5-flash']??null},
  ...endpoints.map(e=>({id:'endpoint:'+e.id,label:e.label+' · '+e.model,
   keyReady:e.key_ready,free:e.declared_free,latency:e.last_test_latency_ms??null}))
 ]
 const routeOrder=(settings?.ai_route_order??['glm:glm-4.7-flash','glm:glm-4.5-flash'])
  .filter(id=>availableRoutes.some(x=>x.id===id))
 const updateOrder=(ids:string[])=>void onUpdate({ai_route_order:ids.slice(0,6),ai_enabled:false})
  const chosen=endpoints.find(e=>e.id===settings?.ai_endpoint_id)
 const ready=chosen?chosen.key_ready:!!settings?.ai_key_ready
 const paidWarning=!!chosen&&!chosen.declared_free
 return <section className="am-personalization">
  <header><h3>邮件工作台设置</h3><p>分类、AI 模型与指令保存在 Supabase，修改后无需重新发布。</p></header>

  <div className="am-personal-section">
   <h4><Settings2 size={16}/> 快捷分类</h4>
   <p>不固定审稿邀请栏目。可按使用频率自行增加、调整顺序与名称。</p>
   <div className="am-view-editor">{views.map((v,i)=><div className="am-view-row" key={v.id}>
    <input key={v.id+v.title} aria-label={v.title+'名称'} defaultValue={v.title} onBlur={e=>{const name=e.target.value.trim().slice(0,16);if(name&&name!==v.title)void updateViews(views.map(x=>x.id===v.id?{...x,title:name}:x))}}/>
    <span>{MAIL_VIEW_KINDS[v.kind]}</span>
    <button type="button" aria-label="上移" disabled={busy||i===0} onClick={()=>{const x=[...views];[x[i-1],x[i]]=[x[i],x[i-1]];void updateViews(x)}}><ArrowUp size={15}/></button>
    <button type="button" aria-label="下移" disabled={busy||i===views.length-1} onClick={()=>{const x=[...views];[x[i+1],x[i]]=[x[i],x[i+1]];void updateViews(x)}}><ArrowDown size={15}/></button>
    <button type="button" aria-label="删除" disabled={busy} onClick={()=>void updateViews(views.filter(x=>x.id!==v.id))}><X size={15}/></button>
   </div>)}</div>
   <div className="am-add-form"><label>入口名称<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="例如：审稿邀请"/></label>
    <label>类型<select value={newKind} onChange={e=>setNewKind(e.target.value as MailViewKind)}>{Object.entries(MAIL_VIEW_KINDS).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    <button type="button" className="am-main-button" disabled={!newTitle.trim()||views.length>=8||busy} onClick={()=>{void updateViews([...views,{id:crypto.randomUUID(),title:newTitle.trim().slice(0,16),kind:newKind}]);setNewTitle('')}}><Plus size={14}/> 添加入口</button>
   </div>
   <label className="am-option"><input type="checkbox" checked={settings?.workspace?.show_statistics!==false} disabled={busy} onChange={e=>void updateWorkspace({show_statistics:e.target.checked})}/> 显示快捷分类</label>
   <label className="am-option"><input type="checkbox" checked={!!settings?.workspace?.compact} disabled={busy} onChange={e=>void updateWorkspace({compact:e.target.checked})}/> 紧凑型邮件列表</label>
  </div>
  <div className="am-personal-section">
   <h4><Sparkles size={16}/> AI 服务与模型</h4>
   <p>内置 GLM 免费 Flash 模型，并可添加多个符合 OpenAI Chat Completions 协议的 HTTPS 接口。密钥保存在服务端 Vault，不会保存到浏览器或 GitHub。</p>
   <label className="am-choice-label">当前分析服务
    <select value={settings?.ai_endpoint_id||''} onChange={e=>void onUpdate({ai_endpoint_id:e.target.value||null,ai_enabled:false,ai_allow_paid:false})}>
     <option value="">Z.AI · GLM 免费 Flash</option>
     {endpoints.map(e=><option key={e.id} value={e.id}>{e.label} · {e.model}</option>)}
    </select></label>
   {!chosen?<div className="am-model-preset">
    <div className="am-add-form"><label>GLM 平台<select value={settings?.ai_glm_platform||'zai'} disabled={busy||!!testing}
      onChange={e=>void onUpdate({ai_glm_platform:e.target.value as 'zai'|'bigmodel',ai_enabled:false})}>
      <option value="bigmodel">智谱 BigModel（中国）</option>
      <option value="zai">Z.AI（国际）</option>
    </select></label><label>默认 GLM 模型<select value={settings?.ai_model||'glm-4.7-flash'} onChange={e=>void onUpdate({ai_model:e.target.value})} disabled={busy}>
     <option value="glm-4.7-flash">GLM-4.7-Flash</option><option value="glm-4.5-flash">GLM-4.5-Flash</option></select></label>
     <label>GLM API Key<input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={settings?.ai_key_ready?'Key 已保存，留空不修改':'填写 API Key'}/></label>
     <button type="button" className="am-main-button" disabled={!apiKey.trim()||busy} onClick={()=>void onSaveKey(apiKey.trim()).then(()=>setApiKey('')).catch(()=>{})}>保存 Key</button>
     <button type="button" className="am-quiet-button" disabled={!settings?.ai_key_ready||!!testing||busy} onClick={()=>void test(null)}>{testing==='default'?'测试中…':'测试当前平台'}</button>
     <button type="button" className="am-quiet-button" disabled={!settings?.ai_key_ready||!!testing||busy}
      onClick={()=>void test(null,true)}>自动检测官方平台</button>
    </div><small>{settings?.ai_key_ready?'GLM API Key 已加密保存。测试调用少量免费 Flash token；自动检测会向国内及国际官方平台分别发送最短探针，成功后自动选择对应平台。':'请先添加 API Key 后测试。'}</small>
   </div>:<div className="am-model-preset"><strong>{chosen.label}</strong><p>模型：{chosen.model} · {chosen.key_ready?'Key 已保存':'Key 未配置'} · {chosen.last_test_status==='ok'?'上次测试成功':chosen.last_test_status||'尚未测试'}</p>
    <button type="button" className="am-quiet-button" disabled={!chosen.key_ready||!!testing||busy} onClick={()=>void test(chosen.id)}>{testing===chosen.id?'测试中…':'测试选中模型'}</button></div>}
   <div className="am-endpoint-list"><div className="am-section-heading"><strong>自定义 API 列表</strong><span>{endpoints.length} 个</span></div>
    {endpoints.map(e=><div key={e.id} className="am-endpoint-row">
     <div><strong>{e.label}</strong><small>{e.model} · {e.declared_free?'自定义标记为免费':'可能收费'} · {e.key_ready?'已授权':'未授权'}</small></div>
     <button type="button" disabled={busy||saving} onClick={()=>startEdit(e)}>编辑</button>
     <button type="button" disabled={!e.key_ready||!!testing||busy} onClick={()=>void test(e.id)}>测试</button>
     <button type="button" disabled={busy||saving} onClick={()=>void remove(e.id)} aria-label="删除接口"><Trash2 size={14}/></button>
    </div>)}
   </div>
   <div className="am-model-editor"><strong>{editId?'编辑自定义 API':'新增自定义 API'}</strong>
    <div className="am-add-form">
     <label>服务名称<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="例如：OpenRouter"/></label>
     <label>模型 ID<input value={model} onChange={e=>setModel(e.target.value)} placeholder="例如：provider/model-id"/></label>
     <label className="am-full-field">API Base URL 或 Chat Completions 完整地址<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://api.example.com/v1/chat/completions"/></label>
     <label>API Key<input type="password" autoComplete="new-password" value={endpointKey} onChange={e=>setEndpointKey(e.target.value)} placeholder={editId?'留空保持原 Key':'填写接口授权 Key'}/></label>
    </div>
    <label className="am-option"><input type="checkbox" checked={free} onChange={e=>setFree(e.target.checked)}/> 该模型由我确认属于免费调用（需要实际测试，平台可能调整政策）</label>
    <label className="am-option"><input type="checkbox" checked={paid} onChange={e=>setPaid(e.target.checked)}/> 允许此接口参与可能收费的自动调用（还需二次全局授权）</label>
    <div className="am-add-form"><button type="button" className="am-main-button" disabled={saving||busy||!url||!model||!label} onClick={()=>void saveEndpoint()}>{saving?'保存中…':'保存接口'}</button>
     {editId&&<button type="button" className="am-quiet-button" onClick={resetDraft}>取消编辑</button>}</div>
   </div>
  </div>
  <div className="am-personal-section">
   <h4><Sparkles size={16}/> 多模型优先级与自动接力</h4>
   <p>默认不自动切换。可勾选需要的模型并调整顺序；启用接力后按此顺序尝试，只向已授权的免费备用模型发送邮件正文。不同服务商都可能接收同一封待分析邮件。</p>
   <div className="am-route-list">
    {availableRoutes.map(route=>{
      const index=routeOrder.indexOf(route.id),active=index>=0
      return <div className={'am-route-row '+(active?'selected':'')} key={route.id}>
       <label className="am-route-checkbox"><input type="checkbox" checked={active} disabled={busy||(!active&&routeOrder.length>=6)}
        onChange={e=>updateOrder(e.target.checked?[...routeOrder,route.id]:routeOrder.filter(id=>id!==route.id))}/></label>
       <div className="am-route-detail"><strong>{route.label}</strong>
        <small>{route.free?'免费标记':'可能收费，不能作为自动备用'} · {route.keyReady?'连接已授权':'未测试或未授权'} · {route.latency!==null?'实测 '+(route.latency/1000).toFixed(1)+' 秒':'尚无速度测量'}</small>
       </div>
       {active&&<div className="am-route-position"><span>第 {index+1} 位</span>
        <button type="button" aria-label={route.label+'上移'} disabled={busy||index===0}
         onClick={()=>{const x=[...routeOrder];[x[index-1],x[index]]=[x[index],x[index-1]];updateOrder(x)}}><ArrowUp size={14}/></button>
        <button type="button" aria-label={route.label+'下移'} disabled={busy||index===routeOrder.length-1}
         onClick={()=>{const x=[...routeOrder];[x[index+1],x[index]]=[x[index],x[index+1]];updateOrder(x)}}><ArrowDown size={14}/></button>
       </div>}
       {route.id.startsWith('glm:')&&<button type="button" className="am-quiet-button am-route-test"
        disabled={busy||!!testing||!route.keyReady} onClick={()=>void test(null,false,route.id.slice(4))}>测速度</button>}
       {route.id.startsWith('endpoint:')&&<button type="button" className="am-quiet-button am-route-test"
        disabled={busy||!!testing||!route.keyReady} onClick={()=>void test(route.id.slice(9))}>测速度</button>}
      </div>
    })}
   </div>
   <label className="am-option"><input type="checkbox" checked={!!settings?.ai_failover_enabled} disabled={busy||routeOrder.length===0}
     onChange={e=>void onUpdate({ai_failover_enabled:e.target.checked,ai_enabled:false})}/> 当前模型失败后，自动尝试路由列表的下一模型</label>
   <label className="am-option"><input type="checkbox" checked={settings?.ai_slow_mode!==false} disabled={busy}
     onChange={e=>void onUpdate({ai_slow_mode:e.target.checked})}/> 容忍免费接口慢速响应，按最近实测耗时调整等待时间</label>
   <div className="am-add-form"><label>每次模型请求最长等待<select value={settings?.ai_max_wait_seconds??65} disabled={busy}
     onChange={e=>void onUpdate({ai_max_wait_seconds:Number(e.target.value)})}>
    {[30,45,65,90].map(x=><option key={x} value={x}>{x} 秒</option>)}
   </select></label></div>
   <p className="am-disclaimer">慢速模式不会因短暂无响应直接改用收费模型。每次接力都计入每日调用次数；总运行时间受 Supabase 免费 Edge 环境约束。未启用接力时仍只访问当前选择的模型。</p>
  </div>
   <div className="am-personal-section">
   <h4>分析指令与自动处理</h4>
   <p>指令可直接修改，保留固定的邮件安全隔离和 JSON 输出约束。自动分析只会发送邮件正文片段到你选定的模型服务。</p>
   <label className="am-choice-label">分析系统指令<textarea rows={5} maxLength={6000} value={prompt} onChange={e=>setPrompt(e.target.value)} /></label>
   <div className="am-add-form"><button type="button" className="am-main-button" disabled={!prompt.trim()||busy||prompt===settings?.ai_system_prompt} onClick={()=>void onUpdate({ai_system_prompt:prompt.trim()})}>保存分析指令</button>
    <button type="button" className="am-quiet-button" onClick={()=>setPrompt(DEFAULT_PROMPT)}>恢复默认文本</button></div>
   <div className="am-add-form"><label>每日最多自动分析<select value={settings?.ai_daily_limit??20} disabled={busy} onChange={e=>void onUpdate({ai_daily_limit:Number(e.target.value)})}>{[0,5,10,20,30,50].map(n=><option value={n} key={n}>{n} 封</option>)}</select></label></div>
   {paidWarning&&<label className="am-option"><input type="checkbox" checked={!!settings?.ai_allow_paid} disabled={busy} onChange={e=>void onUpdate({ai_allow_paid:e.target.checked,ai_enabled:false})}/> 我了解该自定义模型可能产生费用，并明确允许自动调用</label>}
   <label className="am-option"><input type="checkbox" disabled={busy||!ready||settings?.ai_daily_limit===0||(paidWarning&&!chosen?.declared_free&&!(chosen?.allow_paid&&settings?.ai_allow_paid))} checked={!!settings?.ai_enabled}
     onChange={e=>void onUpdate({ai_enabled:e.target.checked,...e.target.checked?{ai_started_at:new Date().toISOString()}: {}})}/> 开启后台自动摘要、标签、优先级和行动建议（默认关闭）</label>
   <label className="am-option"><input type="checkbox" disabled={busy} checked={!!settings?.ai_analyze_existing} onChange={e=>void onUpdate({ai_analyze_existing:e.target.checked})}/> 同时分析历史邮件</label>
   {settings?.last_ai_error&&<p className="am-account-error"><AlertCircle size={14}/>{settings.last_ai_error}</p>}
   <p className="am-disclaimer">测试模型会发送简单探针并使用少量 token，可能产生费用。自定义接口的免费额度由服务商决定；系统不自动切换付费模型。校园邮件外发应符合所在单位的数据管理要求。</p>
  </div>
 </section>
}
