import { supabase } from '../lib/supabase'
import type { ManuscriptDraft } from '../lib/preparation'

/**
 * Real Submission Hub manuscript management for QiHub's native UI.
 * The original web app retains the Supabase session. Android sends
 * explicit domain fields; IDs, owners and version stamps are never writable.
 */
const TEXT = [
  'title', 'article_type', 'language', 'abstract', 'outline', 'notes',
] as const
const LISTS = ['keywords', 'authors', 'target_journal_ids'] as const
const COUNTS = [
  'target_word_count', 'current_word_count', 'figure_count',
  'table_count', 'reference_count',
] as const
const REFS = [
  'topic_id', 'primary_journal_id', 'submitted_paper_id',
] as const
const STAGES = new Set([
  'outline', 'writing', 'internal_review', 'journal_adaptation',
  'submission_ready', 'submitted', 'paused',
])
const CHECK_CATEGORIES = new Set([
  'manuscript', 'authors', 'data', 'ethics', 'submission',
])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_COUNTER = 100000000

type DbResponse = { data: unknown; error: unknown }
type Query = {
  eq(field: string, value: string): Query
  select(fields: string): Query
  maybeSingle(): PromiseLike<DbResponse>
}
export type ManuscriptCrudClient = {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null }; error: unknown
    }>
  }
  from(table: string): {
    select(fields: string): Query
    insert(values: Record<string, unknown>): Query
    update(values: Record<string, unknown>): Query
    delete(): Query
  }
}

async function activeAccount(client: ManuscriptCrudClient) {
  const result = await client.auth.getUser()
  const id = result.data.user?.id
  if (result.error || !id) throw Error('QIHUB_MANUSCRIPT_SIGN_IN_REQUIRED')
  return id
}

function requiredText(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) {
    throw Error('QIHUB_MANUSCRIPT_INVALID_' + key)
  }
  return value.trim()
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/** Validate all 21 editable source columns (no hidden metadata overwrite). */
export function validateQiHubManuscriptDraft(
  input: unknown,
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Error('QIHUB_MANUSCRIPT_INVALID_FIELDS')
  }
  const values = input as Record<string, unknown>
  const allowed = new Set<string>([
    ...TEXT, ...LISTS, ...COUNTS, ...REFS, 'stage',
    'deadline', 'external_links', 'checklist',
  ])
  if (Object.keys(values).some(key => !allowed.has(key))) {
    throw Error('QIHUB_MANUSCRIPT_FORBIDDEN_FIELD')
  }
  const payload: Record<string, unknown> = {}
  payload.title = requiredText(values.title, 'TITLE')
  payload.article_type = requiredText(values.article_type ?? 'Research Article', 'ARTICLE_TYPE')
  payload.language = requiredText(values.language ?? 'en', 'LANGUAGE')
  for (const key of ['abstract', 'outline', 'notes'] as const) {
    const value = values[key]
    if (value != null &&
        (typeof value !== 'string' || value.length > 200000)) {
      throw Error('QIHUB_MANUSCRIPT_INVALID_TEXT_' + key)
    }
    payload[key] = value ?? null
  }
  const stage = values.stage ?? 'outline'
  if (typeof stage !== 'string' || !STAGES.has(stage)) {
    throw Error('QIHUB_MANUSCRIPT_INVALID_STAGE')
  }
  payload.stage = stage
  for (const key of ['keywords', 'authors'] as const) {
    const array = values[key] ?? []
    if (!Array.isArray(array) || array.length > 100 ||
        array.some(item => typeof item !== 'string' ||
          !item.trim() || item.length > 300)) {
      throw Error('QIHUB_MANUSCRIPT_INVALID_LIST_' + key)
    }
    payload[key] = array
  }
  const targetJournals = values.target_journal_ids ?? []
  if (!Array.isArray(targetJournals) || targetJournals.length > 100 ||
      targetJournals.some(id => !validUuid(id)) ||
      new Set(targetJournals).size !== targetJournals.length) {
    throw Error('QIHUB_MANUSCRIPT_INVALID_TARGET_JOURNALS')
  }
  payload.target_journal_ids = targetJournals
  for (const key of COUNTS) {
    const value = values[key] ?? (key === 'target_word_count' ? null : 0)
    if (value != null &&
        (!Number.isInteger(value) || Number(value) < 0 ||
          Number(value) > MAX_COUNTER)) {
      throw Error('QIHUB_MANUSCRIPT_INVALID_COUNT_' + key)
    }
    payload[key] = value
  }
  for (const key of REFS) {
    const value = values[key] ?? null
    if (value != null && !validUuid(value)) {
      throw Error('QIHUB_MANUSCRIPT_INVALID_REFERENCE_' + key)
    }
    payload[key] = value
  }
  const deadline = values.deadline
  if (deadline == null || deadline === '') {
    payload.deadline = null
  } else if (typeof deadline === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(deadline) &&
      Number.isFinite(Date.parse(deadline)) &&
      new Date(deadline).toISOString().slice(0, 10) === deadline) {
    payload.deadline = deadline
  } else {
    throw Error('QIHUB_MANUSCRIPT_INVALID_DEADLINE')
  }
  const links = values.external_links ?? []
  if (!Array.isArray(links) || links.length > 100 ||
      links.some(link => !link || typeof link !== 'object' ||
        Array.isArray(link) || typeof link.label !== 'string' ||
        !link.label.trim() || link.label.length > 250 ||
        typeof link.url !== 'string' ||
        !/^https?:\/\//i.test(link.url) || link.url.length > 3000 ||
        Object.keys(link).some(k => k !== 'label' && k !== 'url'))) {
    throw Error('QIHUB_MANUSCRIPT_INVALID_LINKS')
  }
  payload.external_links = links
  const checklist = values.checklist ?? []
  if (!Array.isArray(checklist) || checklist.length > 150 ||
      checklist.some(item => !item || typeof item !== 'object' ||
        Array.isArray(item) || typeof item.id !== 'string' ||
        !item.id.trim() || item.id.length > 128 ||
        typeof item.category !== 'string' ||
        !CHECK_CATEGORIES.has(item.category) ||
        typeof item.label !== 'string' ||
        !item.label.trim() || item.label.length > 1000 ||
        typeof item.required !== 'boolean' ||
        typeof item.done !== 'boolean' ||
        (item.note != null && (typeof item.note !== 'string' ||
          item.note.length > 10000)) ||
        Object.keys(item).some(k => !['id', 'category', 'label', 'required',
          'done', 'note'].includes(k))) ||
      new Set(checklist.map(item => item.id)).size !== checklist.length) {
    throw Error('QIHUB_MANUSCRIPT_INVALID_CHECKLIST')
  }
  payload.checklist = checklist
  return payload
}

async function confirmReference(
  client: ManuscriptCrudClient,
  table: string,
  id: string | null,
  owner: string,
) {
  if (!id) return
  const read = await client.from(table).select('id,user_id')
    .eq('id', id).eq('user_id', owner).maybeSingle()
  if (read.error || !read.data ||
      typeof read.data !== 'object' ||
      (read.data as Record<string, unknown>).id !== id ||
      (read.data as Record<string, unknown>).user_id !== owner) {
    throw Error('QIHUB_MANUSCRIPT_INVALID_OWNED_REFERENCE_' + table)
  }
}

/** Keep topic, target journals, primary journal and submitted-paper links real. */
async function confirmOwnedLinks(
  client: ManuscriptCrudClient,
  payload: Record<string, unknown>,
  owner: string,
) {
  await confirmReference(client, 'research_topics', payload.topic_id as string | null, owner)
  await confirmReference(client, 'journal_profiles', payload.primary_journal_id as string | null, owner)
  await confirmReference(client, 'papers', payload.submitted_paper_id as string | null, owner)
  for (const journal of payload.target_journal_ids as string[]) {
    await confirmReference(client, 'journal_profiles', journal, owner)
  }
}

export type NativeManuscriptOperation = {
  operation: 'create' | 'update' | 'delete'
  id?: string
  expectedUpdatedAt?: string
  fields?: unknown
}

/** CREATE/UPDATE/DELETE never claim success without the actual source DB row. */
export async function mutateQiHubManuscriptDraft(
  request: NativeManuscriptOperation,
  client: ManuscriptCrudClient = supabase as unknown as ManuscriptCrudClient,
): Promise<{ ok: boolean; conflict?: boolean; record?: ManuscriptDraft }> {
  const owner = await activeAccount(client)
  if (!request || !['create', 'update', 'delete'].includes(request.operation)) {
    throw Error('QIHUB_MANUSCRIPT_INVALID_OPERATION')
  }
  const drafts = client.from('manuscript_drafts')
  if (request.operation === 'create') {
    const fields = validateQiHubManuscriptDraft(request.fields)
    await confirmOwnedLinks(client, fields, owner)
    const result = await drafts.insert({ ...fields, user_id: owner })
      .select('*').maybeSingle()
    if (result.error || !result.data ||
        typeof result.data !== 'object') {
      throw Error('QIHUB_MANUSCRIPT_CREATE_UNCONFIRMED')
    }
    const row = result.data as ManuscriptDraft
    if (!validUuid(row.id) || row.user_id !== owner ||
        typeof row.updated_at !== 'string' ||
        row.title !== fields.title ||
        owner !== await activeAccount(client)) {
      throw Error('QIHUB_MANUSCRIPT_CREATE_ACK_MISMATCH')
    }
    return { ok: true, record: row }
  }
  const id = request.id
  const expected = request.expectedUpdatedAt
  if (!validUuid(id) || !expected ||
      !Number.isFinite(Date.parse(expected))) {
    throw Error('QIHUB_MANUSCRIPT_INVALID_VERSION')
  }
  const old = await drafts.select('id,user_id,updated_at')
    .eq('id', id).eq('user_id', owner).maybeSingle()
  if (old.error) throw Error('QIHUB_MANUSCRIPT_READ_FAILED')
  if (!old.data) return { ok: false, conflict: true }
  const previous = old.data as { id: string; user_id: string; updated_at: string }
  if (previous.id !== id || previous.user_id !== owner) {
    throw Error('QIHUB_MANUSCRIPT_OWNER_MISMATCH')
  }
  if (previous.updated_at !== expected) return { ok: false, conflict: true }
  if (request.operation === 'delete') {
    const deleted = await drafts.delete()
      .eq('id', id).eq('user_id', owner)
      .eq('updated_at', expected).select('*').maybeSingle()
    if (deleted.error) throw Error('QIHUB_MANUSCRIPT_DELETE_FAILED')
    if (!deleted.data) return { ok: false, conflict: true }
    const row = deleted.data as ManuscriptDraft
    if (row.id !== id || row.user_id !== owner ||
        owner !== await activeAccount(client)) {
      throw Error('QIHUB_MANUSCRIPT_DELETE_ACK_MISMATCH')
    }
    return { ok: true, record: row }
  }
  const fields = validateQiHubManuscriptDraft(request.fields)
  await confirmOwnedLinks(client, fields, owner)
  const updatedAt = new Date(
    Math.max(Date.now(), Date.parse(expected) + 1),
  ).toISOString()
  const changed = await drafts.update({ ...fields, updated_at: updatedAt })
    .eq('id', id).eq('user_id', owner).eq('updated_at', expected)
    .select('*').maybeSingle()
  if (changed.error) throw Error('QIHUB_MANUSCRIPT_UPDATE_FAILED')
  if (!changed.data) return { ok: false, conflict: true }
  const row = changed.data as ManuscriptDraft
  if (row.id !== id || row.user_id !== owner ||
      row.title !== fields.title ||
      !row.updated_at ||
      Date.parse(row.updated_at) !== Date.parse(updatedAt) ||
      owner !== await activeAccount(client)) {
    throw Error('QIHUB_MANUSCRIPT_UPDATE_ACK_MISMATCH')
  }
  return { ok: true, record: row }
}
