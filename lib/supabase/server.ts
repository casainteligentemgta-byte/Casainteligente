import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseFetch } from '@/lib/supabase/supabaseFetch';

/**
 * Cliente Supabase en servidor (RSC, Server Actions, Route Handlers).
 * Usa `await cookies()` para compatibilidad con Next.js 15 (cookies async).
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local (Supabase → Project Settings → API).',
    );
  }
  try {
    new URL(url);
  } catch {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL no es una URL válida. Revísala en .env.local (Supabase → Project Settings → API).',
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    global: { fetch: supabaseFetch },
    cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            /* RSC / rutas donde set no aplica */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            /* idem */
          }
        },
      },
    });
}
