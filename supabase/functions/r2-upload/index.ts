import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.645.0'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.645.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const maxFileSize = 20 * 1024 * 1024
const blockedExtensions = new Set(['exe', 'dll', 'bat', 'cmd', 'com', 'msi', 'ps1', 'sh', 'apk', 'dmg', 'pkg', 'scr', 'js', 'mjs', 'vbs'])
const allowedMimePrefixes = ['application/pdf', 'application/zip', 'application/json', 'application/msword', 'application/vnd.', 'text/', 'image/']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function safeFilename(filename: string) {
  const cleaned = filename.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
  return cleaned.slice(-180) || 'file'
}

function isAllowedType(filename: string, contentType: string) {
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  if (blockedExtensions.has(extension)) return false
  if (!contentType || contentType === 'application/octet-stream') return true
  return allowedMimePrefixes.some(prefix => contentType.startsWith(prefix))
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const accountId = Deno.env.get('R2_ACCOUNT_ID')
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
    const bucketName = Deno.env.get('R2_BUCKET_NAME') || 'submission-hub'
    const publicUrl = (Deno.env.get('R2_PUBLIC_URL') || '').replace(/\/$/, '')

    if (!supabaseUrl || !anonKey || !accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
      return json({ error: 'R2 storage configuration is incomplete' }, 500)
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await request.json()
    const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
    const contentType = typeof body.content_type === 'string' ? body.content_type.trim().toLowerCase() : 'application/octet-stream'
    const size = Number(body.size)

    if (!filename) return json({ error: 'Missing filename' }, 400)
    if (!Number.isFinite(size) || size <= 0) return json({ error: 'Invalid file size' }, 400)
    if (size > maxFileSize) return json({ error: 'File exceeds the 20 MB limit' }, 413)
    if (!isAllowedType(filename, contentType)) return json({ error: 'This file type is not allowed' }, 415)

    const objectKey = `${user.id}/${crypto.randomUUID()}/${safeFilename(filename)}`
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType || 'application/octet-stream',
      Metadata: {
        owner: user.id,
        original_name: encodeURIComponent(filename).slice(0, 500),
      },
    })
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 15 * 60 })

    return json({
      uploadUrl,
      fileUrl: `${publicUrl}/${objectKey.split('/').map(encodeURIComponent).join('/')}`,
      objectKey,
      maxFileSize,
    })
  } catch (error) {
    console.error('r2-upload error:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
