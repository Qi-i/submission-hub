// Shared, side-effect-free MIME construction for SMTP and Graph.
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
const encoder = new TextEncoder()
export function encodeBase64(value) {
  const bytes = encoder.encode(value)
  let binary = ''
  for (let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192))
  return btoa(binary)
}
const fold = value => value.match(/.{1,76}/g)?.join('\r\n') || ''
export function parseAttachments(value) {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 10) throw Error('最多 10 个附件')
  let total = 0
  return value.map(file => {
    const name = file?.name
    const data = file?.content_base64
    if (typeof name !== 'string' || !name.trim() || name.length > 200 || /[\x00-\x1f\x7f]/.test(name))
      throw Error('附件名称无效')
    if (typeof data !== 'string' || !data.length || data.length > Math.ceil(MAX_ATTACHMENT_BYTES/3)*4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))
      throw Error('附件编码或大小无效')
    const bytes = data.length/4*3-(data.endsWith('==')?2:data.endsWith('=')?1:0)
    total += bytes
    if (!bytes || total > MAX_ATTACHMENT_BYTES) throw Error('附件总大小不能超过 2 MiB')
    const type = typeof file.content_type === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(file.content_type)
      ? file.content_type : 'application/octet-stream'
    return {name, data, type}
  })
}
function subjectWords(subject) {
  const chunks = []; let piece = ''
  for (const ch of subject) {
    if (encoder.encode(piece+ch).length>42) { chunks.push(piece);piece='' }
    piece+=ch
  }
  if(piece) chunks.push(piece)
  return chunks.map(v=>'=?UTF-8?B?'+encodeBase64(v)+'?=').join('\r\n ')
}
function fileParameter(name) {
  const encoded = [...encoder.encode(name)].map(b=>'%'+b.toString(16).padStart(2,'0').toUpperCase())
  const pieces=[]
  for(let i=0;i<encoded.length;i+=15) pieces.push(encoded.slice(i,i+15).join(''))
  return pieces.map((p,i)=>' filename*'+i+'*='+(i===0?"UTF-8''":'')+p).join(';\r\n')
}
export function buildMime({from,to,subject,content,replyTo='',attachments=[],boundary,id,date}) {
  const headers = [
    'From: <'+from+'>','To: <'+to+'>','Subject: '+subjectWords(subject),
    'Date: '+date,'Message-ID: <'+id+'>',
    ...(replyTo?['In-Reply-To: '+replyTo,'References: '+replyTo]:[]),
    'MIME-Version: 1.0',
  ]
  const text = ['Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',fold(encodeBase64(content))]
  if(!attachments.length) return [...headers,...text].join('\r\n')
  const lines = [...headers,'Content-Type: multipart/mixed; boundary="'+boundary+'"','',
    '--'+boundary,...text]
  for(const file of attachments){
    lines.push('--'+boundary,'Content-Type: '+file.type,
      'Content-Disposition: attachment;\r\n'+fileParameter(file.name),
      'Content-Transfer-Encoding: base64','',fold(file.data))
  }
  lines.push('--'+boundary+'--','')
  return lines.join('\r\n')
}
