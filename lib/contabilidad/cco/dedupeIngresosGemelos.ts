/**
 * Deduplica ingresos CCO «gemelos»: mismo abono / fecha / monto con IDs V4 distintos.
 * El CSV del programa a menudo exporta una fila con PROVEEDOR = usuario de sesión
 * (p. ej. LUIS) y otra sin ese proveedor; ambas suman al KPI y duplican el total.
 */

export type IngresoGemeloLike = {
  origen_v4_id?: number | null
  fecha?: string | null
  proveedor?: string | null
  descripcion?: string | null
  monto_base_usd?: number | null
  origen_fondo?: string | null
  id?: string | null
  creado_al?: string | null
}

function normTexto(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Clave de negocio del abono (ABONO 10, ABONO 38, …). */
export function claveAbonoIngreso(descripcion: string, origenFondo?: string | null): string {
  const blob = normTexto(`${descripcion} ${origenFondo ?? ''}`)
  const m = blob.match(/\bABONO\s*#?\s*(\d+)\b/)
  if (m?.[1]) return `ABONO-${m[1]}`
  return blob.replace(/^CCO-V4 #\d+\s*·\s*/, '').slice(0, 80) || 'SIN-ABONO'
}

export function proveedorPareceOperadorSesion(proveedor: string): boolean {
  const p = normTexto(proveedor)
  if (!p || p === 'CLIENTE' || p === 'SIN PROVEEDOR') return false
  if (/\bABONO\b/.test(p)) return false
  // 1–4 palabras alfabéticas (LUIS, LUIS AZMOUZ, CARLO DI MATTEO)
  return /^[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3}$/.test(p)
}

/** Detecta gemelo con «· LUIS ·» (u otro operador) en origen_fondo. */
export function origenFondoTieneOperador(origenFondo: string): boolean {
  const parts = String(origenFondo ?? '')
    .split(/\s*·\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  // CCO-V4 #id · OPERADOR · DESC
  if (parts.length >= 3) {
    return proveedorPareceOperadorSesion(parts[1] ?? '')
  }
  return false
}

function fechaKey(fecha: string | null | undefined): string {
  const s = String(fecha ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s.slice(0, 10)
}

function montoKey(monto: number): string {
  return String(Math.round(monto * 100) / 100)
}

export function claveGemeloIngreso(row: IngresoGemeloLike): string | null {
  const monto = num(row.monto_base_usd)
  if (monto <= 0) return null
  const fecha = fechaKey(row.fecha)
  if (!fecha) return null
  const abono = claveAbonoIngreso(String(row.descripcion ?? ''), row.origen_fondo)
  return `${fecha}|${montoKey(monto)}|${abono}`
}

function scoreConservar(row: IngresoGemeloLike): number {
  const fondo = String(row.origen_fondo ?? '')
  const prov = String(row.proveedor ?? '')
  if (origenFondoTieneOperador(fondo) || proveedorPareceOperadorSesion(prov)) return 10
  if (!prov.trim() || normTexto(prov) === 'CLIENTE') return 100
  if (/\bABONO\b/i.test(prov)) return 90
  return 50
}

/**
 * De un grupo de gemelos, elige cuál conservar (preferencia: sin operador de sesión).
 */
export function elegirIngresoGemeloAConservar<T extends IngresoGemeloLike>(group: T[]): T {
  const ranked = [...group].sort((a, b) => {
    const ds = scoreConservar(b) - scoreConservar(a)
    if (ds !== 0) return ds
    const aId = num(a.origen_v4_id)
    const bId = num(b.origen_v4_id)
    if (aId && bId && aId !== bId) return aId - bId
    return String(a.creado_al ?? '').localeCompare(String(b.creado_al ?? ''))
  })
  return ranked[0]!
}

/**
 * Filtra transacciones INGRESO del CSV: deja un solo abono por fecha/monto.
 * No toca otras clases.
 */
export function filtrarIngresosGemelosCsv<
  T extends IngresoGemeloLike & { clase?: string | null },
>(transacciones: T[]): { kept: T[]; discarded: T[] } {
  const ingresos: T[] = []
  const otras: T[] = []
  for (const t of transacciones) {
    if (String(t.clase ?? '').toUpperCase() === 'INGRESO') ingresos.push(t)
    else otras.push(t)
  }

  const grupos = new Map<string, T[]>()
  const sinClave: T[] = []
  for (const t of ingresos) {
    const k = claveGemeloIngreso({
      ...t,
      monto_base_usd: t.monto_base_usd,
    })
    if (!k) {
      sinClave.push(t)
      continue
    }
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k)!.push(t)
  }

  const keptIngresos: T[] = [...sinClave]
  const discarded: T[] = []
  for (const group of Array.from(grupos.values())) {
    if (group.length === 1) {
      keptIngresos.push(group[0]!)
      continue
    }
    const keep = elegirIngresoGemeloAConservar(group)
    keptIngresos.push(keep)
    for (const g of group) {
      if (g !== keep) discarded.push(g)
    }
  }

  return { kept: [...otras, ...keptIngresos], discarded }
}

/**
 * Filas de ci_inyecciones_capital a eliminar (gemelos con operador).
 */
export function idsIngresosGemelosAEliminar(
  rows: Array<{
    id: string
    fecha_ingreso?: string | null
    monto_usd?: number | null
    origen_fondo?: string | null
    creado_al?: string | null
  }>,
): string[] {
  const grupos = new Map<string, IngresoGemeloLike[]>()
  for (const r of rows) {
    const monto = num(r.monto_usd)
    if (monto <= 0) continue
    const like: IngresoGemeloLike = {
      id: r.id,
      fecha: r.fecha_ingreso,
      monto_base_usd: monto,
      origen_fondo: r.origen_fondo,
      descripcion: r.origen_fondo,
      creado_al: r.creado_al,
    }
    const k = claveGemeloIngreso(like)
    if (!k) continue
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k)!.push(like)
  }

  const eliminar: string[] = []
  for (const group of Array.from(grupos.values())) {
    if (group.length < 2) continue
    // Solo actuar si hay al menos un gemelo «operador» y uno «limpio»
    const conOp = group.filter((g) => origenFondoTieneOperador(String(g.origen_fondo ?? '')))
    const sinOp = group.filter((g) => !origenFondoTieneOperador(String(g.origen_fondo ?? '')))
    if (conOp.length === 0 || sinOp.length === 0) continue
    const keep = elegirIngresoGemeloAConservar(group)
    for (const g of group) {
      if (g.id && g.id !== keep.id) eliminar.push(String(g.id))
    }
  }
  return eliminar
}
