import { getPlanDeviceModelOrDefault } from '@/lib/netvision/catalog/planDevices'
import {
  coverageBandPolygons,
  visionBandRangesM,
} from '@/lib/netvision/services/coverageCalculator'
import { buildFovPolygon } from '@/lib/netvision/services/structureAttenuation'
import type {
  CoverageSector,
  DesignPlanDevice,
  DesignStructure,
  PlanDiscipline,
  ScaleCalibration,
} from '@/lib/netvision/types'
import {
  fovSectorAngles,
  metersToNormRadius,
} from '@/lib/netvision/utils/geometryHelpers'

const OMNI_EPS = 359

export function buildPlanDeviceSectors(
  devices: DesignPlanDevice[],
  scale: ScaleCalibration,
  structures: DesignStructure[] = [],
  discipline?: PlanDiscipline,
): CoverageSector[] {
  return devices
    .filter((d) => !discipline || d.discipline === discipline)
    .map((dev) => {
      const model = getPlanDeviceModelOrDefault(dev.modelId, dev.discipline)
      const rangeM = Math.max(0.4, dev.rangeM ?? model.rangeM)
      const catalogRangeM = model.rangeM
      const fovDeg = Math.max(10, Math.min(360, dev.fovDeg ?? model.fovDeg))
      const yawDeg = ((dev.yawDeg ?? 0) % 360 + 360) % 360
      const omni = fovDeg >= OMNI_EPS
      const { startAngleRad, endAngleRad } = omni
        ? { startAngleRad: 0, endAngleRad: Math.PI * 2 }
        : fovSectorAngles(yawDeg, fovDeg)
      const radiusNorm = metersToNormRadius(
        rangeM,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      const bands = visionBandRangesM(rangeM, catalogRangeM)
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
      const polygon = buildFovPolygon(
        dev.x,
        dev.y,
        radiusNorm,
        startAngleRad,
        endAngleRad,
        structures,
        96,
        0,
      )
      return {
        cameraId: dev.id,
        lensId: 'main',
        cx: dev.x,
        cy: dev.y,
        radiusNorm,
        innerRadiusNorm: 0,
        startAngleRad,
        endAngleRad,
        mode: 'day' as const,
        polygon,
        greenRadiusNorm,
        yellowRadiusNorm,
        ...coverageBandPolygons({
          cx: dev.x,
          cy: dev.y,
          startAngleRad,
          endAngleRad,
          innerRadiusNorm: 0,
          greenRadiusNorm,
          yellowRadiusNorm,
          structures,
        }),
      }
    })
}

export function buildApCoverageSectors(
  nodes: { id: string; x: number; y: number; kind: string; modelId: string }[],
  rangeMFor: (node: { modelId: string }) => number,
  scale: ScaleCalibration,
  structures: DesignStructure[] = [],
): CoverageSector[] {
  return nodes
    .filter((n) => n.kind === 'ap')
    .map((n) => {
      const rangeM = Math.max(1, rangeMFor(n))
      const radiusNorm = metersToNormRadius(
        rangeM,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      const bands = visionBandRangesM(rangeM, rangeM)
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
      const startAngleRad = 0
      const endAngleRad = Math.PI * 2
      const polygon = buildFovPolygon(
        n.x,
        n.y,
        radiusNorm,
        startAngleRad,
        endAngleRad,
        structures,
        96,
        0,
      )
      return {
        cameraId: n.id,
        lensId: 'main',
        cx: n.x,
        cy: n.y,
        radiusNorm,
        innerRadiusNorm: 0,
        startAngleRad,
        endAngleRad,
        mode: 'day' as const,
        polygon,
        greenRadiusNorm,
        yellowRadiusNorm,
        ...coverageBandPolygons({
          cx: n.x,
          cy: n.y,
          startAngleRad,
          endAngleRad,
          innerRadiusNorm: 0,
          greenRadiusNorm,
          yellowRadiusNorm,
          structures,
        }),
      }
    })
}
