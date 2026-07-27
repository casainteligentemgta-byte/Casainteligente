import { snapOrtho90 } from '@/lib/netvision/utils/structureDraw'

export type NormPoint = { x: number; y: number }

function clamp01(p: NormPoint): NormPoint {
  return {
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y)),
  }
}

export function roundNormPoint(p: NormPoint): NormPoint {
  return {
    x: Math.round(p.x * 1000) / 1000,
    y: Math.round(p.y * 1000) / 1000,
  }
}

export function manhattanNorm(a: NormPoint, b: NormPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function nearestMagnet(
  raw: NormPoint,
  magnets: NormPoint[],
  radius: number,
): NormPoint | null {
  let best: NormPoint | null = null
  let bestD = radius
  for (const m of magnets) {
    const d = Math.hypot(m.x - raw.x, m.y - raw.y)
    if (d < bestD) {
      bestD = d
      best = m
    }
  }
  return best
}

/**
 * Snap de dibujo de cable (CAD minimalista):
 * - Imán a cámaras / nodos cercanos
 * - Trazos ortogonales H/V respecto al último vértice
 */
export function snapCableDrawPoint(
  from: NormPoint | null,
  raw: NormPoint,
  magnets: NormPoint[],
  magnetRadius = 0.028,
): NormPoint {
  const magnet = nearestMagnet(raw, magnets, magnetRadius)
  if (!from) return clamp01(magnet ?? raw)

  if (magnet) {
    const ax = Math.abs(magnet.x - from.x)
    const ay = Math.abs(magnet.y - from.y)
    // Alineado en H o V → anclar al equipo
    if (ax < 0.012 || ay < 0.012) return clamp01(magnet)
  }

  return clamp01(snapOrtho90(from, magnet ?? raw))
}

/** Vértices válidos para persistir (sin duplicados consecutivos). */
export function sanitizeCablePoints(points: NormPoint[]): NormPoint[] {
  const out: NormPoint[] = []
  for (const p of points) {
    const r = roundNormPoint(clamp01(p))
    const prev = out[out.length - 1]
    if (prev && manhattanNorm(prev, r) < 0.004) continue
    out.push(r)
  }
  return out
}
