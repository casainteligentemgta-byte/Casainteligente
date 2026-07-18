import { getStructureMaterialOrDefault } from '@/lib/netvision/catalog/materials'
import type { DesignStructure } from '@/lib/netvision/types'
import {
  polarToNorm,
  rayCrossings,
  type NormSeg,
} from '@/lib/netvision/utils/geometryHelpers'

export function structuresToSegs(structures: DesignStructure[]): NormSeg[] {
  return structures.map((s) => ({
    x1: s.x1,
    y1: s.y1,
    x2: s.x2,
    y2: s.y2,
  }))
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
  const segs = structuresToSegs(structures)
  const hits = rayCrossings(ox, oy, end.x, end.y, segs)
  for (const hit of hits) {
    const s = structures[hit.index]!
    const mat = getStructureMaterialOrDefault(s.materialId)
    if (mat.blocksVision) {
      return Math.max(0.01, maxRadiusNorm * hit.t)
    }
  }
  return maxRadiusNorm
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
  rays = 36,
): { x: number; y: number }[] {
  let start = startAngleRad
  let end = endAngleRad
  while (end < start) end += Math.PI * 2
  const span = end - start
  const pts: { x: number; y: number }[] = [{ x: cx, y: cy }]
  for (let i = 0; i <= rays; i++) {
    const ang = start + (span * i) / rays
    const r = visionRangeAlongRay(cx, cy, ang, radiusNorm, structures)
    pts.push(polarToNorm(cx, cy, r, ang))
  }
  return pts
}
