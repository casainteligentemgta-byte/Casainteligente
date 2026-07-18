import { getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
import { buildFovPolygon } from '@/lib/netvision/services/structureAttenuation'
import type {
  CoverageSector,
  DesignCamera,
  DesignStructure,
  ScaleCalibration,
} from '@/lib/netvision/types'
import {
  fovSectorAngles,
  metersToNormRadius,
  pointInSector,
} from '@/lib/netvision/utils/geometryHelpers'

export function defaultScale(): ScaleCalibration {
  // Asume plano ~40 m de ancho si no hay calibración
  return {
    metersPerNormX: 40,
    metersPerNormY: 40,
    calibrated: false,
  }
}

export function buildCoverageSectors(
  cameras: DesignCamera[],
  scale: ScaleCalibration,
  mode: 'day' | 'night' = 'day',
  structures: DesignStructure[] = [],
): CoverageSector[] {
  return cameras.map((cam) => {
    const model = getCameraModelOrDefault(cam.modelId)
    const rangeM = mode === 'night' ? model.rangeNightM : model.rangeDayM
    const radiusNorm = metersToNormRadius(
      rangeM,
      scale.metersPerNormX,
      scale.metersPerNormY,
    )
    const { startAngleRad, endAngleRad } = fovSectorAngles(cam.yawDeg, model.fovDeg)
    const polygon =
      structures.length > 0
        ? buildFovPolygon(
            cam.x,
            cam.y,
            radiusNorm,
            startAngleRad,
            endAngleRad,
            structures,
          )
        : undefined
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

/** Fracción de celdas de una grilla cubiertas por al menos un sector. */
export function estimateCoverageRatio(
  sectors: CoverageSector[],
  grid = 24,
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
        return pointInSector(
          px,
          py,
          s.cx,
          s.cy,
          s.radiusNorm,
          s.startAngleRad,
          s.endAngleRad,
        )
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

function pointInPolygon(
  px: number,
  py: number,
  poly: { x: number; y: number }[],
): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x
    const yi = poly[i]!.y
    const xj = poly[j]!.x
    const yj = poly[j]!.y
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}
