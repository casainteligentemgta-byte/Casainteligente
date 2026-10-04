import type { ScaleCalibration } from '@/lib/netvision/types'

/** Mismo umbral que `pickDimensionForSegment`: trazo demasiado corto. */
export const CALIB_MIN_SEGMENT_NORM = 0.012

export type CalibrationOk = {
  ok: true
  meters: number
  metersPerNorm: number
  planWidthM: number
  planHeightM: number
  segmentNorm: number
  source: 'cota' | 'manual'
  label: string
}

export type CalibrationFail = {
  ok: false
  reason: 'short' | 'meters'
}

export type CalibrationOutcome = CalibrationOk | CalibrationFail

export function computePlanCalibration(opts: {
  a: { x: number; y: number }
  b: { x: number; y: number }
  meters: number
  source: 'cota' | 'manual'
  label?: string
}): CalibrationOutcome {
  const segmentNorm = Math.hypot(opts.a.x - opts.b.x, opts.a.y - opts.b.y)
  if (!(segmentNorm >= CALIB_MIN_SEGMENT_NORM)) return { ok: false, reason: 'short' }
  const meters = opts.meters
  if (!Number.isFinite(meters) || meters < 0.4 || meters > 200) {
    return { ok: false, reason: 'meters' }
  }
  const metersPerNorm = meters / segmentNorm
  return {
    ok: true,
    meters,
    metersPerNorm,
    planWidthM: metersPerNorm,
    planHeightM: metersPerNorm,
    segmentNorm,
    source: opts.source,
    label: (opts.label ?? String(meters)).trim() || String(meters),
  }
}

export function calibrationToScale(result: CalibrationOk): ScaleCalibration {
  return {
    metersPerNormX: result.metersPerNorm,
    metersPerNormY: result.metersPerNorm,
    calibrated: true,
  }
}

/** Comprueba que metros / trazo = ancho del plano. */
export function calibrationChecksOut(result: CalibrationOk): boolean {
  const recomputed = result.meters / result.segmentNorm
  return (
    Math.abs(recomputed - result.metersPerNorm) < 1e-9 &&
    Math.abs(result.planWidthM - result.metersPerNorm) < 1e-9 &&
    result.planWidthM > 0
  )
}
