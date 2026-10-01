/** Ajustes de óptica en el plano (yaw / FOV / alcance). */

import { clampFovHalf } from '@/lib/netvision/utils/geometryHelpers'

export function wrapDeg360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

export function shortestDeltaDeg(fromDeg: number, toDeg: number): number {
  let d = toDeg - fromDeg
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

export function snapToStep(value: number, step: number): number {
  if (!(step > 0) || !Number.isFinite(value)) return value
  return Math.round(value / step) * step
}

/** Apertura simétrica desde el ángulo entre el yaw y el puntero. */
export function symmetricFovFromYawDelta(deltaDeg: number): {
  fovLeftDeg: number
  fovRightDeg: number
  fovDeg: number
} {
  const half = clampFovHalf(snapToStep(Math.abs(deltaDeg), 5))
  return {
    fovLeftDeg: half,
    fovRightDeg: half,
    fovDeg: half * 2,
  }
}

export function rangeFromDistNorm(distNorm: number, avgMPerNorm: number): number {
  const raw = distNorm * Math.max(avgMPerNorm, 0.01)
  return Math.round(Math.min(120, Math.max(2, raw)) * 10) / 10
}

export const FOV_PRESETS_DEG = [60, 90, 110, 130] as const
export const RANGE_PRESETS_M = [8, 15, 25, 40] as const
