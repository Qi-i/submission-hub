import { supabase } from '../lib/supabase'
import { fetchStoredFile, isManagedStoredFile } from '../lib/storage'

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

/** Only the real logged-in paper/attachment references the user owns.
 * Unmanaged external URLs are deliberately excluded; a URL is not an
 * original byte copy and must not silently become a "synced attachment".
 */
export async function listQiHubPrivateAttachmentCandidates(
  client: Reader = supabase as unknown as Reader,
) {
  const snapshot = await collectQiHubReadOnlySnapshot(client)
  const items: Array<{paperId: string; reference: string; fileName: string}> = []
  for (const paper of snapshot.collections.papers) {
    if (!Array.isArray(paper.files)) continue
    for (const attachment of paper.files) {
      if (!attachment || typeof attachment !== 'object') continue
      const file = attachment as {p?:unknown;n?:unknown}
      if (typeof file.p !== 'string' || !isManagedStoredFile(file.p)) continue
      items.push({
        paperId: paper.id,
        reference: file.p,
        fileName: typeof file.n === 'string' ? file.n : 'attachment',
      })
      if (items.length > 4000) throw Error('QIHUB_ATTACHMENT_TOO_MANY')
    }
  }
  return { accountId: snapshot.accountId, items }
}

type AttachmentReadClient = {
  auth: Reader['auth']
  from(table: string): {
    select(fields: string): {
      eq(field: string, value: string): {
        eq(field: string, value: string): {
          maybeSingle(): PromiseLike<{data:unknown;error:unknown}>
        }
      }
    }
  }
}

/** Re-check the exact paper/filename/referenced path on the live server
 * immediately before retrieving the actual file via the site's existing
 * R2 signed-GET + authenticated-proxy fallback or Supabase Storage path.
 */
export async function readQiHubPrivateAttachment(
  paperId: string,
  reference: string,
  fileName: string,
  client: AttachmentReadClient = supabase as unknown as AttachmentReadClient,
  readFile = fetchStoredFile,
) {
  const account = await activeAccount(client as unknown as Reader)
  if (!paperId || !isManagedStoredFile(reference) ||
      typeof fileName !== 'string' || fileName.length > 255) {
    throw Error('QIHUB_ATTACHMENT_INVALID_REFERENCE')
  }
  const response = await client.from('papers').select('id,user_id,files')
    .eq('user_id', account).eq('id', paperId).maybeSingle()
  if (response.error || !response.data ||
      typeof response.data !== 'object') {
    throw Error('QIHUB_ATTACHMENT_OWNERSHIP_UNVERIFIED')
  }
  const paper = response.data as {
    id?:unknown;user_id?:unknown;files?:unknown
  }
  if (paper.id !== paperId || paper.user_id !== account ||
      !Array.isArray(paper.files) ||
      !paper.files.some(entry => entry && typeof entry === 'object' &&
        (entry as {p?:unknown}).p === reference &&
        (entry as {n?:unknown}).n === fileName)) {
    throw Error('QIHUB_ATTACHMENT_NOT_IN_PAPER')
  }
  const file = await readFile(reference, fileName)
  const bytes = file.arrayBuffer
  if (bytes.byteLength < 1 || bytes.byteLength > 20 * 1024 * 1024) {
    throw Error('QIHUB_ATTACHMENT_SIZE_LIMIT')
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const sha256 = Array.from(digest, x => x.toString(16).padStart(2, '0')).join('')
  if (account !== await activeAccount(client as unknown as Reader)) {
    throw Error('QIHUB_ATTACHMENT_ACCOUNT_CHANGED')
  }
  return {
    accountId: account,
    paperId,
    reference,
    fileName,
    mime: file.blob.type || 'application/octet-stream',
    sha256,
    blob: file.blob,
  }
}
