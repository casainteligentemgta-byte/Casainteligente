import type { NetVisionProject } from '@/lib/netvision/types'
import { projectToExportJson } from '@/lib/netvision/utils/exporters'
import { buildBom } from '@/lib/netvision/services/bandwidthCalculator'
import { buildCableRoutes } from '@/lib/netvision/services/cableRoutingEngine'
import { planConduits } from '@/lib/netvision/services/conduitCalculator'

/** Genera payload de configuración exportable (JSON). */
export function generateConfig(project: NetVisionProject) {
  const cableRoutes = buildCableRoutes(
    project.cameras,
    project.networkNodes ?? [],
    project.scale,
  )
  const conduitPlans = planConduits(cableRoutes)
  const bom = buildBom(
    project.cameras,
    project.retentionDays,
    project.networkNodes ?? [],
    cableRoutes,
    conduitPlans,
  )
  return {
    ...projectToExportJson(project, bom),
    cableRoutes,
    conduitPlans,
  }
}
