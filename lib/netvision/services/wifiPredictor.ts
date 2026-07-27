import { getNetworkModelOrDefault } from '@/lib/netvision/catalog/network'
import { getStructureMaterialOrDefault } from '@/lib/netvision/catalog/materials'
import {
  buildFovPolygon,
  hasClearVision,
  wifiLossBetween,
} from '@/lib/netvision/services/structureAttenuation'
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
  /** Cobertura 360° recortada por muros opacos (drywall/bloque/concreto). */
  polygon?: { x: number; y: number }[]
}

function hasOpaqueWalls(structures: DesignStructure[]): boolean {
  return structures.some((s) =>
    getStructureMaterialOrDefault(s.materialId).blocksVision,
  )
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
  structures: DesignStructure[] = [],
): WifiCoverageCircle[] {
  return nodes
    .filter((n) => n.kind === 'ap')
    .map((n) => {
      const m = getNetworkModelOrDefault(n.modelId, 'ap')
      const rangeM = m.wifiRangeM > 0 ? m.wifiRangeM : usefulRangeM(-70)
      const radiusNorm = metersToNormRadius(
        rangeM,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      const polygon =
        structures.length > 0
          ? buildFovPolygon(
              n.x,
              n.y,
              radiusNorm,
              0,
              Math.PI * 2,
              structures,
              128,
            )
          : undefined
      return {
        nodeId: n.id,
        cx: n.x,
        cy: n.y,
        radiusNorm,
        edgeDbm: estimateRssiDbm(rangeM),
        polygon,
      }
    })
}

/**
 * Mapa de calor WiFi:
 * - Drywall / bloque / concreto: cortan el espectro (sin celdas al otro lado).
 * - Vidrio / ventana / puerta: atenúan (wifiLossDb) sin cortar.
 */
export function buildWifiSpectrum(
  nodes: DesignNetworkNode[],
  scale: ScaleCalibration,
  structures: DesignStructure[] = [],
  grid = 28,
): SpectrumCell[] {
  const aps = nodes.filter((n) => n.kind === 'ap')
  if (aps.length === 0) return []

  const opaque = hasOpaqueWalls(structures)
  const resolvedGrid = opaque ? Math.max(grid, 48) : grid
  const cell = 1 / resolvedGrid
  const cells: SpectrumCell[] = []
  const minDbm = -85
  const maxDbm = -45

  for (let iy = 0; iy < resolvedGrid; iy++) {
    for (let ix = 0; ix < resolvedGrid; ix++) {
      const px = (ix + 0.5) * cell
      const py = (iy + 0.5) * cell
      let best = -999
      for (const ap of aps) {
        // Muros opacos: no hay cobertura al otro lado (igual que visión CCTV).
        if (!hasClearVision(ap.x, ap.y, px, py, structures)) continue
        const d = distMeters(
          ap.x,
          ap.y,
          px,
          py,
          scale.metersPerNormX,
          scale.metersPerNormY,
        )
        // Vidrio / ventana / puerta siguen atenuando sin cortar.
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
  const resolvedGrid = hasOpaqueWalls(structures) ? Math.max(grid, 48) : grid
  const total = resolvedGrid * resolvedGrid
  const covered = spectrum.filter((c) => c.strength >= 0.35).length
  const ratio = covered / total
  const results: ValidationResult[] = []
  if (ratio < 0.5) {
    results.push({
      level: 'WARNING',
      code: 'WIFI-010',
      message: `Cobertura WiFi útil ~${Math.round(ratio * 100)}% del plano`,
      solution: 'Agrega APs o revisa muros de bloque/concreto que cortan la señal',
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
