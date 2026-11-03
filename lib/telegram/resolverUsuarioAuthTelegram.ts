import type { SupabaseClient } from '@supabase/supabase-js';

async function authUserIdPorEmail(
  supabase: SupabaseClient,
  email: string | null | undefined,
): Promise<string | null> {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e || !e.includes('@')) return null;
  const { data } = await supabase
    .from('employees')
    .select('auth_user_id')
    .ilike('email', e)
    .not('auth_user_id', 'is', null)
    .limit(1)
    .maybeSingle();
  const id = String((data as { auth_user_id?: string | null } | null)?.auth_user_id ?? '').trim();
  return id || null;
}

/**
 * Mapea el chat de Telegram a auth.users cuando hay vínculo (employees.auth_user_id).
 * Si no hay mapping, el RPC recibe p_usuario_id null (registrado_por queda vacío).
 */
export async function resolverUsuarioAuthDesdeTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<string | null> {
  const chat = String(chatId ?? '').trim();
  if (!chat) return null;
  const chatNum = Number(chat);
  const chatFiltro = Number.isFinite(chatNum) ? chatNum : chat;

  try {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('email')
      .eq('telegram_chat_id', chatFiltro)
      .maybeSingle();
    const fromPerfil = await authUserIdPorEmail(
      supabase,
      (perfil as { email?: string | null } | null)?.email,
    );
    if (fromPerfil) return fromPerfil;
  } catch {
    /* perfiles puede no estar o no tener la columna */
  }

  try {
    const { data: emp } = await supabase
      .from('ci_empleados')
      .select('email')
      .eq('telegram_chat_id', chatFiltro)
      .maybeSingle();
    const fromEmp = await authUserIdPorEmail(
      supabase,
      (emp as { email?: string | null } | null)?.email,
    );
    if (fromEmp) return fromEmp;
  } catch {
    /* ci_empleados.email opcional */
  }

  try {
    const { data: nom } = await supabase
      .from('ci_proyecto_nomina')
      .select('email')
      .eq('telegram_chat_id', chatFiltro)
      .not('email', 'is', null)
      .limit(1)
      .maybeSingle();
    const fromNom = await authUserIdPorEmail(
      supabase,
      (nom as { email?: string | null } | null)?.email,
    );
    if (fromNom) return fromNom;
  } catch {
    /* nómina sin fila */
  }

  return null;
}
