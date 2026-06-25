// supabase/functions/admin-stats/index.ts
// Returns all users' paper statistics. Admin-only.
// Also handles user profile updates when called with action='update_user'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_ID = 'c207de09-6b0c-470d-85a6-90ff4304c1ba'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Create client with anon key to verify JWT
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== ADMIN_ID) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create admin client with service role key
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Check if this is an update request
    let body: any = {}
    try { body = await req.json() } catch {}

    if (body.action === 'update_user') {
      const updateData: Record<string, string> = {}
      if (body.username) updateData.username = body.username
      if (body.display_name !== undefined) updateData.display_name = body.display_name

      const { error } = await admin
        .from('user_profiles')
        .update(updateData)
        .eq('id', body.user_id)

      if (error) throw error
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default: return all users' paper stats
    const { data: profiles } = await admin.from('user_profiles').select('*')
    const { data: papers } = await admin.from('papers').select('user_id, status')

    // Group papers by user
    const statsMap = new Map<string, { paper_count: number; status_counts: Record<string, number> }>()
    for (const p of papers || []) {
      const existing = statsMap.get(p.user_id) || { paper_count: 0, status_counts: {} }
      existing.paper_count++
      existing.status_counts[p.status] = (existing.status_counts[p.status] || 0) + 1
      statsMap.set(p.user_id, existing)
    }

    const result = (profiles || []).map(p => ({
      user_id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      paper_count: statsMap.get(p.id)?.paper_count || 0,
      status_counts: statsMap.get(p.id)?.status_counts || {},
    }))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
