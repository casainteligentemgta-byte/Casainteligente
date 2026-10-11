/**
 * Aviso antes de guardar un presupuesto: qué renglones se venden al costo o por debajo.
 *
 * El margen del presupuesto empieza en 0 % y en la mayoría de los productos el precio del
 * catálogo es igual al costo, así que es fácil guardar un presupuesto que no deja nada.
 * No se bloquea: se avisa y el operador decide.
 */

export type RenglonMargen = {
  nombre: string
  cantidad: number
  /** Precio unitario escrito en el presupuesto, antes del descuento. */
  precioUnitario: number
  /** Descuento del renglón, en %. */
  descuentoPct?: number | null
  /** Costo unitario del catálogo; sin costo (null o 0) no se puede opinar. */
  costo?: number | null
}

export type RenglonAlCosto = {
  nombre: string
  /** Precio unitario ya con el descuento. */
  vendido: number
  costo: number
  /** Lo que se pierde en el renglón entero (0 si se vende justo al costo). */
  perdida: number
}

const centimos = (n: number) => Math.round(n * 100) / 100

/** Renglones cuyo precio (con descuento) no supera el costo. Los que no tienen costo se saltan. */
export function renglonesAlCostoOBajo(renglones: readonly RenglonMargen[]): RenglonAlCosto[] {
  const fuera: RenglonAlCosto[] = []
  for (const r of renglones) {
    const costo = Number(r.costo)
    if (!Number.isFinite(costo) || costo <= 0) continue
    const descuento = Math.min(100, Math.max(0, Number(r.descuentoPct) || 0))
    const vendido = centimos((Number(r.precioUnitario) || 0) * (1 - descuento / 100))
    // Un céntimo de tolerancia: redondeos del margen no cuentan como ganancia.
    if (vendido > costo + 0.005) continue
    const cantidad = Number(r.cantidad) > 0 ? Number(r.cantidad) : 1
    fuera.push({ nombre: r.nombre, vendido, costo: centimos(costo), perdida: centimos(Math.max(0, costo - vendido) * cantidad) })
  }
  return fuera
}

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Texto de la pregunta al guardar, o `null` si todos los renglones dejan ganancia.
 * Lista hasta cinco renglones; el resto se resume.
 */
export function avisoGuardarSinGanancia(renglones: readonly RenglonMargen[]): string | null {
  const fuera = renglonesAlCostoOBajo(renglones)
  if (fuera.length === 0) return null
  const bajo = fuera.filter((r) => r.perdida > 0)
  const perdida = centimos(bajo.reduce((s, r) => s + r.perdida, 0))
  const titulo =
    fuera.length === 1
      ? 'Un renglón se vende al costo o por debajo:'
      : `${fuera.length} renglones se venden al costo o por debajo:`
  const lineas = fuera.slice(0, 5).map((r) => {
    const nombre = r.nombre.length > 46 ? `${r.nombre.slice(0, 45)}…` : r.nombre
    return r.perdida > 0
      ? `• ${nombre}: vendes a ${usd(r.vendido)} y cuesta ${usd(r.costo)}`
      : `• ${nombre}: vendes al costo (${usd(r.costo)})`
  })
  if (fuera.length > 5) lineas.push(`• …y ${fuera.length - 5} más`)
  const cierre =
    perdida > 0
      ? `En esos renglones el presupuesto pierde ${usd(perdida)}.`
      : 'En esos renglones el presupuesto no deja ganancia.'
  return `${titulo}\n\n${lineas.join('\n')}\n\n${cierre} Puedes subir el margen o corregir el precio.\n\n¿Guardar de todos modos?`
}
