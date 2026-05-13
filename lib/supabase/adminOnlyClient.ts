import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseServiceRoleKey } from '@/lib/supabase/resolveServiceRoleKey';
import { supabaseFetch } from '@/lib/supabase/supabaseFetch';

/**
 * Cliente Supabase con `service_role` (solo servidor).
 * Usar en RSC/rutas donde el listado debe coincidir con escrituras hechas con el mismo rol (p. ej. contratos express).
 */
export function createSupabaseAdminOnlyClient(): SupabaseClient | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
  const key = resolveSupabaseServiceRoleKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch },
  });
}
