import {
  ROUTE_SLACK,
  cableMaxM,
  cableTypeLabel,
  cableWarning,
  isDataCableType,
  recommendCableType,
} from '@/lib/netvision/services/cableCalculator'
import { adviseCameraLinks } from '@/lib/netvision/services/poeAnalyzer'
import type {
  CableRoute,
  DesignCableSegment,
  DesignCamera,
  DesignNetworkNode,
  ScaleCalibration,
  ValidationResult,
} from '@/lib/netvision/types'
import { distMeters } from '@/lib/netvision/utils/geometryHelpers'

/** Id de destino ficticio para cables dibujados a mano (no van a conducto). */
export const MANUAL_CABLE_TO_ID = 'manual'

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

/** Convierte un segmento dibujado en el plano a CableRoute. */
export function cableSegmentToRoute(
  seg: DesignCableSegment,
  scale: ScaleCalibration,
): CableRoute {
  const points = [
    { x: seg.x1, y: seg.y1 },
    { x: seg.x2, y: seg.y2 },
  ]
  const lengthM =
    Math.round(
      distMeters(
        seg.x1,
        seg.y1,
        seg.x2,
        seg.y2,
        scale.metersPerNormX,
        scale.metersPerNormY,
      ) * 10,
    ) / 10
  const warning = cableWarning(lengthM, seg.type)
  return {
    id: seg.id,
    fromId: seg.id,
    toId: MANUAL_CABLE_TO_ID,
    fromLabel: seg.label,
    toLabel: cableTypeLabel(seg.type),
    points,
    straightM: lengthM,
    routeM: lengthM,
    type: seg.type,
    certified: isDataCableType(seg.type),
    warn: !!warning || lengthM > cableMaxM(seg.type),
    warning,
  }
}

export function withManualCableSegments(
  autoRoutes: CableRoute[],
  segments: DesignCableSegment[],
  scale: ScaleCalibration,
): CableRoute[] {
  if (!segments.length) return autoRoutes
  const autoIds = new Set(autoRoutes.map((r) => r.id))
  const manual = segments
    .map((s) => cableSegmentToRoute(s, scale))
    .filter((r) => !autoIds.has(r.id))
  return [...autoRoutes, ...manual]
}

export function validateCableRoutes(routes: CableRoute[]): ValidationResult[] {
  const results: ValidationResult[] = []
  for (const r of routes) {
    const max = cableMaxM(r.type)
    if (r.routeM > max) {
      results.push({
        level: 'ERROR',
        code: 'CAB-001',
        message: `${r.fromLabel}→${r.toLabel}: ${r.routeM} m supera ${max} m (${cableTypeLabel(r.type)})`,
        solution:
          r.type === 'POWER_12V' || r.type === 'AUDIO'
            ? 'Acorta el tramo o usa calibre / amplificación adecuada'
            : 'Usar fibra óptica o repetidor / injector midspan',
        cameraId:
          r.fromId.startsWith('cam') || r.fromLabel.startsWith('CAM')
            ? r.fromId
            : undefined,
        nodeId: r.toId === MANUAL_CABLE_TO_ID ? undefined : r.toId,
      })
    } else if (r.warning) {
      results.push({
        level: 'WARNING',
        code: 'CAB-002',
        message: `${r.fromLabel}→${r.toLabel}: ${r.warning}`,
        solution: 'Revisar longitud o tipo de cable',
        nodeId: r.toId === MANUAL_CABLE_TO_ID ? undefined : r.toId,
      })
    }
  }

  // Redundancia de rutas: si un switch concentra >8 cables, avisar
  const byTo = new Map<string, number>()
  for (const r of routes) {
    if (r.toId === MANUAL_CABLE_TO_ID) continue
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
