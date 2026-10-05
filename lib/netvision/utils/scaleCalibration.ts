import type { ScaleCalibration } from '@/lib/netvision/types'

/** Mismo umbral que `pickDimensionForSegment`: trazo demasiado corto. */
export const CALIB_MIN_SEGMENT_NORM = 0.012

/** Ancho que se asume para un plano sin calibrar (m). */
export const ANCHO_SIN_CALIBRAR_M = 40

export type CalibrationOk = {
  ok: true
  meters: number
  /** Metros por unidad de ancho del plano (= ancho del plano en metros). */
  metersPerNorm: number
  planWidthM: number
  planHeightM: number
  segmentNorm: number
  /** Proporción alto/ancho de la imagen con la que se calibró. */
  aspect: number
  source: 'cota' | 'manual'
  label: string
}

export type CalibrationFail = {
  ok: false
  reason: 'short' | 'meters'
}

export type CalibrationOutcome = CalibrationOk | CalibrationFail

/** Proporción alto/ancho válida, o 1 (cuadrado) si no se conoce. */
export function aspectoValido(aspect: unknown): number {
  return typeof aspect === 'number' && Number.isFinite(aspect) && aspect > 0.01 && aspect < 100
    ? aspect
    : 1
}

/**
 * Calibra el plano con un trazo de longitud conocida.
 *
 * Las coordenadas del plano van de 0 a 1 en ancho y de 0 a 1 en alto, así que
 * una unidad vertical NO mide lo mismo que una horizontal salvo que el plano
 * sea cuadrado. Con `aspect` = alto/ancho de la imagen:
 *   largo real del trazo = ancho_m · √(dx² + (dy · aspect)²)
 * de donde sale el ancho en metros; el alto es ancho_m · aspect.
 */
export function computePlanCalibration(opts: {
  a: { x: number; y: number }
  b: { x: number; y: number }
  meters: number
  /** Alto/ancho de la imagen del plano. Sin valor se asume cuadrado. */
  aspect?: number
  source: 'cota' | 'manual'
  label?: string
}): CalibrationOutcome {
  const dx = opts.a.x - opts.b.x
  const dy = opts.a.y - opts.b.y
  const segmentNorm = Math.hypot(dx, dy)
  if (!(segmentNorm >= CALIB_MIN_SEGMENT_NORM)) return { ok: false, reason: 'short' }
  const meters = opts.meters
  if (!Number.isFinite(meters) || meters < 0.4 || meters > 200) {
    return { ok: false, reason: 'meters' }
  }
  const aspect = aspectoValido(opts.aspect)
  // Largo del trazo medido en «anchos de plano».
  const trazoEnAnchos = Math.hypot(dx, dy * aspect)
  const planWidthM = meters / trazoEnAnchos
  return {
    ok: true,
    meters,
    metersPerNorm: planWidthM,
    planWidthM,
    planHeightM: planWidthM * aspect,
    segmentNorm,
    aspect,
    source: opts.source,
    label: (opts.label ?? String(meters)).trim() || String(meters),
  }
}

export function calibrationToScale(result: CalibrationOk): ScaleCalibration {
  return {
    metersPerNormX: result.planWidthM,
    metersPerNormY: result.planHeightM,
    calibrated: true,
    aspect: result.aspect,
  }
}

/** Comprueba que el trazo, medido con la escala resultante, da los metros indicados. */
export function calibrationChecksOut(result: CalibrationOk): boolean {
  return (
    result.planWidthM > 0 &&
    Math.abs(result.planHeightM - result.planWidthM * result.aspect) < 1e-9 &&
    Math.abs(result.metersPerNorm - result.planWidthM) < 1e-9
  )
}

export type EstadoEscala =
  /** Calibrado con la proporción real del plano. */
  | 'ok'
  /** Nunca se calibró: los metros son aproximados. */
  | 'sin_calibrar'
  /**
   * Calibrado con la versión anterior, que trataba el plano como cuadrado: en
   * un plano alargado las medidas de un sentido salen deformadas.
   */
  | 'calibracion_antigua'

/** Tolerancia para considerar cuadrado un plano. */
const CASI_CUADRADO = 0.02

export function estadoEscala(scale: ScaleCalibration, aspect: number | null): EstadoEscala {
  if (!scale.calibrated) return 'sin_calibrar'
  if (typeof scale.aspect === 'number') return 'ok'
  if (aspect == null) return 'ok'
  const cuadrado = Math.abs(aspect - 1) <= CASI_CUADRADO
  const mismaEscala = Math.abs(scale.metersPerNormX - scale.metersPerNormY) < 1e-6
  return !cuadrado && mismaEscala ? 'calibracion_antigua' : 'ok'
}

/**
 * Para un plano SIN calibrar: escala por defecto (40 m de ancho) con el alto
 * que corresponde a su proporción. Devuelve null si ya está bien o si el plano
 * está calibrado (una calibración nunca se toca sola).
 */
export function ajustarEscalaSinCalibrar(
  scale: ScaleCalibration,
  aspect: number | null,
): ScaleCalibration | null {
  if (scale.calibrated || aspect == null) return null
  const a = aspectoValido(aspect)
  const altoEsperado = scale.metersPerNormX * a
  if (Math.abs(scale.metersPerNormY - altoEsperado) < 1e-6 && scale.aspect === a) return null
  return { ...scale, metersPerNormY: altoEsperado, aspect: a }
}
