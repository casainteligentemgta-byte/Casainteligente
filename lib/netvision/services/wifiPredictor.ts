import { getNetworkModelOrDefault } from '@/lib/netvision/catalog/network'
import { wifiLossBetween } from '@/lib/netvision/services/structureAttenuation'
import type {
  DesignNetworkNode,
  DesignStructure,
  ScaleCalibration,
  SpectrumCell,
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

/** Mapa de calor WiFi con atenuación por muros/vidrio. */
export function buildWifiSpectrum(
  nodes: DesignNetworkNode[],
  scale: ScaleCalibration,
  structures: DesignStructure[] = [],
  grid = 28,
): SpectrumCell[] {
  const aps = nodes.filter((n) => n.kind === 'ap')
  if (aps.length === 0) return []

  const cell = 1 / grid
  const cells: SpectrumCell[] = []
  const minDbm = -85
  const maxDbm = -45

  for (let iy = 0; iy < grid; iy++) {
    for (let ix = 0; ix < grid; ix++) {
      const px = (ix + 0.5) * cell
      const py = (iy + 0.5) * cell
      let best = -999
      for (const ap of aps) {
        const d = distMeters(
          ap.x,
          ap.y,
          px,
          py,
          scale.metersPerNormX,
          scale.metersPerNormY,
        )
        const loss = wifiLossBetween(ap.x, ap.y, px, py, structures)
        const rssi = estimateRssiDbm(d) - loss
        if (rssi > best) best = rssi
      }
      if (best < minDbm) continue
      const strength = Math.min(1, Math.max(0, (best - minDbm) / (maxDbm - minDbm)))
      cells.push({
        x: ix * cell,
        y: iy * cell,
        w: cell,
        h: cell,
        strength,
      })
    }
  }
  return cells
}

export function analyzeWifiCoverage(
  nodes: DesignNetworkNode[],
  scale: ScaleCalibration,
  grid = 20,
  structures: DesignStructure[] = [],
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

  const spectrum = buildWifiSpectrum(nodes, scale, structures, grid)
  const total = grid * grid
  const covered = spectrum.filter((c) => c.strength >= 0.35).length
  const ratio = covered / total
  const results: ValidationResult[] = []
  if (ratio < 0.5) {
    results.push({
      level: 'WARNING',
      code: 'WIFI-010',
      message: `Cobertura WiFi útil ~${Math.round(ratio * 100)}% del plano`,
      solution: 'Agrega APs o revisa muros de bloque que atenuán la señal',
    })
  } else {
    results.push({
      level: 'INFO',
      code: 'WIFI-OK',
      message: `Cobertura WiFi útil ~${Math.round(ratio * 100)}% (con muros)`,
      solution: 'Mantén separación de canales entre APs cercanos',
    })
  }

  // APs demasiado cercanos
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
          code: 'WIFI-020',
          message: `${a.label} y ${b.label} están a ${d.toFixed(1)} m`,
          solution: 'Separa APs o asigna canales no solapados',
          nodeId: a.id,
        })
      }
    }
  }

  return results
}
