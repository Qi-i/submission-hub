import { supabase } from '../lib/supabase'

/** Complete author-owned journal profile management for QiHub native.
 * Never forward a source session into Android or update arbitrary columns.
 * Extra server-managed fields are always preserved by column allowlisting.
 */
const TEXT = [
  'name', 'name_zh', 'official_abbreviation', 'publisher', 'website_url',
  'author_guide_url', 'submission_url', 'issn', 'eissn', 'scope',
  'scope_zh', 'jcr_quartile', 'cas_quartile', 'apc_currency',
  'fee_notes', 'selection_notes', 'notes',
] as const
const ARRAYS = ['subject_tags', 'selection_tags', 'indexing'] as const
const DECIMALS = ['impact_factor', 'apc_amount', 'acceptance_rate'] as const
const DAYS = ['first_decision_days', 'total_review_days'] as const
const OA = new Set(['unknown', 'closed', 'hybrid', 'gold', 'diamond'])
const RISK = new Set(['normal', 'watch', 'warning'])
const PRIORITY = new Set(['low', 'medium', 'high', 'critical'])

type DbResult = { data: unknown; error: unknown }
type DbQuery = {
  eq(column: string, value: string): DbQuery
  contains(column: string, value: string[]): DbQuery
  select(columns: string): DbQuery
  maybeSingle(): PromiseLike<DbResult>
}
type JournalCrudClient = {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null }; error: unknown
    }>
  }
  from(table: string): {
    select(columns: string): DbQuery
    insert(values: Record<string, unknown>): DbQuery
    update(values: Record<string, unknown>): DbQuery
    delete(): DbQuery
  }
}

async function accountId(client: JournalCrudClient): Promise<string> {
  const response = await client.auth.getUser()
  const id = response.data.user?.id
  if (response.error || !id) throw Error('QIHUB_JOURNAL_SIGN_IN_REQUIRED')
  return id
}

export function validateQiHubJournalProfile(
  input: unknown,
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Error('QIHUB_JOURNAL_INVALID_FIELDS')
  }
  const data = input as Record<string, unknown>
  const allowed = new Set<string>([
    ...TEXT, ...ARRAYS, ...DECIMALS, ...DAYS,
    'third_party_links', 'oa_type', 'risk_level', 'priority', 'is_favorite',
  ])
  if (Object.keys(data).some(key => !allowed.has(key))) {
    throw Error('QIHUB_JOURNAL_FORBIDDEN_FIELD')
  }
  if (typeof data.name !== 'string' ||
      !data.name.trim() || data.name.length > 500) {
    throw Error('QIHUB_JOURNAL_NAME_REQUIRED')
  }
  const result: Record<string, unknown> = {}
  for (const key of TEXT) {
    const value = data[key]
    if (value != null && (typeof value !== 'string' ||
        value.length > (key === 'name' ? 500 : 20000))) {
      throw Error('QIHUB_JOURNAL_INVALID_TEXT_' + key)
    }
    if (['website_url', 'author_guide_url', 'submission_url'].includes(key) &&
        typeof value === 'string' && value &&
        !/^https?:\/\//i.test(value)) {
      throw Error('QIHUB_JOURNAL_INVALID_URL')
    }
    result[key] = typeof value === 'string'
      ? (key === 'name' ? value.trim() : value) : null
  }
  for (const key of ARRAYS) {
    const list = data[key] ?? []
    if (!Array.isArray(list) || list.length > 80 ||
        list.some(item => typeof item !== 'string' || item.length > 250)) {
      throw Error('QIHUB_JOURNAL_INVALID_ARRAY_' + key)
    }
    result[key] = list
  }
  const links = data.third_party_links ?? []
  if (!Array.isArray(links) || links.length > 80 ||
      links.some(link =>
        !link || typeof link !== 'object' || Array.isArray(link) ||
        typeof link.label !== 'string' || !link.label.trim() ||
        link.label.length > 250 || typeof link.url !== 'string' ||
        link.url.length > 3000 ||
        !/^https?:\/\//i.test(link.url) ||
        Object.keys(link).some(key => key !== 'label' && key !== 'url'))) {
    throw Error('QIHUB_JOURNAL_INVALID_LINKS')
  }
  result.third_party_links = links
  for (const key of DECIMALS) {
    const number = data[key]
    if (number != null &&
        (typeof number !== 'number' || !Number.isFinite(number) ||
         number < 0 || (key === 'acceptance_rate' && number > 100))) {
      throw Error('QIHUB_JOURNAL_INVALID_DECIMAL_' + key)
    }
    result[key] = number ?? null
  }
  for (const key of DAYS) {
    const number = data[key]
    if (number != null &&
        (!Number.isInteger(number) || Number(number) < 0 ||
         Number(number) > 100000)) {
      throw Error('QIHUB_JOURNAL_INVALID_DAYS_' + key)
    }
    result[key] = number ?? null
  }
  const oa = data.oa_type ?? 'unknown'
  const risk = data.risk_level ?? 'normal'
  const priority = data.priority ?? 'medium'
  if (typeof oa !== 'string' || !OA.has(oa) ||
      typeof risk !== 'string' || !RISK.has(risk) ||
      typeof priority !== 'string' || !PRIORITY.has(priority)) {
    throw Error('QIHUB_JOURNAL_INVALID_ENUM')
  }
  result.oa_type = oa
  result.risk_level = risk
  result.priority = priority
  if (data.is_favorite != null && typeof data.is_favorite !== 'boolean') {
    throw Error('QIHUB_JOURNAL_INVALID_FAVORITE')
  }
  result.is_favorite = data.is_favorite ?? true
  return result
}

export type JournalCrudRequest = {
  operation: 'create' | 'update' | 'delete'
  id?: string
  expectedUpdatedAt?: string
  fields?: unknown
}

export async function mutateQiHubJournalProfile(
  request: JournalCrudRequest,
  client: JournalCrudClient = supabase as unknown as JournalCrudClient,
) {
  const owner = await accountId(client)
  if (!request ||
      !['create', 'update', 'delete'].includes(request.operation)) {
    throw Error('QIHUB_JOURNAL_INVALID_OPERATION')
  }
  const journals = client.from('journal_profiles')
  if (request.operation === 'create') {
    const validated = validateQiHubJournalProfile(request.fields)
    const response = await journals.insert({
      ...validated, user_id: owner,
    }).select('*').maybeSingle()
    if (response.error || !response.data ||
        typeof response.data !== 'object') {
      throw Error('QIHUB_JOURNAL_CREATE_UNCONFIRMED')
    }
    const row = response.data as Record<string, unknown>
    if (row.user_id !== owner || typeof row.id !== 'string' ||
        typeof row.updated_at !== 'string' ||
        row.name !== validated.name) {
      throw Error('QIHUB_JOURNAL_CREATE_ACK_MISMATCH')
    }
    if (owner !== await accountId(client)) {
      throw Error('QIHUB_JOURNAL_ACCOUNT_CHANGED')
    }
    return { ok: true as const, record: row }
  }
  const id = request.id
  const expected = request.expectedUpdatedAt
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) ||
      !expected || Number.isNaN(Date.parse(expected))) {
    throw Error('QIHUB_JOURNAL_INVALID_VERSION')
  }
  const original = await journals.select('id,user_id,updated_at')
    .eq('user_id', owner).eq('id', id).maybeSingle()
  if (original.error) throw Error('QIHUB_JOURNAL_READ_FAILED')
  if (!original.data) return { ok: false as const, conflict: true as const }
  const old = original.data as Record<string, unknown>
  if (old.user_id !== owner || old.id !== id) {
    throw Error('QIHUB_JOURNAL_OWNER_MISMATCH')
  }
  if (old.updated_at !== expected) {
    return { ok: false as const, conflict: true as const }
  }
  if (request.operation === 'delete') {
    // A journal may be referenced by an active manuscript as primary
    // journal or as one of the target journal UUIDs. Neither relationship
    // should silently be lost by native deletion.
    const manuscripts = client.from('manuscript_drafts')
    const primary = await manuscripts.select('id')
      .eq('user_id', owner).eq('primary_journal_id', id).maybeSingle()
    if (primary.error) throw Error('QIHUB_JOURNAL_REFERENCE_CHECK_FAILED')
    const targets = await manuscripts.select('id')
      .eq('user_id', owner)
      .contains('target_journal_ids', [id]).maybeSingle()
    if (targets.error) throw Error('QIHUB_JOURNAL_REFERENCE_CHECK_FAILED')
    if (primary.data || targets.data) {
      throw Error('QIHUB_JOURNAL_REFERENCED_BY_MANUSCRIPT')
    }
    const removed = await journals.delete()
      .eq('id', id).eq('user_id', owner)
      .eq('updated_at', expected).select('*').maybeSingle()
    if (removed.error) throw Error('QIHUB_JOURNAL_DELETE_FAILED')
    if (!removed.data) {
      return { ok: false as const, conflict: true as const }
    }
    const row = removed.data as Record<string, unknown>
    if (row.id !== id || row.user_id !== owner) {
      throw Error('QIHUB_JOURNAL_DELETE_ACK_MISMATCH')
    }
    return { ok: true as const, record: row }
  }
  const validated = validateQiHubJournalProfile(request.fields)
  const nextUpdatedAt = new Date(
    Math.max(Date.now(), Date.parse(expected) + 1),
  ).toISOString()
  const changed = await journals.update({
    ...validated, updated_at: nextUpdatedAt,
  }).eq('id', id).eq('user_id', owner)
    .eq('updated_at', expected).select('*').maybeSingle()
  if (changed.error) throw Error('QIHUB_JOURNAL_UPDATE_FAILED')
  if (!changed.data) {
    return { ok: false as const, conflict: true as const }
  }
  const row = changed.data as Record<string, unknown>
  if (row.id !== id || row.user_id !== owner ||
      row.name !== validated.name ||
      typeof row.updated_at !== 'string' ||
      Date.parse(row.updated_at) !== Date.parse(nextUpdatedAt)) {
    throw Error('QIHUB_JOURNAL_UPDATE_ACK_MISMATCH')
  }
  if (owner !== await accountId(client)) {
    throw Error('QIHUB_JOURNAL_ACCOUNT_CHANGED')
  }
  return { ok: true as const, record: row }
}
