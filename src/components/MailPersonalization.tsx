import { useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, Plus, Settings2, Sparkles, X } from 'lucide-react'

export type MailViewKind='all'|'important'|'review_invite'|'pending'|'submission_update'|'spam'
export type MailView={id:string;title:string;kind:MailViewKind}
export type MailSettings={
 user_id:string;workspace:{compact?:boolean;show_statistics?:boolean;views?:MailView[]};
 ai_enabled:boolean;ai_model:string;ai_daily_limit:number;ai_analyze_existing:boolean;ai_started_at?:string|null;
 ai_key_ready:boolean;last_ai_error:string|null
}
export const DEFAULT_MAIL_VIEWS:MailView[]=[
 {id:'all',title:'全部邮件',kind:'all'},
 {id:'important',title:'重要邮件',kind:'important'},
 {id:'submission',title:'投稿往来',kind:'submission_update'},
 {id:'spam',title:'垃圾邮件备份',kind:'spam'},
]
export const MAIL_VIEW_KINDS:Record<MailViewKind,string>={
 all:'全部邮件',important:'重要邮件',review_invite:'审稿邀请',
 pending:'待答复审稿',submission_update:'投稿往来',spam:'垃圾邮件'
}

type Props={
 settings:MailSettings|null
 busy:boolean
 onUpdate:(change:Partial<MailSettings>)=>Promise<void>
 onSaveKey:(key:string)=>Promise<void>
}
export default function MailPersonalization({settings,busy,onUpdate,onSaveKey}:Props){
 const [newTitle,setNewTitle]=useState('')
 const [newKind,setNewKind]=useState<MailViewKind>('review_invite')
 const [apiKey,setApiKey]=useState('')
 const views=(settings?.workspace?.views?.length?settings.workspace.views:DEFAULT_MAIL_VIEWS)
   .filter(v=>v&&MAIL_VIEW_KINDS[v.kind])
 const updateViews=(next:MailView[])=>onUpdate({workspace:{...(settings?.workspace||{}),views:next}})
 const updateWorkspace=(fields:Partial<MailSettings['workspace']>)=>
  onUpdate({workspace:{...(settings?.workspace||{}),...fields}})
 return <section className="am-personalization">
  <header><h3>个性化邮件工作台</h3>
   <p>快捷入口、显示密度和 AI 设置直接同步到数据库，无需重新发布网页。</p></header>
  <div className="am-personal-section">
   <h4><Settings2 size={16}/> 自定义快捷入口</h4>
   <p>仅显示常用内容。审稿邀请可随时添加或取消，不占固定栏目。</p>
   <div className="am-view-editor">
    {views.map((view,index)=><div className="am-view-row" key={view.id}>
     <input aria-label={view.title+'名称'} defaultValue={view.title} key={view.id+':'+view.title}
      onBlur={e=>{if(e.target.value.trim()!==view.title)void updateViews(views.map(v=>v.id===view.id?{...v,title:e.target.value.trim().slice(0,16)||v.title}:v))}}/>
     <span>{MAIL_VIEW_KINDS[view.kind]}</span>
     <button type="button" title="向前移动" aria-label="向前移动" disabled={busy||index===0}
      onClick={()=>{const next=[...views];[next[index],next[index-1]]=[next[index-1],next[index]];void updateViews(next)}}><ArrowUp size={15}/></button>
     <button type="button" title="向后移动" aria-label="向后移动" disabled={busy||index===views.length-1}
      onClick={()=>{const next=[...views];[next[index],next[index+1]]=[next[index+1],next[index]];void updateViews(next)}}><ArrowDown size={15}/></button>
     <button type="button" aria-label="移除快捷入口" title="移除" disabled={busy}
      onClick={()=>void updateViews(views.filter(v=>v.id!==view.id))}><X size={15}/></button>
    </div>)}
   </div>
   <div className="am-add-form">
    <label>新增入口<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="例如：审稿邀请"/></label>
    <label>筛选条件<select value={newKind} onChange={e=>setNewKind(e.target.value as MailViewKind)}>
     {Object.entries(MAIL_VIEW_KINDS).map(([k,v])=><option value={k} key={k}>{v}</option>)}
    </select></label>
    <button type="button" className="am-main-button" disabled={!newTitle.trim()||views.length>=8||busy}
     onClick={()=>{void updateViews([...views,{id:crypto.randomUUID(),title:newTitle.trim().slice(0,16),kind:newKind}]);setNewTitle('')}}><Plus size={14}/>添加</button>
   </div>
   <label className="am-option"><input type="checkbox" checked={settings?.workspace?.show_statistics!==false}
     disabled={busy} onChange={e=>void updateWorkspace({show_statistics:e.target.checked})}/> 显示快捷分类</label>
   <label className="am-option"><input type="checkbox" checked={!!settings?.workspace?.compact}
     disabled={busy} onChange={e=>void updateWorkspace({compact:e.target.checked})}/> 紧凑型邮件列表</label>
  </div>

  <div className="am-personal-section">
   <h4><Sparkles size={16}/> 免费 AI 邮件摘要</h4>
   <p>自动对新收到的邮件提取中文摘要、简短标签及处理建议。仅选择官方免费 Flash 模型；邮件正文片段将提交至 Z.AI，请遵守学校相关数据外发规定。</p>
   <div className="am-add-form">
    <label>Z.AI API Key<input type="password" autoComplete="new-password" value={apiKey}
      onChange={e=>setApiKey(e.target.value)} placeholder={settings?.ai_key_ready?'已配置；输入可替换':'粘贴专用 API Key'}/></label>
    <button type="button" className="am-main-button" disabled={!apiKey.trim()||busy}
      onClick={()=>{void onSaveKey(apiKey.trim()).then(()=>setApiKey(''))}}>加密保存</button>
   </div>
   <div className="am-add-form">
    <label>免费模型<select disabled={busy} value={settings?.ai_model||'glm-4.7-flash'}
      onChange={e=>void onUpdate({ai_model:e.target.value})}>
      <option value="glm-4.7-flash">GLM-4.7-Flash（默认）</option>
      <option value="glm-4.5-flash">GLM-4.5-Flash（免费备选）</option>
    </select></label>
    <label>每日最多分析<select disabled={busy} value={settings?.ai_daily_limit??20}
      onChange={e=>void onUpdate({ai_daily_limit:Number(e.target.value)})}>
      {[0,5,10,20,30,50].map(value=><option value={value} key={value}>{value} 封</option>)}
    </select></label>
   </div>
   <label className="am-option"><input type="checkbox" checked={!!settings?.ai_enabled}
     disabled={!settings?.ai_key_ready||busy} onChange={e=>void onUpdate({ai_enabled:e.target.checked,...(e.target.checked?{ai_started_at:new Date().toISOString()}: {})})}/>
      开启自动分析（默认关闭，需主动授权）</label>
   <label className="am-option"><input type="checkbox" checked={!!settings?.ai_analyze_existing}
     disabled={busy} onChange={e=>void onUpdate({ai_analyze_existing:e.target.checked})}/>
      同时分析历史邮件（占用每日免费限额）</label>
   {settings?.last_ai_error&&<div className="am-account-error"><AlertCircle size={14}/>{settings.last_ai_error}</div>}
   <p className="am-disclaimer">严格禁止付费 GLM-4.7 / FlashX 自动回退。请求若被服务商以付费或权限状态拒绝，将暂停自动分析。免费资格、速率限制请以服务商官网为准。</p>
  </div>
 </section>
}
