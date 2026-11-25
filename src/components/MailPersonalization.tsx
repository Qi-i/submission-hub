import {useCallback,useEffect,useState} from 'react'
import {AlertCircle,ArrowDown,ArrowUp,Plus,Settings2,Sparkles,Trash2,X} from 'lucide-react'
import {supabase} from '../lib/supabase'
import type {MailToastKind} from './MailToast'
import {normalizeEndpoint,authOf,type AiProtocol,type AiAuth,type ChatTokenField} from '../../supabase/functions/_shared/ai-protocol.mjs'
import {AI_TASKS,taskPolicy,type AiTask,type AiTaskPolicy} from '../../supabase/functions/_shared/ai-task-policy.mjs'
export type MailViewKind='all'|'important'|'review_invite'|'pending'|'submission_update'|'spam'
export type MailView={id:string;title:string;kind:MailViewKind}
export type MailSettings={
 user_id:string;workspace:{compact?:boolean;show_statistics?:boolean;views?:MailView[]};
 ai_enabled:boolean;ai_model:string;ai_daily_limit:number;ai_analyze_existing:boolean;ai_started_at?:string|null;
 ai_key_ready:boolean;last_ai_error:string|null;ai_endpoint_id?:string|null;ai_system_prompt?:string;ai_allow_paid?:boolean;ai_glm_platform?:'zai'|'bigmodel';
 ai_failover_enabled?:boolean;ai_route_order?:string[];ai_slow_mode?:boolean;ai_max_wait_seconds?:number;ai_glm_probe_ms?:number|null;ai_glm_probe_times?:Record<string,number>;ai_task_routes?:Partial<Record<AiTask,AiTaskPolicy|null>>
}
type Endpoint={id:string;label:string;api_url:string;model:string;declared_free:boolean;allow_paid:boolean;key_ready:boolean;last_test_at:string|null;last_test_status:string|null;last_test_latency_ms?:number|null;api_protocol?:AiProtocol;auth_scheme?:AiAuth;chat_token_field?:ChatTokenField;config_revision?:string;vision_test_status?:string|null}
const taskLabels:Record<AiTask,string>={mail_translation:'邮件翻译',mail_analysis:'邮件自动分析',ledger_text:'账单文字智能导入',ledger_vision:'账单截图识别'}
const protocolLabels:Record<AiProtocol,string>={chat:'OpenAI Chat Completions',messages:'Anthropic Messages',responses:'OpenAI Responses',gemini:'Gemini GenerateContent'}
const presets=[{label:'OpenAI',url:'https://api.openai.com/v1',protocol:'responses'},{label:'Anthropic',url:'https://api.anthropic.com/v1',protocol:'messages'},{label:'Gemini',url:'https://generativelanguage.googleapis.com/v1beta',protocol:'gemini'},{label:'OpenAI 兼容 / 中转',url:'',protocol:'chat'}] as const
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
 const [showApiEditor,setShowApiEditor]=useState(false)
 const [label,setLabel]=useState('')
 const [url,setUrl]=useState('')
 const [model,setModel]=useState('')
 const [protocol,setProtocol]=useState<AiProtocol>('chat')
 const [auth,setAuth]=useState<AiAuth>('bearer')
 const [tokenField,setTokenField]=useState<ChatTokenField>('max_tokens')
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
  const r=await (supabase.from('mail_ai_endpoints') as any).select('id,label,api_url,model,declared_free,allow_paid,key_ready,last_test_at,last_test_status,last_test_latency_ms,api_protocol,auth_scheme,chat_token_field,config_revision,vision_test_status').eq('user_id',userId).order('created_at',{ascending:true})
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
 const resetDraft=()=>{setEditId(null);setLabel('');setUrl('');setModel('');setProtocol('chat');setAuth('bearer');setTokenField('max_tokens');setFree(false);setPaid(false);setEndpointKey('');setShowApiEditor(false)}
 const fillGarden=()=>{
  setEditId(null)
  setLabel('MagicZotero GPT 翻译')
  setUrl('https://gpt.magiczotero.top/v1/chat/completions')
  setModel('magic-translate-gpt')
  setProtocol('chat');setAuth('bearer');setTokenField('max_tokens')
  setFree(true)
  setPaid(false)
  setEndpointKey('')
  setShowApiEditor(true)
  setLocalError('')
  setTestResult('')
 }
 const chooseProtocol=(p:AiProtocol)=>{setProtocol(p);setAuth(authOf(p));setTokenField('max_tokens')}
 const choosePreset=(index:string)=>{if(!index)return;const preset=presets[Number(index)];if(!preset)return;setLabel(preset.label);setUrl(preset.url);setModel('');chooseProtocol(preset.protocol);setFree(false);setPaid(false);setEndpointKey('')}
 let requestAddress=''
 try{if(url.trim())requestAddress=normalizeEndpoint(url,protocol,model.trim())}catch{}
 const saveEndpoint=async()=>{
  setLocalError('');setTestResult('')
  let candidate=''
  try{
   if(!label.trim()||!model.trim())throw Error('请填写服务名称与模型 ID')
   candidate=normalizeEndpoint(url,protocol,model.trim())
   authOf(protocol,auth)
   const old=endpoints.find(e=>e.id===editId)
   if(old&&(old.api_url!==candidate||old.model!==model.trim()||(old.api_protocol||'chat')!==protocol||(old.auth_scheme||'bearer')!==auth||(old.chat_token_field||'max_tokens')!==tokenField||old.declared_free!==free||old.allow_paid!==(free?false:paid))&&!endpointKey.trim())throw Error('接口或计费配置已改变，请重新填写 Key 后保存')
  }catch(e){setLocalError(e instanceof Error?e.message:String(e));return}
  setSaving(true)
  try{
   let id=editId,revision:string
   const fields={label:label.trim().slice(0,80),api_url:candidate,model:model.trim().slice(0,128),declared_free:free,allow_paid:free?false:paid,api_protocol:protocol,auth_scheme:auth,chat_token_field:tokenField}
   if(id){const old=endpoints.find(e=>e.id===id);const r=await (supabase.from('mail_ai_endpoints') as any).update({...fields,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId).eq('config_revision',old?.config_revision).select('id,config_revision').maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error('配置已改变，请刷新后编辑');revision=r.data.config_revision}
   else{const r=await (supabase.from('mail_ai_endpoints') as any).insert({user_id:userId,...fields}).select('id,config_revision').single();if(r.error)throw r.error;id=r.data.id;revision=r.data.config_revision;setEditId(id)}
   if(endpointKey.trim())await call('save_endpoint_key',{endpoint_id:id,config_revision:revision,api_key:endpointKey.trim()})
   await reload();await onRefresh();resetDraft()
   setTestResult('模型接口已更新')
  }catch(e){setLocalError(e instanceof Error?e.message:String(e));await reload()}
  finally{setSaving(false)}
 }
 const startEdit=(e:Endpoint)=>{setEditId(e.id);setLabel(e.label);setUrl(e.api_url);setModel(e.model);setProtocol(e.api_protocol||'chat');setAuth(e.auth_scheme||'bearer');setTokenField(e.chat_token_field||'max_tokens');setFree(e.declared_free);setPaid(e.allow_paid);setEndpointKey('');setTestResult('');setLocalError('');setShowApiEditor(true)}
 const test=async(id:string|null,autoDetect=false,modelOverride?:string,vision=false)=>{
  const endpoint=id?endpoints.find(e=>e.id===id):null
  const paidTest=!!endpoint&&!endpoint.declared_free
  if(paidTest&&!confirm('该接口可能产生费用。是否发送一次连接测试？'))return
  setTesting(id||'default');setLocalError('');setTestResult('')
  try{
   const r=await call(id?(vision?'test_vision':'test_endpoint'):'test',id?{endpoint_id:id,allow_paid_test:paidTest}:{auto_detect:autoDetect,model:modelOverride||settings?.ai_model})
   setTestResult((r.ok?'连接成功：':r.reachable?'连接已响应但模型未就绪：':'连接失败：')+
    (r.message||'未知响应')+(r.code?' · 业务码 '+r.code:'')+
    (r.retry_after_seconds?' · 建议 '+r.retry_after_seconds+' 秒后重试':'')+
    (r.latency_ms?' · '+r.latency_ms+'ms':''))
   if(id)await reload()
   await onRefresh()
   // Auto-detection already saved its platform on the server; do not write stale preferences.
  }catch(e){setLocalError(e instanceof Error?e.message:String(e))}
  finally{setTesting(null)}
 }
 const remove=async(id:string)=>{
  if(!confirm('删除这个模型接口？'))return
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
   keyReady:!!settings?.ai_key_ready,free:true,tested:!!settings?.ai_glm_probe_times?.['glm-4.7-flash'],latency:settings?.ai_glm_probe_times?.['glm-4.7-flash']??null},
  {id:'glm:glm-4.5-flash',label:'GLM-4.5-Flash · '+(settings?.ai_glm_platform==='bigmodel'?'BigModel':'Z.AI'),
   keyReady:!!settings?.ai_key_ready,free:true,tested:!!settings?.ai_glm_probe_times?.['glm-4.5-flash'],latency:settings?.ai_glm_probe_times?.['glm-4.5-flash']??null},
  ...endpoints.map(e=>({id:'endpoint:'+e.id,label:e.label+' · '+e.model,
   keyReady:e.key_ready,free:e.declared_free,tested:e.last_test_status==='ok',latency:e.last_test_latency_ms??null}))
 ]
 const routeOrder=(settings?.ai_route_order??['glm:glm-4.7-flash','glm:glm-4.5-flash'])
  .filter(id=>availableRoutes.some(x=>x.id===id))
 const updateOrder=(ids:string[])=>void onUpdate({ai_route_order:ids.slice(0,6),ai_enabled:false})
 const eligibleCount=routeOrder.filter(id=>{const r=availableRoutes.find(v=>v.id===id);return !!r?.free&&!!r?.keyReady&&(id.startsWith('glm:')||!!r?.tested)}).length
  const chosen=endpoints.find(e=>e.id===settings?.ai_endpoint_id)
 const ready=chosen?chosen.key_ready:!!settings?.ai_key_ready
 const paidWarning=!!chosen&&!chosen.declared_free
 const updateTask=(task:AiTask,policy:AiTaskPolicy|null)=>void onUpdate({ai_task_routes:{...settings?.ai_task_routes,[task]:policy},...(task==='mail_analysis'?{ai_enabled:false}:{})})
 return <section className="am-personalization">
  <header><h3>邮件工作台设置</h3></header>

  <div className="am-personal-section">
   <h4><Settings2 size={16}/> 快捷分类</h4>
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
   <h4><Sparkles size={16}/> 共享 AI 模型库</h4>
   <label className="am-choice-label">公共默认线路
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
    </div>
   </div>:<div className="am-model-preset"><strong>{chosen.label}</strong><p>模型：{chosen.model} · {chosen.key_ready?'Key 已保存':'Key 未配置'} · {chosen.last_test_status==='ok'?'上次测试成功':chosen.last_test_status||'尚未测试'}</p>
    <button type="button" className="am-quiet-button" disabled={!chosen.key_ready||!!testing||busy} onClick={()=>void test(chosen.id)}>{testing===chosen.id?'测试中…':'测试选中模型'}</button></div>}
   <div className="am-endpoint-list"><div className="am-section-heading"><strong>自定义 API 列表</strong>
     <button type="button" className="am-quiet-button" onClick={fillGarden} disabled={busy||saving}>预填 MagicZotero 翻译 API</button>
     <span>{endpoints.length} 个</span></div>
    {endpoints.map(e=><div key={e.id} className="am-endpoint-row">
     <div><strong>{e.label}</strong><small>{protocolLabels[e.api_protocol||'chat']} · {e.model} · {e.declared_free?'自定义标记为免费':'可能收费'} · {e.key_ready?'已授权':'未授权'} · {e.last_test_status==='ok'?'已测试':'待验证'}</small></div>
     <button type="button" disabled={busy||saving} onClick={()=>startEdit(e)}>编辑</button>
     <button type="button" disabled={!e.key_ready||!!testing||busy} onClick={()=>void test(e.id)}>文本测试</button>
     <button type="button" disabled={!e.key_ready||!!testing||busy} onClick={()=>void test(e.id,false,undefined,true)}>{e.vision_test_status==='ok'?'视觉已通过':'视觉测试'}</button>
     {e.declared_free&&e.key_ready&&e.last_test_status==='ok'&&
      <button type="button" disabled={busy||saving||settings?.ai_endpoint_id===e.id}
       onClick={()=>void onUpdate({ai_endpoint_id:e.id,ai_enabled:false,ai_allow_paid:false,ai_failover_enabled:false})}>
       {settings?.ai_endpoint_id===e.id?'当前翻译线路':'用于翻译'}</button>}
     <button type="button" disabled={busy||saving} onClick={()=>void remove(e.id)} aria-label="删除接口"><Trash2 size={14}/></button>
    </div>)}
   </div>
   <details className="am-model-editor" open={!!editId||showApiEditor||undefined}
    onToggle={e=>setShowApiEditor(e.currentTarget.open)}><summary>{editId?'编辑自定义 API':'新增自定义 API'}</summary>
    <div className="am-add-form">
     {!editId&&<label>服务商预设<select value="" onChange={e=>choosePreset(e.target.value)}><option value="">选择或手动配置</option>{presets.map((p,i)=><option key={p.label} value={i}>{p.label}</option>)}</select></label>}
     <label>服务名称<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="例如：OpenRouter"/></label>
     <label>接口协议<select value={protocol} onChange={e=>chooseProtocol(e.target.value as AiProtocol)}>{Object.entries(protocolLabels).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
     <label>模型 ID<input value={model} onChange={e=>setModel(e.target.value)} placeholder="例如：provider/model-id"/></label>
     <label className="am-full-field">API Base URL 或完整请求地址<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://api.example.com/v1"/><small>{requestAddress?'实际请求：'+requestAddress:'请填写与所选协议匹配的 HTTPS 地址'}</small></label>
     <label>认证方式<select value={auth} onChange={e=>setAuth(e.target.value as AiAuth)}><option value="bearer">Authorization: Bearer</option>{protocol==='messages'&&<option value="x-api-key">x-api-key</option>}{protocol==='gemini'&&<option value="x-goog-api-key">x-goog-api-key</option>}</select></label>
     {protocol==='chat'&&<label>输出 Token 参数<select value={tokenField} onChange={e=>setTokenField(e.target.value as ChatTokenField)}><option value="max_tokens">max_tokens（兼容接口）</option><option value="max_completion_tokens">max_completion_tokens（新模型）</option></select></label>}
     <label>API Key<input type="password" autoComplete="new-password" value={endpointKey} onChange={e=>setEndpointKey(e.target.value)} placeholder={editId?'留空保持原 Key':'填写接口授权 Key'}/></label>
    </div>
    <label className="am-option"><input type="checkbox" checked={free} onChange={e=>{setFree(e.target.checked);if(e.target.checked)setPaid(false)}}/> 已确认免费接口（服务商实际计费由用户核对）</label>
    <label className="am-option"><input type="checkbox" checked={paid&&!free} disabled={free} onChange={e=>setPaid(e.target.checked)}/> 允许付费分析调用</label>
    <small>配置保存在云端，Android 使用同一线路，无需再次填写 Key。翻译仅使用免费线路。</small>
    <div className="am-add-form"><button type="button" className="am-main-button" disabled={saving||busy||!url||!model||!label} onClick={()=>void saveEndpoint()}>{saving?'保存中…':'保存接口'}</button>
     {editId&&<button type="button" className="am-quiet-button" onClick={resetDraft}>取消编辑</button>}</div>
   </details>
  </div>
  <div className="am-personal-section">
   <h4><Settings2 size={16}/> 按业务分配模型</h4>
   <p>一次配置模型库；各任务继承公共方案，或独立指定有序候选。图片仅使用通过视觉测试的模型。手动付费识别需每次授权，自动备用仅免费。</p>
   {AI_TASKS.map(task=>{
    const policy=taskPolicy(settings||{},task),custom=settings?.ai_task_routes?.[task]
    const ids=policy.routes
    const move=(i:number,delta:number)=>{const next=[...ids];[next[i],next[i+delta]]=[next[i+delta],next[i]];updateTask(task,{routes:next,allowPaid:false})}
    return <div className="am-model-preset" key={task}>
     <div className="am-section-heading"><strong>{taskLabels[task]}</strong><label><select aria-label={taskLabels[task]+'配置方式'} disabled={busy||saving} value={policy.inherit?'inherit':'custom'} onChange={e=>updateTask(task,e.target.value==='inherit'?null:{routes:[...ids],allowPaid:false})}><option value="inherit">继承公共方案</option><option value="custom">独立配置</option></select></label></div>
     <div className="am-route-list">{ids.map((id,i)=>{
      const r=availableRoutes.find(x=>x.id===id),ep=endpoints.find(x=>'endpoint:'+x.id===id)
      return <div className="am-route-row" key={id}><span>{i+1}</span><div className="am-route-detail"><strong>{r?.label||'已移除的模型'}</strong><small>{!r?.keyReady?'未授权':task==='ledger_vision'&&ep?.vision_test_status!=='ok'?'视觉尚未通过':!r.tested?'尚未测试':r.free?'免费标记':'可能收费'}</small></div>
       {!policy.inherit&&<div className="am-route-position"><button type="button" aria-label="上移线路" disabled={busy||i===0} onClick={()=>move(i,-1)}><ArrowUp size={14}/></button><button type="button" aria-label="下移线路" disabled={busy||i===ids.length-1} onClick={()=>move(i,1)}><ArrowDown size={14}/></button><button type="button" aria-label="移除线路" disabled={busy} onClick={()=>updateTask(task,{routes:ids.filter(x=>x!==id),allowPaid:false})}><X size={14}/></button></div>}
      </div>
     })}</div>
     {!ids.length&&<small>未配置线路：该任务不会请求模型。</small>}
     {!policy.inherit&&<><label className="am-choice-label">添加候选模型<select value="" disabled={busy||ids.length>=6} onChange={e=>{if(e.target.value)updateTask(task,{routes:[...ids,e.target.value],allowPaid:false})}}><option value="">选择模型</option>{availableRoutes.filter(r=>!ids.includes(r.id)&&r.keyReady&&(task!=='mail_translation'||r.free)&&(task!=='ledger_vision'||endpoints.some(ep=>'endpoint:'+ep.id===r.id&&ep.vision_test_status==='ok'))).map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
      {task!=='mail_translation'&&ids.length===1&&<label className="am-option"><input type="checkbox" checked={custom?.allowPaid===true} disabled={busy} onChange={e=>updateTask(task,{routes:ids,allowPaid:e.target.checked})}/> 明确允许此任务使用已授权的付费模型</label>}</>}
    </div>
   })}
  </div>
  <details className="am-personal-section am-advanced-models">
   <summary>模型优先级与备用线路</summary>
   <div className="am-route-list">
    {availableRoutes.map(route=>{
      const index=routeOrder.indexOf(route.id),active=index>=0
      return <div className={'am-route-row '+(active?'selected':'')} key={route.id}>
       <label className="am-route-checkbox"><input type="checkbox" checked={active} disabled={busy||!route.free||(!active&&routeOrder.length>=6)}
        onChange={e=>updateOrder(e.target.checked?[...routeOrder,route.id]:routeOrder.filter(id=>id!==route.id))}/></label>
       <div className="am-route-detail"><strong>{route.label}</strong>
        <small>{route.free?'免费标记':'可能收费，不能作为自动备用'} · {!route.keyReady?'尚未授权':route.tested?'测试成功':'尚未测速/验证'} · {route.latency!==null?'实测 '+(route.latency/1000).toFixed(1)+' 秒':'尚无速度测量'}</small>
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
   <label className="am-option"><input type="checkbox" checked={!!settings?.ai_failover_enabled} disabled={busy||eligibleCount===0}
     onChange={e=>void onUpdate({ai_failover_enabled:e.target.checked,ai_enabled:false})}/> 模型失败时切换到已授权的免费备用模型</label>
   <label className="am-option"><input type="checkbox" checked={settings?.ai_slow_mode!==false} disabled={busy}
     onChange={e=>void onUpdate({ai_slow_mode:e.target.checked})}/> 容忍免费接口慢速响应，按最近实测耗时调整等待时间</label>
   <div className="am-add-form"><label>每次模型请求最长等待<select value={settings?.ai_max_wait_seconds??65} disabled={busy}
     onChange={e=>void onUpdate({ai_max_wait_seconds:Number(e.target.value)})}>
    {[30,45,65,90].map(x=><option key={x} value={x}>{x} 秒</option>)}
   </select></label></div>
  </details>
  <details className="am-personal-section am-analysis-settings">
   <summary>分析指令与调用额度</summary>
   <label className="am-choice-label">分析系统指令<textarea rows={5} maxLength={6000} value={prompt} onChange={e=>setPrompt(e.target.value)} /></label>
   <div className="am-add-form"><button type="button" className="am-main-button" disabled={!prompt.trim()||busy||prompt===settings?.ai_system_prompt} onClick={()=>void onUpdate({ai_system_prompt:prompt.trim()})}>保存分析指令</button>
    <button type="button" className="am-quiet-button" onClick={()=>setPrompt(DEFAULT_PROMPT)}>恢复默认文本</button></div>
   {paidWarning&&<label className="am-option"><input type="checkbox" checked={!!settings?.ai_allow_paid} disabled={busy} onChange={e=>void onUpdate({ai_allow_paid:e.target.checked,ai_enabled:false})}/> 我了解该自定义模型可能产生费用，并明确允许自动调用</label>}
   {settings?.last_ai_error&&<p className="am-account-error"><AlertCircle size={14}/>{settings.last_ai_error}</p>}
  </details>
 </section>
}
