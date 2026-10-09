/**
 * Elige qué presupuesto de Ventas mostrar al cliente.
 * El de Indira (u otro) se hizo en Ventas: hay que encontrarlo por cliente,
 * no solo por la nota «Generado desde NetVision».
 */

export type ResumenPresupuestoVentas = {
  id: string
  cliente: string
  subtotal: number
  notas: string
  fecha: string
  items: unknown[]
}

export function normalizarTextoPresupuesto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokensUtiles(texto: string): string[] {
  return normalizarTextoPresupuesto(texto)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && t !== 'proyecto' && t !== 'pro')
}

/** Qué tanto encaja un presupuesto de Ventas con este diseño. */
export function puntajePresupuestoVentas(
  fila: Pick<ResumenPresupuestoVentas, 'cliente' | 'notas'>,
  args: { nombreProyecto: string; nombreCliente?: string },
): number {
  const cliente = normalizarTextoPresupuesto(fila.cliente)
  const notas = normalizarTextoPresupuesto(fila.notas)
  const proyecto = normalizarTextoPresupuesto(args.nombreProyecto)
  const buscado = normalizarTextoPresupuesto(args.nombreCliente ?? '')
  let n = 0
  if (proyecto && notas.includes(`generado desde netvision: ${proyecto}`)) n += 12
  if (buscado.length >= 3) {
    if (cliente === buscado) n += 10
    else if (cliente.includes(buscado) || buscado.includes(cliente)) n += 8
  }
  if (proyecto && (notas.includes(proyecto) || cliente.includes(proyecto))) n += 4
  for (const tok of tokensUtiles(proyecto)) {
    if (notas.includes(tok) || cliente.includes(tok)) n += 3
  }
  return n
}

export function ordenarPresupuestosVentas(
  filas: readonly ResumenPresupuestoVentas[],
  args: { nombreProyecto: string; nombreCliente?: string },
): ResumenPresupuestoVentas[] {
  return [...filas].sort((a, b) => {
    const da = puntajePresupuestoVentas(a, args)
    const db = puntajePresupuestoVentas(b, args)
    if (db !== da) return db - da
    if (b.subtotal !== a.subtotal) return b.subtotal - a.subtotal
    return b.fecha.localeCompare(a.fecha)
  })
}

/**
 * Si hay un único encaje claro (mismo cliente, o nota de NetVision),
 * se usa solo. Si no, se listan para que el instalador elija (p. ej. Indira).
 */
export function resolverPresupuestoVentas(
  filas: readonly ResumenPresupuestoVentas[],
  args: { nombreProyecto: string; nombreCliente?: string },
):
  | { tipo: 'unico'; fila: ResumenPresupuestoVentas }
  | { tipo: 'varios'; filas: ResumenPresupuestoVentas[] }
  | { tipo: 'ninguno' } {
  const conItems = filas.filter((f) => f.id && f.items.length > 0)
  if (conItems.length === 0) return { tipo: 'ninguno' }
  const ordenadas = ordenarPresupuestosVentas(conItems, args)
  const top = ordenadas[0]!
  const score = puntajePresupuestoVentas(top, args)
  const empate = ordenadas.filter((f) => puntajePresupuestoVentas(f, args) === score)
  if (score >= 8 && empate.length === 1) return { tipo: 'unico', fila: top }
  return { tipo: 'varios', filas: ordenadas }
}

export function filtrarPresupuestosVentas(
  filas: readonly ResumenPresupuestoVentas[],
  consulta: string,
): ResumenPresupuestoVentas[] {
  const q = normalizarTextoPresupuesto(consulta)
  if (!q) return [...filas]
  return filas.filter((f) => {
    const cliente = normalizarTextoPresupuesto(f.cliente)
    const notas = normalizarTextoPresupuesto(f.notas)
    return cliente.includes(q) || notas.includes(q) || String(Math.round(f.subtotal)).includes(q)
  })
}
