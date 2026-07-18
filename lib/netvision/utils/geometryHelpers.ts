/** Geometría 2D normalizada (plano 0–1) y conversiones a metros. */

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** Distancia euclídea en espacio normalizado. */
export function distNorm(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return Math.hypot(dx, dy)
}

/** Distancia en metros usando escala anisotrópica del plano. */
export function distMeters(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  metersPerNormX: number,
  metersPerNormY: number,
): number {
  const dx = (ax - bx) * metersPerNormX
  const dy = (ay - by) * metersPerNormY
  return Math.hypot(dx, dy)
}

/** Radio en unidades normalizadas a partir de metros (usa promedio de escala). */
export function metersToNormRadius(
  meters: number,
  metersPerNormX: number,
  metersPerNormY: number,
): number {
  const avg = (metersPerNormX + metersPerNormY) / 2
  if (avg <= 0) return 0
  return meters / avg
}

/**
 * Yaw en grados: 0 = derecha (+X), 90 = abajo (+Y) en canvas.
 * Devuelve ángulos de sector para Konva (radianes, 0 = este, sentido horario en canvas).
 */
export function fovSectorAngles(yawDeg: number, fovDeg: number): {
  startAngleRad: number
  endAngleRad: number
} {
  const half = fovDeg / 2
  const start = degToRad(yawDeg - half)
  const end = degToRad(yawDeg + half)
  return { startAngleRad: start, endAngleRad: end }
}

/** Punto de muestra en polar (canvas: ángulo desde +X, horario). */
export function polarToNorm(
  cx: number,
  cy: number,
  radiusNorm: number,
  angleRad: number,
): { x: number; y: number } {
  return {
    x: cx + Math.cos(angleRad) * radiusNorm,
    y: cy + Math.sin(angleRad) * radiusNorm,
  }
}

export function pointInSector(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radiusNorm: number,
  startAngleRad: number,
  endAngleRad: number,
): boolean {
  const dx = px - cx
  const dy = py - cy
  const r = Math.hypot(dx, dy)
  if (r > radiusNorm + 1e-9) return false
  let ang = Math.atan2(dy, dx)
  // Normalizar ángulos a [-PI, PI] y comprobar arco
  let start = startAngleRad
  let end = endAngleRad
  while (end < start) end += Math.PI * 2
  while (ang < start) ang += Math.PI * 2
  return ang <= end + 1e-9
}
