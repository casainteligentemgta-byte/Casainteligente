import { effectiveCameraVision } from '@/lib/netvision/catalog/cameras'
import {
  buildFovPolygon,
  hasClearVision,
} from '@/lib/netvision/services/structureAttenuation'
import type {
  CoverageSector,
  DesignCamera,
  DesignStructure,
  ScaleCalibration,
  SpectrumCell,
  VisionBand,
} from '@/lib/netvision/types'
import {
  distMeters,
  fovSectorAngles,
  metersToNormRadius,
  pointInSector,
} from '@/lib/netvision/utils/geometryHelpers'

/** Fracciones del alcance: verde detección, amarillo lejos, rojo dudoso. */
export const VISION_BAND_FRAC = {
  greenMax: 0.4,
  yellowMax: 0.7,
} as const

export function defaultScale(): ScaleCalibration {
  // Asume plano ~40 m de ancho si no hay calibración
  return {
    metersPerNormX: 40,
    metersPerNormY: 40,
    calibrated: false,
  }
}

export function visionBandForDistance(
  distanceM: number,
  rangeM: number,
): VisionBand | null {
  if (rangeM <= 0 || distanceM < 0 || distanceM > rangeM + 1e-6) return null
  const t = distanceM / rangeM
  if (t <= VISION_BAND_FRAC.greenMax) return 'green'
  if (t <= VISION_BAND_FRAC.yellowMax) return 'yellow'
  return 'red'
}

function bandRank(band: VisionBand): number {
  if (band === 'green') return 3
  if (band === 'yellow') return 2
  return 1
}

/** Metros por banda de semáforo según el alcance efectivo. */
export function visionBandRangesM(rangeM: number): {
  greenMaxM: number
  yellowMaxM: number
  redMaxM: number
} {
  return {
    greenMaxM: Math.round(rangeM * VISION_BAND_FRAC.greenMax * 10) / 10,
    yellowMaxM: Math.round(rangeM * VISION_BAND_FRAC.yellowMax * 10) / 10,
    redMaxM: Math.round(rangeM * 10) / 10,
  }
}

export function buildCoverageSectors(
  cameras: DesignCamera[],
  scale: ScaleCalibration,
  mode: 'day' | 'night' = 'day',
  structures: DesignStructure[] = [],
): CoverageSector[] {
  return cameras.map((cam) => {
    const { fovDeg, rangeM, yawDeg } = effectiveCameraVision(cam, mode)
    const radiusNorm = metersToNormRadius(
      rangeM,
      scale.metersPerNormX,
      scale.metersPerNormY,
    )
    const { startAngleRad, endAngleRad } = fovSectorAngles(yawDeg, fovDeg)
    // Siempre polígono: recorta contra muros opacos (drywall/bloque)
    const polygon = buildFovPolygon(
      cam.x,
      cam.y,
      radiusNorm,
      startAngleRad,
      endAngleRad,
      structures,
    )
    return {
      cameraId: cam.id,
      cx: cam.x,
      cy: cam.y,
      radiusNorm,
      startAngleRad,
      endAngleRad,
      mode,
      polygon,
    }
  })
}

/**
 * Espectro de visión CCTV con semáforo de cobertura automática:
 * verde = detección objetos/personas, amarillo = más lejos,
 * rojo = detección dudosa pero con visión.
 */
export function buildVisionSpectrum(
  cameras: DesignCamera[],
  scale: ScaleCalibration,
  mode: 'day' | 'night' = 'day',
  structures: DesignStructure[] = [],
  grid = 36,
): SpectrumCell[] {
  if (cameras.length === 0) return []

  const prepared = cameras.map((cam) => {
    const { fovDeg, rangeM, yawDeg } = effectiveCameraVision(cam, mode)
    const radiusNorm = metersToNormRadius(
      rangeM,
      scale.metersPerNormX,
      scale.metersPerNormY,
    )
    const { startAngleRad, endAngleRad } = fovSectorAngles(yawDeg, fovDeg)
    return { cam, rangeM, radiusNorm, startAngleRad, endAngleRad }
  })

  const cell = 1 / grid
  const cells: SpectrumCell[] = []

  for (let iy = 0; iy < grid; iy++) {
    for (let ix = 0; ix < grid; ix++) {
      const px = (ix + 0.5) * cell
      const py = (iy + 0.5) * cell
      let bestBand: VisionBand | null = null
      let bestStrength = 0
      for (const p of prepared) {
        if (
          !pointInSector(
            px,
            py,
            p.cam.x,
            p.cam.y,
            p.radiusNorm,
            p.startAngleRad,
            p.endAngleRad,
          )
        ) {
          continue
        }
        if (!hasClearVision(p.cam.x, p.cam.y, px, py, structures)) continue
        const d = distMeters(
          p.cam.x,
          p.cam.y,
          px,
          py,
          scale.metersPerNormX,
          scale.metersPerNormY,
        )
        const band = visionBandForDistance(d, p.rangeM)
        if (!band) continue
        const strength = Math.max(0.15, 1 - d / Math.max(p.rangeM, 1))
        if (
          !bestBand ||
          bandRank(band) > bandRank(bestBand) ||
          (band === bestBand && strength > bestStrength)
        ) {
          bestBand = band
          bestStrength = strength
        }
      }
      if (!bestBand) continue
      cells.push({
        x: ix * cell,
        y: iy * cell,
        w: cell,
        h: cell,
        strength: bestStrength,
        band: bestBand,
      })
    }
  }
  return cells
}

/** Fracción de celdas de una grilla cubiertas por al menos un sector. */
export function estimateCoverageRatio(
  sectors: CoverageSector[],
  grid = 24,
  structures: DesignStructure[] = [],
): { coveredRatio: number; uncoveredCells: number; totalCells: number } {
  if (sectors.length === 0) {
    return { coveredRatio: 0, uncoveredCells: grid * grid, totalCells: grid * grid }
  }

  let covered = 0
  const total = grid * grid
  for (let iy = 0; iy < grid; iy++) {
    for (let ix = 0; ix < grid; ix++) {
      const px = (ix + 0.5) / grid
      const py = (iy + 0.5) / grid
      const hit = sectors.some((s) => {
        if (
          !pointInSector(
            px,
            py,
            s.cx,
            s.cy,
            s.radiusNorm,
            s.startAngleRad,
            s.endAngleRad,
          )
        ) {
          return false
        }
        return hasClearVision(s.cx, s.cy, px, py, structures)
      })
      if (hit) covered++
    }
  }
  return {
    coveredRatio: covered / total,
    uncoveredCells: total - covered,
    totalCells: total,
  }
}
