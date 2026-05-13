import { createBrowserClient } from '@supabase/ssr';
import { supabaseFetch } from '@/lib/supabase/supabaseFetch';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Añádelos en .env.local (Supabase → Project Settings → API) y reinicia npm run dev.',
    );
  }
  try {
    // Valida forma de URL antes de que falle un fetch opaco.
    new URL(url);
  } catch {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL no es una URL válida. Cópiala tal cual desde Supabase → Project Settings → API (https://….supabase.co, sin comillas).',
    );
  }
  return createBrowserClient(url, key, {
    global: { fetch: supabaseFetch },
  });
}
