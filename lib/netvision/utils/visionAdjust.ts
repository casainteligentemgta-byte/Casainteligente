/** Ajustes de óptica en el plano (yaw / FOV / alcance). */

import { clampFovHalf, radToDeg } from '@/lib/netvision/utils/geometryHelpers'

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
export function symmetricFovFromYawDelta(
  deltaDeg: number,
  step = 1,
): {
  fovLeftDeg: number
  fovRightDeg: number
  fovDeg: number
} {
  const half = clampFovHalf(snapToStep(Math.abs(deltaDeg), step))
  return {
    fovLeftDeg: half,
    fovRightDeg: half,
    fovDeg: half * 2,
  }
}

export type VisionHandleMode = 'yaw' | 'fov' | 'range'

/** Parche de óptica según el asa: girar, abrir o estirar. Nunca mezcla alcance con giro. */
export function visionPatchFromPointer(opts: {
  mode: VisionHandleMode
  camX: number
  camY: number
  pointerX: number
  pointerY: number
  yawDeg: number
  avgMPerNorm: number
  fovStep?: number
}): {
  yawDeg?: number
  fovLeftDeg?: number
  fovRightDeg?: number
  fovDeg?: number
  rangeM?: number
} {
  const dx = opts.pointerX - opts.camX
  const dy = opts.pointerY - opts.camY
  const ang = wrapDeg360(radToDeg(Math.atan2(dy, dx)))
  if (opts.mode === 'yaw') {
    return { yawDeg: Math.round(ang) }
  }
  if (opts.mode === 'range') {
    return { rangeM: rangeFromDistNorm(Math.hypot(dx, dy), opts.avgMPerNorm) }
  }
  return symmetricFovFromYawDelta(
    shortestDeltaDeg(opts.yawDeg, ang),
    opts.fovStep ?? 1,
  )
}

export function rangeFromDistNorm(distNorm: number, avgMPerNorm: number): number {
  const raw = distNorm * Math.max(avgMPerNorm, 0.01)
  return Math.round(Math.min(120, Math.max(2, raw)) * 10) / 10
}

export const FOV_PRESETS_DEG = [60, 90, 110, 130] as const
export const RANGE_PRESETS_M = [8, 15, 25, 40] as const
