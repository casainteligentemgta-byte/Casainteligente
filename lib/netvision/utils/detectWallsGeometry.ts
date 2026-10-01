/** Geometría y scoring de muros desde polígonos rellenos (paso 2 de la cascada). */

export type PdfPoint = [number, number]

export type WallSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type Affine = [number, number, number, number, number, number]

export const AFFINE_IDENTITY: Affine = [1, 0, 0, 1, 0, 0]

/** Relación largo/espesor a partir de la cual un polígono cuenta como “alargado”. */
export const WALL_ELONGATION_MIN = 3

/** Colores que el negro de CAD suele usar para texto, flechas y bloques. */
const SKIP_COLORS = new Set(['(0.0, 0.0, 0.0)', '(0, 0, 0)', '0', '0.0', 'None', 'none', 'null'])

export function shapeStats(pts: PdfPoint[]): { longer: number; shorter: number } {
  if (pts.length === 0) return { longer: 0, shorter: 1e-6 }
  let minX = pts[0]![0]
  let maxX = minX
  let minY = pts[0]![1]
  let maxY = minY
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const w = maxX - minX
  const h = maxY - minY
  const longer = Math.max(w, h)
  const shorter = Math.max(Math.min(w, h), 1e-6)
  return { longer, shorter }
}

export function elongation(pts: PdfPoint[]): number {
  const { longer, shorter } = shapeStats(pts)
  return longer / shorter
}

function roundColorComp(n: number): string {
  const v = Math.round(n * 1000) / 1000
  if (Object.is(v, -0)) return '0'
  return String(v)
}

/** Serializa el color de relleno al estilo pdfplumber (`str(non_stroking_color)`). */
export function stringifyFillColor(color: number | number[] | string | null | undefined): string {
  if (color == null) return 'None'
  if (typeof color === 'string') {
    const t = color.trim()
    return t.length === 0 ? 'None' : t
  }
  if (typeof color === 'number') {
    if (!Number.isFinite(color)) return 'None'
    return roundColorComp(color)
  }
  if (!Array.isArray(color) || color.length === 0) return 'None'
  const comps = color.map((c) => (typeof c === 'number' && Number.isFinite(c) ? c : 0))
  const looksByte = comps.some((c) => c > 1)
  const norm = looksByte ? comps.map((c) => c / 255) : comps
  if (norm.length === 1) return roundColorComp(norm[0]!)
  return `(${norm.map(roundColorComp).join(', ')})`
}

export function isSkippedFillColor(color: string): boolean {
  if (SKIP_COLORS.has(color)) return true
  const rgb = color.match(/^\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/)
  if (rgb) {
    const r = Number(rgb[1])
    const g = Number(rgb[2])
    const b = Number(rgb[3])
    return r <= 0.04 && g <= 0.04 && b <= 0.04
  }
  const n = Number(color)
  return Number.isFinite(n) && n <= 0.04
}

export function pickWallColor(
  groups: Map<string, PdfPoint[][]> | Record<string, PdfPoint[][]>,
): { color: string | null; score: number } {
  const entries =
    groups instanceof Map ? groups.entries() : Object.entries(groups)
  let best: string | null = null
  let bestScore = 0
  for (const [color, polys] of entries) {
    if (isSkippedFillColor(color)) continue
    const score = polys.reduce((n, pts) => n + (elongation(pts) > WALL_ELONGATION_MIN ? 1 : 0), 0)
    if (score > bestScore) {
      best = color
      bestScore = score
    }
  }
  return { color: best, score: bestScore }
}

function dedupeClosed(pts: PdfPoint[]): PdfPoint[] {
  if (pts.length < 2) return pts
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
    return pts.slice(0, -1)
  }
  return pts
}

function edgeLen(a: PdfPoint, b: PdfPoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function midpoint(a: PdfPoint, b: PdfPoint): PdfPoint {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

function orderSegment(seg: WallSegment): WallSegment {
  const dx = Math.abs(seg.x2 - seg.x1)
  const dy = Math.abs(seg.y2 - seg.y1)
  if (dx >= dy) {
    if (seg.x1 <= seg.x2) return seg
    return { x1: seg.x2, y1: seg.y2, x2: seg.x1, y2: seg.y1 }
  }
  if (seg.y1 <= seg.y2) return seg
  return { x1: seg.x2, y1: seg.y2, x2: seg.x1, y2: seg.y1 }
}

/**
 * Eje largo de un polígono delgado: en un rectángulo, une los puntos medios
 * de los lados cortos; si no, usa el eje del bounding box.
 */
export function polygonToCenterline(pts: PdfPoint[]): WallSegment | null {
  const ring = dedupeClosed(pts)
  if (ring.length < 2) return null

  if (ring.length === 4) {
    const edges = [0, 1, 2, 3].map((i) => {
      const a = ring[i]!
      const b = ring[(i + 1) % 4]!
      return { i, a, b, len: edgeLen(a, b) }
    })
    const sorted = [...edges].sort((x, y) => x.len - y.len)
    const shortA = sorted[0]!
    const shortB = sorted[1]!
    const shareVertex =
      shortA.i === (shortB.i + 1) % 4 || shortB.i === (shortA.i + 1) % 4
    if (!shareVertex && shortA.len > 1e-9) {
      const m1 = midpoint(shortA.a, shortA.b)
      const m2 = midpoint(shortB.a, shortB.b)
      if (edgeLen(m1, m2) > 1e-6) {
        return orderSegment({ x1: m1[0], y1: m1[1], x2: m2[0], y2: m2[1] })
      }
    }
  }

  let minX = ring[0]![0]
  let maxX = minX
  let minY = ring[0]![1]
  let maxY = minY
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const w = maxX - minX
  const h = maxY - minY
  if (Math.max(w, h) < 1e-6) return null
  if (w >= h) {
    const midY = (minY + maxY) / 2
    return orderSegment({ x1: minX, y1: midY, x2: maxX, y2: midY })
  }
  const midX = (minX + maxX) / 2
  return orderSegment({ x1: midX, y1: minY, x2: midX, y2: maxY })
}

export type PolygonToSegmentOpts = {
  /** Elongación mínima (largo/espesor). */
  minElong?: number
  /** Largo mínimo en las mismas unidades que los puntos (p. ej. 0–1). */
  minLonger?: number
  /** Espesor máximo; descarta rellenos gordos (habitaciones). */
  maxShorter?: number
}

export function polygonsToWallSegments(
  polys: PdfPoint[][],
  opts: PolygonToSegmentOpts = {},
): WallSegment[] {
  const minElong = opts.minElong ?? WALL_ELONGATION_MIN
  const minLonger = opts.minLonger ?? 0
  const maxShorter = opts.maxShorter ?? Number.POSITIVE_INFINITY
  const out: WallSegment[] = []
  for (const pts of polys) {
    const { longer, shorter } = shapeStats(pts)
    if (longer / shorter < minElong) continue
    if (longer < minLonger) continue
    if (shorter > maxShorter) continue
    const seg = polygonToCenterline(pts)
    if (!seg) continue
    out.push({
      x1: Math.round(seg.x1 * 1000) / 1000,
      y1: Math.round(seg.y1 * 1000) / 1000,
      x2: Math.round(seg.x2 * 1000) / 1000,
      y2: Math.round(seg.y2 * 1000) / 1000,
    })
  }
  return out
}

export function multiplyAffine(m: Affine, n: Affine): Affine {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

export function applyAffine(m: Affine, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  }
}

export function cloneAffine(m: Affine): Affine {
  return [m[0], m[1], m[2], m[3], m[4], m[5]]
}
