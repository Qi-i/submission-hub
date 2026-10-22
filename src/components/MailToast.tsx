import {useEffect} from 'react'
import {createPortal} from 'react-dom'
import {AlertCircle,CheckCircle2,Info,X} from 'lucide-react'

export type MailToastKind='error'|'success'|'warning'
type Props={
 error:string;notice:string;warning:string;
 onDismissError:()=>void;onDismissNotice:()=>void;onDismissWarning:()=>void
}
export default function MailToast({error,notice,warning,onDismissError,onDismissNotice,onDismissWarning}:Props){
 useEffect(()=>{
  if(!notice)return
  const timer=window.setTimeout(onDismissNotice,9500)
  return ()=>window.clearTimeout(timer)
 },[notice,onDismissNotice])
 useEffect(()=>{
  if(!warning)return
  const timer=window.setTimeout(onDismissWarning,18000)
  return ()=>window.clearTimeout(timer)
 },[warning,onDismissWarning])
 // Keep hard errors visible until dismissed; otherwise users may lose actionable details.
 if(typeof document==='undefined'||(!error&&!notice&&!warning))return null
 return createPortal(<div className="am-floating-feedback" aria-label="邮件中心操作反馈">
   {error&&<div className="am-toast-item am-toast-error" role="alert">
     <AlertCircle size={17}/><span>{error}</span>
     <button type="button" aria-label="关闭错误" onClick={onDismissError}><X size={15}/></button>
   </div>}
   {warning&&<div className="am-toast-item am-toast-warning" role="status">
     <Info size={17}/><span>{warning}</span>
     <button type="button" aria-label="关闭提示" onClick={onDismissWarning}><X size={15}/></button>
   </div>}
   {notice&&<div className="am-toast-item am-toast-success" role="status">
     <CheckCircle2 size={17}/><span>{notice}</span>
     <button type="button" aria-label="关闭通知" onClick={onDismissNotice}><X size={15}/></button>
   </div>}
 </div>,document.body)
}
