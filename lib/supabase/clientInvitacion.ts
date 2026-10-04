import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseFetch } from '@/lib/supabase/supabaseFetch';

/**
 * Cliente anónimo para páginas públicas con enlace de invitación (/registro, /onboarding, /reclutamiento/onboarding).
 *
 * Envía la cabecera `x-invite-token`, que las políticas RLS de `ci_empleados` usan para permitir
 * leer o actualizar SOLO la fila cuyo `token_registro` (o `token` legado) coincide con el enlace.
 * Sin esa cabecera, un visitante anónimo no puede leer ni modificar empleados.
 *
 * No persiste sesión: no interfiere con la sesión del personal si está abierta en el mismo navegador.
 */
export function createClientConInvitacion(token: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: supabaseFetch,
      headers: { 'x-invite-token': String(token ?? '').trim() },
    },
  });
}
