/**
 * Clave con privilegios de servicio para el cliente admin de Supabase (bypass RLS).
 * No usar la anon key aquí.
 *
 * Orden: primero SUPABASE_SECRET_KEY (la llave secreta nueva, `sb_secret_…`, que se puede
 * revocar sin tocar nada más) y después SUPABASE_SERVICE_ROLE_KEY (la llave antigua). Así
 * el cambio de llave consiste en añadir una variable, y deshacerlo, en quitarla.
 */
export function resolveSupabaseServiceRoleKey(): string {
  const candidates = [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY,
  ];
  for (const c of candidates) {
    const t = (c ?? '').trim();
    if (t) return t;
  }
  return '';
}

export type TipoLlaveSupabase = 'nueva' | 'antigua' | 'ausente';

/** Qué clase de llave es, sin revelar nada de su valor (para diagnóstico). */
export function tipoLlaveSupabase(llave: string | null | undefined): TipoLlaveSupabase {
  const t = (llave ?? '').trim();
  if (!t) return 'ausente';
  return t.startsWith('sb_') ? 'nueva' : 'antigua';
}
