/**
 * Oferta que viaja en el enlace del cliente: renglones y total de venta,
 * sin costo, margen, ganancia ni id de Ventas.
 */
import { lineaPresupuestoTitulo } from '@/lib/presupuesto/presentacion'
import type {
  BomSummary,
  ClientePresupuestoRenglon,
  ClientePresupuestoSnapshot,
  NetVisionCurrency,
  NetVisionProject,
} from '@/lib/netvision/types'
import { presupuestoDesdeBom } from '@/lib/netvision/presupuesto'
import { monedaEfectiva, normalizarTasa } from '@/lib/netvision/utils/moneda'

const MAX_RENGLONES = 80
const MAX_DESC = 200
const MAX_NOTA = 500

const redondear2 = (n: number) => Math.round(n * 100) / 100

function monedaDe(v: unknown): NetVisionCurrency {
  if (v === 'VES' || v === 'EUR' || v === 'USD') return v
  return 'USD'
}

function cantidad(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.max(1, Math.ceil(n - 1e-9))
}

function montoUsd(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return redondear2(n)
}

function textoCampo(...cands: unknown[]): string {
  for (const c of cands) {
    if (typeof c === 'string' && c.trim()) return c
  }
  return ''
}

/** Notas que sí puede leer el cliente (sin el pie interno de NetVision). */
export function notaParaCliente(notas: string | null | undefined): string | undefined {
  if (!notas) return undefined
  const lineas = notas
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^generado desde netvision/i.test(l))
  const texto = lineas.join(' ').replace(/\s+/g, ' ').trim()
  if (!texto) return undefined
  return texto.slice(0, MAX_NOTA)
}

function renglonDesdeItemVentas(item: unknown): ClientePresupuestoRenglon | null {
  if (!item || typeof item !== 'object') return null
  const r = item as Record<string, unknown>
  const pd =
    r.product_data && typeof r.product_data === 'object'
      ? (r.product_data as Record<string, unknown>)
      : r.product && typeof r.product === 'object'
        ? (r.product as Record<string, unknown>)
        : {}
  const qty = cantidad(r.qty ?? r.quantity ?? r.cantidad)
  if (qty <= 0) return null
  const descripcion = lineaPresupuestoTitulo(
    textoCampo(pd.nombre, pd.name, r.descripcion, r.description, r.nombre, r.name),
    '',
  ).slice(0, MAX_DESC)
  if (!descripcion) return null
  return {
    descripcion,
    qty,
    unitUsd: montoUsd(r.unit_price ?? r.unitPrice ?? r.precio ?? r.precioUnit ?? pd.precio),
  }
}

/**
 * Copia pública a partir de los ítems de un presupuesto de Ventas.
 * Ignora costo, margen, ganancia, product_id e imágenes.
 */
export function snapshotDesdeItemsVentas(args: {
  items: readonly unknown[]
  subtotal?: unknown
  notas?: string | null
  moneda?: unknown
  tasaCambio?: unknown
  publicadoAt?: string
}): ClientePresupuestoSnapshot | null {
  const renglones: ClientePresupuestoRenglon[] = []
  for (const item of args.items) {
    const r = renglonDesdeItemVentas(item)
    if (r) renglones.push(r)
    if (renglones.length >= MAX_RENGLONES) break
  }
  if (renglones.length === 0) return null
  const suma = redondear2(renglones.reduce((s, r) => s + r.qty * r.unitUsd, 0))
  const subtotal = montoUsd(args.subtotal)
  const moneda = monedaEfectiva(monedaDe(args.moneda), args.tasaCambio)
  const tasa = moneda === 'USD' ? undefined : (normalizarTasa(args.tasaCambio) ?? undefined)
  const publicadoAt =
    typeof args.publicadoAt === 'string' && args.publicadoAt ? args.publicadoAt : new Date().toISOString()
  const nota = notaParaCliente(args.notas)
  return {
    publicadoAt,
    moneda,
    ...(tasa != null ? { tasaCambio: tasa } : {}),
    renglones,
    subtotalUsd: subtotal > 0 ? subtotal : suma,
    ...(nota ? { nota } : {}),
  }
}

/** Quita cualquier campo extra que se haya colado en el JSON del proyecto. */
export function sanitizarClientePresupuesto(raw: unknown): ClientePresupuestoSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const snap = snapshotDesdeItemsVentas({
    items: Array.isArray(o.renglones)
      ? o.renglones.map((r) => {
          if (!r || typeof r !== 'object') return null
          const x = r as Record<string, unknown>
          return {
            qty: x.qty,
            unit_price: x.unitUsd ?? x.unit_price,
            product_data: { nombre: x.descripcion },
          }
        })
      : [],
    subtotal: o.subtotalUsd ?? o.subtotal,
    notas: typeof o.nota === 'string' ? o.nota : null,
    moneda: o.moneda,
    tasaCambio: o.tasaCambio,
    publicadoAt: typeof o.publicadoAt === 'string' ? o.publicadoAt : undefined,
  })
  return snap ?? undefined
}

export function hayOfertaCliente(
  project: { clientePresupuesto?: ClientePresupuestoSnapshot | null } | null | undefined,
): boolean {
  return (project?.clientePresupuesto?.renglones.length ?? 0) > 0
}

/**
 * Oferta a partir de la lista de materiales del plano (precios de venta =
 * referencia de NetVision + margen del proyecto). Sin costos.
 */
export function snapshotDesdeBom(
  project: Pick<NetVisionProject, 'name' | 'currency' | 'tasaCambio' | 'distributorMarginPct'>,
  bom: Pick<BomSummary, 'lines'>,
): ClientePresupuestoSnapshot | null {
  const armado = presupuestoDesdeBom(
    bom,
    project.name,
    {},
    [],
    project.distributorMarginPct,
  )
  return snapshotDesdeItemsVentas({
    items: armado.presupuesto.items,
    subtotal: armado.presupuesto.subtotal,
    notas: armado.notas,
    moneda: project.currency,
    tasaCambio: project.tasaCambio,
  })
}

