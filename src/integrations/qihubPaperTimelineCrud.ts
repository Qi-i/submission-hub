import { supabase } from '../lib/supabase'
import type { Paper, TimelineEvent } from '../lib/types'

// Mutations execute only in the original, authenticated Submission Hub.
// QiHub receives business values and returned database rows, never tokens.
const TEXT = [
  'title', 'title_zh', 'journal', 'manuscript_no', 'submission_system',
  'system_status', 'next_action', 'followup_log', 'doi', 'publication_info',
  'citation', 'journal_apc_note', 'corresponding_author', 'timeline', 'notes',
  'apc_currency', 'lang', 'quartile_jcr', 'quartile_cas', 'quartile_new',
  'quartile_cust',
] as const
const DATES = ['last_status_date', 'submitted_date', 'resolve_date', 'deadline'] as const
const URLS = ['tracking_url', 'published_url', 'journal_url'] as const
const ARRAYS = ['authors', 'quartile_zh'] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUSES = new Set(['preparing', 'submitted', 'under_review', 'revision', 'accepted', 'rejected', 'withdrawn'])
const REMINDERS = new Set(['none', 'watch', 'warn', 'urgent'])

type Response = {data: unknown; error: unknown}
type Query = {
  eq(field: string, value: string): Query
  is(field: string, value: null): Query
  select(fields: string): Query
  maybeSingle(): PromiseLike<Response>
}
export type PaperTimelineClient = {
  auth: {getUser(): Promise<{data:{user:{id:string}|null};error:unknown}>}
  from(table: string): {
    select(fields: string): Query
    insert(values: Record<string, unknown>): Query
    update(values: Record<string, unknown>): Query
    delete(): Query
  }
}
type Request = {operation: 'create'|'update'|'delete';id?:string;expectedUpdatedAt?:string;fields?:unknown;previous?:unknown}
type Result<T> = {ok:boolean;conflict?:boolean;record?:T}

async function account(client: PaperTimelineClient) {
  const {data,error} = await client.auth.getUser()
  if (error || !data.user?.id) throw Error('QIHUB_PAPER_SIGN_IN_REQUIRED')
  return data.user.id
}

function date(value: unknown, key: string): string|null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value) {
    throw Error('QIHUB_PAPER_INVALID_DATE_' + key)
  }
  return value
}

export function validateQiHubPaperFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Error('QIHUB_PAPER_INVALID_FIELDS')
  }
  const values = input as Record<string, unknown>
  const allowed = new Set<string>([
    ...TEXT, ...DATES, ...URLS, ...ARRAYS,
    'status', 'reminder_level', 'revision_round', 'apc_amount', 'prev_id',
  ])
  if (Object.keys(values).some(k => !allowed.has(k))) {
    throw Error('QIHUB_PAPER_FORBIDDEN_FIELD')
  }
  const result: Record<string, unknown> = {}
  for (const key of TEXT) {
    const fallback = key === 'title' ? '未命名' : key === 'lang' ? 'zh' :
      key === 'apc_currency' ? 'USD' :
        key === 'quartile_jcr' || key === 'quartile_cas' ? '未定' :
          key === 'quartile_new' || key === 'quartile_cust' ? '无' : null
    const value = values[key] ?? fallback
    if (value != null && (typeof value !== 'string' ||
        value.length > (key === 'timeline' || key === 'notes' ||
          key === 'followup_log' ? 50000 : 10000))) {
      throw Error('QIHUB_PAPER_INVALID_TEXT_' + key)
    }
    result[key] = value
  }
  if (typeof values.title !== 'string' || !values.title.trim() ||
      values.title.length > 500) throw Error('QIHUB_PAPER_TITLE_REQUIRED')
  result.title = values.title.trim()
  if (typeof result.lang !== 'string' || !(result.lang as string).trim() ||
      (result.lang as string).length > 50) throw Error('QIHUB_PAPER_INVALID_LANGUAGE')
  for (const key of DATES) result[key] = date(values[key], key)
  for (const key of URLS) {
    const value = values[key]
    if (value != null && value !== '' && (typeof value !== 'string' ||
        !/^https?:\/\//i.test(value) || value.length > 3000)) {
      throw Error('QIHUB_PAPER_INVALID_URL_' + key)
    }
    result[key] = value || null
  }
  for (const key of ARRAYS) {
    const items = values[key] ?? []
    if (!Array.isArray(items) || items.length > 100 ||
        items.some(item => typeof item !== 'string' ||
          item.length > 500 || !item.trim())) {
      throw Error('QIHUB_PAPER_INVALID_LIST_' + key)
    }
    result[key] = items
  }
  const status = values.status ?? 'preparing'
  const reminder = values.reminder_level ?? 'none'
  if (typeof status !== 'string' || !STATUSES.has(status) ||
      typeof reminder !== 'string' || !REMINDERS.has(reminder)) {
    throw Error('QIHUB_PAPER_INVALID_STATUS')
  }
  result.status = status
  result.reminder_level = reminder
  const revision = values.revision_round ?? 0
  if (!Number.isInteger(revision) || Number(revision) < 0 || Number(revision) > 1000) {
    throw Error('QIHUB_PAPER_INVALID_REVISION')
  }
  result.revision_round = revision
  const apc = values.apc_amount ?? null
  if (apc != null && (typeof apc !== 'number' || !Number.isFinite(apc) ||
      apc < 0 || apc > 100000000)) throw Error('QIHUB_PAPER_INVALID_APC')
  result.apc_amount = apc
  const prev = values.prev_id ?? null
  if (prev != null && (typeof prev !== 'string' || !UUID.test(prev))) {
    throw Error('QIHUB_PAPER_INVALID_PREVIOUS')
  }
  result.prev_id = prev
  return result
}

export function validateQiHubTimelineFields(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Error('QIHUB_TIMELINE_INVALID_FIELDS')
  }
  const values = input as Record<string,unknown>
  if (Object.keys(values).some(key => !['paper_id','event_date','event_label','event_note'].includes(key))) {
    throw Error('QIHUB_TIMELINE_FORBIDDEN_FIELD')
  }
  if (typeof values.paper_id !== 'string' || !UUID.test(values.paper_id)) {
    throw Error('QIHUB_TIMELINE_INVALID_PAPER')
  }
  const eventDate = date(values.event_date, 'event_date')
  if (!eventDate || typeof values.event_label !== 'string' ||
      !values.event_label.trim() || values.event_label.length > 500 ||
      (values.event_note != null && (typeof values.event_note !== 'string' ||
        values.event_note.length > 10000))) {
    throw Error('QIHUB_TIMELINE_INVALID_CONTENT')
  }
  return {
    paper_id: values.paper_id,
    event_date: eventDate,
    event_label: values.event_label.trim(),
    event_note: values.event_note ?? null,
  }
}

async function ownedPaper(client: PaperTimelineClient, owner:string, id:string) {
  const result = await client.from('papers').select('id,user_id')
    .eq('user_id', owner).eq('id', id).maybeSingle()
  if (result.error || !result.data ||
      (result.data as Paper).id !== id ||
      (result.data as Paper).user_id !== owner) {
    throw Error('QIHUB_PAPER_REFERENCE_NOT_OWNED')
  }
}

export async function mutateQiHubPaper(
  request: Request, client: PaperTimelineClient = supabase as unknown as PaperTimelineClient,
): Promise<Result<Paper>> {
  const owner = await account(client)
  if (!request || !['create','update','delete'].includes(request.operation)) {
    throw Error('QIHUB_PAPER_INVALID_OPERATION')
  }
  const table = client.from('papers')
  if (request.operation === 'create') {
    const fields = validateQiHubPaperFields(request.fields)
    if (fields.prev_id) await ownedPaper(client, owner, fields.prev_id as string)
    const result = await table.insert({...fields,user_id:owner,files:[]})
      .select('*').maybeSingle()
    if (result.error || !result.data) throw Error('QIHUB_PAPER_CREATE_UNCONFIRMED')
    const row = result.data as Paper
    if (row.user_id !== owner || !row.id || !row.updated_at ||
        row.title !== fields.title || owner !== await account(client)) {
      throw Error('QIHUB_PAPER_CREATE_ACK_MISMATCH')
    }
    return {ok:true,record:row}
  }
  const id = request.id, expected = request.expectedUpdatedAt
  if (!id || !UUID.test(id) || !expected || !Number.isFinite(Date.parse(expected))) {
    throw Error('QIHUB_PAPER_INVALID_VERSION')
  }
  const before = await table.select('*').eq('user_id',owner).eq('id',id).maybeSingle()
  if (before.error) throw Error('QIHUB_PAPER_READ_FAILED')
  if (!before.data) return {ok:false,conflict:true}
  const old = before.data as Paper
  if (old.user_id !== owner || old.id !== id) throw Error('QIHUB_PAPER_OWNER_MISMATCH')
  if (old.updated_at !== expected) return {ok:false,conflict:true}

  if (request.operation === 'delete') {
    // Files have separate cloud bytes; a paper delete must not orphan them.
    if (Array.isArray(old.files) && old.files.length) throw Error('QIHUB_PAPER_HAS_ATTACHMENTS')
    for (const [tableName,key] of [
      ['timeline_events','paper_id'],
      ['manuscript_drafts','submitted_paper_id'],
      ['papers','prev_id'],
    ] as const) {
      const linked = await client.from(tableName).select('id')
        .eq('user_id',owner).eq(key,id).maybeSingle()
      if (linked.error) throw Error('QIHUB_PAPER_RELATION_CHECK_FAILED')
      if (linked.data) throw Error('QIHUB_PAPER_HAS_LINKED_' + tableName)
    }
    const deleted = await table.delete().eq('user_id',owner).eq('id',id)
      .eq('updated_at',expected).select('*').maybeSingle()
    if (deleted.error) throw Error('QIHUB_PAPER_DELETE_FAILED')
    if (!deleted.data) return {ok:false,conflict:true}
    const row = deleted.data as Paper
    if (row.id !== id || row.user_id !== owner || owner !== await account(client)) {
      throw Error('QIHUB_PAPER_DELETE_ACK_MISMATCH')
    }
    return {ok:true,record:row}
  }
  const fields = validateQiHubPaperFields(request.fields)
  if (fields.prev_id === id) throw Error('QIHUB_PAPER_INVALID_PREVIOUS')
  if (fields.prev_id) await ownedPaper(client,owner,fields.prev_id as string)
  const updatedAt = new Date(Math.max(Date.now(),Date.parse(expected)+1)).toISOString()
  const changed = await table.update({...fields,updated_at:updatedAt})
    .eq('user_id',owner).eq('id',id).eq('updated_at',expected)
    .select('*').maybeSingle()
  if (changed.error) throw Error('QIHUB_PAPER_UPDATE_FAILED')
  if (!changed.data) return {ok:false,conflict:true}
  const row = changed.data as Paper
  if (row.id !== id || row.user_id !== owner ||
      row.title !== fields.title ||
      Date.parse(row.updated_at) !== Date.parse(updatedAt) ||
      owner !== await account(client)) throw Error('QIHUB_PAPER_UPDATE_ACK_MISMATCH')
  return {ok:true,record:row}
}

/** timeline_events has no updated_at; use the original field triple as CAS. */
export async function mutateQiHubTimelineEvent(
  request: Request, client: PaperTimelineClient = supabase as unknown as PaperTimelineClient,
): Promise<Result<TimelineEvent>> {
  const owner = await account(client)
  if (!request || !['create','update','delete'].includes(request.operation)) {
    throw Error('QIHUB_TIMELINE_INVALID_OPERATION')
  }
  const table = client.from('timeline_events')
  if (request.operation === 'create') {
    const fields = validateQiHubTimelineFields(request.fields)
    await ownedPaper(client,owner,fields.paper_id)
    const result = await table.insert({...fields,user_id:owner}).select('*').maybeSingle()
    if (result.error || !result.data) throw Error('QIHUB_TIMELINE_CREATE_UNCONFIRMED')
    const row = result.data as TimelineEvent
    if (!row.id || row.paper_id !== fields.paper_id || row.user_id !== owner ||
        row.event_date !== fields.event_date ||
        owner !== await account(client)) throw Error('QIHUB_TIMELINE_CREATE_ACK_MISMATCH')
    return {ok:true,record:row}
  }
  if (!request.id || !UUID.test(request.id) || !request.previous ||
      typeof request.previous !== 'object') throw Error('QIHUB_TIMELINE_INVALID_PREVIOUS')
  const read = await table.select('*').eq('user_id',owner).eq('id',request.id).maybeSingle()
  if (read.error) throw Error('QIHUB_TIMELINE_READ_FAILED')
  if (!read.data) return {ok:false,conflict:true}
  const old = read.data as TimelineEvent
  if (old.id !== request.id || old.user_id !== owner) throw Error('QIHUB_TIMELINE_OWNER_MISMATCH')
  const previous = validateQiHubTimelineFields(request.previous)
  if (old.paper_id !== previous.paper_id ||
      old.event_date !== previous.event_date ||
      old.event_label !== previous.event_label ||
      (old.event_note ?? null) !== previous.event_note) return {ok:false,conflict:true}
  let mutation = request.operation === 'delete' ? table.delete() :
    table.update(validateQiHubTimelineFields(request.fields))
  if (request.operation === 'update') {
    const fields = validateQiHubTimelineFields(request.fields)
    await ownedPaper(client,owner,fields.paper_id)
  }
  mutation = mutation.eq('user_id',owner).eq('id',request.id)
    .eq('paper_id',previous.paper_id).eq('event_date',previous.event_date)
    .eq('event_label',previous.event_label)
  mutation = previous.event_note === null ? mutation.is('event_note',null) :
    mutation.eq('event_note',previous.event_note as string)
  const written = await mutation.select('*').maybeSingle()
  if (written.error) throw Error('QIHUB_TIMELINE_WRITE_FAILED')
  if (!written.data) return {ok:false,conflict:true}
  const row = written.data as TimelineEvent
  if (row.id !== request.id || row.user_id !== owner ||
      owner !== await account(client)) throw Error('QIHUB_TIMELINE_ACK_MISMATCH')
  return {ok:true,record:row}
}
