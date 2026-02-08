import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente de Supabase para uso en componentes del cliente (Browser).
 * Usa las variables NEXT_PUBLIC_ para que estén disponibles en el frontend.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local'
    );
  }

  return createBrowserClient(url, key);
}
