import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

type Incoming = {
  remote_key?: string; internet_message_id?: string | null
  first_folder?: string; last_folder?: string; received_at?: string | null
  sender_name?: string; sender_address?: string; recipient_address?: string
  subject?: string; snippet?: string; body_text?: string
  category?: string; importance?: number; deadline?: string | null
  extraction?: Record<string, unknown>; archived_locally?: boolean
}
const categories = new Set(['review_invite','submission_update','editorial','other','suspicious'])
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' },
})
const short = (value: unknown, max: number) => String(value ?? '').slice(0, max)
const optionalDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) ? value : null

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({error:'POST required'},405)
  const bearer = /^Bearer\s+([a-f0-9]{64})$/i.exec(req.headers.get('authorization') || '')
  if (!bearer) return json({error:'Invalid collector token'},401)
  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !secret) return json({error:'Server not configured'},500)
  const admin = createClient(url, secret, {auth:{persistSession:false,autoRefreshToken:false}})
  const tokenBytes = new TextEncoder().encode(bearer[1].toLowerCase())
  const digest = await crypto.subtle.digest('SHA-256', tokenBytes)
  const tokenHash = Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('')
  const {data:key, error:keyError} = await admin.from('mail_collector_keys')
    .select('user_id').eq('token_hash',tokenHash).is('revoked_at',null).maybeSingle()
  if (keyError) return json({error:'Token check failed'},500)
  if (!key) return json({error:'Collector token revoked or unknown'},401)
  let body: {account_id?:string; messages?:Incoming[]}
  try {body=await req.json()} catch {return json({error:'Invalid JSON'},400)}
  if (!body.account_id || !Array.isArray(body.messages) || body.messages.length > 60)
    return json({error:'Expected account_id and at most 60 messages'},400)
  const {data:account,error:accountError}=await admin.from('mail_accounts').select('id')
    .eq('id',body.account_id).eq('user_id',key.user_id).eq('enabled',true).maybeSingle()
  if (accountError || !account) return json({error:'Account not found or disabled'},403)
  const entries = body.messages.map(m=>{
    const category=categories.has(m.category || '') ? m.category : 'other'
    return {
      user_id:key.user_id, account_id:account.id,
      remote_key:short(m.remote_key,256),
      internet_message_id:short(m.internet_message_id,512),
      first_folder:short(m.first_folder || 'INBOX',255),last_folder:short(m.last_folder || 'INBOX',255),
      received_at:m.received_at || null,
      sender_name:short(m.sender_name,256), sender_address:short(m.sender_address,320),
      recipient_address:short(m.recipient_address,320), subject:short(m.subject,1024),
      snippet:short(m.snippet,800),body_text:short(m.body_text,60000),
      category,importance:Math.min(3,Math.max(0,Math.floor(Number(m.importance)||0))),
      deadline:optionalDate(m.deadline),
      extraction: m.extraction && typeof m.extraction==='object' && !Array.isArray(m.extraction) ?
        Object.fromEntries(Object.entries(m.extraction).slice(0,16).map(([k,v])=>[short(k,80),short(v,512)])) : {},
      archived_locally:Boolean(m.archived_locally),last_seen_at:new Date().toISOString(),
    }
  })
  if (entries.some(m=>!m.remote_key)) return json({error:'Missing remote_key'},400)
  if (entries.length) {
    const {error}=await admin.from('mail_messages').upsert(entries,{onConflict:'account_id,remote_key'})
    if (error) return json({error:'Write failed',detail:error.message},500)
  }
  await admin.from('mail_accounts').update({last_sync_at:new Date().toISOString(),last_error:null})
    .eq('id',account.id).eq('user_id',key.user_id)
  return json({accepted:entries.length})
})
