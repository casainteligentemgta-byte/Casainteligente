import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import type { PerfilCampo, ProyectoIngenieroAsignacion } from '@/types/campo';

const TOKEN_TTL_HOURS = 48;

export function mapPerfilRow(row: Record<string, unknown>): PerfilCampo {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    email: row.email != null ? String(row.email) : null,
    telegram_chat_id:
      row.telegram_chat_id != null ? Number(row.telegram_chat_id) : null,
    telegram_username:
      row.telegram_username != null ? String(row.telegram_username) : null,
    activo: row.activo !== false,
  };
}

export async function listarPerfilesActivos(
  supabase: SupabaseClient,
): Promise<PerfilCampo[]> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, email, telegram_chat_id, telegram_username, activo')
    .eq('activo', true)
    .order('nombre');
  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapPerfilRow(r as Record<string, unknown>));
}

export async function obtenerIngenieroProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<PerfilCampo | null> {
  const { data, error } = await supabase
    .from('proyecto_ingenieros')
    .select(
      'id, perfil:perfiles(id, nombre, email, telegram_chat_id, telegram_username, activo)',
    )
    .eq('proyecto_id', proyectoId)
    .eq('rol', 'ingeniero_residente')
    .limit(1)
    .maybeSingle();
  if (error?.code === '42P01') return null;
  if (error) throw new Error(error.message);
  const perfilRaw = data?.perfil;
  const perfil = Array.isArray(perfilRaw) ? perfilRaw[0] : perfilRaw;
  if (!perfil) return null;
  return mapPerfilRow(perfil as Record<string, unknown>);
}

export async function asignarIngenieroProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  perfilId: string | null,
): Promise<void> {
  await supabase
    .from('proyecto_ingenieros')
    .delete()
    .eq('proyecto_id', proyectoId)
    .eq('rol', 'ingeniero_residente');

  if (!perfilId) return;

  const { error } = await supabase.from('proyecto_ingenieros').insert({
    proyecto_id: proyectoId,
    perfil_id: perfilId,
    rol: 'ingeniero_residente',
  });
  if (error) throw new Error(error.message);
}

export async function crearPerfilSiNoExiste(
  supabase: SupabaseClient,
  input: { nombre: string; email?: string },
): Promise<PerfilCampo> {
  const email = input.email?.trim() || null;
  if (email) {
    const { data: existing } = await supabase
      .from('perfiles')
      .select('id, nombre, email, telegram_chat_id, telegram_username, activo')
      .eq('email', email)
      .maybeSingle();
    if (existing) return mapPerfilRow(existing as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('perfiles')
    .insert({
      nombre: input.nombre.trim(),
      email,
    })
    .select('id, nombre, email, telegram_chat_id, telegram_username, activo')
    .single();
  if (error) throw new Error(error.message);
  return mapPerfilRow(data as Record<string, unknown>);
}

export function generarTokenVinculo(): string {
  return randomBytes(16).toString('hex');
}

export async function crearTokenVinculoTelegram(
  supabase: SupabaseClient,
  perfilId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = generarTokenVinculo();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000).toISOString();
  const { error } = await supabase.from('telegram_vinculo_tokens').insert({
    token,
    perfil_id: perfilId,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

export function buildTelegramDeepLink(botUsername: string, token: string): string {
  const user = botUsername.replace(/^@/, '');
  return `https://t.me/${user}?start=${token}`;
}

export function getTelegramBotUsername(): string | null {
  const u = process.env.TELEGRAM_BOT_USERNAME?.trim();
  return u ? u.replace(/^@/, '') : null;
}

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

export async function perfilPorTelegramChatId(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<PerfilCampo | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, email, telegram_chat_id, telegram_username, activo')
    .eq('telegram_chat_id', Number(chatId))
    .maybeSingle();
  if (error?.code === '42P01') return null;
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapPerfilRow(data as Record<string, unknown>);
}

export async function proyectosActivosConIngeniero(
  supabase: SupabaseClient,
): Promise<
  Array<{
    proyecto_id: string;
    proyecto_nombre: string;
    perfil: PerfilCampo;
    asignacion: ProyectoIngenieroAsignacion;
  }>
> {
  const { data, error } = await supabase
    .from('proyecto_ingenieros')
    .select(
      'id, proyecto_id, perfil_id, rol, proyecto:ci_proyectos(id, nombre), perfil:perfiles(id, nombre, email, telegram_chat_id, telegram_username, activo)',
    )
    .eq('rol', 'ingeniero_residente');
  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  const out: Array<{
    proyecto_id: string;
    proyecto_nombre: string;
    perfil: PerfilCampo;
    asignacion: ProyectoIngenieroAsignacion;
  }> = [];

  for (const row of data ?? []) {
    const perfilRaw = row.perfil;
    const perfil = Array.isArray(perfilRaw) ? perfilRaw[0] : perfilRaw;
    if (!perfil?.telegram_chat_id) continue;
    const proyRaw = row.proyecto;
    const proy = Array.isArray(proyRaw) ? proyRaw[0] : proyRaw;
    out.push({
      proyecto_id: String(row.proyecto_id),
      proyecto_nombre: String(proy?.nombre ?? 'Obra'),
      perfil: mapPerfilRow(perfil as Record<string, unknown>),
      asignacion: {
        id: String(row.id),
        proyecto_id: String(row.proyecto_id),
        perfil_id: String(row.perfil_id),
        rol: String(row.rol),
      },
    });
  }
  return out;
}
