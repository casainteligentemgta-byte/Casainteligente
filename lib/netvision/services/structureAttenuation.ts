import { getStructureMaterialOrDefault } from '@/lib/netvision/catalog/materials'
import type { DesignStructure } from '@/lib/netvision/types'
import {
  polarToNorm,
  rayCrossings,
  type NormSeg,
} from '@/lib/netvision/utils/geometryHelpers'

/** Grosor normalizado de muros opacos para el raycast (~12 cm si el plano ≈ 40 m). */
const OPAQUE_WALL_HALF_THICKNESS = 0.003

export function structuresToSegs(structures: DesignStructure[]): NormSeg[] {
  return structures.map((s) => ({
    x1: s.x1,
    y1: s.y1,
    x2: s.x2,
    y2: s.y2,
  }))
}

/**
 * Segmentos que bloquean visión, con leve grosor (paralelas) para que el FOV
 * no “se cuele” por errores de precisión en paredes delgadas.
 */
export function visionBlockingSegs(structures: DesignStructure[]): {
  segs: NormSeg[]
  /** Índice del segmento → estructura origen */
  structureIndex: number[]
} {
  const segs: NormSeg[] = []
  const structureIndex: number[] = []
  for (let i = 0; i < structures.length; i++) {
    const s = structures[i]!
    const mat = getStructureMaterialOrDefault(s.materialId)
    if (!mat.blocksVision) continue
    const dx = s.x2 - s.x1
    const dy = s.y2 - s.y1
    const len = Math.hypot(dx, dy)
    if (len < 1e-9) continue
    const nx = (-dy / len) * OPAQUE_WALL_HALF_THICKNESS
    const ny = (dx / len) * OPAQUE_WALL_HALF_THICKNESS
    const variants: NormSeg[] = [
      { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 },
      { x1: s.x1 + nx, y1: s.y1 + ny, x2: s.x2 + nx, y2: s.y2 + ny },
      { x1: s.x1 - nx, y1: s.y1 - ny, x2: s.x2 - nx, y2: s.y2 - ny },
    ]
    for (const v of variants) {
      segs.push(v)
      structureIndex.push(i)
    }
  }
  return { segs, structureIndex }
}

/** Distancia normalizada hasta el primer muro que bloquea visión. */
export function visionRangeAlongRay(
  ox: number,
  oy: number,
  angleRad: number,
  maxRadiusNorm: number,
  structures: DesignStructure[],
): number {
  if (structures.length === 0 || maxRadiusNorm <= 0) return maxRadiusNorm
  const end = polarToNorm(ox, oy, maxRadiusNorm, angleRad)
  const { segs } = visionBlockingSegs(structures)
  if (segs.length === 0) return maxRadiusNorm
  const hits = rayCrossings(ox, oy, end.x, end.y, segs)
  if (hits.length === 0) return maxRadiusNorm
  // Primer impacto (ya ordenado por t)
  return Math.max(0.01, maxRadiusNorm * hits[0]!.t)
}

/** Pérdida WiFi (dB) acumulada entre dos puntos por muros cruzados. */
export function wifiLossBetween(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  structures: DesignStructure[],
): number {
  if (structures.length === 0) return 0
  const segs = structuresToSegs(structures)
  const hits = rayCrossings(ax, ay, bx, by, segs)
  let loss = 0
  for (const hit of hits) {
    const s = structures[hit.index]!
    loss += getStructureMaterialOrDefault(s.materialId).wifiLossDb
  }
  return loss
}

/** Pérdida de sonido (dB) acumulada entre dos puntos. */
export function soundLossBetween(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  structures: DesignStructure[],
): number {
  if (structures.length === 0) return 0
  const segs = structuresToSegs(structures)
  const hits = rayCrossings(ax, ay, bx, by, segs)
  let loss = 0
  for (const hit of hits) {
    const s = structures[hit.index]!
    loss += getStructureMaterialOrDefault(s.materialId).soundLossDb
  }
  return loss
}

/** Polígono FOV por rayos (incluye el centro de la cámara). */
export function buildFovPolygon(
  cx: number,
  cy: number,
  radiusNorm: number,
  startAngleRad: number,
  endAngleRad: number,
  structures: DesignStructure[],
  rays = 96,
): { x: number; y: number }[] {
  let start = startAngleRad
  let end = endAngleRad
  while (end < start) end += Math.PI * 2
  const span = end - start
  const rayCount = structures.some((s) =>
    getStructureMaterialOrDefault(s.materialId).blocksVision,
  )
    ? Math.max(rays, 128)
    : rays
  const pts: { x: number; y: number }[] = [{ x: cx, y: cy }]
  for (let i = 0; i <= rayCount; i++) {
    const ang = start + (span * i) / rayCount
    const r = visionRangeAlongRay(cx, cy, ang, radiusNorm, structures)
    pts.push(polarToNorm(cx, cy, r, ang))
  }
  return pts
}

/** ¿Hay línea de visión libre (sin muro opaco) entre dos puntos? */
export function hasClearVision(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  structures: DesignStructure[],
): boolean {
  if (structures.length === 0) return true
  const { segs } = visionBlockingSegs(structures)
  if (segs.length === 0) return true
  return rayCrossings(ax, ay, bx, by, segs).length === 0
}
