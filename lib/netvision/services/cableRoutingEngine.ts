import {
  ROUTE_SLACK,
  cableWarning,
  recommendCableType,
} from '@/lib/netvision/services/cableCalculator'
import { adviseCameraLinks } from '@/lib/netvision/services/poeAnalyzer'
import type {
  CableRoute,
  DesignCamera,
  DesignNetworkNode,
  ScaleCalibration,
  ValidationResult,
} from '@/lib/netvision/types'
import { distMeters } from '@/lib/netvision/utils/geometryHelpers'

export type NormPoint = { x: number; y: number }

/** Clave de override de quiebres para un enlace from→to. */
export function cableRouteKey(fromId: string, toId: string): string {
  return `${fromId}__${toId}`
}

export function makeCableRouteId(fromId: string, toId: string): string {
  return `cable-${fromId}-${toId}`
}

/** Ruta ortogonal L (horizontal→vertical) en coords normalizadas. */
export function orthogonalPath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  prefer: 'hv' | 'vh' = 'hv',
): NormPoint[] {
  if (prefer === 'vh') {
    return [
      { x: ax, y: ay },
      { x: ax, y: by },
      { x: bx, y: by },
    ]
  }
  return [
    { x: ax, y: ay },
    { x: bx, y: ay },
    { x: bx, y: by },
  ]
}

export function pathLengthM(
  points: NormPoint[],
  scale: ScaleCalibration,
): number {
  let m = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    m += distMeters(a.x, a.y, b.x, b.y, scale.metersPerNormX, scale.metersPerNormY)
  }
  return m
}

function pickShorterPath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  scale: ScaleCalibration,
): NormPoint[] {
  const hv = orthogonalPath(ax, ay, bx, by, 'hv')
  const vh = orthogonalPath(ax, ay, bx, by, 'vh')
  return pathLengthM(hv, scale) <= pathLengthM(vh, scale) ? hv : vh
}

function clampNorm(n: number) {
  return Math.min(1, Math.max(0, Math.round(n * 1000) / 1000))
}

function sanitizeMids(mids: NormPoint[]): NormPoint[] {
  return mids
    .filter((p) => typeof p.x === 'number' && typeof p.y === 'number')
    .map((p) => ({ x: clampNorm(p.x), y: clampNorm(p.y) }))
}

/** Une extremos vivos + quiebres intermedios. */
export function composeRoutePoints(
  from: NormPoint,
  to: NormPoint,
  mids: NormPoint[] | undefined,
  scale: ScaleCalibration,
): NormPoint[] {
  if (mids && mids.length > 0) {
    return [
      { x: from.x, y: from.y },
      ...sanitizeMids(mids),
      { x: to.x, y: to.y },
    ]
  }
  return pickShorterPath(from.x, from.y, to.x, to.y, scale)
}

/** Índice del segmento más largo y punto medio (para añadir quiebre). */
export function longestSegmentBreak(points: NormPoint[]): {
  afterIndex: number
  point: NormPoint
} {
  let bestI = 0
  let bestLen = -1
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const len = Math.hypot(a.x - b.x, a.y - b.y)
    if (len > bestLen) {
      bestLen = len
      bestI = i
    }
  }
  const a = points[bestI]!
  const b = points[bestI + 1]!
  return {
    afterIndex: bestI,
    point: {
      x: clampNorm((a.x + b.x) / 2),
      y: clampNorm((a.y + b.y) / 2),
    },
  }
}

/**
 * Inserta un quiebre tras `afterIndex` en la polilínea completa.
 * Devuelve solo los waypoints intermedios (sin extremos).
 */
export function insertMidWaypoint(
  points: NormPoint[],
  afterIndex: number,
  point: NormPoint,
): NormPoint[] {
  const full = [...points]
  const idx = Math.max(0, Math.min(afterIndex + 1, full.length - 1))
  full.splice(idx, 0, { x: clampNorm(point.x), y: clampNorm(point.y) })
  return sanitizeMids(full.slice(1, -1))
}

/** Actualiza el quiebre i-ésimo (0-based en mids). */
export function moveMidWaypoint(
  mids: NormPoint[],
  midIndex: number,
  point: NormPoint,
): NormPoint[] {
  if (midIndex < 0 || midIndex >= mids.length) return sanitizeMids(mids)
  const next = [...mids]
  next[midIndex] = { x: clampNorm(point.x), y: clampNorm(point.y) }
  return sanitizeMids(next)
}

/** Elimina el quiebre i-ésimo. */
export function removeMidWaypoint(
  mids: NormPoint[],
  midIndex: number,
): NormPoint[] {
  if (midIndex < 0 || midIndex >= mids.length) return sanitizeMids(mids)
  return sanitizeMids(mids.filter((_, i) => i !== midIndex))
}

/** Proyecta un punto al segmento más cercano; devuelve índice de inicio del segmento. */
export function nearestSegmentOnRoute(
  points: NormPoint[],
  px: number,
  py: number,
): { afterIndex: number; point: NormPoint; dist: number } {
  let best = {
    afterIndex: 0,
    point: points[0] ?? { x: px, y: py },
    dist: Infinity,
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    let t = len2 < 1e-12 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const qx = a.x + dx * t
    const qy = a.y + dy * t
    const dist = Math.hypot(px - qx, py - qy)
    if (dist < best.dist) {
      best = {
        afterIndex: i,
        point: { x: clampNorm(qx), y: clampNorm(qy) },
        dist,
      }
    }
  }
  return best
}

function poeCapable(nodes: DesignNetworkNode[]) {
  return nodes.filter((n) => n.kind === 'switch' || n.kind === 'nvr' || n.kind === 'injector')
}

function buildOneRoute(
  fromId: string,
  toId: string,
  fromLabel: string,
  toLabel: string,
  from: NormPoint,
  to: NormPoint,
  scale: ScaleCalibration,
  overrides: Record<string, NormPoint[]> | undefined,
): CableRoute {
  const key = cableRouteKey(fromId, toId)
  const mids = overrides?.[key]
  const points = composeRoutePoints(from, to, mids, scale)
  const straightM = distMeters(
    from.x,
    from.y,
    to.x,
    to.y,
    scale.metersPerNormX,
    scale.metersPerNormY,
  )
  const orthoM = pathLengthM(points, scale)
  const routeM = Math.round(orthoM * ROUTE_SLACK * 10) / 10
  const type = recommendCableType(routeM)
  const warning = cableWarning(routeM, type)
  return {
    id: makeCableRouteId(fromId, toId),
    fromId,
    toId,
    fromLabel,
    toLabel,
    points,
    straightM: Math.round(straightM * 10) / 10,
    routeM,
    type,
    certified: true,
    warn: !!warning || routeM > 100,
    warning,
  }
}

/**
 * Genera rutas de cable cámara→PoE y AP→switch con metros reales.
 * Si hay `overrides`, usa polilínea con varios quiebres (extremos vivos).
 */
export function buildCableRoutes(
  cameras: DesignCamera[],
  networkNodes: DesignNetworkNode[],
  scale: ScaleCalibration,
  overrides?: Record<string, NormPoint[]>,
): CableRoute[] {
  const routes: CableRoute[] = []
  const links = adviseCameraLinks(cameras, networkNodes, scale)
  const nodeById = new Map(networkNodes.map((n) => [n.id, n]))
  const camById = new Map(cameras.map((c) => [c.id, c]))

  for (const link of links) {
    if (!link.nearestNodeId) continue
    const cam = camById.get(link.cameraId)
    const node = nodeById.get(link.nearestNodeId)
    if (!cam || !node) continue
    routes.push(
      buildOneRoute(
        cam.id,
        node.id,
        cam.label,
        node.label,
        { x: cam.x, y: cam.y },
        { x: node.x, y: node.y },
        scale,
        overrides,
      ),
    )
  }

  const capable = poeCapable(networkNodes)
  for (const ap of networkNodes.filter((n) => n.kind === 'ap')) {
    let best: DesignNetworkNode | null = null
    let bestD = Infinity
    for (const p of capable) {
      const d = distMeters(
        ap.x,
        ap.y,
        p.x,
        p.y,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    if (!best) continue
    routes.push(
      buildOneRoute(
        ap.id,
        best.id,
        ap.label,
        best.label,
        { x: ap.x, y: ap.y },
        { x: best.x, y: best.y },
        scale,
        overrides,
      ),
    )
  }

  return routes
}

export function validateCableRoutes(routes: CableRoute[]): ValidationResult[] {
  const results: ValidationResult[] = []
  for (const r of routes) {
    if (r.routeM > 100 && r.type !== 'FIBER') {
      results.push({
        level: 'ERROR',
        code: 'CAB-001',
        message: `${r.fromLabel}→${r.toLabel}: ${r.routeM} m supera 100 m (${r.type})`,
        solution: 'Usar fibra óptica o repetidor / injector midspan',
        cameraId:
          r.fromId.startsWith('cam') || r.fromLabel.startsWith('CAM')
            ? r.fromId
            : undefined,
        nodeId: r.toId,
      })
    } else if (r.warning) {
      results.push({
        level: 'WARNING',
        code: 'CAB-002',
        message: `${r.fromLabel}→${r.toLabel}: ${r.warning}`,
        solution: 'Revisar longitud o tipo de cable',
        nodeId: r.toId,
      })
    }
  }

  const byTo = new Map<string, number>()
  for (const r of routes) {
    byTo.set(r.toId, (byTo.get(r.toId) ?? 0) + 1)
  }
  Array.from(byTo.entries()).forEach(([toId, count]) => {
    if (count >= 8) {
      const sample = routes.find((r) => r.toId === toId)
      results.push({
        level: 'INFO',
        code: 'CAB-RED-001',
        message: `${sample?.toLabel ?? toId}: ${count} cables en un solo nodo`,
        solution: 'Considera ruta/conducto redundante o segundo switch (fallo de conducto)',
        nodeId: toId,
      })
    }
  })

  return results
}

export function totalCableMeters(routes: CableRoute[]): number {
  return Math.round(routes.reduce((s, r) => s + r.routeM, 0) * 10) / 10
}
