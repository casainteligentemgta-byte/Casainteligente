/**
 * Margen del catálogo: precio de venta = costo × (1 + margen/100).
 *
 * El 20 % es el mismo número que NetVision (MARGEN_VENTAS_DEFECTO). Vive en el
 * producto (`margen_pct`) y, si falta, en la categoría (`margen_pct_defecto`).
 * El presupuesto usa el precio del catálogo como base; un extra encima es otra
 * palanca (unificada a 20 % con NetVision).
 */

export const MARGEN_CATALOGO_DEFECTO = 20

/** Alias: el presupuesto y NetVision usan el mismo 20 % por defecto. */
export const MARGEN_VENTAS_DEFECTO = MARGEN_CATALOGO_DEFECTO

export function redondearDinero(n: number): number {
  return Math.round(n * 100) / 100
}

/** Margen admitido (%), igual que el campo libre de /ventas. */
export function acotarMargenPct(valor: unknown, defecto = MARGEN_CATALOGO_DEFECTO): number {
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(n)) return defecto
  return Math.min(300, Math.max(0, Math.round(n * 100) / 100))
}

/** Precio de venta = costo × (1 + margen/100). */
export function precioVentaDesdeCosto(costo: number, margenPct = MARGEN_CATALOGO_DEFECTO): number {
  const c = Number(costo)
  if (!Number.isFinite(c) || c < 0) return 0
  return redondearDinero(c * (1 + acotarMargenPct(margenPct, 0) / 100))
}

/**
 * Margen sobre el costo: (precio / costo − 1) × 100.
 * Distinto del «margen sobre venta» (precio−costo)/precio que mostraba el formulario.
 */
export function margenPctDesdePrecios(
  costo: number | null | undefined,
  precio: number | null | undefined,
): number | null {
  const c = Number(costo)
  const p = Number(precio)
  if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(p) || p < 0) return null
  return Math.round((p / c - 1) * 10000) / 100
}

export function utilidadDesdePrecios(
  costo: number | null | undefined,
  precio: number | null | undefined,
): number | null {
  if (costo == null || precio == null) return null
  const c = Number(costo)
  const p = Number(precio)
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null
  return redondearDinero(p - c)
}

/**
 * Precio igual al costo (o sin precio de venta): el catálogo no deja ganancia.
 * Sin costo no se puede opinar.
 */
export function productoSinMargen(p: {
  costo?: number | null
  precio?: number | null
}): boolean {
  const c = Number(p.costo)
  if (!Number.isFinite(c) || c <= 0) return false
  const pr = Number(p.precio)
  if (!Number.isFinite(pr) || pr <= 0) return true
  return Math.abs(pr - c) < 0.005
}

export type OpcionesMargenCatalogo = {
  margenPctDefecto?: number
  /** Nombre de categoría → margen por defecto (el de `product_categories`). */
  margenPorCategoria?: Record<string, number>
}

function margenDeCategoria(
  categoria: string | null | undefined,
  porCategoria?: Record<string, number>,
): number | null {
  const cat = String(categoria ?? '').trim()
  if (!cat || !porCategoria) return null
  const exacto = porCategoria[cat]
  if (Number.isFinite(exacto)) return acotarMargenPct(exacto, 0)
  const clave = cat.toLowerCase()
  for (const [nombre, valor] of Object.entries(porCategoria)) {
    if (nombre.toLowerCase() === clave && Number.isFinite(valor)) return acotarMargenPct(valor, 0)
  }
  return null
}

/** Margen a usar: el del producto, si no el de su categoría, si no el 20 % del catálogo. */
export function margenEfectivoProducto(
  p: { margen_pct?: number | null; categoria?: string | null },
  opciones?: OpcionesMargenCatalogo,
): number {
  if (p.margen_pct != null && Number.isFinite(Number(p.margen_pct))) {
    return acotarMargenPct(p.margen_pct, 0)
  }
  const deCat = margenDeCategoria(p.categoria, opciones?.margenPorCategoria)
  if (deCat != null) return deCat
  return acotarMargenPct(opciones?.margenPctDefecto, MARGEN_CATALOGO_DEFECTO)
}

export function aplicarMargenACosto(
  costo: number,
  margenPct = MARGEN_CATALOGO_DEFECTO,
): { costo: number; margen_pct: number; precio: number; utilidad: number } {
  const c = redondearDinero(Number(costo))
  const m = acotarMargenPct(margenPct)
  const precio = precioVentaDesdeCosto(c, m)
  return { costo: c, margen_pct: m, precio, utilidad: redondearDinero(precio - c) }
}
