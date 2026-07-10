import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const easyScholarSecret = Deno.env.get('EASYSCHOLAR_SECRET_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Supabase configuration is incomplete' }, 500)
    if (!easyScholarSecret) return json({ error: 'EasyScholar secret is not configured' }, 503)

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await authClient.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await request.json()
    const publicationName = typeof body.publicationName === 'string' ? body.publicationName.trim() : ''
    if (!publicationName) return json({ error: 'Missing publicationName' }, 400)
    if (publicationName.length > 200) return json({ error: 'Publication name is too long' }, 400)

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const cacheKey = `easyscholar:${normalizeName(publicationName)}`
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000

    const { data: cached } = await serviceClient
      .from('external_api_cache')
      .select('response_data, fetched_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    if (cached?.response_data && Date.now() - new Date(cached.fetched_at).getTime() < maxAgeMs) {
      return json({ data: cached.response_data, cached: true, fetchedAt: cached.fetched_at })
    }

    let acquired = false
    for (let attempt = 0; attempt < 4 && !acquired; attempt += 1) {
      const { data, error } = await serviceClient.rpc('acquire_external_api_slot', {
        p_api_name: 'easyscholar',
        p_interval_ms: 600,
      })
      if (error) throw error
      acquired = data === true
      if (!acquired) await sleep(650)
    }
    if (!acquired) return json({ error: 'Rate limit busy, please retry shortly' }, 429)

    const endpoint = new URL('https://www.easyscholar.cc/open/getPublicationRank')
    endpoint.searchParams.set('secretKey', easyScholarSecret)
    endpoint.searchParams.set('publicationName', publicationName)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    let response: Response
    try {
      response = await fetch(endpoint, { signal: controller.signal, headers: { Accept: 'application/json' } })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) return json({ error: `EasyScholar returned ${response.status}` }, 502)
    const payload = await response.json()
    if (payload?.code !== 200 || !payload?.data) {
      return json({ error: typeof payload?.msg === 'string' ? payload.msg : 'EasyScholar lookup failed' }, 502)
    }

    const fetchedAt = new Date().toISOString()
    const { error: cacheError } = await serviceClient.from('external_api_cache').upsert({
      cache_key: cacheKey,
      api_name: 'easyscholar',
      response_data: payload.data,
      fetched_at: fetchedAt,
    })
    if (cacheError) console.warn('Cache EasyScholar result failed:', cacheError)

    return json({ data: payload.data, cached: false, fetchedAt })
  } catch (error) {
    console.error('journal-rank error:', error)
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'EasyScholar request timed out'
      : error instanceof Error ? error.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})