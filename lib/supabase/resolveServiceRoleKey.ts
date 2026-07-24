/**
 * Clave con privilegios de servicio para el cliente admin de Supabase (bypass RLS).
 * No usar la anon key aquí.
 */
export function resolveSupabaseServiceRoleKey(): string {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_KEY,
  ];
  for (const c of candidates) {
    const t = (c ?? '').trim();
    if (t) return t;
  }
  return '';
}
