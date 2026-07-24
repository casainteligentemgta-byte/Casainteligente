/**
 * Inferencia híbrida de cantidad/unidad cuando no hay factura detallada.
 *
 * Lógica de obra (cemento):
 * 1) Si el texto trae bolsas/sacos → usar esa cantidad.
 * 2) Si no, buscar paletas/pallets y convertir × factor (cemento = 48 bolsas).
 * 3) Precio unitario = monto / cantidad convertida.
 *
 * Extensible a otros materiales con tabla de presentaciones.
 */

export type PresentacionMaterial = {
  conceptoCanonico: string
  /** Bolsas/sacos (u otra unidad base) por pallet. */
  unidadesPorPallet: number
  unidadBase: string
  unidadPallet: string
  /** Detecta el material en texto libre. */
  detectMaterial: RegExp
}

/** Presentaciones conocidas de obra (Venezuela). */
export const PRESENTACIONES_MATERIAL: PresentacionMaterial[] = [
  {
    conceptoCanonico: 'CEMENTO',
    unidadesPorPallet: 48,
    unidadBase: 'SAC',
    unidadPallet: 'PAL',
    // Variantes de proveedores / OCR / jerga: CEMENTO, CEMNTO, CMT, PORTLAND, etc.
    detectMaterial:
      /\b(CEMENTOS?|CIMENTOS?|CEMNTOS?|CEMTOS?|CEMENTS?|PORTLAND|CMT\.?|CEM\.?)\b/i,
  },
]

export type InferenciaEmpaque = {
  cantidad: number
  unidad: string
  precioUnitario: number
  /** bolsas | pallets | linea | sin_dato */
  fuente: 'bolsas' | 'pallets' | 'linea' | 'sin_dato'
  conceptoCanonico: string | null
  factorPallet: number | null
  detalle: string
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normUnidad(u: string): string {
  const s = String(u ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
  if (!s) return 'UND'
  if (/^(SAC|SACO|SACOS)$/.test(s)) return 'SAC'
  if (/^(BOL|BOLSA|BOLSAS)$/.test(s)) return 'SAC' // bolsa de cemento ≈ saco
  if (/^(PAL|PALET|PALETS|PALLET|PALLETS|PALETA|PALETAS)$/.test(s)) return 'PAL'
  return s
}

function blobTexto(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => String(p ?? ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function resolverPresentacion(
  texto: string,
  concepto?: string | null,
): PresentacionMaterial | null {
  const blob = blobTexto(texto, concepto)
  const conceptoUp = String(concepto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  for (const p of PRESENTACIONES_MATERIAL) {
    if (conceptoUp === p.conceptoCanonico) return p
    if (p.detectMaterial.test(blob)) return p
  }
  return null
}

function extraerCantidad(
  texto: string,
  patrones: RegExp[],
): number | null {
  for (const re of patrones) {
    const m = texto.match(re)
    if (m?.[1]) {
      const n = num(m[1].replace(',', '.'))
      if (n > 0) return n
    }
  }
  return null
}

const RE_BOLSAS = [
  /(\d+(?:[.,]\d+)?)\s*(?:SACOS?|BOLSAS?|SAC\.?|BOL\.?)\b/i,
  /\b(?:SACOS?|BOLSAS?|SAC\.?|BOL\.?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
  /(\d+(?:[.,]\d+)?)\s*(?:X|×)\s*(?:SACOS?|BOLSAS?)\b/i,
]

const RE_PALLETS = [
  /(\d+(?:[.,]\d+)?)\s*(?:PALETAS?|PALLETS?|PALETS?|PAL\.?)\b/i,
  /\b(?:PALETAS?|PALLETS?|PALETS?|PAL\.?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
  /(\d+(?:[.,]\d+)?)\s*(?:X|×)\s*(?:PALETAS?|PALLETS?)\b/i,
]

/**
 * Híbrido: prioriza bolsas; si no hay, convierte pallets → unidad base.
 * Si la línea ya trae cantidad en sacos/bolsas, la respeta.
 */
export function inferirCantidadEmpaque(opts: {
  descripcion?: string | null
  concepto?: string | null
  unidad?: string | null
  cantidad?: number | null
  montoUsd?: number | null
}): InferenciaEmpaque {
  const desc = blobTexto(opts.descripcion, opts.concepto)
  const monto = num(opts.montoUsd)
  const cantIn = num(opts.cantidad)
  const undIn = normUnidad(String(opts.unidad ?? 'UND'))
  const presentacion = resolverPresentacion(desc, opts.concepto)

  const base = (cantidad: number, unidad: string, fuente: InferenciaEmpaque['fuente'], detalle: string): InferenciaEmpaque => ({
    cantidad,
    unidad,
    precioUnitario: cantidad > 0 && monto > 0 ? monto / cantidad : monto,
    fuente,
    conceptoCanonico: presentacion?.conceptoCanonico ?? null,
    factorPallet: presentacion?.unidadesPorPallet ?? null,
    detalle,
  })

  if (!presentacion) {
    const cant = cantIn > 0 ? cantIn : 1
    return base(cant, undIn || 'UND', cantIn > 0 ? 'linea' : 'sin_dato', 'Sin presentación conocida')
  }

  // 1) Ya viene en unidad base (sacos/bolsas)
  if ((undIn === 'SAC' || undIn === 'BOL') && cantIn > 0) {
    return base(
      cantIn,
      presentacion.unidadBase,
      'linea',
      `Cantidad en ${undIn} respetada`,
    )
  }

  // 2) Unidad pallet + cantidad numérica
  if (undIn === 'PAL' && cantIn > 0) {
    const bolsas = cantIn * presentacion.unidadesPorPallet
    return base(
      bolsas,
      presentacion.unidadBase,
      'pallets',
      `${cantIn} ${presentacion.unidadPallet} × ${presentacion.unidadesPorPallet} = ${bolsas} ${presentacion.unidadBase}`,
    )
  }

  // 3) Texto: bolsas/sacos explícitos
  const bolsasTxt = extraerCantidad(desc, RE_BOLSAS)
  if (bolsasTxt != null) {
    return base(
      bolsasTxt,
      presentacion.unidadBase,
      'bolsas',
      `Bolsas/sacos detectados en texto: ${bolsasTxt}`,
    )
  }

  // 4) Texto: pallets → × factor
  const palletsTxt = extraerCantidad(desc, RE_PALLETS)
  if (palletsTxt != null) {
    const bolsas = palletsTxt * presentacion.unidadesPorPallet
    return base(
      bolsas,
      presentacion.unidadBase,
      'pallets',
      `${palletsTxt} pallet(s) × ${presentacion.unidadesPorPallet} = ${bolsas} ${presentacion.unidadBase}`,
    )
  }

  // 5) Cantidad numérica genérica + mención de pallet en texto/unidad
  if (cantIn > 0 && /PALET|PALLET|PALETA|\bPAL\b/i.test(desc)) {
    const bolsas = cantIn * presentacion.unidadesPorPallet
    return base(
      bolsas,
      presentacion.unidadBase,
      'pallets',
      `Cantidad ${cantIn} interpretada como pallet(s)`,
    )
  }

  // 6) Material cemento pero solo 1 UND (cabecera sin detalle): no inventar bolsas
  if (cantIn > 0) {
    return base(cantIn, undIn || 'UND', 'linea', 'Cantidad de línea sin conversión')
  }

  return base(1, 'UND', 'sin_dato', 'Sin bolsas ni pallets detectables')
}
