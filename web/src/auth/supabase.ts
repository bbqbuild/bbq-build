import { createClient } from '@supabase/supabase-js'

// Publishable key is safe to embed in the client. Overridable at build via Vite env.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://twakzbszusbinfewvzqr.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zYR0SqULJ6kUvj4MavDjsw_spsemxj5'

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
