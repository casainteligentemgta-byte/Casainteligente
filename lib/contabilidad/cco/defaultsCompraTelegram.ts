import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto'
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios'
import { parseCondicionPagoExtracted } from '@/lib/contabilidad/extractedCanal'

export type CcoEstadoTelegram = 'PAGADO' | 'PENDIENTE'

/** Contado → PAGADO; crédito → PENDIENTE + forma CREDITO (instrumento exacto desconocido). */
export function mapCondicionPagoTelegramACco(condicion: unknown): {
  cco_estado: CcoEstadoTelegram
  forma_pago_cco: 'CREDITO' | null
} {
  if (parseCondicionPagoExtracted(condicion) === 'credito') {
    return { cco_estado: 'PENDIENTE', forma_pago_cco: 'CREDITO' }
  }
  return { cco_estado: 'PAGADO', forma_pago_cco: null }
}

export type ExistingCcoCompraFields = {
  tipo_gasto_cco?: string | null
  cco_estado?: string | null
  forma_pago_cco?: string | null
  honorarios_usd?: number | null
}

/**
 * Patch CCO para compras Telegram → obra.
 * Solo rellena campos vacíos (no pisa ediciones manuales en CCO).
 */
export function buildPatchCcoCompraTelegram(input: {
  supplierName: string
  condicionPago: unknown
  montoUsd: number
  honorariosAdminPct?: number | null
  existing?: ExistingCcoCompraFields | null
}): Record<string, unknown> | null {
  const existing = input.existing ?? null
  const mapped = mapCondicionPagoTelegramACco(input.condicionPago)
  const pctGlobal =
    Number.isFinite(Number(input.honorariosAdminPct)) && Number(input.honorariosAdminPct) > 0
      ? Number(input.honorariosAdminPct)
      : 15
  const calc = aplicarHonorariosABase(input.montoUsd, null, pctGlobal)
  const patch: Record<string, unknown> = {}

  if (!String(existing?.tipo_gasto_cco ?? '').trim()) {
    patch.tipo_gasto_cco = clasificarTipoGasto(input.supplierName)
  }
  if (!String(existing?.cco_estado ?? '').trim()) {
    patch.cco_estado = mapped.cco_estado
  }
  if (
    mapped.forma_pago_cco &&
    !String(existing?.forma_pago_cco ?? '').trim()
  ) {
    patch.forma_pago_cco = mapped.forma_pago_cco
  }
  if (existing?.honorarios_usd == null && calc.honorariosUsd > 0) {
    patch.honorarios_usd = calc.honorariosUsd
  }

  return Object.keys(patch).length > 0 ? patch : null
}

export function isMissingCcoColumnError(message: string | null | undefined): boolean {
  return /tipo_gasto_cco|forma_pago_cco|cco_estado|honorarios_usd|admin_pct|capitulo_cco|schema cache|42703|PGRST204/i.test(
    message ?? '',
  )
}
