import { effectiveCameraLenses } from '@/lib/netvision/catalog/cameras'
import { getStructureMaterialOrDefault } from '@/lib/netvision/catalog/materials'
import { alcanceUtilCamara } from '@/lib/netvision/services/dimensionamiento'
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
 * Dispositivos de plano (no CCTV): el metraje de ficha es verde.
 * Naranja solo aparece si se pasa `yellowExtraM`. Estirar el cono pinta rojo.
 */
export const VISION_BAND_FRAC = {
  greenMax: 1,
  yellowMax: 1,
} as const

/** En cámaras CCTV, naranja = 1 m más allá de identificar un rostro. */
export const FACE_ID_YELLOW_EXTRA_M = 1

export type VisionBandQuality = {
  /** Límite verde en metros. Cámaras: `identificarM`. Sin valor: ficha. */
  greenMaxM?: number
  /** Metros naranja después del verde. Cámaras: 1. Resto: 0. */
  yellowExtraM?: number
}

/** Semáforo CCTV: verde identifica rostros; naranja son 1 m más. */
export function cameraVisionBandQuality(
  cam: DesignCamera,
  lensId?: string,
): VisionBandQuality {
  const alcance = alcanceUtilCamara(cam)
  const lente =
    (lensId ? alcance.lentes.find((x) => x.lensId === lensId) : undefined) ??
    alcance.lentes[0]
  return {
    greenMaxM: Math.max(0, lente?.identificarM ?? 0),
    yellowExtraM: FACE_ID_YELLOW_EXTRA_M,
  }
}

function resolveBandQualityM(
  catalogRangeM: number,
  quality?: VisionBandQuality,
): { greenQualityM: number; yellowQualityM: number } {
  const catalog = Math.max(catalogRangeM, 0)
  const greenQualityM =
    typeof quality?.greenMaxM === 'number' && Number.isFinite(quality.greenMaxM)
      ? Math.max(0, quality.greenMaxM)
      : catalog * VISION_BAND_FRAC.greenMax
  const yellowExtraM =
    typeof quality?.yellowExtraM === 'number' && Number.isFinite(quality.yellowExtraM)
      ? Math.max(0, quality.yellowExtraM)
      : 0
  return {
    greenQualityM,
    yellowQualityM: greenQualityM + yellowExtraM,
  }
}

export function defaultScale(): ScaleCalibration {
  // Asume plano ~40 m de ancho si no hay calibración
  return {
    metersPerNormX: 40,
    metersPerNormY: 40,
    calibrated: false,
  }
}

/**
 * Semáforo en metros de calidad, no del cono estirado.
 * Cámaras: verde = identificar rostros; naranja = +1 m; rojo = resto.
 * Sin `quality`: verde = ficha (`catalogRangeM`). Estirar solo alarga el rojo.
 */
export function visionBandForDistance(
  distanceM: number,
  drawnRangeM: number,
  catalogRangeM = drawnRangeM,
  quality?: VisionBandQuality,
): VisionBand | null {
  if (drawnRangeM <= 0 || distanceM < 0 || distanceM > drawnRangeM + 1e-6) return null
  const { greenQualityM, yellowQualityM } = resolveBandQualityM(catalogRangeM, quality)
  if (distanceM <= greenQualityM + 1e-6) return 'green'
  if (distanceM <= yellowQualityM + 1e-6) return 'yellow'
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
 * Cámaras: verde = identificar; naranja = +1 m; rojo = borde dibujado.
 * Sin `quality`: verde = ficha (`catalogRangeM`).
 */
export function visionBandRangesM(
  drawnRangeM: number,
  catalogRangeM = drawnRangeM,
  quality?: VisionBandQuality,
): {
  greenMaxM: number
  yellowMaxM: number
  redMaxM: number
} {
  const drawn = Math.max(drawnRangeM, 0)
  const { greenQualityM, yellowQualityM } = resolveBandQualityM(catalogRangeM, quality)
  return {
    greenMaxM: round1(Math.min(drawn, greenQualityM)),
    yellowMaxM: round1(Math.min(drawn, yellowQualityM)),
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
      const bands = visionBandRangesM(
        ground.farM,
        lens.catalogRangeM,
        cameraVisionBandQuality(cam, lens.lensId),
      )
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
 * verde = identifica un rostro, naranja = 1 m más, rojo = resto del cono.
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
        quality: cameraVisionBandQuality(cam, lens.lensId),
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
        const band = visionBandForDistance(d, p.rangeM, p.catalogRangeM, p.quality)
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
