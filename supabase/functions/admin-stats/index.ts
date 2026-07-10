import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const fallbackAdminId = 'c207de09-6b0c-470d-85a6-90ff4304c1ba'
const adminId = Deno.env.get('ADMIN_USER_ID') || fallbackAdminId

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'Server configuration is incomplete' }, 500)

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user || user.id !== adminId) return json({ error: 'Unauthorized' }, 403)

    const admin = createClient(supabaseUrl, serviceRoleKey)
    let body: Record<string, unknown> = {}
    try { body = await request.json() } catch {}

    if (body.action === 'update_user') {
      const userId = typeof body.user_id === 'string' ? body.user_id : ''
      const username = typeof body.username === 'string' ? body.username.trim() : ''
      const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : ''
      if (!userId || !username) return json({ error: 'Missing user_id or username' }, 400)
      if (username.length > 80 || displayName.length > 120) return json({ error: 'Profile value is too long' }, 400)

      const { error } = await admin
        .from('user_profiles')
        .update({ username, display_name: displayName || null })
        .eq('id', userId)
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    const [{ data: profiles, error: profileError }, { data: papers, error: paperError }] = await Promise.all([
      admin.from('user_profiles').select('id, username, display_name, avatar_url, created_at').order('created_at', { ascending: false }),
      admin.from('papers').select('user_id, status'),
    ])
    if (profileError) return json({ error: profileError.message }, 400)
    if (paperError) return json({ error: paperError.message }, 400)

    const statsMap = new Map<string, { paper_count: number; status_counts: Record<string, number> }>()
    for (const paper of papers || []) {
      const current = statsMap.get(paper.user_id) || { paper_count: 0, status_counts: {} }
      current.paper_count += 1
      current.status_counts[paper.status] = (current.status_counts[paper.status] || 0) + 1
      statsMap.set(paper.user_id, current)
    }

    return json((profiles || []).map(profile => ({
      user_id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      paper_count: statsMap.get(profile.id)?.paper_count || 0,
      status_counts: statsMap.get(profile.id)?.status_counts || {},
    })))
  } catch (error) {
    console.error('admin-stats error:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
