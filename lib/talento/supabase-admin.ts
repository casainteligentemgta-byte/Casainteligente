import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/** Cliente Supabase con service role (solo rutas servidor; nunca en el bundle del cliente). */
export function supabaseAdminForRoute():
  | { ok: true; client: ReturnType<typeof createClient> }
  | { ok: false; response: NextResponse } {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    '';
  if (!url || !key) {
    const hint = !url
      ? 'Falta NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL). Añádela en Vercel → Environment Variables y vuelve a desplegar.'
      : 'Falta clave de servicio en el servidor: SUPABASE_SERVICE_ROLE_KEY (Supabase → API → service_role) o SUPABASE_SECRET_KEY (integración Vercel–Supabase). Vercel → Environment Variables → Production, luego redeploy. No uses la anon key.';
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'config',
          hint,
        },
        { status: 503 },
      ),
    };
  }
  return {
    ok: true,
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}
