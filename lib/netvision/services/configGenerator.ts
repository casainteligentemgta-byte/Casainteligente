import type { NetVisionProject } from '@/lib/netvision/types'
import { projectToExportJson } from '@/lib/netvision/utils/exporters'
import { buildBom } from '@/lib/netvision/services/bandwidthCalculator'

/** Genera payload de configuración exportable (JSON). */
export function generateConfig(project: NetVisionProject) {
  const bom = buildBom(project.cameras, project.retentionDays)
  return projectToExportJson(project, bom)
}
