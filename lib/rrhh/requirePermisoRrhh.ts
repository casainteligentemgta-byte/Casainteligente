import type { Permiso } from '@/lib/auth/permisosCatalogo';
import {
  requireAlgunPermisoWeb,
  type RequirePermisoFail,
  type RequirePermisoOk,
} from '@/lib/auth/requirePermisoRoute';

/** Operación de obra (express, solicitud, formalizar). Dirección también puede. */
export const RRHH_PERMISOS_OBRA: Permiso[] = [
  'rrhh.obra',
  'rrhh.entidad',
  'equipo.gestionar',
];

/** Operación de Dirección (nómina, liquidaciones, tabulador). */
export const RRHH_PERMISOS_ENTIDAD: Permiso[] = ['rrhh.entidad', 'equipo.gestionar'];

/** Lectura / PDF compartido. */
export const RRHH_PERMISOS_ANY: Permiso[] = [
  'rrhh.obra',
  'rrhh.entidad',
  'equipo.gestionar',
];

export function requirePermisoRrhhObra(ctx?: {
  proyectoId?: string | null;
  entidadId?: string | null;
}): Promise<RequirePermisoOk | RequirePermisoFail> {
  return requireAlgunPermisoWeb(RRHH_PERMISOS_OBRA, ctx);
}

export function requirePermisoRrhhEntidad(ctx?: {
  proyectoId?: string | null;
  entidadId?: string | null;
}): Promise<RequirePermisoOk | RequirePermisoFail> {
  return requireAlgunPermisoWeb(RRHH_PERMISOS_ENTIDAD, ctx);
}

export function requirePermisoRrhhAny(ctx?: {
  proyectoId?: string | null;
  entidadId?: string | null;
}): Promise<RequirePermisoOk | RequirePermisoFail> {
  return requireAlgunPermisoWeb(RRHH_PERMISOS_ANY, ctx);
}
