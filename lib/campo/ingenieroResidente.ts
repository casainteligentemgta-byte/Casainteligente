import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

export type IngenieroResidenteRow = {
  id: string;
  nombre: string;
  cargo: string | null;
  cedula: string | null;
  celular: string | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
};

function mapEmpleado(row: Record<string, unknown>): IngenieroResidenteRow {
  const nombre =
    String(row.nombre_completo ?? '').trim() ||
    [row.nombres, row.primer_apellido, row.segundo_apellido]
      .filter(Boolean)
      .map(String)
      .join(' ')
      .trim() ||
    'Sin nombre';
  return {
    id: String(row.id),
    nombre,
    cargo: row.cargo_nombre != null ? String(row.cargo_nombre) : null,
    cedula: row.cedula != null ? String(row.cedula) : row.documento != null ? String(row.documento) : null,
    celular: row.celular != null ? String(row.celular) : row.telefono != null ? String(row.telefono) : null,
    telegram_chat_id:
      row.telegram_chat_id != null ? Number(row.telegram_chat_id) : null,
    telegram_username:
      row.telegram_username != null ? String(row.telegram_username) : null,
  };
}

const SELECT_EMPLEADO =
  'id, nombre_completo, nombres, primer_apellido, segundo_apellido, cedula, documento, celular, telefono, cargo_nombre, telegram_chat_id, telegram_username';

export async function obtenerIngenieroResidenteProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<IngenieroResidenteRow | null> {
  const { data: proy, error } = await supabase
    .from('ci_proyectos')
    .select('ingeniero_residente_id')
    .eq('id', proyectoId)
    .maybeSingle();

  if (error?.code === '42P01' || /ingeniero_residente/i.test(error?.message ?? '')) {
    return null;
  }
  if (error) throw new Error(error.message);

  const eid = proy?.ingeniero_residente_id;
  if (!eid) return null;
  const { data: emp } = await supabase
    .from('ci_empleados')
    .select(SELECT_EMPLEADO)
    .eq('id', eid)
    .maybeSingle();
  return emp ? mapEmpleado(emp as Record<string, unknown>) : null;
}

/** Personal del proyecto: proyecto_modulo_id o asignaciones labor_requests. */
export async function listarEmpleadosElegiblesObra(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<IngenieroResidenteRow[]> {
  const byId = new Map<string, IngenieroResidenteRow>();

  const { data: directos } = await supabase
    .from('ci_empleados')
    .select(SELECT_EMPLEADO)
    .eq('proyecto_modulo_id', proyectoId)
    .order('nombre_completo');
  for (const row of directos ?? []) {
    const m = mapEmpleado(row as Record<string, unknown>);
    byId.set(m.id, m);
  }

  const { data: asignaciones } = await supabase
    .from('project_assignments')
    .select(`worker:ci_empleados(${SELECT_EMPLEADO})`)
    .eq('project_id', proyectoId);
  for (const row of asignaciones ?? []) {
    const w = Array.isArray(row.worker) ? row.worker[0] : row.worker;
    if (!w) continue;
    const m = mapEmpleado(w as Record<string, unknown>);
    byId.set(m.id, m);
  }

  return Array.from(byId.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function asignarIngenieroResidenteProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  empleadoId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('ci_proyectos')
    .update({
      ingeniero_residente_id: empleadoId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proyectoId);
  if (error) throw new Error(error.message);
}

export function generarTokenVinculo(): string {
  return randomBytes(16).toString('hex');
}

export async function crearTokenVinculoTelegramEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = generarTokenVinculo();
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const { error } = await supabase.from('telegram_vinculo_tokens').insert({
    token,
    empleado_id: empleadoId,
    perfil_id: null,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

export async function vincularTelegramEmpleadoConToken(
  supabase: SupabaseClient,
  token: string,
  chatId: number,
  username?: string,
): Promise<{ ok: boolean; nombre?: string; error?: string }> {
  const { data: row, error } = await supabase
    .from('telegram_vinculo_tokens')
    .select('token, empleado_id, perfil_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: 'Token inválido o expirado.' };
  if (row.used_at) return { ok: false, error: 'Este enlace ya fue utilizado.' };
  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    return { ok: false, error: 'El enlace de sincronización expiró.' };
  }

  const empleadoId = row.empleado_id ?? null;
  const perfilId = row.perfil_id ?? null;

  if (empleadoId) {
    const { data: emp, error: eErr } = await supabase
      .from('ci_empleados')
      .update({
        telegram_chat_id: chatId,
        telegram_username: username ?? null,
      })
      .eq('id', empleadoId)
      .select('nombre_completo, nombres, primer_apellido')
      .single();
    if (eErr) return { ok: false, error: eErr.message };
    await supabase
      .from('telegram_vinculo_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);
    const nombre =
      String(emp?.nombre_completo ?? '').trim() ||
      [emp?.nombres, emp?.primer_apellido].filter(Boolean).join(' ');
    return { ok: true, nombre: nombre || 'Ingeniero' };
  }

  if (perfilId) {
    const { vincularTelegramConToken } = await import('@/lib/campo/perfilesCampo');
    return vincularTelegramConToken(supabase, token, chatId, username);
  }

  return { ok: false, error: 'Token sin empleado asociado.' };
}

export async function empleadoPorTelegramChatId(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<IngenieroResidenteRow | null> {
  const { data, error } = await supabase
    .from('ci_empleados')
    .select(SELECT_EMPLEADO)
    .eq('telegram_chat_id', Number(chatId))
    .maybeSingle();
  if (error?.code === '42P01' || /telegram_chat_id|column/i.test(error?.message ?? '')) {
    return null;
  }
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapEmpleado(data as Record<string, unknown>);
}

export async function proyectosActivosConIngenieroResidente(
  supabase: SupabaseClient,
): Promise<
  Array<{
    proyecto_id: string;
    proyecto_nombre: string;
    ingeniero: IngenieroResidenteRow;
  }>
> {
  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id, nombre, codigo_lulo, ingeniero_residente_id')
    .not('ingeniero_residente_id', 'is', null);
  if (error?.code === '42P01' || /ingeniero_residente/i.test(error?.message ?? '')) {
    return [];
  }
  if (error) throw new Error(error.message);

  const out: Array<{
    proyecto_id: string;
    proyecto_nombre: string;
    ingeniero: IngenieroResidenteRow;
  }> = [];

  for (const row of data ?? []) {
    const eid = row.ingeniero_residente_id;
    if (!eid) continue;
    const { data: emp } = await supabase
      .from('ci_empleados')
      .select(SELECT_EMPLEADO)
      .eq('id', eid)
      .maybeSingle();
    if (!emp) continue;
    const ingeniero = mapEmpleado(emp as Record<string, unknown>);
    if (!ingeniero.telegram_chat_id) continue;
    out.push({
      proyecto_id: String(row.id),
      proyecto_nombre: String(row.nombre ?? 'Obra'),
      ingeniero,
    });
  }
  return out;
}
