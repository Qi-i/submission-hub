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

    const body = await request.json()
    const userId = typeof body.user_id === 'string' ? body.user_id : ''
    const newPassword = typeof body.new_password === 'string' ? body.new_password : ''
    if (!userId || !newPassword) return json({ error: 'Missing user_id or new_password' }, 400)
    if (newPassword.length < 10) return json({ error: 'Password must be at least 10 characters' }, 400)
    if (newPassword.length > 128) return json({ error: 'Password is too long' }, 400)

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
    if (error) return json({ error: error.message }, 400)

    return json({ success: true, message: 'Password reset successfully' })
  } catch (error) {
    console.error('reset-password error:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
