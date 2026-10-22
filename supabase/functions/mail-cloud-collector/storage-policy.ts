// Deterministic source-level classification. No AI calls and no user mail content
// is sent to outside services. Lower-priority mail is indexed without copying attachments.
export type StorageTier='full'|'text'|'index'
export type StorageDecision={tier:StorageTier;label:string}
export function mailStoragePolicy(
 provider:string,folder:string,subject:string,sender:string
):StorageDecision{
 const sub=subject.toLowerCase(),from=sender.toLowerCase(),location=folder.toLowerCase()
 const academic=/manuscript|revision|editorial decision|editorial office|journal submission|review invitation|reviewer invitation|invitation to review|article accepted|proof correction|稿件|审稿|审稿邀请|录用通知|返修|退修|投稿|期刊编辑部/.test(sub)

 const bulkFolder=/spam|junk|trash|垃圾|广告|促销|promotions|social|社交/.test(location)
 const developerNotice=/(github\.com|github\.noreply|github-actions|codex|chatgpt|openai\.com)/.test(from)&&
  /pull request|commit|workflow|checks|issue|review|deployment|build|codex|action|discussion|notification|推送|合并|构建|代码|审查|pr #|#\d+/.test(sub)
 const ad=/unsubscribe|广告|促销|折扣|优惠推送|双十一|满减|subscribe|special offer|sale ends|newsletter|营销活动|推广|免运费|限时优惠/i.test(sub) ||
  /(mailer-daemon-notify|newsletter|promo@|marketing@|notifications@)/.test(from)
 const finance=/信用卡|账单|月结单|还款|invoice|receipt|payment confirmation|statement|电子发票|报销|发票|银行|银行卡|扣款通知|支付成功|支付凭证|消费提醒|交易提醒|交易成功|对账单/i.test(sub)
 if(finance)return {tier:'index',label:'账单/发票'}
 if(academic)return {tier:'full',label:'学术往来'}
 if(bulkFolder||developerNotice||ad)return {tier:'index',label:developerNotice?'开发通知':bulkFolder?'垃圾/推广':'广告订阅'}

 if(['qq','gmail','outlook'].includes(provider))return {tier:'text',label:'普通往来'}
 return {tier:'full',label:'往来邮件'}
}
export function textPreview(text:string,length=700):string{
 return text.replace(/\s+/g,' ').trim().slice(0,length)
}
export function safeGraphWebLink(value:unknown):string|null{
 if(typeof value!=='string'||value.length>1600)return null
 try{
  const u=new URL(value)
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null
  if(!['outlook.office.com','outlook.live.com','outlook.office365.com'].includes(u.hostname.toLowerCase()))return null
  return u.href
 }catch{return null}
}
