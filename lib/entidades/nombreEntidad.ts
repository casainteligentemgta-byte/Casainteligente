/**
 * Nombre visible de una entidad. Las entidades enlazadas a un cliente (cliente_administrada)
 * no guardan el nombre: se toma de customers.nombre.
 */
export type EntidadConNombre = {
  nombre?: string | null;
  customer_id?: string | null;
  customers?: { nombre?: string | null } | { nombre?: string | null }[] | null;
};

/** Columnas para un select de ci_entidades que necesita el nombre. */
export const SELECT_NOMBRE_ENTIDAD = 'id, nombre, customer_id, customers(nombre)';

export function nombreEntidad(entidad: EntidadConNombre | null | undefined, fallback = 'Entidad'): string {
  if (!entidad) return fallback;
  const c = entidad.customers;
  const cliente = Array.isArray(c) ? c[0]?.nombre : c?.nombre;
  const nombre = String(cliente ?? entidad.nombre ?? '').trim();
  return nombre || fallback;
}
