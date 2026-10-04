/** Snap ortogonal (H/V) respecto a un punto de origen — esquinas a 90°. */

export function snapOrtho90(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  if (dx >= dy) {
    return { x: to.x, y: from.y }
  }
  return { x: from.x, y: to.y }
}

export const STRUCTURE_JOINT_SNAP = 0.014

type Joint = { x: number; y: number }

function jointsOf(
  structures: { x1: number; y1: number; x2: number; y2: number }[],
): Joint[] {
  const out: Joint[] = []
  for (const s of structures) {
    out.push({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 })
  }
  return out
}

/** Acerca el punto a un extremo de muro ya dibujado (para unir habitaciones). */
export function snapToStructureJoints(
  pt: { x: number; y: number },
  structures: { x1: number; y1: number; x2: number; y2: number }[],
  threshold = STRUCTURE_JOINT_SNAP,
): { x: number; y: number } {
  let best = pt
  let bestD = threshold
  for (const q of jointsOf(structures)) {
    const d = Math.hypot(pt.x - q.x, pt.y - q.y)
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return best
}

/**
 * Tras el snap H/V, une a un extremo cercano solo si sigue siendo horizontal o vertical.
 */
export function snapToStructureJointsAligned(
  from: { x: number; y: number },
  snapped: { x: number; y: number },
  structures: { x1: number; y1: number; x2: number; y2: number }[],
  threshold = STRUCTURE_JOINT_SNAP,
): { x: number; y: number } {
  const horizontal = Math.abs(snapped.y - from.y) <= Math.abs(snapped.x - from.x)
  let best = snapped
  let bestD = threshold
  for (const q of jointsOf(structures)) {
    if (horizontal) {
      if (Math.abs(q.y - from.y) > threshold) continue
    } else if (Math.abs(q.x - from.x) > threshold) {
      continue
    }
    const aligned = horizontal
      ? { x: q.x, y: from.y }
      : { x: from.x, y: q.y }
    const d = Math.hypot(snapped.x - aligned.x, snapped.y - aligned.y)
    if (d < bestD) {
      bestD = d
      best = aligned
    }
  }
  return best
}

export function structureLabelPrefix(materialId: string): string {
  if (materialId === 'door') return 'PUE'
  if (materialId === 'window') return 'VEN'
  if (materialId === 'glass') return 'VID'
  if (materialId === 'block') return 'BLO'
  if (materialId === 'concrete') return 'CON'
  return 'DRY'
}

export type StructureDrawPoint = { x: number; y: number }

export type StructureDrawAdvance =
  | { type: 'start'; draft: StructureDrawPoint }
  | { type: 'too-short'; draft: StructureDrawPoint }
  | {
      type: 'segment'
      x1: number
      y1: number
      x2: number
      y2: number
      nextDraft: StructureDrawPoint
    }

const MIN_STRUCTURE_LEN = 0.008

/**
 * Primer clic = origen. Segundo clic = graba el tramo H/V y sigue desde esa esquina.
 * Usa el borrador que le pases (no el de un closure viejo).
 */
export function advanceStructureDraw(
  draft: StructureDrawPoint | null,
  raw: StructureDrawPoint,
  walls: { x1: number; y1: number; x2: number; y2: number }[],
  minLen = MIN_STRUCTURE_LEN,
): StructureDrawAdvance {
  if (!draft) {
    return { type: 'start', draft: snapToStructureJoints(raw, walls) }
  }
  const snapped = snapOrtho90(draft, raw)
  const joined = snapToStructureJointsAligned(draft, snapped, walls)
  const dx = Math.abs(draft.x - joined.x)
  const dy = Math.abs(draft.y - joined.y)
  if (dx + dy < minLen) return { type: 'too-short', draft }
  return {
    type: 'segment',
    x1: draft.x,
    y1: draft.y,
    x2: joined.x,
    y2: joined.y,
    nextDraft: joined,
  }
}
