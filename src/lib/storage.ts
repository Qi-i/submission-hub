// src/lib/storage.ts
// File upload/download via Cloudflare R2 with pre-signed URLs.

import { supabase } from './supabase'

/**
 * Upload a file to R2 and return the public file URL.
 * Returns null if R2 is not configured or upload fails.
 */
export async function uploadFile(file: File): Promise<{ fileUrl: string; fileName: string } | null> {
  try {
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token
    if (!token) return null

    // Get pre-signed upload URL from Edge Function
    const { data, error } = await supabase.functions.invoke('r2-upload', {
      headers: { Authorization: `Bearer ${token}` },
      body: { filename: file.name, content_type: file.type },
    })

    if (error || !data) {
      console.error('R2 upload URL error:', error?.message || 'no data')
      return null
    }

    const { uploadUrl, fileUrl } = data

    // Upload file directly to R2
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    })

    if (!res.ok) {
      console.error('R2 PUT failed:', res.status, res.statusText)
      return null
    }

    return { fileUrl, fileName: file.name }
  } catch (err) {
    console.error('uploadFile error:', err)
    return null
  }
}

/**
 * Check if a file URL points to R2 storage.
 */
export function isR2File(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://')
}
