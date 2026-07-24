import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/** Cliente Supabase para Route Handlers; evita lanzar y provocar 500 genérico si faltan env. */
export function supabaseForRoute():
  | { ok: true; client: ReturnType<typeof createClient> }
  | { ok: false; response: NextResponse } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'config', hint: 'Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local' },
        { status: 503 },
      ),
    };
  }
  return { ok: true, client: createClient(url, key) };
}
