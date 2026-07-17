import type { NetVisionProject } from '@/lib/netvision/types'

/** Stub Fase 7 — paquete BIM (IFC/JSON). No genera .RVT nativo en browser. */
export function exportBimPackageJson(project: NetVisionProject) {
  return {
    format: 'netvision-bim-package',
    version: 1,
    note: 'Materializar .RVT vía worker Railway + add-in Revit',
    phases: ['design', 'cabling', 'equipment', 'documentation'],
    elements: project.cameras.map((c) => ({
      type: 'camera',
      bimPhase: 'equipment',
      ...c,
    })),
  }
}
