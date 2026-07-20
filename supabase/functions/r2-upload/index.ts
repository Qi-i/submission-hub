import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from 'npm:@aws-sdk/client-s3@3.645.0'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.645.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-r2-action, x-r2-object-key, x-r2-filename, x-r2-file-size, x-r2-bucket',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const maxFileSize = 20 * 1024 * 1024
const defaultSignedUrlTtl = 10 * 60
const maxSignedUrlTtl = 60 * 60
const freeTierBytes = 10 * 1024 * 1024 * 1024
const blockedExtensions = new Set(['exe', 'dll', 'bat', 'cmd', 'com', 'msi', 'ps1', 'sh', 'apk', 'dmg', 'pkg', 'scr', 'js', 'mjs', 'vbs'])
const allowedMimePrefixes = ['application/pdf', 'application/zip', 'application/json', 'application/msword', 'application/vnd.', 'text/', 'image/']
const r2Scheme = 'r2-storage://'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function safeFilename(filename: string) {
  const cleaned = filename
    .normalize('NFKC')
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_')
    .replace(/_+/g, '_')
    .trim()
  return cleaned.slice(-180) || 'file'
}

function encodedHeaderFilename(filename: string) {
  const ascii = safeFilename(filename).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'attachment'
  return { ascii, encoded: encodeURIComponent(filename) }
}

function isAllowedType(filename: string, contentType: string) {
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  if (blockedExtensions.has(extension)) return false
  if (!contentType || contentType === 'application/octet-stream') return true
  return allowedMimePrefixes.some(prefix => contentType.startsWith(prefix))
}

function validateFileInfo(filename: string, contentType: string, size: number) {
  if (!filename) return 'Missing filename'
  if (!Number.isFinite(size) || size <= 0) return 'Invalid file size'
  if (size > maxFileSize) return 'File exceeds the 20 MB limit'
  if (!isAllowedType(filename, contentType)) return 'This file type is not allowed'
  return ''
}

function encodeSegments(value: string) {
  return value.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

function decodeSegments(value: string) {
  return value.split('/').map(segment => decodeURIComponent(segment)).join('/')
}

function createReference(bucket: string, key: string) {
  return `${r2Scheme}${encodeURIComponent(bucket)}/${encodeSegments(key)}`
}

function parseReference(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith(r2Scheme)) return null
  const remainder = value.slice(r2Scheme.length)
  const separator = remainder.indexOf('/')
  if (separator <= 0 || separator === remainder.length - 1) return null
  try {
    const bucket = decodeURIComponent(remainder.slice(0, separator))
    const key = decodeSegments(remainder.slice(separator + 1))
    return bucket && key ? { bucket, key } : null
  } catch {
    return null
  }
}

function decodeHeader(value: string | null) {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function ownedKey(userId: string, key: string) {
  return key.startsWith(`${userId}/`) && !key.includes('/../') && !key.endsWith('/..')
}

function clampTtl(input: unknown) {
  const value = Number(input)
  if (!Number.isFinite(value)) return defaultSignedUrlTtl
  return Math.min(maxSignedUrlTtl, Math.max(60, Math.trunc(value)))
}

async function readJson(request: Request) {
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    return {}
  }
}

async function authenticate(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return { error: json({ error: 'Missing authorization' }, 401) }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return { error: json({ error: 'Supabase function configuration is incomplete' }, 500) }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: json({ error: 'Unauthorized' }, 401) }
  return { user }
}

function r2Config() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucketName = Deno.env.get('R2_BUCKET_NAME') || 'submission-hub'
  if (!accountId || !accessKeyId || !secretAccessKey) return null
  return { accountId, accessKeyId, secretAccessKey, bucketName }
}

function r2Client(config: NonNullable<ReturnType<typeof r2Config>>) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

async function proxyUpload(request: Request, userId: string, client: S3Client, configuredBucket: string) {
  const filename = decodeHeader(request.headers.get('x-r2-filename'))
  const objectKey = decodeHeader(request.headers.get('x-r2-object-key'))
  const requestedBucket = decodeHeader(request.headers.get('x-r2-bucket')) || configuredBucket
  const contentType = (request.headers.get('Content-Type') || 'application/octet-stream').split(';')[0].trim().toLowerCase()
  const declaredSize = Number(request.headers.get('x-r2-file-size'))

  if (requestedBucket !== configuredBucket) return json({ error: 'Invalid R2 bucket' }, 400)
  if (!ownedKey(userId, objectKey)) return json({ error: 'Object ownership check failed' }, 403)
  const validation = validateFileInfo(filename, contentType, declaredSize)
  if (validation) return json({ error: validation }, validation.includes('20 MB') ? 413 : 400)

  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength !== declaredSize) return json({ error: 'Uploaded file size does not match the declared size' }, 400)

  await client.send(new PutObjectCommand({
    Bucket: configuredBucket,
    Key: objectKey,
    Body: bytes,
    ContentType: contentType,
    Metadata: {
      owner: userId,
      original_name: encodeURIComponent(filename).slice(0, 500),
    },
  }))

  return json({
    uploaded: true,
    reference: createReference(configuredBucket, objectKey),
    objectKey,
    size: bytes.byteLength,
    contentType,
  })
}

async function proxyRead(requestUrl: URL, userId: string, client: S3Client, configuredBucket: string) {
  const location = parseReference(requestUrl.searchParams.get('reference'))
  if (!location || location.bucket !== configuredBucket || !ownedKey(userId, location.key)) {
    return json({ error: 'Attachment reference is invalid or not owned by the current user' }, 403)
  }

  const object = await client.send(new GetObjectCommand({ Bucket: configuredBucket, Key: location.key }))
  if (!object.Body) return json({ error: 'Attachment body is empty' }, 404)
  const bytes = await object.Body.transformToByteArray()
  const originalName = object.Metadata?.original_name
    ? decodeHeader(object.Metadata.original_name)
    : location.key.split('/').pop() || 'attachment'
  const headerName = encodedHeaderFilename(originalName)

  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': object.ContentType || 'application/octet-stream',
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `inline; filename="${headerName.ascii}"; filename*=UTF-8''${headerName.encoded}`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405)

  try {
    const auth = await authenticate(request)
    if ('error' in auth) return auth.error

    const config = r2Config()
    if (!config) return json({ error: 'R2 storage configuration is incomplete' }, 500)
    const client = r2Client(config)
    const requestUrl = new URL(request.url)
    const actionHint = requestUrl.searchParams.get('action') || request.headers.get('x-r2-action') || ''

    if (actionHint === 'proxy-upload') {
      return proxyUpload(request, auth.user.id, client, config.bucketName)
    }
    if (actionHint === 'proxy-read') {
      return proxyRead(requestUrl, auth.user.id, client, config.bucketName)
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const body = await readJson(request)
    const action = typeof body.action === 'string' ? body.action : ''

    if (action === 'upload-url') {
      const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
      const contentType = typeof body.contentType === 'string' ? body.contentType.trim().toLowerCase() : 'application/octet-stream'
      const size = Number(body.size)
      const validation = validateFileInfo(filename, contentType, size)
      if (validation) return json({ error: validation }, validation.includes('20 MB') ? 413 : 400)

      const objectKey = `${auth.user.id}/${crypto.randomUUID()}/${safeFilename(filename)}`
      const expiresIn = 15 * 60
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
        ContentType: contentType,
      })
      const uploadUrl = await getSignedUrl(client, command, { expiresIn })
      return json({
        uploadUrl,
        objectKey,
        bucket: config.bucketName,
        reference: createReference(config.bucketName, objectKey),
        expiresIn,
        maxFileSize,
      })
    }

    if (action === 'access') {
      const location = parseReference(body.reference)
      if (!location || location.bucket !== config.bucketName || !ownedKey(auth.user.id, location.key)) {
        return json({ error: 'Attachment reference is invalid or not owned by the current user' }, 403)
      }

      const head = await client.send(new HeadObjectCommand({ Bucket: config.bucketName, Key: location.key }))
      const storedName = head.Metadata?.original_name ? decodeHeader(head.Metadata.original_name) : ''
      const requestedName = typeof body.filename === 'string' ? body.filename.trim() : ''
      const fileName = storedName || requestedName || location.key.split('/').pop() || 'attachment'
      const disposition = body.disposition === 'attachment' ? 'attachment' : 'inline'
      const headerName = encodedHeaderFilename(fileName)
      const expiresIn = clampTtl(body.expiresIn)
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: location.key,
        ResponseContentDisposition: `${disposition}; filename="${headerName.ascii}"; filename*=UTF-8''${headerName.encoded}`,
        ResponseContentType: head.ContentType || 'application/octet-stream',
      })
      const url = await getSignedUrl(client, command, { expiresIn })
      return json({
        url,
        reference: createReference(config.bucketName, location.key),
        fileName,
        contentType: head.ContentType || 'application/octet-stream',
        size: typeof head.ContentLength === 'number' ? head.ContentLength : null,
        updatedAt: head.LastModified?.toISOString() || null,
        expiresIn,
      })
    }

    if (action === 'delete') {
      const location = parseReference(body.reference)
      if (!location || location.bucket !== config.bucketName || !ownedKey(auth.user.id, location.key)) {
        return json({ error: 'Attachment reference is invalid or not owned by the current user' }, 403)
      }
      await client.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: location.key }))
      return json({ deleted: true, reference: createReference(config.bucketName, location.key) })
    }

    if (action === 'usage') {
      let continuationToken: string | undefined
      let bytes = 0
      let count = 0
      do {
        const page = await client.send(new ListObjectsV2Command({
          Bucket: config.bucketName,
          Prefix: `${auth.user.id}/`,
          ContinuationToken: continuationToken,
        }))
        for (const object of page.Contents || []) {
          bytes += Number(object.Size || 0)
          count += 1
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
      } while (continuationToken)
      return json({ provider: 'r2', bytes, count, freeTierBytes })
    }

    if (action === 'health') {
      return json({ configured: true, bucket: config.bucketName, maxFileSize })
    }

    return json({ error: 'Unsupported action' }, 400)
  } catch (error) {
    console.error('r2-upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = /not found|NoSuchKey|404/i.test(message) ? 404 : 500
    return json({ error: message }, status)
  }
})
