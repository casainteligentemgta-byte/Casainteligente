import materialsJson from '@/data/netvision/materials.json'
import type { StructureMaterial, StructureMaterialId } from '@/lib/netvision/types'

export const STRUCTURE_MATERIALS: StructureMaterial[] = (
  materialsJson.materials ?? []
) as StructureMaterial[]

export function getStructureMaterial(
  id: string | undefined,
): StructureMaterial | undefined {
  return STRUCTURE_MATERIALS.find((m) => m.id === id)
}

export function getStructureMaterialOrDefault(
  id: string | undefined,
): StructureMaterial {
  return getStructureMaterial(id) ?? STRUCTURE_MATERIALS[0]!
}

export const DEFAULT_STRUCTURE_MATERIAL_ID: StructureMaterialId =
  (STRUCTURE_MATERIALS[0]?.id as StructureMaterialId) ?? 'drywall'
