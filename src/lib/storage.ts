import { createSupabaseStoragePath, parseSupabaseStoragePath } from './file-storage-path'
import { supabase } from './supabase'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const STORAGE_BUCKET = 'paper-files'
const SIGNED_URL_TTL_SECONDS = 10 * 60
const blockedExtensions = new Set(['exe', 'dll', 'bat', 'cmd', 'com', 'msi', 'ps1', 'sh', 'apk', 'dmg', 'pkg', 'scr', 'js', 'mjs', 'vbs'])
const allowedMimePrefixes = ['application/pdf', 'application/zip', 'application/json', 'application/msword', 'application/vnd.', 'text/', 'image/']

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

function safeFilename(filename: string) {
  const cleaned = filename
    .normalize('NFKC')
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_')
    .replace(/_+/g, '_')
    .trim()
  return cleaned.slice(-180) || 'file'
}

async function functionErrorDetail(error: unknown, data: unknown) {
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
        // Fall back to the SDK error below.
      }
    }
  }

  return errorMessage(error, 'R2 签名服务不可用')
}

async function uploadToR2(file: File, token: string) {
  const { data, error } = await supabase.functions.invoke('r2-upload', {
    headers: { Authorization: `Bearer ${token}` },
    body: {
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      size: file.size,
    },
  })

  if (error || !data?.uploadUrl || !data?.fileUrl) {
    throw new Error(await functionErrorDetail(error, data))
  }

  const response = await fetch(data.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  })

  if (!response.ok) throw new Error(`R2 上传返回 ${response.status}`)
  return { fileUrl: String(data.fileUrl), fileName: file.name }
}

async function uploadToSupabaseStorage(file: File, userId: string) {
  const objectPath = `${userId}/${crypto.randomUUID()}/${safeFilename(file.name)}`
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw error
  return {
    fileUrl: createSupabaseStoragePath(STORAGE_BUCKET, objectPath),
    fileName: file.name,
  }
}

export async function uploadFile(file: File): Promise<{ fileUrl: string; fileName: string }> {
  const validationError = validateFile(file)
  if (validationError) throw new Error(validationError)

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const session = sessionData.session
  if (sessionError || !session?.access_token || !session.user?.id) {
    throw new Error('登录状态已失效，请重新登录后上传。')
  }

  try {
    return await uploadToR2(file, session.access_token)
  } catch (r2Error) {
    console.warn('R2 upload unavailable, falling back to Supabase Storage:', r2Error)
    try {
      return await uploadToSupabaseStorage(file, session.user.id)
    } catch (storageError) {
      console.error('Supabase Storage fallback failed:', storageError)
      throw new Error(`主存储不可用（${errorMessage(r2Error)}）；备用存储失败（${errorMessage(storageError)}）。`)
    }
  }
}

export async function openStoredFile(value: string): Promise<void> {
  const location = parseSupabaseStoragePath(value)
  if (!location) throw new Error('附件地址无效。')

  const pendingWindow = window.open('about:blank', '_blank')
  if (pendingWindow) pendingWindow.opener = null

  try {
    const { data, error } = await supabase.storage
      .from(location.bucket)
      .createSignedUrl(location.path, SIGNED_URL_TTL_SECONDS)
    if (error || !data?.signedUrl) throw error || new Error('无法生成下载链接。')

    if (pendingWindow) pendingWindow.location.replace(data.signedUrl)
    else window.location.assign(data.signedUrl)
  } catch (error) {
    pendingWindow?.close()
    throw error
  }
}

export function isR2File(path: string): boolean {
  return /^https?:\/\//i.test(path)
}
