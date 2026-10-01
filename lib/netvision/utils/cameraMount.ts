/** Montaje 3D de cámara: altura e inclinación → cobertura en el piso. */

import { degToRad, radToDeg } from '@/lib/netvision/utils/geometryHelpers'

export const DEFAULT_MOUNT_HEIGHT_M = 2.8
export const DEFAULT_TILT_DEG = 0

export const MIN_MOUNT_HEIGHT_M = 1.5
export const MAX_MOUNT_HEIGHT_M = 12
export const MIN_TILT_DEG = 0
export const MAX_TILT_DEG = 90

export const HEIGHT_PRESETS_M = [2.2, 2.8, 3.5, 4.5, 6] as const
export const TILT_PRESETS_DEG = [0, 15, 30, 45, 60, 90] as const

export function clampMountHeightM(m: number): number {
  if (!Number.isFinite(m)) return DEFAULT_MOUNT_HEIGHT_M
  return Math.min(MAX_MOUNT_HEIGHT_M, Math.max(MIN_MOUNT_HEIGHT_M, m))
}

/** 0° = horizonte; 90° = mira al piso (nadir). */
export function clampTiltDeg(deg: number): number {
  if (!Number.isFinite(deg)) return DEFAULT_TILT_DEG
  return Math.min(MAX_TILT_DEG, Math.max(MIN_TILT_DEG, deg))
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

/**
 * FOV vertical aproximado (sensor 16:9) a partir del FOV horizontal de ficha.
 */
export function verticalFovFromHorizontal(hFovDeg: number): number {
  const h = degToRad(Math.min(170, Math.max(1, hFovDeg)))
  const v = 2 * Math.atan(Math.tan(h / 2) * (9 / 16))
  return radToDeg(v)
}

export type GroundCoverage = {
  /** Distancia en el piso desde la cámara hasta el primer pixel útil (zona ciega). */
  nearM: number
  /** Alcance en el piso (proyección del FOV + ficha). */
  farM: number
  vFovDeg: number
}

/**
 * Proyecta el cono sobre el plano:
 * - inclinación 0° → se conserva el cono 2D actual (sin zona ciega).
 * - inclinación > 0° → aparece zona ciega bajo la cámara y el fondo se recorta
 *   cuando el rayo superior pega al piso antes del alcance de ficha.
 */
export function projectGroundCoverage(opts: {
  heightM: number
  tiltDeg: number
  hFovDeg: number
  rangeM: number
}): GroundCoverage {
  const heightM = clampMountHeightM(opts.heightM)
  const tiltDeg = clampTiltDeg(opts.tiltDeg)
  const rangeM = Math.max(0.5, opts.rangeM)
  const vFovDeg = verticalFovFromHorizontal(opts.hFovDeg)
  const halfV = vFovDeg / 2

  if (tiltDeg < 0.5) {
    return { nearM: 0, farM: round1(rangeM), vFovDeg: round1(vFovDeg) }
  }

  const elevBottom = Math.min(89.5, tiltDeg + halfV)
  const elevTop = tiltDeg - halfV

  const nearRaw =
    elevBottom >= 89.4 ? 0 : heightM / Math.tan(degToRad(elevBottom))

  let farM: number
  if (elevTop <= 0.35) {
    farM = rangeM
  } else {
    const topRad = degToRad(elevTop)
    const geomFar = heightM / Math.tan(topRad)
    const slant = heightM / Math.sin(topRad)
    farM = slant > rangeM ? rangeM * Math.cos(topRad) : geomFar
  }

  farM = Math.max(0.4, Math.min(rangeM, farM))
  const nearM = Math.max(0, Math.min(nearRaw, farM * 0.92))
  return { nearM: round1(nearM), farM: round1(farM), vFovDeg: round1(vFovDeg) }
}
