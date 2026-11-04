import type { Permiso } from '@/lib/auth/permisosCatalogo';

/** Lectura de stock, movimientos y trazabilidad. */
export const PERMISOS_ALMACEN_VER: readonly Permiso[] = [
  'almacen.ingreso',
  'almacen.despacho',
  'almacen.cuarentena',
  'procura.usar_almacen',
];

/** Ajuste de stock o baja de material. */
export const PERMISOS_ALMACEN_EDITAR: readonly Permiso[] = [
  'almacen.ingreso',
  'almacen.cuarentena',
];
