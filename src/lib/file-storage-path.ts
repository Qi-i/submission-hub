const SUPABASE_STORAGE_SCHEME = 'supabase-storage://'

export type SupabaseStorageLocation = {
  bucket: string
  path: string
}

export function createSupabaseStoragePath(bucket: string, path: string): string {
  const encodedBucket = encodeURIComponent(bucket.trim())
  const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return `${SUPABASE_STORAGE_SCHEME}${encodedBucket}/${encodedPath}`
}

export function parseSupabaseStoragePath(value?: string | null): SupabaseStorageLocation | null {
  if (!value?.startsWith(SUPABASE_STORAGE_SCHEME)) return null
  const remainder = value.slice(SUPABASE_STORAGE_SCHEME.length)
  const separator = remainder.indexOf('/')
  if (separator <= 0 || separator === remainder.length - 1) return null

  try {
    const bucket = decodeURIComponent(remainder.slice(0, separator))
    const path = remainder.slice(separator + 1).split('/').map(segment => decodeURIComponent(segment)).join('/')
    if (!bucket || !path) return null
    return { bucket, path }
  } catch {
    return null
  }
}

export function isSupabaseStoragePath(value?: string | null): boolean {
  return parseSupabaseStoragePath(value) !== null
}
