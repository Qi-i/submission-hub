// supabase/functions/r2-upload/index.ts
// Generates pre-signed URLs for uploading files to Cloudflare R2.
// The client uploads directly to R2 using the pre-signed URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { filename, content_type } = await req.json()
    if (!filename) throw new Error('Missing filename')

    // R2 config
    const accountId = Deno.env.get('R2_ACCOUNT_ID')!
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')!
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')!
    const bucketName = Deno.env.get('R2_BUCKET_NAME') || 'submission-hub'
    const publicUrl = Deno.env.get('R2_PUBLIC_URL') || ''

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 storage not configured')
    }

    // Generate unique object key
    const uuid = crypto.randomUUID()
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const objectKey = `${user.id}/${uuid}/${safeName}`

    // Generate pre-signed PUT URL using S3-compatible API
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
    const now = new Date()
    const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const shortDate = dateStamp.slice(0, 8)
    const credential = `${accessKeyId}/${shortDate}/auto/s3/aws4_request`

    // Build the canonical request for pre-signed URL
    const expires = '900' // 15 minutes
    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': dateStamp,
      'X-Amz-Expires': expires,
      'X-Amz-SignedHeaders': 'host',
    })

    const canonicalHeaders = `host:${accountId}.r2.cloudflarestorage.com\n`
    const canonicalRequest = [
      'PUT',
      `/${bucketName}/${objectKey}`,
      queryParams.toString(),
      canonicalHeaders,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n')

    // String to sign
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateStamp,
      `${shortDate}/auto/s3/aws4_request`,
      await hashHex(canonicalRequest),
    ].join('\n')

    // Signing key
    const signingKey = await getSignatureKey(secretAccessKey, shortDate, 'auto', 's3')
    const signature = await hmacHex(signingKey, stringToSign)

    queryParams.set('X-Amz-Signature', signature)

    const uploadUrl = `${endpoint}/${bucketName}/${objectKey}?${queryParams.toString()}`

    // The file URL that can be used to download/access the file
    const fileUrl = publicUrl
      ? `${publicUrl}/${objectKey}`
      : `${endpoint}/${bucketName}/${objectKey}`

    return new Response(JSON.stringify({ uploadUrl, fileUrl, objectKey }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// HMAC-SHA256 helper
async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
}

async function hmacHex(key: ArrayBuffer | Uint8Array, message: string): Promise<string> {
  const sig = await hmac(key, message)
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashHex(message: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode('AWS4' + key), dateStamp)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  return await hmac(kService, 'aws4_request')
}
