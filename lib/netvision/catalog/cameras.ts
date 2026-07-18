import equipment from '@/data/netvision/equipment.json'
import type { CameraBrand, CameraModel, DesignCamera } from '@/lib/netvision/types'

export const CAMERA_CATALOG: CameraModel[] = equipment.cameras as CameraModel[]

/** Marcas CCTV soportadas en NetVision Pro. */
export const CAMERA_BRANDS: CameraBrand[] = [
  'Hikvision',
  'Axis',
  'Uniview',
  'Dahua',
  'Sony',
  'Ezviz',
  'Aqara',
]

export const DEFAULT_CAMERA_MODEL_ID = CAMERA_CATALOG[0]?.id ?? 'hik-ds2cd2143'

export function getCameraModel(id: string): CameraModel | undefined {
  return CAMERA_CATALOG.find((m) => m.id === id)
}

export function getCameraModelOrDefault(id: string): CameraModel {
  return getCameraModel(id) ?? CAMERA_CATALOG[0]!
}

export function camerasByBrand(brand: CameraBrand): CameraModel[] {
  return CAMERA_CATALOG.filter((m) => m.brand === brand)
}

export function cameraCatalogGrouped(): { brand: CameraBrand; models: CameraModel[] }[] {
  return CAMERA_BRANDS.map((brand) => ({
    brand,
    models: camerasByBrand(brand),
  })).filter((g) => g.models.length > 0)
}

/** Óptica efectiva: overrides del pin o valores del catálogo. */
export function effectiveCameraVision(
  cam: DesignCamera,
  mode: 'day' | 'night' = 'day',
): { fovDeg: number; rangeM: number; yawDeg: number } {
  const model = getCameraModelOrDefault(cam.modelId)
  const catalogRange = mode === 'night' ? model.rangeNightM : model.rangeDayM
  const fovDeg =
    typeof cam.fovDeg === 'number' && Number.isFinite(cam.fovDeg)
      ? Math.min(170, Math.max(20, cam.fovDeg))
      : model.fovDeg
  const rangeM =
    typeof cam.rangeM === 'number' && Number.isFinite(cam.rangeM)
      ? Math.min(120, Math.max(2, cam.rangeM))
      : catalogRange
  const yawDeg = ((cam.yawDeg % 360) + 360) % 360
  return { fovDeg, rangeM, yawDeg }
}
