// supabase/functions/reset-password/index.ts
// Reset a user's password. Admin-only.

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller is admin
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== ADMIN_ID) {
      return new Response(JSON.stringify({ error: 'Unauthorized - admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { user_id, new_password } = await req.json()
    if (!user_id || !new_password) {
      throw new Error('Missing user_id or new_password')
    }
    if (new_password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    // Use admin client to reset password
    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { error } = await admin.auth.admin.updateUserById(user_id, {
      password: new_password,
    })

    if (error) throw error

    return new Response(JSON.stringify({ success: true, message: 'Password reset successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
