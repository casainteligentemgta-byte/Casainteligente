import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseServiceRoleKey } from '@/lib/supabase/resolveServiceRoleKey';
import { supabaseFetch } from '@/lib/supabase/supabaseFetch';

export type TelegramSupabaseAdminResult =
  | { ok: true; client: SupabaseClient }
  | { ok: false };

/** Cliente Supabase con service role para el bot de Telegram (solo servidor). */
export function telegramSupabaseAdmin(): TelegramSupabaseAdminResult {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
  const key = resolveSupabaseServiceRoleKey();
  if (!url || !key) return { ok: false };

  const client = createClient(url, key, {
    global: {
      fetch: (input, init) => supabaseFetch(input, { ...init, cache: 'no-store' }),
    },
  });
  return { ok: true, client };
}
