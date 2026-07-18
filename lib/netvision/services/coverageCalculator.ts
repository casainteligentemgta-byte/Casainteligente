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
} from '@/lib/netvision/types'
import {
  distMeters,
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
 * Espectro de visión CCTV: celdas visibles por al menos una cámara
 * (dentro del FOV + línea de visión no bloqueada por muros opacos).
 */
export function buildVisionSpectrum(
  cameras: DesignCamera[],
  scale: ScaleCalibration,
  mode: 'day' | 'night' = 'day',
  structures: DesignStructure[] = [],
  grid = 32,
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
      let best = 0
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
        const strength = Math.max(0, 1 - d / Math.max(p.rangeM, 1))
        if (strength > best) best = strength
      }
      if (best < 0.04) continue
      cells.push({
        x: ix * cell,
        y: iy * cell,
        w: cell,
        h: cell,
        strength: best,
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
