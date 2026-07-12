import type { SupabaseClient } from '@supabase/supabase-js';

export type FilaRolUsuario = {
  id?: string;
  rol: string;
  entidad_id: string;
  user_id?: string;
  usuario_id?: string;
  created_at?: string;
  updated_at?: string;
};

function esErrorColumnaInexistente(message: string | undefined, columna: string): boolean {
  const m = (message ?? '').toLowerCase();
  return m.includes('could not find') && m.includes(columna.toLowerCase());
}

/** Producción usa `user_id` + enum; migración 139 usa `usuario_id` + texto libre. */
export async function listarRolesEmpresaUsuario(
  supabase: SupabaseClient,
  userId: string,
): Promise<FilaRolUsuario[]> {
  const byUserId = await supabase
    .from('ci_usuarios_roles')
    .select('id, rol, entidad_id, created_at')
    .eq('user_id', userId);
  if (!byUserId.error) return (byUserId.data ?? []) as FilaRolUsuario[];

  if (!esErrorColumnaInexistente(byUserId.error.message, 'user_id')) {
    return [];
  }

  const byUsuarioId = await supabase
    .from('ci_usuarios_roles')
    .select('id, rol, entidad_id, created_at, updated_at')
    .eq('usuario_id', userId);
  if (byUsuarioId.error) return [];
  return (byUsuarioId.data ?? []) as FilaRolUsuario[];
}

/** Mapea rol de UI al valor aceptado por BD legacy (enum). */
export function rolEmpresaParaBd(rol: string): string {
  const k = rol.trim().toLowerCase();
  if (k === 'admin' || k === 'administrador') return 'super_admin';
  return rol.trim();
}

export async function upsertRolEmpresaUsuario(
  supabase: SupabaseClient,
  input: { userId: string; rol: string; entidadId: string },
): Promise<{ data: FilaRolUsuario | null; error: string | null }> {
  const rolBd = rolEmpresaParaBd(input.rol);
  const now = new Date().toISOString();

  const legacyRow = {
    user_id: input.userId,
    rol: rolBd,
    entidad_id: input.entidadId,
  };
  const legacy = await supabase
    .from('ci_usuarios_roles')
    .upsert(legacyRow, { onConflict: 'user_id,entidad_id' })
    .select('id, user_id, rol, entidad_id, created_at')
    .single();
  if (!legacy.error) {
    return { data: legacy.data as FilaRolUsuario, error: null };
  }
  if (!esErrorColumnaInexistente(legacy.error.message, 'user_id')) {
    return { data: null, error: legacy.error.message };
  }

  const modernRow = {
    usuario_id: input.userId,
    rol: input.rol.trim(),
    entidad_id: input.entidadId,
    updated_at: now,
  };
  const modern = await supabase
    .from('ci_usuarios_roles')
    .upsert(modernRow, { onConflict: 'usuario_id,entidad_id' })
    .select('id, usuario_id, rol, entidad_id, created_at, updated_at')
    .single();
  if (modern.error) return { data: null, error: modern.error.message };
  return { data: modern.data as FilaRolUsuario, error: null };
}
