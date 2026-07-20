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
