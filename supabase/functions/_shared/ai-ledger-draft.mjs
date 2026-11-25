const types=new Set(['expense.create','income.create','transfer.create','credit.repay','installment.link','refund.create','reimbursement.link','prepaid.event','investment.trade','account.adjust','booking.record','benefit.redeem','transaction.update'])
const fields=new Set(['merchant','occurredAt','orderedAt','paidAt','settlement','account','fromAccount','toAccount','channel','category','source','pricingBasis','grossMinor','items','fees','discounts','paymentLegs','originalTransactionRef','terms','refund','links','adjustment','investment','prepaid','reimbursement','booking','targetTransactionRef','baseSequence','patch','extensions'])
const record=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{}
const string=(v,max)=>typeof v==='string'?v.trim().slice(0,max):''
const digest=async(bytes)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
const hash=v=>digest(new TextEncoder().encode(JSON.stringify(v)))
export async function ledgerEvidenceId(text,images){
 const hashes=await Promise.all(images.map(i=>digest(Uint8Array.from(atob(i.data),c=>c.charCodeAt(0)))))
 return 'ai-'+(await hash([text.trim(),hashes.sort()])).slice(0,48)
}
export async function buildLedgerDraft(batchId,transactions){
 if(!/^ai-[a-f0-9]{48}$/.test(batchId)||!Array.isArray(transactions)||!transactions.length||transactions.length>50)throw Error('账单识别结果数量无效')
 const operations=[],counts=new Map()
 for(const entry of transactions){
  const d=record(entry),raw=record(d.operation),source=record(raw.source)
  let type=raw.type
  if(!types.has(type))type=({refund:'refund.create',installment:'installment.link',reimbursement:'reimbursement.link',prepaid:'prepaid.event'})[d.kind]??(['ordinary','complex'].includes(d.kind)&&typeof d.income==='boolean'?(d.income?'income.create':'expense.create'):null)
  const title=string(d.name,250),note=string(d.note,500),accountHint=string(d.account,100),categoryHint=string(d.category,100)
  const currency=typeof raw.currency==='string'&&/^[A-Z]{3}$/.test(raw.currency)?raw.currency:null
  const derived=currency==='CNY'&&typeof d.amount==='number'&&Number.isFinite(d.amount)&&d.amount>=0&&d.amount<=1e10&&Math.abs(d.amount*100-Math.round(d.amount*100))<1e-6?Math.round(d.amount*100):null
  const minor=Number.isSafeInteger(raw.amountMinor)&&raw.amountMinor>=0&&raw.amountMinor<=1e12?(derived!==null&&derived!==raw.amountMinor?null:raw.amountMinor):derived
  const identity=source.platform&&(source.orderId||source.externalTransactionId)?[type,source.platform,source.orderId||source.externalTransactionId]:[type,title,d.amount??null,d.date??null,accountHint,note]
  const base='ai-'+(await hash(identity)).slice(0,36)
  const count=(counts.get(base)||0)+1;counts.set(base,count)
  const row=Object.fromEntries(Object.entries(raw).filter(([k,v])=>fields.has(k)&&v!==null&&v!==undefined))
  // An actual timestamp needs time and timezone; never infer date-only midnight.
  for(const field of ['occurredAt','orderedAt','paidAt'])if(typeof row[field]!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(row[field])||!Number.isFinite(Date.parse(row[field])))delete row[field]
  operations.push({...row,clientId:count===1?base:base+'-'+count,type,title,amountMinor:minor,currency,
    ...(!row.account&&accountHint?{account:{institution:accountHint}}:{}),...(!row.category&&categoryHint?{category:{main:categoryHint}}:{}),note})
 }
 const batch={format:'qi-ledger-import',version:1,batchId,operations}
 if(new TextEncoder().encode(JSON.stringify(batch)).length>145000)throw Error('识别批次过大，请分批')
 return batch
}
