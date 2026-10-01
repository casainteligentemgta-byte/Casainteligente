/** Huecos y rellenos secundarios → puertas / ventanas (paso 3 de la cascada). */

import {
  isSkippedFillColor,
  polygonToCenterline,
  shapeStats,
  type PdfPoint,
  type WallSegment,
} from '@/lib/netvision/utils/detectWallsGeometry'

export type OpeningKind = 'door' | 'window'

export type ThickSegment = WallSegment & { thickness: number }

export type Rgb = { r: number; g: number; b: number }

export function parseFillRgb(color: string): Rgb | null {
  if (isSkippedFillColor(color)) return null
  const rgb = color.match(/^\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/)
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }
  }
  const n = Number(color)
  if (Number.isFinite(n)) return { r: n, g: n, b: n }
  return null
}

/**
 * Vidrio (cian/azul) vs hoja de puerta (marrón/naranja/amarillo).
 * El gris de muro queda en `neutral`.
 */
export function fillColorRole(color: string): 'glass' | 'wood' | 'neutral' | 'skip' {
  if (isSkippedFillColor(color)) return 'skip'
  const c = parseFillRgb(color)
  if (!c) return 'neutral'
  const { r, g, b } = c
  if (b > 0.32 && b >= r + 0.07 && (b >= g - 0.08 || g > 0.4)) return 'glass'
  if (g > 0.48 && b > 0.48 && r < 0.58 && b >= r) return 'glass'
  if (r > 0.28 && r >= g - 0.02 && r > b + 0.08) return 'wood'
  if (r > 0.4 && g > 0.28 && b < 0.32 && r + g > 0.85) return 'wood'
  return 'neutral'
}

export function roundSeg(seg: WallSegment): WallSegment {
  const out: WallSegment = {
    x1: Math.round(seg.x1 * 1000) / 1000,
    y1: Math.round(seg.y1 * 1000) / 1000,
    x2: Math.round(seg.x2 * 1000) / 1000,
    y2: Math.round(seg.y2 * 1000) / 1000,
  }
  if (typeof seg.thickness === 'number') {
    out.thickness = Math.round(seg.thickness * 1000) / 1000
  }
  return out
}

export function segLen(s: WallSegment): number {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
}

export function isHorizontal(s: WallSegment): boolean {
  return Math.abs(s.x2 - s.x1) >= Math.abs(s.y2 - s.y1)
}

type AxisRun = {
  horizontal: boolean
  axis: number
  t0: number
  t1: number
  thickness: number
}

function toRun(s: ThickSegment): AxisRun {
  const th = Math.max(s.thickness, 1e-6)
  if (isHorizontal(s)) {
    return {
      horizontal: true,
      axis: (s.y1 + s.y2) / 2,
      t0: Math.min(s.x1, s.x2),
      t1: Math.max(s.x1, s.x2),
      thickness: th,
    }
  }
  return {
    horizontal: false,
    axis: (s.x1 + s.x2) / 2,
    t0: Math.min(s.y1, s.y2),
    t1: Math.max(s.y1, s.y2),
    thickness: th,
  }
}

function runToSeg(run: AxisRun): WallSegment {
  if (run.horizontal) {
    return { x1: run.t0, y1: run.axis, x2: run.t1, y2: run.axis, thickness: run.thickness }
  }
  return { x1: run.axis, y1: run.t0, x2: run.axis, y2: run.t1, thickness: run.thickness }
}

function overlap1d(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

function segsOverlap(a: WallSegment, b: WallSegment, pad = 0): boolean {
  const ra = toRun({ ...a, thickness: a.thickness ?? 0.01 })
  const rb = toRun({ ...b, thickness: b.thickness ?? 0.01 })
  if (ra.horizontal !== rb.horizontal) return false
  const axisTol = Math.max(ra.thickness, rb.thickness) * 2 + pad
  if (Math.abs(ra.axis - rb.axis) > axisTol) return false
  return overlap1d(ra.t0, ra.t1, rb.t0, rb.t1) > 0.002
}

export function dedupeSegments(segs: WallSegment[], minOverlap = 0.45): WallSegment[] {
  const sorted = [...segs].sort((a, b) => segLen(b) - segLen(a))
  const kept: WallSegment[] = []
  for (const s of sorted) {
    if (segLen(s) < 0.004) continue
    const hit = kept.some((k) => {
      const ra = toRun({ ...s, thickness: s.thickness ?? 0.01 })
      const rb = toRun({ ...k, thickness: k.thickness ?? 0.01 })
      if (ra.horizontal !== rb.horizontal) return false
      if (Math.abs(ra.axis - rb.axis) > Math.max(ra.thickness, rb.thickness) * 2.5) return false
      const ov = overlap1d(ra.t0, ra.t1, rb.t0, rb.t1)
      const shorter = Math.min(ra.t1 - ra.t0, rb.t1 - rb.t0)
      return shorter > 0 && ov / shorter >= minOverlap
    })
    if (!hit) kept.push(roundSeg(s))
  }
  return kept
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function mergeRuns(runs: AxisRun[], mergeTol: number): AxisRun[] {
  const sorted = [...runs].sort((a, b) => a.t0 - b.t0)
  const out: AxisRun[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.t0 <= last.t1 + mergeTol) {
      last.t1 = Math.max(last.t1, r.t1)
      last.thickness = Math.max(last.thickness, r.thickness)
      last.axis = (last.axis + r.axis) / 2
    } else {
      out.push({ ...r })
    }
  }
  return out
}

/**
 * Huecos entre tramos colineales. En CAD el muro se parte en las puertas;
 * una ventana suele llevar relleno de vidrio en el hueco.
 */
export function openingsFromWallGaps(
  walls: ThickSegment[],
  opts?: { glassSegs?: WallSegment[]; pageMin?: number },
): { doors: WallSegment[]; windows: WallSegment[] } {
  const glassSegs = opts?.glassSegs ?? []
  const pageMin = opts?.pageMin ?? 1
  const doors: WallSegment[] = []
  const windows: WallSegment[] = []
  if (walls.length < 2) return { doors, windows }

  const medTh = median(walls.map((w) => w.thickness)) || pageMin * 0.012
  const axisTol = Math.max(medTh * 0.9, pageMin * 0.004)
  const mergeTol = Math.max(medTh * 1.4, pageMin * 0.005)
  const minGap = Math.max(medTh * 2.8, pageMin * 0.012)
  const maxGap = pageMin * 0.28

  const clusters: AxisRun[][] = []
  for (const w of walls) {
    const run = toRun(w)
    let placed = false
    for (const cluster of clusters) {
      const sample = cluster[0]!
      if (sample.horizontal !== run.horizontal) continue
      if (Math.abs(sample.axis - run.axis) > axisTol) continue
      cluster.push(run)
      placed = true
      break
    }
    if (!placed) clusters.push([run])
  }

  for (const cluster of clusters) {
    const merged = mergeRuns(cluster, mergeTol)
    for (let i = 0; i < merged.length - 1; i++) {
      const a = merged[i]!
      const b = merged[i + 1]!
      const gap = b.t0 - a.t1
      if (gap < minGap || gap > maxGap) continue
      const opening = runToSeg({
        horizontal: a.horizontal,
        axis: (a.axis + b.axis) / 2,
        t0: a.t1,
        t1: b.t0,
        thickness: Math.max(a.thickness, b.thickness),
      })
      const glazed = glassSegs.some((g) => segsOverlap(opening, g, medTh))
      if (glazed) windows.push(roundSeg(opening))
      else doors.push(roundSeg(opening))
    }
  }

  return {
    doors: dedupeSegments(doors),
    windows: dedupeSegments(windows),
  }
}

function nearParallelWall(
  seg: WallSegment,
  walls: ThickSegment[],
  maxDist: number,
): boolean {
  const r = toRun({ ...seg, thickness: seg.thickness ?? 0.01 })
  return walls.some((w) => {
    const wr = toRun(w)
    if (wr.horizontal !== r.horizontal) return false
    if (Math.abs(wr.axis - r.axis) > maxDist) return false
    return overlap1d(wr.t0, wr.t1, r.t0, r.t1) > segLen(seg) * 0.35
  })
}

function leafAtWall(
  seg: WallSegment,
  walls: ThickSegment[],
  maxDist: number,
): boolean {
  const r = toRun({ ...seg, thickness: seg.thickness ?? 0.01 })
  return walls.some((w) => {
    const wr = toRun(w)
    if (wr.horizontal === r.horizontal) return false
    if (r.axis < wr.t0 - maxDist || r.axis > wr.t1 + maxDist) return false
    const distToWall = Math.min(Math.abs(r.t0 - wr.axis), Math.abs(r.t1 - wr.axis))
    return distToWall <= maxDist
  })
}

export function segmentsFromColoredPolys(
  groups: Map<string, PdfPoint[][]> | Record<string, PdfPoint[][]>,
  wallColor: string | null,
  opts: { minLonger: number; maxShorter: number; pageMin: number },
): { glass: ThickSegment[]; wood: ThickSegment[] } {
  const entries = Array.from(
    groups instanceof Map ? groups.entries() : Object.entries(groups),
  )
  const glass: ThickSegment[] = []
  const wood: ThickSegment[] = []
  for (const [color, polys] of entries) {
    if (color === wallColor) continue
    const role = fillColorRole(color)
    if (role !== 'glass' && role !== 'wood') continue
    for (const pts of polys) {
      const { longer, shorter } = shapeStats(pts)
      const elong = longer / shorter
      if (role === 'glass' && (elong < 2 || longer < opts.minLonger * 0.6)) continue
      if (role === 'wood' && (elong < 1.6 || longer < opts.minLonger * 0.35)) continue
      if (shorter > opts.maxShorter) continue
      if (longer > opts.pageMin * 0.45) continue
      const seg = polygonToCenterline(pts)
      if (!seg) continue
      const thick: ThickSegment = {
        ...roundSeg(seg),
        thickness: Math.round(shorter * 1000) / 1000,
      }
      if (role === 'glass') glass.push(thick)
      else wood.push(thick)
    }
  }
  return { glass, wood }
}

export function openingsFromColoredFills(
  walls: ThickSegment[],
  glass: ThickSegment[],
  wood: ThickSegment[],
  pageMin: number,
): { doors: WallSegment[]; windows: WallSegment[] } {
  const medTh = median(walls.map((w) => w.thickness)) || pageMin * 0.012
  const near = Math.max(medTh * 2.2, pageMin * 0.01)
  const windows = glass.filter((s) => nearParallelWall(s, walls, near))
  const doors = wood.filter((s) => {
    const len = segLen(s)
    if (len > pageMin * 0.16) return false
    return nearParallelWall(s, walls, near) || leafAtWall(s, walls, near)
  })
  return {
    doors: dedupeSegments(doors),
    windows: dedupeSegments(windows),
  }
}

/** Arco de 90° (vaivén) cerca de un muro → cuerda sobre el muro = puerta. */
export function doorsFromArcs(
  arcs: PdfPoint[][],
  walls: ThickSegment[],
  pageMin: number,
): WallSegment[] {
  const medTh = median(walls.map((w) => w.thickness)) || pageMin * 0.012
  const minR = Math.max(medTh * 3, pageMin * 0.014)
  const maxR = pageMin * 0.14
  const out: WallSegment[] = []
  for (const pts of arcs) {
    if (pts.length < 3) continue
    const { longer, shorter } = shapeStats(pts)
    if (longer < minR || longer > maxR) continue
    const aspect = longer / shorter
    if (aspect > 1.55) continue
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2
    let best: ThickSegment | null = null
    let bestDist = Infinity
    for (const w of walls) {
      const wr = toRun(w)
      const dist = wr.horizontal ? Math.abs(wr.axis - midY) : Math.abs(wr.axis - midX)
      const t = wr.horizontal ? midX : midY
      if (t < wr.t0 - longer || t > wr.t1 + longer) continue
      if (dist < bestDist) {
        bestDist = dist
        best = w
      }
    }
    if (!best || bestDist > Math.max(longer * 0.7, medTh * 3)) continue
    const wr = toRun(best)
    const half = longer * 0.45
    const t = wr.horizontal ? midX : midY
    const t0 = Math.max(wr.t0, t - half)
    const t1 = Math.min(wr.t1, t + half)
    if (t1 - t0 < minR * 0.5) continue
    out.push(
      roundSeg(
        runToSeg({
          horizontal: wr.horizontal,
          axis: wr.axis,
          t0,
          t1,
          thickness: wr.thickness,
        }),
      ),
    )
  }
  return dedupeSegments(out)
}

export function mergeOpenings(
  gap: { doors: WallSegment[]; windows: WallSegment[] },
  fills: { doors: WallSegment[]; windows: WallSegment[] },
  arcs: WallSegment[],
): { doors: WallSegment[]; windows: WallSegment[] } {
  const windows = dedupeSegments([...gap.windows, ...fills.windows])
  const doorsRaw = dedupeSegments([...gap.doors, ...fills.doors, ...arcs])
  const doors = doorsRaw.filter((d) => !windows.some((w) => segsOverlap(d, w)))
  return { doors, windows }
}

export function thickFromPolys(
  polys: PdfPoint[][],
  opts: { minElong?: number; minLonger?: number; maxShorter?: number },
): ThickSegment[] {
  const minElong = opts.minElong ?? 3
  const minLonger = opts.minLonger ?? 0
  const maxShorter = opts.maxShorter ?? Number.POSITIVE_INFINITY
  const out: ThickSegment[] = []
  for (const pts of polys) {
    const { longer, shorter } = shapeStats(pts)
    if (longer / shorter < minElong) continue
    if (longer < minLonger) continue
    if (shorter > maxShorter) continue
    const seg = polygonToCenterline(pts)
    if (!seg) continue
    out.push({
      ...roundSeg(seg),
      thickness: Math.round(shorter * 1000) / 1000,
    })
  }
  return out
}
