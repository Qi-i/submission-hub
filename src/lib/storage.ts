import { createR2StoragePath, parseR2StoragePath, parseSupabaseStoragePath } from './file-storage-path'
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const LEGACY_STORAGE_BUCKET = 'paper-files'
const R2_FUNCTION = 'r2-upload'
const SIGNED_URL_TTL_SECONDS = 10 * 60
const blockedExtensions = new Set(['exe', 'dll', 'bat', 'cmd', 'com', 'msi', 'ps1', 'sh', 'apk', 'dmg', 'pkg', 'scr', 'js', 'mjs', 'vbs'])
const allowedMimePrefixes = ['application/pdf', 'application/zip', 'application/json', 'application/msword', 'application/vnd.', 'text/', 'image/']

export type StoredFileProvider = 'r2' | 'supabase'

export type StoredFileAccess = {
  reference: string
  provider: StoredFileProvider
  url: string
  fileName: string
  contentType: string
  size: number | null
  updatedAt: string | null
  expiresIn: number
}

export type StoredFilePayload = {
  access: StoredFileAccess
  arrayBuffer: ArrayBuffer
  blob: Blob
}

export type StorageUsage = {
  provider: 'r2'
  bytes: number
  count: number
  freeTierBytes: number
}

type R2UploadResponse = {
  uploadUrl: string
  objectKey: string
  reference?: string
  bucket?: string
  expiresIn?: number
}

type R2AccessResponse = {
  url: string
  reference: string
  fileName?: string
  contentType?: string
  size?: number | null
  updatedAt?: string | null
  expiresIn?: number
}

function errorMessage(error: unknown, fallback = '未知错误') {
  return error instanceof Error && error.message ? error.message : fallback
}

function validateFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (!file.size) return '文件内容为空。'
  if (file.size > MAX_FILE_SIZE) return '文件超过 20 MB 上限。'
  if (blockedExtensions.has(extension)) return '该文件类型不允许上传。'
  if (file.type && file.type !== 'application/octet-stream' && !allowedMimePrefixes.some(prefix => file.type.startsWith(prefix))) {
    return '该文件类型不允许上传。'
  }
  return ''
}

async function requireSession() {
  const { data, error } = await supabase.auth.getSession()
  const session = data.session
  if (error || !session?.access_token || !session.user?.id) throw new Error('登录状态已失效，请重新登录后操作附件。')
  return session
}

async function functionErrorDetail(error: unknown, data: unknown, fallback = 'R2 文件服务不可用') {
  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
    return (data as { error: string }).error
  }
  if (error && typeof error === 'object' && 'context' in error) {
    const response = (error as { context?: Response }).context
    if (response && typeof response.clone === 'function') {
      try {
        const payload = await response.clone().json() as { error?: unknown }
        if (typeof payload?.error === 'string') return payload.error
      } catch {
        // Fall through to the SDK message.
      }
    }
  }
  return errorMessage(error, fallback)
}

async function invokeR2<T>(body: Record<string, unknown>, token: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(R2_FUNCTION, {
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  if (error || !data) throw new Error(await functionErrorDetail(error, data))
  if (typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

function proxyFunctionUrl(action: string, reference?: string) {
  const url = new URL(`${supabaseUrl}/functions/v1/${R2_FUNCTION}`)
  url.searchParams.set('action', action)
  if (reference) url.searchParams.set('reference', reference)
  return url.toString()
}

async function uploadThroughProxy(file: File, objectKey: string, token: string, bucket?: string) {
  const response = await fetch(proxyFunctionUrl('proxy-upload'), {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-r2-object-key': encodeURIComponent(objectKey),
      'x-r2-filename': encodeURIComponent(file.name),
      'x-r2-file-size': String(file.size),
      ...(bucket ? { 'x-r2-bucket': encodeURIComponent(bucket) } : {}),
    },
    body: file,
  })
  const payload = await response.json().catch(() => ({})) as { reference?: string; error?: string }
  if (!response.ok || !payload.reference) throw new Error(payload.error || `R2 代理上传返回 ${response.status}`)
  return payload.reference
}

async function uploadToR2(file: File, token: string) {
  const prepared = await invokeR2<R2UploadResponse>({
    action: 'upload-url',
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
  }, token)

  if (!prepared.uploadUrl || !prepared.objectKey) throw new Error('R2 上传签名响应不完整。')
  const fallbackReference = prepared.reference || createR2StoragePath(prepared.bucket || 'submission-hub', prepared.objectKey)

  try {
    const response = await fetch(prepared.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    })
    if (!response.ok) throw new Error(`R2 直传返回 ${response.status}`)
    return fallbackReference
  } catch (directError) {
    console.warn('R2 direct upload failed; using authenticated proxy upload:', directError)
    return uploadThroughProxy(file, prepared.objectKey, token, prepared.bucket)
  }
}

export async function uploadFile(file: File): Promise<{ fileUrl: string; fileName: string; size: number; contentType: string }> {
  const validationError = validateFile(file)
  if (validationError) throw new Error(validationError)

  const session = await requireSession()
  try {
    const fileUrl = await uploadToR2(file, session.access_token)
    return {
      fileUrl,
      fileName: file.name,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
    }
  } catch (error) {
    console.error('Private R2 document upload failed:', error)
    throw new Error(`私有文档存储失败：${errorMessage(error)}。`)
  }
}

export function isManagedStoredFile(value?: string | null): boolean {
  return parseR2StoragePath(value) !== null || parseSupabaseStoragePath(value) !== null
}

export function storedFileProvider(value?: string | null): StoredFileProvider | null {
  if (parseR2StoragePath(value)) return 'r2'
  if (parseSupabaseStoragePath(value)) return 'supabase'
  return null
}

export async function getStoredFileAccess(value: string, fileName = 'attachment', disposition: 'inline' | 'attachment' = 'inline'): Promise<StoredFileAccess> {
  const r2 = parseR2StoragePath(value)
  if (r2) {
    const session = await requireSession()
    const data = await invokeR2<R2AccessResponse>({
      action: 'access',
      reference: value,
      filename: fileName,
      disposition,
      expiresIn: SIGNED_URL_TTL_SECONDS,
    }, session.access_token)
    if (!data.url) throw new Error('无法生成 R2 临时访问链接。')
    return {
      reference: value,
      provider: 'r2',
      url: data.url,
      fileName: data.fileName || fileName,
      contentType: data.contentType || 'application/octet-stream',
      size: typeof data.size === 'number' ? data.size : null,
      updatedAt: data.updatedAt || null,
      expiresIn: data.expiresIn || SIGNED_URL_TTL_SECONDS,
    }
  }

  const legacy = parseSupabaseStoragePath(value)
  if (!legacy || legacy.bucket !== LEGACY_STORAGE_BUCKET) throw new Error('附件地址无效。')
  await requireSession()
  const { data, error } = await supabase.storage.from(legacy.bucket).createSignedUrl(legacy.path, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) throw error || new Error('无法生成 Supabase Storage 临时访问链接。')
  return {
    reference: value,
    provider: 'supabase',
    url: data.signedUrl,
    fileName,
    contentType: 'application/octet-stream',
    size: null,
    updatedAt: null,
    expiresIn: SIGNED_URL_TTL_SECONDS,
  }
}

async function fetchR2Proxy(reference: string, token: string) {
  return fetch(proxyFunctionUrl('proxy-read', reference), {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function fetchStoredFile(value: string, fileName = 'attachment'): Promise<StoredFilePayload> {
  const access = await getStoredFileAccess(value, fileName, 'inline')
  let response: Response
  try {
    response = await fetch(access.url, { cache: 'no-store' })
    if (!response.ok) throw new Error(`文件读取返回 ${response.status}`)
  } catch (directError) {
    if (access.provider !== 'r2') throw directError
    console.warn('R2 signed GET was blocked or failed; using authenticated proxy read:', directError)
    const session = await requireSession()
    response = await fetchR2Proxy(value, session.access_token)
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(payload.error || `R2 代理读取返回 ${response.status}`)
    }
  }

  const blob = await response.blob()
  const arrayBuffer = await blob.arrayBuffer()
  return {
    access: {
      ...access,
      contentType: blob.type || access.contentType,
      size: access.size ?? blob.size,
    },
    blob,
    arrayBuffer,
  }
}

export async function openStoredFile(value: string, fileName = 'attachment'): Promise<void> {
  const pendingWindow = window.open('about:blank', '_blank')
  if (pendingWindow) pendingWindow.opener = null
  try {
    const access = await getStoredFileAccess(value, fileName, 'inline')
    if (pendingWindow) pendingWindow.location.replace(access.url)
    else window.location.assign(access.url)
  } catch (error) {
    pendingWindow?.close()
    throw error
  }
}

export async function downloadStoredFile(value: string, fileName = 'attachment'): Promise<void> {
  const payload = await fetchStoredFile(value, fileName)
  const url = URL.createObjectURL(payload.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = payload.access.fileName || fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export async function deleteStoredFile(value: string): Promise<boolean> {
  const r2 = parseR2StoragePath(value)
  if (r2) {
    const session = await requireSession()
    await invokeR2<{ deleted: boolean }>({ action: 'delete', reference: value }, session.access_token)
    return true
  }

  const legacy = parseSupabaseStoragePath(value)
  if (!legacy || legacy.bucket !== LEGACY_STORAGE_BUCKET) return false
  await requireSession()
  const { error } = await supabase.storage.from(legacy.bucket).remove([legacy.path])
  if (error) throw error
  return true
}

export async function deleteStoredFiles(values: Array<string | null | undefined>): Promise<void> {
  const unique = Array.from(new Set(values.filter((value): value is string => isManagedStoredFile(value))))
  if (!unique.length) return

  const results = await Promise.allSettled(unique.map(value => deleteStoredFile(value)))
  const failures = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[]
  if (failures.length) {
    const detail = failures.map(result => errorMessage(result.reason)).join('；')
    throw new Error(`${failures.length} 个附件未能从云端清理：${detail}`)
  }
}

export async function getStorageUsage(): Promise<StorageUsage> {
  const session = await requireSession()
  const data = await invokeR2<Partial<StorageUsage>>({ action: 'usage' }, session.access_token)
  return {
    provider: 'r2',
    bytes: Number(data.bytes || 0),
    count: Number(data.count || 0),
    freeTierBytes: Number(data.freeTierBytes || 10 * 1024 * 1024 * 1024),
  }
}
