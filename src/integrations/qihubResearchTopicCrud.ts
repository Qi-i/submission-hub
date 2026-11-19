import { supabase } from '../lib/supabase'

/**
 * The original authenticated Submission Hub domain owns all mutations.
 * QiHub never sees its login token and must explicitly request each write.
 * This adapter supports every actual research_topics business column; it
 * never writes a generic object from the caller into PostgREST.
 */
const TEXT_FIELDS = [
  'title', 'research_question', 'objective', 'novelty', 'background',
  'target_audience', 'expected_output', 'notes',
] as const
const ARRAY_FIELDS = ['keywords', 'methods', 'data_sources'] as const
const SCORE_FIELDS = [
  'novelty_score', 'feasibility_score', 'data_score',
  'method_score', 'timeline_score',
] as const
const STATUS = new Set([
  'idea', 'literature', 'data', 'analysis',
  'drafting', 'paused', 'abandoned',
])
const PRIORITY = new Set(['low', 'medium', 'high', 'critical'])

type CloudTopic = Record<string, unknown> & {
  id: string; user_id: string; updated_at: string
}
type CrudResult = {
  ok: boolean
  conflict?: boolean
  record?: CloudTopic
}

type Result = { data: unknown; error: unknown }
type Query = PromiseLike<Result> & {
  eq(field: string, value: string): Query
  select(fields: string): Query
  maybeSingle(): PromiseLike<Result>
}
type CrudClient = {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null }; error: unknown
    }>
  }
  from(table: string): {
    select(fields: string): Query
    insert(value: Record<string, unknown>): Query
    update(value: Record<string, unknown>): Query
    delete(): Query
  }
}

async function currentAccount(client: CrudClient) {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user?.id) throw Error('QIHUB_TOPIC_SIGN_IN_REQUIRED')
  return data.user.id
}

/** Enforces DB schema, enumerations and financial-free valid ranges. */
export function validateQiHubResearchTopic(
  untrusted: unknown,
): Record<string, unknown> {
  if (!untrusted || typeof untrusted !== 'object' ||
      Array.isArray(untrusted)) {
    throw Error('QIHUB_TOPIC_INVALID_FIELDS')
  }
  const values = untrusted as Record<string, unknown>
  const allowed = new Set<string>([
    ...TEXT_FIELDS, ...ARRAY_FIELDS, ...SCORE_FIELDS,
    'links', 'deadline', 'status', 'priority',
  ])
  if (Object.keys(values).some(key => !allowed.has(key))) {
    throw Error('QIHUB_TOPIC_FORBIDDEN_FIELD')
  }
  if (typeof values.title !== 'string' ||
      !values.title.trim() || values.title.trim().length > 500) {
    throw Error('QIHUB_TOPIC_TITLE_REQUIRED')
  }
  const output: Record<string, unknown> = {}
  for (const field of TEXT_FIELDS) {
    const value = values[field]
    if (value != null && (typeof value !== 'string' ||
        value.length > (field === 'title' ? 500 : 20000))) {
      throw Error('QIHUB_TOPIC_INVALID_TEXT_' + field)
    }
    output[field] = typeof value === 'string' ?
      (field === 'title' ? value.trim() : value) : null
  }
  for (const field of ARRAY_FIELDS) {
    const list = values[field] ?? []
    if (!Array.isArray(list) || list.length > 80 ||
        list.some(value => typeof value !== 'string' ||
          value.length > 250)) {
      throw Error('QIHUB_TOPIC_INVALID_ARRAY_' + field)
    }
    output[field] = list
  }
  for (const field of SCORE_FIELDS) {
    const number = values[field] ?? 3
    if (!Number.isInteger(number) || Number(number) < 0 ||
        Number(number) > 5) {
      throw Error('QIHUB_TOPIC_INVALID_SCORE_' + field)
    }
    output[field] = number
  }
  const status = values.status ?? 'idea'
  const priority = values.priority ?? 'medium'
  if (typeof status !== 'string' || !STATUS.has(status) ||
      typeof priority !== 'string' || !PRIORITY.has(priority)) {
    throw Error('QIHUB_TOPIC_INVALID_ENUM')
  }
  output.status = status
  output.priority = priority
  if (values.deadline == null || values.deadline === '') {
    output.deadline = null
  } else if (typeof values.deadline === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(values.deadline) &&
      !Number.isNaN(Date.parse(values.deadline))) {
    output.deadline = values.deadline
  } else {
    throw Error('QIHUB_TOPIC_INVALID_DEADLINE')
  }
  const links = values.links ?? []
  if (!Array.isArray(links) || links.length > 80 ||
      links.some(link =>
        !link || typeof link !== 'object' || Array.isArray(link) ||
        typeof link.label !== 'string' || !link.label.trim() ||
        link.label.length > 250 || typeof link.url !== 'string' ||
        link.url.length > 3000 ||
        !/^https?:\/\//i.test(link.url) ||
        Object.keys(link).some(key => key !== 'label' && key !== 'url'))) {
    throw Error('QIHUB_TOPIC_INVALID_LINKS')
  }
  output.links = links
  return output
}

export type NativeTopicOperation = {
  operation: 'create' | 'update' | 'delete'
  id?: string
  expectedUpdatedAt?: string
  fields?: unknown
}

/**
 * Real CREATE / UPDATE / DELETE against the same Supabase table as the
 * source website. No optimistic local fake success. Mutations return only
 * after the real database returns the expected owner/record or CAS conflict.
 */
export async function mutateQiHubResearchTopic(
  operation: NativeTopicOperation,
  client: CrudClient = supabase as unknown as CrudClient,
): Promise<CrudResult> {
  const account = await currentAccount(client)
  if (!operation || !['create', 'update', 'delete'].includes(operation.operation)) {
    throw Error('QIHUB_TOPIC_INVALID_OPERATION')
  }
  const table = client.from('research_topics')
  if (operation.operation === 'create') {
    const fields = validateQiHubResearchTopic(operation.fields)
    const outcome = await table.insert({ ...fields, user_id: account })
      .select('*').maybeSingle()
    if (outcome.error || !outcome.data ||
        typeof outcome.data !== 'object') {
      throw Error('QIHUB_TOPIC_CREATE_UNCONFIRMED')
    }
    const row = outcome.data as CloudTopic
    if (row.user_id !== account || !row.id || !row.updated_at ||
        row.title !== fields.title) {
      throw Error('QIHUB_TOPIC_CREATE_ACK_MISMATCH')
    }
    if (account !== await currentAccount(client)) {
      throw Error('QIHUB_TOPIC_ACCOUNT_CHANGED')
    }
    return { ok: true, record: row }
  }

  const id = operation.id
  const expected = operation.expectedUpdatedAt
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) ||
      !expected || Number.isNaN(Date.parse(expected))) {
    throw Error('QIHUB_TOPIC_INVALID_VERSION')
  }
  const before = await table.select('id,user_id,updated_at')
    .eq('user_id', account).eq('id', id).maybeSingle()
  if (before.error) throw Error('QIHUB_TOPIC_READ_FAILED')
  if (!before.data) return { ok: false, conflict: true }
  const old = before.data as CloudTopic
  if (old.user_id !== account || old.id !== id) {
    throw Error('QIHUB_TOPIC_OWNER_MISMATCH')
  }
  if (old.updated_at !== expected) return { ok: false, conflict: true }

  if (operation.operation === 'delete') {
    // A manuscript linked to a topic must not silently lose its relation.
    // The current source DB uses ON DELETE SET NULL; avoid that destructive
    // side effect from an Android control without explicit migration.
    const linked = await client.from('manuscript_drafts').select('id')
      .eq('user_id', account).eq('topic_id', id).maybeSingle()
    if (linked.error) throw Error('QIHUB_TOPIC_RELATION_CHECK_FAILED')
    if (linked.data) throw Error('QIHUB_TOPIC_REFERENCED_BY_DRAFT')
    const deleted = await table.delete()
      .eq('id', id).eq('user_id', account)
      .eq('updated_at', expected).select('*').maybeSingle()
    if (deleted.error) throw Error('QIHUB_TOPIC_DELETE_FAILED')
    if (!deleted.data) return { ok: false, conflict: true }
    const result = deleted.data as CloudTopic
    if (result.id !== id || result.user_id !== account) {
      throw Error('QIHUB_TOPIC_DELETE_ACK_MISMATCH')
    }
    return { ok: true, record: result }
  }

  const fields = validateQiHubResearchTopic(operation.fields)
  const stamp = new Date(
    Math.max(Date.now(), Date.parse(expected) + 1),
  ).toISOString()
  const outcome = await table.update({ ...fields, updated_at: stamp })
    .eq('id', id).eq('user_id', account).eq('updated_at', expected)
    .select('*').maybeSingle()
  if (outcome.error) throw Error('QIHUB_TOPIC_UPDATE_FAILED')
  if (!outcome.data) return { ok: false, conflict: true }
  const updated = outcome.data as CloudTopic
  if (updated.id !== id || updated.user_id !== account ||
      updated.title !== fields.title ||
      Date.parse(updated.updated_at) !== Date.parse(stamp)) {
    throw Error('QIHUB_TOPIC_UPDATE_ACK_MISMATCH')
  }
  if (account !== await currentAccount(client)) {
    throw Error('QIHUB_TOPIC_ACCOUNT_CHANGED')
  }
  return { ok: true, record: updated }
}
