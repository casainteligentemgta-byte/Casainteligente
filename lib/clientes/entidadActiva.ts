import type { FilaRolUsuario } from '@/lib/auth/ciUsuariosRolesDb';
import { normalizarRolEmpresa } from '@/lib/auth/permisosCatalogo';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(id: string | null | undefined): boolean {
  return UUID_RE.test(String(id ?? '').trim());
}

/** Admin global (super_admin / admin): ve clientes de cualquier entidad, también los NULL. */
export function esAdminGlobalRoles(roles: readonly string[]): boolean {
  return roles.some((r) => {
    const k = String(r ?? '').trim().toLowerCase();
    if (k === 'super_admin') return true;
    return normalizarRolEmpresa(k) === 'admin';
  });
}

/**
 * Entidad activa: la del rol más reciente con UUID. Si hay varias, la primera
 * de la lista (ya viene ordenada por created_at desc en listarRolesEmpresaUsuario).
 */
export function entidadActivaDesdeRoles(roles: readonly FilaRolUsuario[]): string | null {
  for (const r of roles) {
    const id = String(r.entidad_id ?? '').trim();
    if (esUuid(id)) return id;
  }
  return null;
}
