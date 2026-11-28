import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {ledgerEvidenceId,type LedgerDraftBatch} from '../../supabase/functions/_shared/ai-ledger-draft.mjs'
import './LedgerAiWorkspace.css'

const fileData=(file:File)=>new Promise<string>((resolve,reject)=>{
 const reader=new FileReader()
 reader.onerror=()=>reject(Error('图片读取失败'))
 reader.onload=()=>typeof reader.result==='string'?resolve(reader.result.split(',')[1]):reject(Error('图片格式错误'))
 reader.readAsDataURL(file)
})
export default function LedgerAiWorkspace({userId,onClose}:{userId:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null)
 const [text,setText]=useState(''),[files,setFiles]=useState<File[]>([])
 const [allowPaid,setAllowPaid]=useState(false),[busy,setBusy]=useState(false)
 const [batch,setBatch]=useState<LedgerDraftBatch|null>(null),[model,setModel]=useState(''),[notice,setNotice]=useState('')
 const [previews,setPreviews]=useState<string[]>([])
 useEffect(()=>{dialog.current?.showModal()},[])
 useEffect(()=>{const urls=files.map(file=>URL.createObjectURL(file));setPreviews(urls);return()=>urls.forEach(url=>URL.revokeObjectURL(url))},[files])
 const clearResult=()=>{setBatch(null);setModel('');setNotice('')}
 const addFiles=(incoming:File[])=>{
  const combined=[...files,...incoming]
  if(combined.length>6||combined.some(f=>!['image/png','image/jpeg','image/webp'].includes(f.type)||!f.size||f.size>3*1024*1024)||combined.reduce((n,f)=>n+f.size,0)>6*1024*1024){setNotice('支持 PNG、JPEG、WebP；最多6张，单张3 MiB，合计6 MiB');return}
  setFiles(combined);clearResult()
 }
 const recognize=async()=>{
  if(busy||(!text.trim()&&!files.length))return
  setBusy(true);clearResult();setAllowPaid(false)
  try{
   const {data,error}=await supabase.auth.getSession()
   if(error||data.session?.user.id!==userId)throw Error('请先登录当前账号')
   const images=await Promise.all(files.map(async f=>({mime:f.type,data:await fileData(f)})))
   const expectedBatchId=await ledgerEvidenceId(text,images)
   const res=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/ledger-ai-recognize',{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({text,images,allow_paid:allowPaid}),redirect:'error',signal:AbortSignal.timeout(125000)})
   const r=await res.json()
   if(!res.ok)throw Error(r.error||'识别失败')
   if(r.ok!==true||r.committed!==false||r.task!==(images.length?'ledger_vision':'ledger_text')||typeof r.model!=='string'||r.batch?.format!=='qi-ledger-import'||r.batch.version!==1||r.batch.batchId!==expectedBatchId||!Array.isArray(r.transactions)||!Array.isArray(r.batch.operations)||!r.batch.operations.length||r.batch.operations.length>50||r.batch.operations.length!==r.transactions.length)throw Error('草稿与本次识别证据不一致')
   const ids=r.batch.operations.map((op:unknown)=>op&&typeof op==='object'&&!Array.isArray(op)?(op as Record<string,unknown>).clientId:null)
   if(ids.some((id:unknown)=>typeof id!=='string'||!/^ai-[a-f0-9]{36}(?:-[2-9]|-[1-4][0-9]|-50)?$/.test(id))||new Set(ids).size!==ids.length||new TextEncoder().encode(JSON.stringify(r.batch)).length>145000)throw Error('草稿操作标识或大小无效')
   const current=await supabase.auth.getSession()
   if(current.data.session?.user.id!==userId)throw Error('账号已变化，请重新识别')
   setBatch(r.batch);setModel(String(r.model||''));setNotice('已生成草稿，尚未入账')
  }catch(e){setNotice(e instanceof Error?e.message:'识别失败')}
  finally{setBusy(false)}
 }
 const copy=async()=>{if(!batch)return;try{const {data,error}=await supabase.auth.getSession();if(error||data.session?.user.id!==userId){clearResult();setNotice('账号已变化，请重新识别');return}await navigator.clipboard.writeText(JSON.stringify(batch,null,2));setNotice('已复制 v1 草稿，粘贴到 Qi-Ledger、浏览器扩展或 MCP 导入入口')}catch{setNotice('复制失败，请使用下方 JSON 手动复制')}}
 const close=()=>{if(!busy)onClose()}
 return <dialog ref={dialog} className="ledger-ai-dialog" onCancel={e=>{e.preventDefault();close()}}>
  <header><div><h2>账单智能识别</h2><p>使用共享 AI 模型库的文字或视觉任务线路</p></div><button className="btn btn-ghost" disabled={busy} onClick={close}>关闭</button></header>
  <main>
   <section><h3>原始证据</h3><textarea autoFocus value={text} maxLength={50000} disabled={busy} onChange={e=>{setText(e.target.value);clearResult()}} onPaste={e=>{const images=Array.from(e.clipboardData.files).filter(f=>f.type.startsWith('image/'));if(images.length){e.preventDefault();addFiles(images)}}} placeholder="粘贴订单文字、表格内容或直接粘贴截图（Ctrl+V）" rows={5}/>
    <a href="?view=ai-settings" target="_blank" rel="noopener noreferrer">查看共享 AI 模型与任务线路</a>
    <label className="ledger-ai-file">添加账单图片<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy} onChange={e=>{addFiles(Array.from(e.target.files||[]));e.target.value=''}}/></label>
    <div className="ledger-ai-images">{files.map((file,i)=><div key={i}><img src={previews[i]} alt={file.name||'账单截图'}/><button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>{setFiles(files.filter((_,j)=>i!==j));clearResult()}}>移除</button></div>)}</div>
    <label><input type="checkbox" checked={allowPaid} disabled={busy} onChange={e=>setAllowPaid(e.target.checked)}/> 本次允许已授权的付费线路</label>
    <p>只在点击识别后发送本次选定证据。结果不会自动记账。</p>
    <button className="btn btn-primary" disabled={busy||(!text.trim()&&!files.length)} onClick={()=>void recognize()}>{busy?'正在识别…':files.length?'识别截图':'识别文字'}</button>
   </section>
   <section><h3>待核对草稿 {batch?'· '+batch.operations.length+' 项':''}</h3>
    {notice&&<p role="status">{notice}</p>}
    {batch&&<><p>模型：{model} · 批次：{batch.batchId}</p><div className="ledger-ai-results">{batch.operations.map(op=><article key={String(op.clientId)}><strong>{String(op.title||'待核对名称')}</strong><span>{String(op.type||'待核对类型')} · {op.amountMinor===null||op.amountMinor===undefined?'待核对金额':String(op.amountMinor)+' 最小货币单位'} {String(op.currency||'待核对币种')}</span><small>{String(op.note||'')}</small></article>)}</div>
    <button className="btn btn-primary" onClick={()=>void copy()}>复制导入 JSON</button><a className="btn btn-ghost" href="https://qiledger.pages.dev/" target="_blank" rel="noopener noreferrer">打开 Qi-Ledger</a><details><summary>查看结构化草稿</summary><textarea readOnly rows={8} value={JSON.stringify(batch,null,2)} /></details></>}
    {!batch&&!busy&&<p>识别后可将草稿交给 Qi-Ledger 待入账中心或浏览器扩展预检。</p>}
   </section>
  </main>
 </dialog>
}
