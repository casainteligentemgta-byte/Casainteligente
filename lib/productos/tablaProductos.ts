/**
 * Lectura del catálogo: la vista enmascara `costo` / `utilidad` / `margen_pct`
 * si el usuario no tiene el permiso `productos.costos`. Escrituras van a la tabla.
 */
export const TABLA_PRODUCTOS = 'products'
export const VISTA_PRODUCTOS_LECTURA = 'products_lectura'

/** La vista aún no existe (migración 389 no aplicada) o PostgREST no la cacheó. */
export function esErrorVistaProductos(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  const msg = String(error.message ?? '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /products_lectura/.test(msg) ||
    /does not exist/.test(msg) ||
    /could not find the table/.test(msg) ||
    /schema cache/.test(msg)
  )
}
