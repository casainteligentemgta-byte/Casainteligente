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
 * Si se pasa `fovRightDeg`, `fovDegOrLeft` es el medio izquierdo (asimétrico).
 * Si no, `fovDegOrLeft` es el FOV total simétrico.
 */
export function fovSectorAngles(
  yawDeg: number,
  fovDegOrLeft: number,
  fovRightDeg?: number,
): {
  startAngleRad: number
  endAngleRad: number
} {
  const left =
    typeof fovRightDeg === 'number' && Number.isFinite(fovRightDeg)
      ? fovDegOrLeft
      : fovDegOrLeft / 2
  const right =
    typeof fovRightDeg === 'number' && Number.isFinite(fovRightDeg)
      ? fovRightDeg
      : fovDegOrLeft / 2
  const start = degToRad(yawDeg - left)
  const end = degToRad(yawDeg + right)
  return { startAngleRad: start, endAngleRad: end }
}

/** Medio FOV por lado (grados), con clamp práctico para asas del plano. */
export function clampFovHalf(deg: number): number {
  return Math.min(85, Math.max(10, deg))
}

/**
 * Proporción del plano para la geometría polar.
 *
 * Las coordenadas del plano van de 0 a 1 en ancho y de 0 a 1 en alto, así que
 * en un plano que no es cuadrado una unidad horizontal no mide lo mismo que una
 * vertical. Un «radio normalizado» (metros ÷ promedio de metros por unidad) solo
 * es un círculo real si cada eje se corrige con estos factores:
 *   ex = metrosPorUnidadX / promedio,  ey = metrosPorUnidadY / promedio.
 * En un plano cuadrado ambos valen 1.
 */
export type PlanIso = { ex: number; ey: number }

export const PLAN_ISO_CUADRADO: PlanIso = { ex: 1, ey: 1 }

export function planIso(metersPerNormX: number, metersPerNormY: number): PlanIso {
  const avg = (metersPerNormX + metersPerNormY) / 2
  if (!(avg > 0) || !(metersPerNormX > 0) || !(metersPerNormY > 0)) return PLAN_ISO_CUADRADO
  return { ex: metersPerNormX / avg, ey: metersPerNormY / avg }
}

/**
 * Punto de muestra en polar (canvas: ángulo desde +X, horario).
 * Con `iso`, el ángulo y el radio son reales aunque el plano no sea cuadrado.
 */
export function polarToNorm(
  cx: number,
  cy: number,
  radiusNorm: number,
  angleRad: number,
  iso: PlanIso = PLAN_ISO_CUADRADO,
): { x: number; y: number } {
  return {
    x: cx + (Math.cos(angleRad) * radiusNorm) / iso.ex,
    y: cy + (Math.sin(angleRad) * radiusNorm) / iso.ey,
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
  iso: PlanIso = PLAN_ISO_CUADRADO,
): boolean {
  const dx = (px - cx) * iso.ex
  const dy = (py - cy) * iso.ey
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

export type NormSeg = { x1: number; y1: number; x2: number; y2: number }

/**
 * Intersección segmento–segmento en [0,1].
 * Devuelve t a lo largo de A→B (0 en A, 1 en B) o null.
 */
export function segmentIntersectionT(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number | null {
  const rX = bx - ax
  const rY = by - ay
  const sX = dx - cx
  const sY = dy - cy
  const den = rX * sY - rY * sX
  if (Math.abs(den) < 1e-12) return null
  const t = ((cx - ax) * sY - (cy - ay) * sX) / den
  const u = ((cx - ax) * rY - (cy - ay) * rX) / den
  if (t < 1e-6 || t > 1 - 1e-6 || u < 0 || u > 1) return null
  return t
}

/** Acumula pérdidas de segmentos cruzados por el rayo A→B (hasta maxT). */
export function rayCrossings(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  segments: NormSeg[],
): { t: number; index: number }[] {
  const hits: { t: number; index: number }[] = []
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!
    const t = segmentIntersectionT(ax, ay, bx, by, s.x1, s.y1, s.x2, s.y2)
    if (t != null) hits.push({ t, index: i })
  }
  hits.sort((a, b) => a.t - b.t)
  return hits
}

/** Point-in-polygon (ray casting). Polígono cerrado o abierto (se asume cierre). */
export function pointInPolygon(
  px: number,
  py: number,
  pts: readonly { x: number; y: number }[],
): boolean {
  if (pts.length < 3) return false
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]!.x
    const yi = pts[i]!.y
    const xj = pts[j]!.x
    const yj = pts[j]!.y
    if (yi > py === yj > py) continue
    const xCross = ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (px < xCross) inside = !inside
  }
  return inside
}
