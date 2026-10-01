import { effectiveCameraLenses } from '@/lib/netvision/catalog/cameras'
import { getStructureMaterialOrDefault } from '@/lib/netvision/catalog/materials'
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
  pointInPolygon,
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

/**
 * Semáforo en metros de ficha (`catalogRangeM`), no del cono estirado.
 * Estirar el anillo solo alarga el rojo; el verde de 2 m sigue en 2 m.
 */
export function visionBandForDistance(
  distanceM: number,
  drawnRangeM: number,
  catalogRangeM = drawnRangeM,
): VisionBand | null {
  if (drawnRangeM <= 0 || distanceM < 0 || distanceM > drawnRangeM + 1e-6) return null
  const qualityM = Math.max(catalogRangeM, 1e-6)
  if (distanceM <= qualityM * VISION_BAND_FRAC.greenMax) return 'green'
  if (distanceM <= qualityM * VISION_BAND_FRAC.yellowMax) return 'yellow'
  return 'red'
}

/** Mayor = mejor detección. Verde prevalece sobre naranja; naranja sobre rojo. */
export function visionBandRank(band: VisionBand): number {
  if (band === 'green') return 3
  if (band === 'yellow') return 2
  return 1
}

/** En un solape, qué banda se muestra (calidad de detección, no mezcla). */
export function preferredVisionBand(a: VisionBand, b: VisionBand): VisionBand {
  return visionBandRank(a) >= visionBandRank(b) ? a : b
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

/**
 * Metros de cada banda.
 * Verde/amarillo salen de la ficha (`catalogRangeM`); el rojo llega al borde dibujado.
 */
export function visionBandRangesM(
  drawnRangeM: number,
  catalogRangeM = drawnRangeM,
): {
  greenMaxM: number
  yellowMaxM: number
  redMaxM: number
} {
  const qualityM = Math.max(catalogRangeM, 0)
  const drawn = Math.max(drawnRangeM, 0)
  return {
    greenMaxM: round1(Math.min(drawn, qualityM * VISION_BAND_FRAC.greenMax)),
    yellowMaxM: round1(Math.min(drawn, qualityM * VISION_BAND_FRAC.yellowMax)),
    redMaxM: round1(drawn),
  }
}

function hasOpaqueWalls(structures: DesignStructure[]): boolean {
  return structures.some((s) => getStructureMaterialOrDefault(s.materialId).blocksVision)
}

export function buildCoverageSectors(
  cameras: DesignCamera[],
  scale: ScaleCalibration,
  mode: 'day' | 'night' = 'day',
  structures: DesignStructure[] = [],
): CoverageSector[] {
  return cameras.flatMap((cam) => {
    const lenses = effectiveCameraLenses(cam, mode)
    return lenses.map((lens) => {
      const radiusNorm = metersToNormRadius(
        lens.rangeM,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      const bands = visionBandRangesM(lens.rangeM, lens.catalogRangeM)
      const { startAngleRad, endAngleRad } = fovSectorAngles(
        lens.yawDeg,
        lens.fovLeftDeg,
        lens.fovRightDeg,
      )
      // Siempre polígono: recorta contra muros opacos (drywall/bloque/concreto)
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
        lensId: lens.lensId,
        cx: cam.x,
        cy: cam.y,
        radiusNorm,
        startAngleRad,
        endAngleRad,
        mode,
        polygon,
        greenRadiusNorm: metersToNormRadius(
          bands.greenMaxM,
          scale.metersPerNormX,
          scale.metersPerNormY,
        ),
        yellowRadiusNorm: metersToNormRadius(
          bands.yellowMaxM,
          scale.metersPerNormX,
          scale.metersPerNormY,
        ),
      }
    })
  })
}

/**
 * Espectro de visión CCTV con semáforo de cobertura automática:
 * verde = detección objetos/personas, amarillo = más lejos,
 * rojo = detección dudosa pero con visión.
 * Las celdas solo cuentan si caen dentro del polígono FOV recortado por muros.
 */
export function buildVisionSpectrum(
  cameras: DesignCamera[],
  scale: ScaleCalibration,
  mode: 'day' | 'night' = 'day',
  structures: DesignStructure[] = [],
  grid = 64,
): SpectrumCell[] {
  if (cameras.length === 0) return []

  const opaque = hasOpaqueWalls(structures)
  const resolvedGrid = opaque ? Math.max(grid, 56) : grid

  const prepared = cameras.flatMap((cam) =>
    effectiveCameraLenses(cam, mode).map((lens) => {
      const radiusNorm = metersToNormRadius(
        lens.rangeM,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      const { startAngleRad, endAngleRad } = fovSectorAngles(
        lens.yawDeg,
        lens.fovLeftDeg,
        lens.fovRightDeg,
      )
      const polygon = buildFovPolygon(
        cam.x,
        cam.y,
        radiusNorm,
        startAngleRad,
        endAngleRad,
        structures,
      )
      return {
        cam,
        rangeM: lens.rangeM,
        catalogRangeM: lens.catalogRangeM,
        radiusNorm,
        startAngleRad,
        endAngleRad,
        polygon,
      }
    }),
  )

  const cell = 1 / resolvedGrid
  const cells: SpectrumCell[] = []

  for (let iy = 0; iy < resolvedGrid; iy++) {
    for (let ix = 0; ix < resolvedGrid; ix++) {
      const px = (ix + 0.5) * cell
      const py = (iy + 0.5) * cell
      let bestBand: VisionBand | null = null
      let bestStrength = 0
      for (const p of prepared) {
        // Fuente de verdad: polígono FOV ya recortado por drywall/bloque/concreto
        if (!pointInPolygon(px, py, p.polygon)) continue
        if (!hasClearVision(p.cam.x, p.cam.y, px, py, structures)) continue
        const d = distMeters(
          p.cam.x,
          p.cam.y,
          px,
          py,
          scale.metersPerNormX,
          scale.metersPerNormY,
        )
        const band = visionBandForDistance(d, p.rangeM, p.catalogRangeM)
        if (!band) continue
        const strength = Math.max(0.15, 1 - d / Math.max(p.catalogRangeM, 1))
        if (
          !bestBand ||
          visionBandRank(band) > visionBandRank(bestBand) ||
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
        if (s.polygon && s.polygon.length >= 3) {
          return pointInPolygon(px, py, s.polygon)
        }
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
