import type { SupabaseClient } from '@supabase/supabase-js';

/** Utilidades Telegram compartidas; vinculación legacy vía tabla `perfiles`. */

export function buildTelegramDeepLink(botUsername: string, token: string): string {
  const user = botUsername.replace(/^@/, '');
  return `https://t.me/${user}?start=${token}`;
}

export function getTelegramBotUsername(): string | null {
  const u = process.env.TELEGRAM_BOT_USERNAME?.trim();
  return u ? u.replace(/^@/, '') : null;
}

/** Fallback si el token apunta a `perfil_id` (migración 177) en lugar de `empleado_id`. */
export async function vincularTelegramConToken(
  supabase: SupabaseClient,
  token: string,
  chatId: number,
  username?: string,
): Promise<{ ok: boolean; nombre?: string; error?: string }> {
  const { data: row, error } = await supabase
    .from('telegram_vinculo_tokens')
    .select('token, perfil_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: 'Token inválido o expirado.' };
  if (row.used_at) return { ok: false, error: 'Este enlace ya fue utilizado.' };
  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    return { ok: false, error: 'El enlace de sincronización expiró.' };
  }

  const perfilId = String(row.perfil_id);
  const { data: perfil, error: pErr } = await supabase
    .from('perfiles')
    .update({
      telegram_chat_id: chatId,
      telegram_username: username ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', perfilId)
    .select('nombre')
    .single();
  if (pErr) return { ok: false, error: pErr.message };

  await supabase
    .from('telegram_vinculo_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token);

  return { ok: true, nombre: String(perfil?.nombre ?? '') };
}
