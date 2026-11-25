import {normalizeEndpoint,protocolOf,authOf} from './ai-protocol.mjs'

// Discovery is GET on the same exact provider base, never a caller-supplied
// second destination or a next-page URL returned by the provider.
export function modelBase(endpoint){
 const protocol=protocolOf(endpoint.api_protocol)
 const url=normalizeEndpoint(endpoint.api_url,protocol,endpoint.model)
 return protocol==='gemini'?url.replace(/\/models\/[A-Za-z0-9_.-]+:generateContent$/,''):
  url.replace(/\/(?:chat\/completions|messages|responses)$/,'')
}
export function modelCatalogRequest(endpoint,key,cursor){
 const protocol=protocolOf(endpoint.api_protocol),auth=authOf(protocol,endpoint.auth_scheme)
 if(typeof key!=='string'||!key||/[\r\n]/.test(key))throw Error('API Key 无效')
 const url=new URL(modelBase(endpoint)+'/models')
 const headers={Accept:'application/json'}
 if(auth==='bearer')headers.Authorization='Bearer '+key
 else headers[auth]=key
 if(protocol==='messages'){
  headers['anthropic-version']='2023-06-01'
  url.searchParams.set('limit','100')
  if(cursor)url.searchParams.set('after_id',cursor)
 }else if(protocol==='gemini'){
  url.searchParams.set('pageSize','100')
  if(cursor)url.searchParams.set('pageToken',cursor)
 }
 return {url:url.href,headers}
}
export function catalogPage(protocol,data){
 protocol=protocolOf(protocol)
 const rows=protocol==='gemini'?data?.models:data?.data
 if(!Array.isArray(rows))throw Error('模型列表格式不兼容')
 const models=[]
 const seen=new Set()
 for(const row of rows){
  if(!row||typeof row!=='object')continue
  if(protocol==='gemini'&&(!Array.isArray(row.supportedGenerationMethods)||!row.supportedGenerationMethods.includes('generateContent')))continue
  const id=protocol==='gemini'?String(row.name||'').replace(/^models\//,''):row.id
  if(typeof id!=='string'||id.length<1||id.length>128||/[\x00-\x20\x7f]/.test(id)||seen.has(id))continue
  if(protocol==='gemini'&&!/^[A-Za-z0-9_.-]+$/.test(id))continue
  seen.add(id)
  const display=protocol==='gemini'?row.displayName:row.display_name
  models.push({id,label:typeof display==='string'?display.slice(0,100):id})
 }
 const raw=protocol==='gemini'?data.nextPageToken:protocol==='messages'&&data.has_more?data.last_id:null
 const next=typeof raw==='string'&&raw.length>0&&raw.length<=512&&!/[\x00-\x1f]/.test(raw)?raw:null
 return {models,next}
}
export function sharedModelUrl(endpoint,model){
 const protocol=protocolOf(endpoint.api_protocol)
 if(typeof model!=='string'||!model.trim()||model.length>128||/[\x00-\x20\x7f]/.test(model))throw Error('模型 ID 无效')
 return normalizeEndpoint(modelBase(endpoint),protocol,model)
}
