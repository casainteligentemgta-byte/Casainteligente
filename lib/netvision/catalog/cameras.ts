import equipment from '@/data/netvision/equipment.json'
import type { CameraModel } from '@/lib/netvision/types'

export const CAMERA_CATALOG: CameraModel[] = equipment.cameras as CameraModel[]

export const DEFAULT_CAMERA_MODEL_ID = CAMERA_CATALOG[0]?.id ?? 'hik-ds2cd2143'

export function getCameraModel(id: string): CameraModel | undefined {
  return CAMERA_CATALOG.find((m) => m.id === id)
}

export function getCameraModelOrDefault(id: string): CameraModel {
  return getCameraModel(id) ?? CAMERA_CATALOG[0]!
}
