/**
 * De la lista de materiales de NetVision a un presupuesto de Ventas.
 * Funciones puras: arman los renglones, los enlazan con productos del catálogo
 * de Ventas y calculan los totales con las mismas reglas que /ventas.
 */
import type { BomLine, BomSummary } from '@/lib/netvision/types'

/** Margen que /ventas aplica por defecto sobre el precio del producto. */
export const MARGEN_VENTAS_DEFECTO = 20

/** Producto del catálogo de Ventas (tabla `products`), solo lo que se usa aquí. */
export type ProductoVenta = {
  id: number
  nombre: string
  marca?: string | null
  modelo?: string | null
  categoria?: string | null
  descripcion?: string | null
  costo?: number | null
  precio?: number | null
  [extra: string]: unknown
}

/** Renglón que el usuario revisa antes de crear el presupuesto. */
export type RenglonPresupuesto = {
  /** Clave estable para recordar el enlace con un producto. */
  clave: string
  descripcion: string
  qty: number
  /** Precio de referencia de NetVision (USD). */
  refUsd: number
  /** Producto de Ventas enlazado; null = renglón libre. */
  productId: number | null
  /** Precio unitario que irá al presupuesto. */
  precioUnit: number
  incluir: boolean
}

const redondear2 = (n: number) => Math.round(n * 100) / 100

/** Clave con la que se recuerda el enlace renglón ↔ producto. */
export function claveEnlace(linea: Pick<BomLine, 'sku' | 'linkKey'>): string {
  return (linea.linkKey ?? linea.sku).trim().toLowerCase()
}

/** Precio de venta de un producto con el margen de /ventas. */
export function precioVentaProducto(
  producto: Pick<ProductoVenta, 'precio'>,
  margenPct = MARGEN_VENTAS_DEFECTO,
): number {
  return parseFloat((((producto.precio ?? 0) as number) * (1 + margenPct / 100)).toFixed(2))
}

/**
 * Renglones del presupuesto a partir de la lista de materiales.
 * - Los renglones sin monto (p. ej. zanja a cargo de otro contratista) no son
 *   productos: van como notas.
 * - Equipos iguales se juntan en un renglón.
 * - Si el renglón ya tiene producto recordado, sale enlazado y con su precio.
 */
export function renglonesDesdeBom(
  bom: Pick<BomSummary, 'lines'>,
  enlaces: Readonly<Record<string, number>> = {},
  productos: readonly ProductoVenta[] = [],
  margenPct = MARGEN_VENTAS_DEFECTO,
): { renglones: RenglonPresupuesto[]; notas: string[] } {
  const porId = new Map(productos.map((p) => [p.id, p]))
  const notas: string[] = []
  const porClave = new Map<string, RenglonPresupuesto>()
  for (const linea of bom.lines) {
    if (!(linea.qty > 0)) continue
    if (linea.sku === 'ZANJA-TERCERO' || (linea.unitUsd === 0 && linea.totalUsd === 0 && linea.category === 'conduit')) {
      notas.push(linea.description)
      continue
    }
    const clave = claveEnlace(linea)
    const previo = porClave.get(clave)
    if (previo && previo.refUsd === linea.unitUsd) {
      previo.qty = redondear2(previo.qty + linea.qty)
      continue
    }
    const enlazado = enlaces[clave]
    const producto = typeof enlazado === 'number' ? porId.get(enlazado) : undefined
    const renglon: RenglonPresupuesto = {
      clave: previo ? `${clave}#${porClave.size}` : clave,
      descripcion: linea.description,
      qty: linea.qty,
      refUsd: linea.unitUsd,
      productId: producto ? producto.id : null,
      precioUnit: producto ? precioVentaProducto(producto, margenPct) : redondear2(linea.unitUsd),
      incluir: true,
    }
    porClave.set(renglon.clave, renglon)
  }
  return { renglones: Array.from(porClave.values()), notas }
}

/** Palabras útiles para comparar un renglón con el nombre de un producto. */
function palabras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
}

/**
 * Productos del catálogo que se parecen al renglón (para proponerlos; el
 * enlace siempre lo confirma el usuario). Ordenados del más parecido al menos.
 */
export function sugerirProductos(
  descripcion: string,
  productos: readonly ProductoVenta[],
  max = 4,
): ProductoVenta[] {
  const buscadas = Array.from(new Set(palabras(descripcion)))
  if (buscadas.length === 0) return []
  const puntuados: { p: ProductoVenta; puntos: number }[] = []
  for (const p of productos) {
    const texto = new Set(palabras(`${p.nombre} ${p.marca ?? ''} ${p.modelo ?? ''}`))
    let puntos = 0
    for (const b of buscadas) {
      if (texto.has(b)) puntos += /\d/.test(b) ? 3 : b.length >= 4 ? 2 : 1
    }
    if (puntos >= 3) puntuados.push({ p, puntos })
  }
  puntuados.sort((a, b) => b.puntos - a.puntos || a.p.nombre.localeCompare(b.p.nombre))
  return puntuados.slice(0, max).map((x) => x.p)
}

/** Búsqueda de productos por texto libre (todas las palabras deben aparecer). */
export function buscarProductos(
  consulta: string,
  productos: readonly ProductoVenta[],
  max = 8,
): ProductoVenta[] {
  const q = palabras(consulta)
  if (q.length === 0) return []
  const out: ProductoVenta[] = []
  for (const p of productos) {
    const texto = `${p.nombre} ${p.marca ?? ''} ${p.modelo ?? ''} ${p.categoria ?? ''}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
    if (q.every((t) => texto.includes(t))) out.push(p)
    if (out.length >= max) break
  }
  return out
}

/** Ítem de `budgets.items`, con la misma forma que guarda /ventas. */
export type ItemPresupuestoVentas = {
  product_id: number
  product_data: Record<string, unknown>
  qty: number
  unit_price: number
  discount: number
  inventory_item_ids: never[]
  serial_numbers: never[]
}

export type PresupuestoVentas = {
  items: ItemPresupuestoVentas[]
  subtotal: number
  total_cost: number
  total_profit: number
  margin_pct: number
}

/**
 * Arma los ítems y totales del presupuesto.
 * - Renglón enlazado: lleva el producto de Ventas (sin su imagen) y su costo.
 * - Renglón libre: producto provisional con id negativo (no existe en el
 *   catálogo), para que /ventas lo muestre y deje editar el precio.
 */
export function construirPresupuesto(
  renglones: readonly RenglonPresupuesto[],
  productos: readonly ProductoVenta[],
): PresupuestoVentas {
  const porId = new Map(productos.map((p) => [p.id, p]))
  const items: ItemPresupuestoVentas[] = []
  let libres = 0
  for (const r of renglones) {
    if (!r.incluir || !(r.qty > 0)) continue
    const producto = r.productId != null ? porId.get(r.productId) : undefined
    const precio = redondear2(Math.max(0, r.precioUnit))
    if (producto) {
      const { imagen: _imagen, ...sinImagen } = producto as ProductoVenta & { imagen?: unknown }
      void _imagen
      items.push({
        product_id: producto.id,
        product_data: sinImagen,
        qty: r.qty,
        unit_price: precio,
        discount: 0,
        inventory_item_ids: [],
        serial_numbers: [],
      })
    } else {
      libres += 1
      const id = -libres
      items.push({
        product_id: id,
        product_data: {
          id,
          nombre: r.descripcion,
          categoria: 'NetVision',
          marca: null,
          modelo: r.clave,
          descripcion: null,
          // Sin producto enlazado no se conoce el costo real: se usa la referencia.
          costo: redondear2(r.refUsd),
          precio,
          utilidad: null,
          cantidad: null,
          image_url: null,
        },
        qty: r.qty,
        unit_price: precio,
        discount: 0,
        inventory_item_ids: [],
        serial_numbers: [],
      })
    }
  }
  const subtotal = redondear2(items.reduce((s, i) => s + i.unit_price * i.qty, 0))
  const total_cost = redondear2(
    items.reduce((s, i) => s + (Number(i.product_data.costo) || 0) * i.qty, 0),
  )
  const total_profit = redondear2(subtotal - total_cost)
  const margin_pct = subtotal > 0 ? redondear2((total_profit / subtotal) * 100) : 0
  return { items, subtotal, total_cost, total_profit, margin_pct }
}

/** Nota del presupuesto: de dónde salió y lo que no se cobra. */
export function notasPresupuesto(nombreProyecto: string, notas: readonly string[]): string {
  const partes = [`Generado desde NetVision: ${nombreProyecto.trim() || 'proyecto sin nombre'}.`]
  for (const n of notas) partes.push(n.endsWith('.') ? n : `${n}.`)
  return partes.join('\n')
}

/** Enlaces renglón → producto que hay que recordar (solo los renglones enlazados). */
export function enlacesParaGuardar(
  renglones: readonly RenglonPresupuesto[],
): { sku: string; product_id: number }[] {
  const out = new Map<string, number>()
  for (const r of renglones) {
    if (r.productId == null) continue
    out.set(r.clave.split('#')[0]!, r.productId)
  }
  return Array.from(out.entries()).map(([sku, product_id]) => ({ sku, product_id }))
}
