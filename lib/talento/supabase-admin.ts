import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { resolveSupabaseServiceRoleKey } from '@/lib/supabase/resolveServiceRoleKey';
import { supabaseFetch } from '@/lib/supabase/supabaseFetch';

/** Evita que Next.js cachee respuestas vacías de PostgREST (p. ej. facturas canal). */
function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return supabaseFetch(input, { ...init, cache: 'no-store' });
}

/** Cliente Supabase con service role (solo rutas servidor; nunca en el bundle del cliente). */
export function supabaseAdminForRoute():
  | { ok: true; client: ReturnType<typeof createClient> }
  | { ok: false; response: NextResponse } {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
  const key = resolveSupabaseServiceRoleKey();
  if (!url || !key) {
    const hint = !url
      ? 'Falta NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL). Añádela en Vercel → Environment Variables y vuelve a desplegar.'
      : [
          'En Vercel: Settings → Environment Variables del proyecto casainteligente.',
          'Añade SUPABASE_SERVICE_ROLE_KEY con el valor «service_role» de Supabase (Project Settings → API; clave secreta larga que empieza por eyJ…).',
          'Si usas la integración Vercel–Supabase, puede llamarse SUPABASE_SECRET_KEY; el código acepta ambas (y SUPABASE_SERVICE_KEY).',
          'Marca el entorno Production (no solo Preview/Development), guarda y Redeploy del último deployment.',
          'No uses la clave anon (publishable).',
        ].join(' ');
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            'Falta la configuración de Supabase en el servidor (URL o clave service_role). Revisa las variables de entorno y vuelve a desplegar.',
          hint,
          code: 'SUPABASE_ADMIN_CONFIG',
        },
        { status: 503 },
      ),
    };
  }
  return {
    ok: true,
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: adminFetch },
    }),
  };
}
