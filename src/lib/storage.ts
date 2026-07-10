import { supabase } from './supabase'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const blockedExtensions = new Set(['exe', 'dll', 'bat', 'cmd', 'com', 'msi', 'ps1', 'sh', 'apk', 'dmg', 'pkg', 'scr', 'js', 'mjs', 'vbs'])

function allowedFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  return file.size > 0 && file.size <= MAX_FILE_SIZE && !blockedExtensions.has(extension)
}

export async function uploadFile(file: File): Promise<{ fileUrl: string; fileName: string } | null> {
  try {
    if (!allowedFile(file)) {
      console.error('Upload rejected: invalid type or file exceeds 20 MB')
      return null
    }

    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token
    if (!token) return null

    const { data, error } = await supabase.functions.invoke('r2-upload', {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        size: file.size,
      },
    })

    if (error || !data?.uploadUrl || !data?.fileUrl) {
      console.error('R2 upload URL error:', error?.message || data?.error || 'invalid response')
      return null
    }

    const response = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    })

    if (!response.ok) {
      console.error('R2 PUT failed:', response.status, response.statusText)
      return null
    }

    return { fileUrl: data.fileUrl, fileName: file.name }
  } catch (error) {
    console.error('uploadFile error:', error)
    return null
  }
}

export function isR2File(path: string): boolean {
  return /^https?:\/\//i.test(path)
}
