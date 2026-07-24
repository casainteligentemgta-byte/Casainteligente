import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildPatchCcoCompraTelegram,
  isMissingCcoColumnError,
  type ExistingCcoCompraFields,
} from '@/lib/contabilidad/cco/defaultsCompraTelegram'
import { obtenerConfigCco } from '@/lib/contabilidad/cco/proyectoConfig'
import { updateContabilidadCompraRow } from '@/lib/contabilidad/updateContabilidadCompraRow'

/**
 * Tras confirmar Telegram a obra: escribe metadatos CCO si faltan.
 * Soft-fail si la migración 269 no está aplicada (no bloquea la compra).
 */
export async function aplicarDefaultsCcoCompraTelegram(
  supabase: SupabaseClient,
  params: {
    compraId: string
    proyectoId: string
    supplierName: string
    condicionPago: unknown
    montoUsd: number
  },
): Promise<{ applied: boolean; skipped?: string }> {
  const compraId = params.compraId?.trim()
  const proyectoId = params.proyectoId?.trim()
  if (!compraId || !proyectoId) {
    return { applied: false, skipped: 'sin compra o proyecto' }
  }

  let existing: ExistingCcoCompraFields | null = null
  const { data: row, error: selErr } = await supabase
    .from('contabilidad_compras')
    .select('tipo_gasto_cco,cco_estado,forma_pago_cco,honorarios_usd')
    .eq('id', compraId)
    .maybeSingle()

  if (selErr && isMissingCcoColumnError(selErr.message)) {
    return { applied: false, skipped: 'columnas CCO ausentes' }
  }
  if (selErr) {
    console.warn('[aplicarDefaultsCcoCompraTelegram] select:', selErr.message)
  } else if (row) {
    existing = row as ExistingCcoCompraFields
  }

  let pctGlobal = 15
  try {
    const cfg = await obtenerConfigCco(supabase, proyectoId)
    pctGlobal = cfg.honorarios_admin_pct || 15
  } catch {
    /* config opcional */
  }

  const patch = buildPatchCcoCompraTelegram({
    supplierName: params.supplierName,
    condicionPago: params.condicionPago,
    montoUsd: params.montoUsd,
    honorariosAdminPct: pctGlobal,
    existing,
  })
  if (!patch) {
    return { applied: false, skipped: 'ya tiene metadatos CCO' }
  }

  const { error: upErr } = await updateContabilidadCompraRow(supabase, compraId, patch)
  if (upErr) {
    if (isMissingCcoColumnError(upErr.message)) {
      return { applied: false, skipped: 'columnas CCO ausentes' }
    }
    console.warn('[aplicarDefaultsCcoCompraTelegram] update:', upErr.message)
    return { applied: false, skipped: upErr.message }
  }
  return { applied: true }
}
