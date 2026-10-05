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
import { projectGroundCoverage } from '@/lib/netvision/utils/cameraMount'
import {
  distMeters,
  fovSectorAngles,
  metersToNormRadius,
  pointInPolygon,
  pointInSector,
  planIso,
  type PlanIso,
} from '@/lib/netvision/utils/geometryHelpers'

/**
 * El metraje de visualización de la ficha (día/noche) es verde.
 * Naranja no recorta esa ficha: solo aparece si un día se define un tramo extra.
 * Estirar el cono más allá de la ficha pinta rojo.
 */
export const VISION_BAND_FRAC = {
  greenMax: 1,
  yellowMax: 1,
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
 * Verde = metraje de visualización de la ficha. Estirar el anillo solo alarga el rojo.
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
 * Verde = ficha (`catalogRangeM`). El rojo llega al borde dibujado si se estira.
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

/**
 * Anillos exclusivos del semáforo (verde / naranja / rojo), recortados por muros.
 * No se apilan: Konva aplica la opacidad por polígono y si se solapan
 * el verde se ensucia con el naranja.
 */
export function coverageBandPolygons(opts: {
  cx: number
  cy: number
  startAngleRad: number
  endAngleRad: number
  innerRadiusNorm: number
  greenRadiusNorm: number
  yellowRadiusNorm: number
  redRadiusNorm?: number
  structures: DesignStructure[]
  /** Proporción del plano (sin ella se asume cuadrado). */
  iso?: PlanIso
}): Pick<CoverageSector, 'greenPolygon' | 'yellowPolygon' | 'redPolygon'> {
  const inner = Math.max(0, opts.innerRadiusNorm)
  const greenR = Math.max(0, opts.greenRadiusNorm)
  const yellowR = Math.max(0, opts.yellowRadiusNorm)
  const redR = Math.max(0, opts.redRadiusNorm ?? 0)
  const rays = 96
  const ring = (outer: number, hole: number) =>
    outer > hole + 1e-4
      ? buildFovPolygon(
          opts.cx,
          opts.cy,
          outer,
          opts.startAngleRad,
          opts.endAngleRad,
          opts.structures,
          rays,
          hole,
          opts.iso,
        )
      : undefined
  return {
    greenPolygon: ring(greenR, inner),
    yellowPolygon: ring(yellowR, Math.max(inner, greenR)),
    redPolygon: ring(redR, Math.max(inner, yellowR)),
  }
}

function hasOpaqueWalls(structures: DesignStructure[]): boolean {
  return structures.some((s) => getStructureMaterialOrDefault(s.materialId).blocksVision)
}

function lensGroundOnPlan(
  cam: DesignCamera,
  lens: { fovDeg: number; rangeM: number },
  scale: ScaleCalibration,
) {
  const ground = projectGroundCoverage({
    heightM: cam.mountHeightM,
    tiltDeg: cam.tiltDeg ?? 0,
    hFovDeg: lens.fovDeg,
    rangeM: lens.rangeM,
  })
  return {
    nearM: ground.nearM,
    farM: ground.farM,
    innerRadiusNorm: metersToNormRadius(
      ground.nearM,
      scale.metersPerNormX,
      scale.metersPerNormY,
    ),
    radiusNorm: metersToNormRadius(
      ground.farM,
      scale.metersPerNormX,
      scale.metersPerNormY,
    ),
  }
}

export function buildCoverageSectors(
  cameras: DesignCamera[],
  scale: ScaleCalibration,
  mode: 'day' | 'night' = 'day',
  structures: DesignStructure[] = [],
): CoverageSector[] {
  // En un plano que no es cuadrado, el cono se traza con su proporción real.
  const iso = planIso(scale.metersPerNormX, scale.metersPerNormY)
  return cameras.flatMap((cam) => {
    const lenses = effectiveCameraLenses(cam, mode)
    return lenses.map((lens) => {
      const ground = lensGroundOnPlan(cam, lens, scale)
      const { startAngleRad, endAngleRad } = fovSectorAngles(
        lens.yawDeg,
        lens.fovLeftDeg,
        lens.fovRightDeg,
      )
      // Siempre polígono: recorta contra muros opacos (drywall/bloque/concreto)
      const polygon = buildFovPolygon(
        cam.x,
        cam.y,
        ground.radiusNorm,
        startAngleRad,
        endAngleRad,
        structures,
        96,
        ground.innerRadiusNorm,
        iso,
      )
      const bands = visionBandRangesM(ground.farM, lens.catalogRangeM)
      const greenRadiusNorm = metersToNormRadius(
        bands.greenMaxM,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      const yellowRadiusNorm = metersToNormRadius(
        bands.yellowMaxM,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      return {
        cameraId: cam.id,
        lensId: lens.lensId,
        cx: cam.x,
        cy: cam.y,
        radiusNorm: ground.radiusNorm,
        innerRadiusNorm: ground.innerRadiusNorm,
        startAngleRad,
        endAngleRad,
        mode,
        polygon,
        greenRadiusNorm,
        yellowRadiusNorm,
        ...coverageBandPolygons({
          cx: cam.x,
          cy: cam.y,
          startAngleRad,
          endAngleRad,
          innerRadiusNorm: ground.innerRadiusNorm,
          greenRadiusNorm,
          yellowRadiusNorm,
          redRadiusNorm: ground.radiusNorm,
          structures,
          iso,
        }),
      }
    })
  })
}

/**
 * Espectro de visión CCTV con semáforo de cobertura automática:
 * verde = metraje de visualización de la ficha,
 * rojo = más allá de la ficha (cono estirado).
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
  const iso = planIso(scale.metersPerNormX, scale.metersPerNormY)

  const prepared = cameras.flatMap((cam) =>
    effectiveCameraLenses(cam, mode).map((lens) => {
      const ground = lensGroundOnPlan(cam, lens, scale)
      const { startAngleRad, endAngleRad } = fovSectorAngles(
        lens.yawDeg,
        lens.fovLeftDeg,
        lens.fovRightDeg,
      )
      const polygon = buildFovPolygon(
        cam.x,
        cam.y,
        ground.radiusNorm,
        startAngleRad,
        endAngleRad,
        structures,
        96,
        ground.innerRadiusNorm,
        iso,
      )
      return {
        cam,
        rangeM: ground.farM,
        catalogRangeM: lens.catalogRangeM,
        nearM: ground.nearM,
        radiusNorm: ground.radiusNorm,
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
        if (d + 1e-6 < p.nearM) continue
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
  iso?: PlanIso,
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
            iso,
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
