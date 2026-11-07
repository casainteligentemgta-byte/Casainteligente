/**
 * Nombre visible de una entidad. Las entidades enlazadas a un cliente (cliente_administrada)
 * no guardan el nombre: se toma de customers.nombre.
 */
export type EntidadConNombre = {
  nombre?: string | null;
  customer_id?: string | null;
  customers?: { nombre?: string | null } | { nombre?: string | null }[] | null;
  /** Otras columnas de ci_entidades que cada consulta añade (id, rif, etc.). */
  [columna: string]: any;
};

/**
 * Embed de `customers.nombre` vía `ci_entidades.customer_id`.
 * Hay dos FKs entre las tablas (`ci_entidades_customer_id_fkey` y
 * `customers_entidad_id_fkey`); sin el hint PostgREST falla con
 * "more than one relationship was found for ci_entidades and customers".
 */
export const SELECT_CUSTOMERS_NOMBRE_DESDE_ENTIDAD =
  'customers!ci_entidades_customer_id_fkey(nombre)';

/** Columnas para un select de ci_entidades que necesita el nombre. */
export const SELECT_NOMBRE_ENTIDAD = `id, nombre, customer_id, ${SELECT_CUSTOMERS_NOMBRE_DESDE_ENTIDAD}`;

/**
 * Hint de la migración 063 solo si Postgres dice que la relación no existe.
 * No se añade ante "more than one relationship" (FKs ambiguas).
 */
export function hintMigracion063Entidades(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('does not exist') && /\brelation\b/.test(m)) {
    return ' — Ejecuta migración 063 (ci_entidades).';
  }
  return '';
}

export function nombreEntidad(entidad: EntidadConNombre | null | undefined, fallback = 'Entidad'): string {
  if (!entidad) return fallback;
  const c = entidad.customers;
  const cliente = Array.isArray(c) ? c[0]?.nombre : c?.nombre;
  const nombre = String(cliente ?? entidad.nombre ?? '').trim();
  return nombre || fallback;
}

/**
 * Nombre de una entidad embebida en otra consulta (`ci_entidades(...)`), que PostgREST
 * devuelve como objeto o como arreglo. Requiere haber pedido `customer_id, customers!ci_entidades_customer_id_fkey(nombre)`.
 */
export function nombreEntidadDeRelacion(
  rel: EntidadConNombre | EntidadConNombre[] | null | undefined,
  fallback = '',
): string {
  const ent = Array.isArray(rel) ? rel[0] : rel;
  return ent ? nombreEntidad(ent, fallback) : fallback;
}

/**
 * Aplica el nombre resuelto a cada fila y ordena por nombre.
 * Úsalo después de un select que incluya SELECT_NOMBRE_ENTIDAD.
 */
export function conNombreEntidad<T extends EntidadConNombre>(
  rows: T[] | null | undefined,
  fallback = 'Entidad',
): Array<T & { nombre: string }> {
  return (rows ?? [])
    .map((r) => ({ ...r, nombre: nombreEntidad(r, fallback) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Aplica el nombre resuelto a una sola fila (maybeSingle). */
export function conNombreFila<T extends EntidadConNombre>(row: T | null | undefined): (T & { nombre: string }) | null {
  if (!row) return null;
  return { ...row, nombre: nombreEntidad(row) };
}
