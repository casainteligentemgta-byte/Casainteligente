import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/** Cliente Supabase con service role (solo rutas servidor; nunca en el bundle del cliente). */
export function supabaseAdminForRoute():
  | { ok: true; client: ReturnType<typeof createClient> }
  | { ok: false; response: NextResponse } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'config',
          hint: 'SUPABASE_SERVICE_ROLE_KEY es requerida para esta operación.',
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
