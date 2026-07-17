import { getNetworkModelOrDefault } from '@/lib/netvision/catalog/network'
import type {
  DesignNetworkNode,
  ScaleCalibration,
  ValidationResult,
} from '@/lib/netvision/types'
import {
  distMeters,
  metersToNormRadius,
} from '@/lib/netvision/utils/geometryHelpers'

export type WifiCoverageCircle = {
  nodeId: string
  cx: number
  cy: number
  radiusNorm: number
  /** dBm estimado en el borde del radio útil */
  edgeDbm: number
}

/**
 * Path-loss log-distance simplificado (indoor):
 * RSSI = txPower - (PL0 + 10*n*log10(d))
 * n≈2.8 indoor, PL0≈40 @1m, txPower≈20 dBm
 */
export function estimateRssiDbm(distanceM: number): number {
  const d = Math.max(1, distanceM)
  const tx = 20
  const pl0 = 40
  const n = 2.8
  return tx - (pl0 + 10 * n * Math.log10(d))
}

/** Radio útil hasta umbral RSSI (default −70 dBm). */
export function usefulRangeM(thresholdDbm = -70): number {
  // Invertir fórmula: threshold = 20 - (40 + 10*2.8*log10(d))
  // 10*2.8*log10(d) = 20 - 40 - threshold = -20 - threshold
  const rhs = -20 - thresholdDbm
  const logd = rhs / (10 * 2.8)
  return Math.pow(10, logd)
}

export function buildWifiCoverage(
  nodes: DesignNetworkNode[],
  scale: ScaleCalibration,
): WifiCoverageCircle[] {
  return nodes
    .filter((n) => n.kind === 'ap')
    .map((n) => {
      const m = getNetworkModelOrDefault(n.modelId, 'ap')
      const rangeM = m.wifiRangeM > 0 ? m.wifiRangeM : usefulRangeM(-70)
      return {
        nodeId: n.id,
        cx: n.x,
        cy: n.y,
        radiusNorm: metersToNormRadius(
          rangeM,
          scale.metersPerNormX,
          scale.metersPerNormY,
        ),
        edgeDbm: estimateRssiDbm(rangeM),
      }
    })
}

export function analyzeWifiCoverage(
  nodes: DesignNetworkNode[],
  scale: ScaleCalibration,
  grid = 20,
): ValidationResult[] {
  const aps = nodes.filter((n) => n.kind === 'ap')
  if (aps.length === 0) {
    return [
      {
        level: 'INFO',
        code: 'WIFI-000',
        message: 'Sin APs en el plano — cobertura WiFi no evaluada',
        solution: 'Coloca APs en modo Red si necesitas WiFi de sitio',
      },
    ]
  }

  const circles = buildWifiCoverage(nodes, scale)
  let covered = 0
  const total = grid * grid
  for (let iy = 0; iy < grid; iy++) {
    for (let ix = 0; ix < grid; ix++) {
      const px = (ix + 0.5) / grid
      const py = (iy + 0.5) / grid
      const hit = circles.some((c) => {
        const dx = px - c.cx
        const dy = py - c.cy
        return Math.hypot(dx, dy) <= c.radiusNorm
      })
      if (hit) covered++
    }
  }
  const ratio = covered / total
  const results: ValidationResult[] = []
  if (ratio < 0.5) {
    results.push({
      level: 'WARNING',
      code: 'WIFI-001',
      message: `Cobertura WiFi estimada ${(ratio * 100).toFixed(0)}% del plano`,
      solution: 'Agrega APs o reubícalos hacia zonas descubiertas',
    })
  } else {
    results.push({
      level: 'INFO',
      code: 'WIFI-OK',
      message: `Cobertura WiFi estimada ${(ratio * 100).toFixed(0)}%`,
      solution: 'Verifica interferencias y canales en el panel Red',
    })
  }

  // APs demasiado cerca
  for (let i = 0; i < aps.length; i++) {
    for (let j = i + 1; j < aps.length; j++) {
      const a = aps[i]!
      const b = aps[j]!
      const d = distMeters(
        a.x,
        a.y,
        b.x,
        b.y,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      if (d < 6) {
        results.push({
          level: 'WARNING',
          code: 'WIFI-002',
          message: `${a.label} y ${b.label} están a ${d.toFixed(1)} m (posible co-channel)`,
          solution: 'Separa APs o asigna canales no solapados',
          nodeId: a.id,
        })
      }
    }
  }

  return results
}
