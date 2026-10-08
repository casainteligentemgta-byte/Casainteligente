import type { BomSummary, NetVisionProject } from '@/lib/netvision/types'
import { projectToExportJson } from '@/lib/netvision/utils/exporters'
import { buildBom } from '@/lib/netvision/services/bandwidthCalculator'
import {
  buildCableRoutes,
  withManualCableSegments,
} from '@/lib/netvision/services/cableRoutingEngine'
import { planConduits } from '@/lib/netvision/services/conduitCalculator'
import {
  buildUndergroundPlan,
  withManualUndergroundSegments,
} from '@/lib/netvision/services/canalizationCalculator'

function materialesDelProyecto(project: NetVisionProject) {
  const cableRoutes = withManualCableSegments(
    buildCableRoutes(
      project.cameras,
      project.networkNodes ?? [],
      project.scale,
      project.cableRouteOverrides ?? {},
    ),
    project.cableSegments ?? [],
    project.scale,
  )
  const conduitPlans = planConduits(cableRoutes)
  const undergroundPlan = withManualUndergroundSegments(
    buildUndergroundPlan(cableRoutes, {
      zone: 'vehicle',
      terrain: 'medium',
      chamberMaterial: 'polietileno',
    }),
    project.undergroundSegments ?? [],
    project.scale,
  )
  const bom = buildBom(
    project.cameras,
    project.retentionDays,
    project.networkNodes ?? [],
    cableRoutes,
    conduitPlans,
    undergroundPlan,
    project.infraDevices ?? [],
    { zanjaModo: project.zanjaModo, planDevices: project.planDevices ?? [] },
  )
  return { bom, cableRoutes, conduitPlans, undergroundPlan }
}

/**
 * Lista de materiales del diseño: la misma que usa el inspector Presupuestos.
 * Sirve para armar la oferta del cliente cuando aún no hay presupuesto en Ventas.
 */
export function bomDelProyecto(project: NetVisionProject): BomSummary {
  return materialesDelProyecto(project).bom
}

/** Genera payload de configuración exportable (JSON). */
export function generateConfig(project: NetVisionProject) {
  const { bom, cableRoutes, conduitPlans, undergroundPlan } = materialesDelProyecto(project)
  return {
    ...projectToExportJson(project, bom),
    cableRoutes,
    conduitPlans,
    undergroundPlan,
  }
}
