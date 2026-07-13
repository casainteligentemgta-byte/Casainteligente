import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Cliente con service role (solo rutas servidor). Nunca exponer al browser. */
export function createAdminClient(): SupabaseClient | null {
    const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim() ||
        ''
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
        process.env.SUPABASE_SECRET_KEY?.trim() ||
        process.env.SUPABASE_SERVICE_KEY?.trim() ||
        ''

    if (!url || !key) return null

    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
}
