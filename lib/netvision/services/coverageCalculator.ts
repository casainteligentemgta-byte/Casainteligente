import { getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
import type {
  CoverageSector,
  DesignCamera,
  ScaleCalibration,
} from '@/lib/netvision/types'
import {
  fovSectorAngles,
  metersToNormRadius,
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
    return {
      cameraId: cam.id,
      cx: cam.x,
      cy: cam.y,
      radiusNorm,
      startAngleRad,
      endAngleRad,
      mode,
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
        const dx = px - s.cx
        const dy = py - s.cy
        const r = Math.hypot(dx, dy)
        if (r > s.radiusNorm) return false
        let ang = Math.atan2(dy, dx)
        let start = s.startAngleRad
        let end = s.endAngleRad
        while (end < start) end += Math.PI * 2
        while (ang < start) ang += Math.PI * 2
        return ang <= end
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
