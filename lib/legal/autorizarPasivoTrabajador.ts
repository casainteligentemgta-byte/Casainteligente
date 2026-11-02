import type { SupabaseClient } from '@supabase/supabase-js';
import { listarRolesEmpresaUsuario } from '@/lib/auth/ciUsuariosRolesDb';

/** Mismos roles globales que las políticas 374 / ci_proyectos. */
const ROLES_PASIVO_GLOBAL = new Set(['super_admin', 'admin', 'administrador']);

/** Roles acotados a la entidad del trabajador (migración 374). */
const ROLES_PASIVO_ENTIDAD = new Set(['entidad_admin', 'director', 'rrhh']);

export type RolEntidadPasivo = {
  rol: string;
  entidad_id?: string | null;
};

export function normalizarRolPasivo(rol: string): string {
  return rol.trim().toLowerCase().replace(/\s+/g, '_');
}

export function rolPasivoEsGlobal(rol: string): boolean {
  return ROLES_PASIVO_GLOBAL.has(normalizarRolPasivo(rol));
}

export function rolPasivoEsDeEntidad(rol: string): boolean {
  return ROLES_PASIVO_ENTIDAD.has(normalizarRolPasivo(rol));
}

/** Decisión pura: ¿estos roles de empresa cubren el trabajador de esa entidad? */
export function puedeCalcularPasivoConRoles(
  roles: RolEntidadPasivo[],
  workerEntidadId: string | null,
): boolean {
  if (roles.some((r) => rolPasivoEsGlobal(r.rol))) return true;
  const entidad = (workerEntidadId ?? '').trim();
  if (!entidad) return false;
  return roles.some(
    (r) => rolPasivoEsDeEntidad(r.rol) && (r.entidad_id ?? '').trim() === entidad,
  );
}

export type AutorizarPasivoOk = { ok: true };
export type AutorizarPasivoFail = {
  ok: false;
  status: 403 | 404;
  error: string;
};

/**
 * Comprueba rol + entidad antes de leer salarios.
 * Usa service_role solo para listar roles/trabajador; no devuelve datos salariales.
 */
export async function autorizarPasivoTrabajador(params: {
  userId: string;
  supabase: SupabaseClient;
  admin: SupabaseClient;
  workerId: string;
}): Promise<AutorizarPasivoOk | AutorizarPasivoFail> {
  const workerId = params.workerId.trim();
  if (!workerId) {
    return { ok: false, status: 404, error: 'Error: No se encontró el trabajador.' };
  }

  let roles = await listarRolesEmpresaUsuario(params.supabase, params.userId);
  if (roles.length === 0 && params.admin !== params.supabase) {
    roles = await listarRolesEmpresaUsuario(params.admin, params.userId);
  }

  const { data: worker, error } = await params.admin
    .from('ci_empleados')
    .select('id, entidad_id')
    .eq('id', workerId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 403, error: 'No autorizado para calcular el pasivo de este trabajador.' };
  }
  if (!worker?.id) {
    return { ok: false, status: 404, error: 'Error: No se encontró el trabajador.' };
  }

  const entidadId =
    worker.entidad_id != null && String(worker.entidad_id).trim()
      ? String(worker.entidad_id).trim()
      : null;

  if (!puedeCalcularPasivoConRoles(roles, entidadId)) {
    return {
      ok: false,
      status: 403,
      error: 'No autorizado para calcular el pasivo de este trabajador.',
    };
  }

  return { ok: true };
}
