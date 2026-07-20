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

async function requireCurrentUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const session = sessionData.session
  if (sessionError || !session?.user?.id) throw new Error('登录状态已失效，请重新登录后操作附件。')
  return session.user
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

  const user = await requireCurrentUser()
  try {
    return await uploadToSupabaseStorage(file, user.id)
  } catch (error) {
    console.error('Private document upload failed:', error)
    throw new Error(`私有文档存储失败：${errorMessage(error)}。`)
  }
}

export function isManagedStoredFile(value?: string | null): boolean {
  return parseSupabaseStoragePath(value) !== null
}

export async function openStoredFile(value: string): Promise<void> {
  const location = parseSupabaseStoragePath(value)
  if (!location || location.bucket !== STORAGE_BUCKET) throw new Error('附件地址无效。')
  await requireCurrentUser()

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

export async function deleteStoredFile(value: string): Promise<boolean> {
  const location = parseSupabaseStoragePath(value)
  if (!location || location.bucket !== STORAGE_BUCKET) return false
  await requireCurrentUser()

  const { error } = await supabase.storage.from(location.bucket).remove([location.path])
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
