import { supabase } from '../lib/supabase'

/**
 * QiHub Android receives the actual authenticated Supabase records through
 * the originating WebView, without ever receiving an OAuth/refresh token.
 * The transport is READ ONLY and deliberately excludes mail credentials,
 * collector keys and private document bytes.
 *
 * Re-reading the complete RLS-filtered inventory catches a concurrent edit,
 * deletion or inserted row before Android adopts an apparent full snapshot.
 * A shortened PostgREST page must never be mistaken for an empty table.
 */
const TABLES = [
  'papers',
  'timeline_events',
  'journal_profiles',
  'research_topics',
  'manuscript_drafts',
] as const

type CollectionName = (typeof TABLES)[number]
type CloudRow = Record<string, unknown> & { id: string; user_id: string }
type Collections = Record<CollectionName, CloudRow[]>

export type QiHubSubmissionSnapshot = {
  format: 'qihub-native-source-snapshot-v1'
  project: 'submission'
  accountId: string
  source: 'supabase-rls'
  capturedAt: string
  complete: true
  collections: Collections
}

type Reader = {
  auth: {
    getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }>
  }
  from(name: string): {
    select(columns: string): {
      eq(field: string, id: string): {
        order(field: string, options: { ascending: boolean }): {
          range(start: number, end: number): PromiseLike<{
            data: unknown; error: unknown
          }>
        }
      }
    }
  }
}

const PAGE_SIZE = 200
const MAX_ROWS_PER_TABLE = 20000

async function activeAccount(client: Reader): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user?.id) throw Error('QIHUB_SOURCE_SIGN_IN_REQUIRED')
  return data.user.id
}

async function scan(client: Reader, accountId: string): Promise<Collections> {
  const collections = {} as Collections
  for (const table of TABLES) {
    const rows: CloudRow[] = []
    let previousId = ''
    let complete = false
    for (let offset = 0; offset < MAX_ROWS_PER_TABLE; offset += PAGE_SIZE) {
      const result = await client.from(table)
        .select('*')
        .eq('user_id', accountId)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      if (result.error) throw Error('QIHUB_SOURCE_READ_FAILED: ' + table)
      if (!Array.isArray(result.data)) {
        throw Error('QIHUB_SOURCE_INVALID_PAGE: ' + table)
      }
      for (const unknownRow of result.data) {
        if (!unknownRow || typeof unknownRow !== 'object') {
          throw Error('QIHUB_SOURCE_INVALID_ROW: ' + table)
        }
        const row = unknownRow as CloudRow
        if (typeof row.id !== 'string' || row.id <= previousId ||
            row.user_id !== accountId) {
          throw Error('QIHUB_SOURCE_ACCOUNT_OR_ORDER_CHANGED: ' + table)
        }
        previousId = row.id
        // Freeze the first scan's JSON value independently of the source
        // client's mutable response objects before running the second scan.
        rows.push(JSON.parse(JSON.stringify(row)) as CloudRow)
      }
      if (result.data.length < PAGE_SIZE) {
        complete = true
        break
      }
    }
    if (!complete) throw Error('QIHUB_SOURCE_TABLE_TOO_LARGE: ' + table)
    collections[table] = rows
  }
  return collections
}

/** The official website calls this using its own signed-in Supabase client.
 * No browser storage key or auth credential crosses into Android.
 */
export async function collectQiHubReadOnlySnapshot(
  client: Reader = supabase as unknown as Reader,
): Promise<QiHubSubmissionSnapshot> {
  const accountId = await activeAccount(client)
  const first = await scan(client, accountId)
  const second = await scan(client, accountId)
  if (accountId !== await activeAccount(client) ||
      JSON.stringify(first) !== JSON.stringify(second)) {
    throw Error('QIHUB_SOURCE_INVENTORY_CHANGED')
  }
  return {
    format: 'qihub-native-source-snapshot-v1',
    project: 'submission',
    accountId,
    source: 'supabase-rls',
    capturedAt: new Date().toISOString(),
    complete: true,
    collections: second,
  }
}
