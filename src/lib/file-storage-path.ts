const SUPABASE_STORAGE_SCHEME = 'supabase-storage://'
const R2_STORAGE_SCHEME = 'r2-storage://'

export type SupabaseStorageLocation = {
  bucket: string
  path: string
}

export type R2StorageLocation = {
  bucket: string
  key: string
}

function encodeSegments(value: string) {
  return value.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

function decodeSegments(value: string) {
  return value.split('/').map(segment => decodeURIComponent(segment)).join('/')
}

export function createSupabaseStoragePath(bucket: string, path: string): string {
  const encodedBucket = encodeURIComponent(bucket.trim())
  return `${SUPABASE_STORAGE_SCHEME}${encodedBucket}/${encodeSegments(path)}`
}

export function parseSupabaseStoragePath(value?: string | null): SupabaseStorageLocation | null {
  if (!value?.startsWith(SUPABASE_STORAGE_SCHEME)) return null
  const remainder = value.slice(SUPABASE_STORAGE_SCHEME.length)
  const separator = remainder.indexOf('/')
  if (separator <= 0 || separator === remainder.length - 1) return null

  try {
    const bucket = decodeURIComponent(remainder.slice(0, separator))
    const path = decodeSegments(remainder.slice(separator + 1))
    if (!bucket || !path) return null
    return { bucket, path }
  } catch {
    return null
  }
}

export function createR2StoragePath(bucket: string, key: string): string {
  const encodedBucket = encodeURIComponent(bucket.trim())
  return `${R2_STORAGE_SCHEME}${encodedBucket}/${encodeSegments(key)}`
}

export function parseR2StoragePath(value?: string | null): R2StorageLocation | null {
  if (!value?.startsWith(R2_STORAGE_SCHEME)) return null
  const remainder = value.slice(R2_STORAGE_SCHEME.length)
  const separator = remainder.indexOf('/')
  if (separator <= 0 || separator === remainder.length - 1) return null

  try {
    const bucket = decodeURIComponent(remainder.slice(0, separator))
    const key = decodeSegments(remainder.slice(separator + 1))
    if (!bucket || !key) return null
    return { bucket, key }
  } catch {
    return null
  }
}

// Historical UI helper retained for compatibility; paper cards use it as the generic managed-file check.
export function isSupabaseStoragePath(value?: string | null): boolean {
  return parseSupabaseStoragePath(value) !== null || parseR2StoragePath(value) !== null
}

export function isR2StoragePath(value?: string | null): boolean {
  return parseR2StoragePath(value) !== null
}
