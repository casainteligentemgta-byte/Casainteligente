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

/** Ruta ortogonal L (horizontal→vertical) en coords normalizadas. */
export function orthogonalPath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  prefer: 'hv' | 'vh' = 'hv',
): { x: number; y: number }[] {
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

function pathLengthM(
  points: { x: number; y: number }[],
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
): { x: number; y: number }[] {
  const hv = orthogonalPath(ax, ay, bx, by, 'hv')
  const vh = orthogonalPath(ax, ay, bx, by, 'vh')
  return pathLengthM(hv, scale) <= pathLengthM(vh, scale) ? hv : vh
}

function poeCapable(nodes: DesignNetworkNode[]) {
  return nodes.filter((n) => n.kind === 'switch' || n.kind === 'nvr' || n.kind === 'injector')
}

/**
 * Genera rutas de cable cámara→PoE y AP→switch con metros reales (ortogonal + holgura).
 */
export function buildCableRoutes(
  cameras: DesignCamera[],
  networkNodes: DesignNetworkNode[],
  scale: ScaleCalibration,
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
    const points = pickShorterPath(cam.x, cam.y, node.x, node.y, scale)
    const straightM = distMeters(
      cam.x,
      cam.y,
      node.x,
      node.y,
      scale.metersPerNormX,
      scale.metersPerNormY,
    )
    const orthoM = pathLengthM(points, scale)
    const routeM = Math.round(orthoM * ROUTE_SLACK * 10) / 10
    const type = recommendCableType(routeM)
    const warning = cableWarning(routeM, type)
    routes.push({
      id: `cable-${cam.id}-${node.id}`,
      fromId: cam.id,
      toId: node.id,
      fromLabel: cam.label,
      toLabel: node.label,
      points,
      straightM: Math.round(straightM * 10) / 10,
      routeM,
      type,
      certified: true,
      warn: !!warning || routeM > 100,
      warning,
    })
  }

  // APs → PoE más cercano
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
    const points = pickShorterPath(ap.x, ap.y, best.x, best.y, scale)
    const orthoM = pathLengthM(points, scale)
    const routeM = Math.round(orthoM * ROUTE_SLACK * 10) / 10
    const type = recommendCableType(routeM)
    const warning = cableWarning(routeM, type)
    routes.push({
      id: `cable-${ap.id}-${best.id}`,
      fromId: ap.id,
      toId: best.id,
      fromLabel: ap.label,
      toLabel: best.label,
      points,
      straightM: Math.round(bestD * 10) / 10,
      routeM,
      type,
      certified: true,
      warn: !!warning || routeM > 100,
      warning,
    })
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
        cameraId: r.fromId.startsWith('cam') || r.fromLabel.startsWith('CAM') ? r.fromId : undefined,
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

  // Redundancia de rutas: si un switch concentra >8 cables, avisar
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
