// Shared by all source-side mail AI operations. Never runs in the phone.
export const PROTOCOLS = Object.freeze({
  chat: '/chat/completions',
  messages: '/messages',
  responses: '/responses',
  gemini: ':generateContent',
})
export function protocolOf(value) {
  if(value===undefined||value===null)return 'chat'
  if(typeof value!=='string'||!Object.hasOwn(PROTOCOLS,value))throw Error('不支持的 AI 接口协议')
  return value
}
export function authOf(protocol,value) {
  protocol=protocolOf(protocol)
  const fallback=protocol==='messages'?'x-api-key':protocol==='gemini'?'x-goog-api-key':'bearer'
  const auth=value??fallback
  if(!['bearer',fallback].includes(auth))throw Error('认证方式与协议不匹配')
  return auth
}
const validHost=h=>/^(?=.{4,190}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(h)&&!/(^|\.)(local|localhost|internal|lan|home|onion|arpa|test|invalid)$/.test(h)
export function normalizeEndpoint(raw,protocol='chat',model='') {
  protocol=protocolOf(protocol)
  const u=new URL(String(raw).trim())
  if(u.protocol!=='https:'||u.port||u.username||u.password||u.search||u.hash||!validHost(u.hostname)||/%(?:2f|5c|2e)/i.test(u.pathname))
    throw Error('API 地址必须为不含凭据的公网 HTTPS 地址')
  let path=u.pathname.replace(/\/+$/,'')
  const suffix=PROTOCOLS[protocol]
  // Reject mismatched complete paths instead of appending another method.
  const explicit=Object.values(PROTOCOLS).find(s=>path.endsWith(s))
  if(explicit&&explicit!==suffix)throw Error('API 地址与所选协议不匹配')
  if(protocol==='gemini'){
    const id=String(model).replace(/^models\//,'')
    if(!/^[A-Za-z0-9_.-]{1,128}$/.test(id))throw Error('Gemini 模型 ID 无效')
    if(explicit){if(!path.endsWith('/models/'+id+suffix))throw Error('Gemini 地址与模型 ID 不匹配')}
    else path+='/models/'+id+suffix
  }else if(!explicit)path+=suffix
  u.pathname=path
  if(u.href.length>500)throw Error('API 地址过长')
  return u.href
}
const public4=ip=>{
  const p=ip.split('.').map(Number),[x,y,z]=p
  return p.length===4&&p.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&
    !(x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||
      x===192&&(y===168||y===0||y===2)||x===100&&y>=64&&y<=127||
      x===198&&(y===18||y===19||y===51&&z===100)||x===203&&y===0&&z===113)
}
const public6=ip=>/^[23][0-9a-f]{3}:/i.test(ip)&&!/^2001:(?:db8|0|10|20):/i.test(ip)&&!/^2002:/i.test(ip)
// DNS resolution must produce at least one public address. This is not
// connection-level DNS pinning; redirects are separately disabled by callers.
export async function checkedEndpoint(raw,protocol,model,resolve) {
  const url=normalizeEndpoint(raw,protocol,model)
  if(typeof resolve!=='function')throw Error('运行环境无法验证自定义 API 的公网地址')
  const host=new URL(url).hostname
  const [a,b]=await Promise.all([Promise.resolve().then(()=>resolve(host,'A')).catch(()=>[]),Promise.resolve().then(()=>resolve(host,'AAAA')).catch(()=>[])])
  if(!Array.isArray(a)||!Array.isArray(b)||!a.length&&!b.length||a.some(ip=>!public4(ip))||b.some(ip=>!public6(ip)))
    throw Error('自定义 API 未解析到安全的公网地址')
  return url
}
export function buildAiRequest(route,{system='',user,maxTokens=4096,temperature,images=[]}){
  const protocol=protocolOf(route.protocol),auth=authOf(protocol,route.auth)
  const key=route.key??route.secret
  if(typeof key!=='string'||!key||/[\r\n]/.test(key))throw Error('API Key 无效')
  if(typeof user!=='string'||typeof system!=='string'||!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>32768)throw Error('AI 请求参数无效')
  const model=route.model
  if(typeof model!=='string'||!model.trim())throw Error('模型 ID 无效')
  const headers={'Content-Type':'application/json'}
  if(!Array.isArray(images)||images.length>6||images.some(i=>!i||!['image/png','image/jpeg','image/webp'].includes(i.mime)||typeof i.data!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(i.data)))throw Error('图片输入格式无效')
  const dataUrl=i=>'data:'+i.mime+';base64,'+i.data
  if(auth==='bearer')headers.Authorization='Bearer '+key
  else headers[auth]=key
  if(protocol==='messages'){
    headers['anthropic-version']='2023-06-01'
    return {headers,body:{model,max_tokens:maxTokens,stream:false,...(system?{system}:{}),messages:[{role:'user',content:images.length?[{type:'text',text:user},...images.map(i=>({type:'image',source:{type:'base64',media_type:i.mime,data:i.data}}))]:user}],...(temperature===undefined?{}:{temperature})}}
  }
  if(protocol==='responses'){
    return {headers,body:{model,input:images.length?[{role:'user',content:[{type:'input_text',text:user},...images.map(i=>({type:'input_image',image_url:dataUrl(i),detail:'auto'}))]}]:user,...(system?{instructions:system}:{}),max_output_tokens:maxTokens,store:false,stream:false}}
  }
  if(protocol==='gemini'){
    return {headers,body:{...(system?{systemInstruction:{parts:[{text:system}]}}:{}),contents:[{role:'user',parts:[{text:user},...images.map(i=>({inlineData:{mimeType:i.mime,data:i.data}}))]}],generationConfig:{maxOutputTokens:maxTokens,...(temperature===undefined?{}:{temperature})}}}
  }
  const tokenField=route.tokenField??'max_tokens'
  if(!['max_tokens','max_completion_tokens'].includes(tokenField))throw Error('输出限制字段无效')
  return {headers,body:{model,stream:false,[tokenField]:maxTokens,messages:[...(system?[{role:'system',content:system}]:[]),{role:'user',content:images.length?[{type:'text',text:user},...images.map(i=>({type:'image_url',image_url:{url:dataUrl(i)}}))]:user}],...(temperature===undefined||tokenField==='max_completion_tokens'?{}:{temperature})}}
}
export function extractAiText(protocol,data){
  protocol=protocolOf(protocol)
  if(!data||data.error)return null
  let parts=[]
  if(protocol==='chat'){
    const choice=data.choices?.[0]
    if(!choice||['length','content_filter','tool_calls','function_call'].includes(choice.finish_reason)||choice.message?.refusal)return null
    const content=choice.message?.content
    parts=typeof content==='string'?[content]:Array.isArray(content)?content.filter(x=>x.type==='text').map(x=>x.text):[]
  }else if(protocol==='messages'){
    if(!Array.isArray(data.content)||!['end_turn','stop_sequence'].includes(data.stop_reason))return null
    parts=data.content.filter(x=>x.type==='text').map(x=>x.text)
  }else if(protocol==='responses'){
    if(data.status!=='completed'||!Array.isArray(data.output))return null
    const messages=data.output.filter(x=>x.type==='message'&&x.role==='assistant')
    if(messages.some(x=>x.status&&x.status!=='completed'||x.content?.some(c=>c.type==='refusal')))return null
    parts=messages.flatMap(x=>(x.content??[]).filter(c=>c.type==='output_text').map(c=>c.text))
  }else{
    const candidate=data.candidates?.[0]
    if(candidate?.finishReason!=='STOP')return null
    parts=(candidate.content?.parts??[]).filter(x=>!x.thought&&typeof x.text==='string').map(x=>x.text)
  }
  const text=parts.filter(x=>typeof x==='string').join('')
  return text.trim()?text:null
}
export function routeFields(row){
  const protocol=protocolOf(row.api_protocol)
  return {protocol,auth:authOf(protocol,row.auth_scheme),tokenField:row.chat_token_field??'max_tokens'}
}
