import equipment from '@/data/netvision/equipment.json'
import type { CameraBrand, CameraModel, DesignCamera } from '@/lib/netvision/types'
import { clampFovHalf } from '@/lib/netvision/utils/geometryHelpers'

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

export type EffectiveLensVision = {
  lensId: string
  label: string
  /** FOV total (izq + der). */
  fovDeg: number
  /** Medio FOV izquierdo (desde yaw). */
  fovLeftDeg: number
  /** Medio FOV derecho (desde yaw). */
  fovRightDeg: number
  rangeM: number
  yawDeg: number
}

function clampFov(fovDeg: number) {
  return Math.min(170, Math.max(20, fovDeg))
}

function clampRange(rangeM: number) {
  return Math.min(120, Math.max(2, rangeM))
}

/**
 * Resuelve medios FOV independientes.
 * - Si hay fovLeftDeg / fovRightDeg → se usan (con fallback al otro / mitad del total).
 * - Si solo fovDeg (o catálogo) → simétrico.
 */
export function resolveFovHalves(
  cam: Pick<DesignCamera, 'fovDeg' | 'fovLeftDeg' | 'fovRightDeg'>,
  catalogFovDeg: number,
): { left: number; right: number; total: number } {
  const hasLeft = typeof cam.fovLeftDeg === 'number' && Number.isFinite(cam.fovLeftDeg)
  const hasRight = typeof cam.fovRightDeg === 'number' && Number.isFinite(cam.fovRightDeg)
  const totalOverride =
    typeof cam.fovDeg === 'number' && Number.isFinite(cam.fovDeg) ? clampFov(cam.fovDeg) : null
  const baseTotal = totalOverride ?? clampFov(catalogFovDeg)
  const baseHalf = baseTotal / 2

  if (hasLeft || hasRight) {
    const leftFinal = clampFovHalf(hasLeft ? cam.fovLeftDeg! : baseHalf)
    const rightFinal = clampFovHalf(hasRight ? cam.fovRightDeg! : baseHalf)
    const total = clampFov(leftFinal + rightFinal)
    return { left: leftFinal, right: rightFinal, total }
  }

  const half = clampFovHalf(baseTotal / 2)
  return { left: half, right: half, total: clampFov(half * 2) }
}

/**
 * Ópticas efectivas por cámara.
 * Dual (≥2 lentes en catálogo) → una entrada por lente (2 espectros en el plano).
 * Overrides fov / rangeM del pin solo afectan la lente primaria (primera).
 */
export function effectiveCameraLenses(
  cam: DesignCamera,
  mode: 'day' | 'night' = 'day',
): EffectiveLensVision[] {
  const model = getCameraModelOrDefault(cam.modelId)
  const yawDeg = ((cam.yawDeg % 360) + 360) % 360
  const lenses = model.lenses?.filter(
    (l) =>
      typeof l.fovDeg === 'number' &&
      Number.isFinite(l.fovDeg) &&
      typeof l.rangeDayM === 'number',
  )

  if (lenses && lenses.length >= 2) {
    return lenses.map((lens, index) => {
      const catalogRange = mode === 'night' ? lens.rangeNightM : lens.rangeDayM
      const useOverride = index === 0
      const halves = useOverride
        ? resolveFovHalves(cam, lens.fovDeg)
        : resolveFovHalves({}, lens.fovDeg)
      const rangeM =
        useOverride && typeof cam.rangeM === 'number' && Number.isFinite(cam.rangeM)
          ? clampRange(cam.rangeM)
          : clampRange(catalogRange)
      return {
        lensId: lens.id || (index === 0 ? 'wide' : `lens-${index}`),
        label: lens.label || (index === 0 ? 'Gran angular' : 'Tele'),
        fovDeg: halves.total,
        fovLeftDeg: halves.left,
        fovRightDeg: halves.right,
        rangeM,
        yawDeg,
      }
    })
  }

  const catalogRange = mode === 'night' ? model.rangeNightM : model.rangeDayM
  const halves = resolveFovHalves(cam, model.fovDeg)
  const rangeM =
    typeof cam.rangeM === 'number' && Number.isFinite(cam.rangeM)
      ? clampRange(cam.rangeM)
      : clampRange(catalogRange)
  return [
    {
      lensId: 'main',
      label: 'Óptica',
      fovDeg: halves.total,
      fovLeftDeg: halves.left,
      fovRightDeg: halves.right,
      rangeM,
      yawDeg,
    },
  ]
}

/** Óptica primaria (compat UI / asas): primera lente o la única. */
export function effectiveCameraVision(
  cam: DesignCamera,
  mode: 'day' | 'night' = 'day',
): {
  fovDeg: number
  fovLeftDeg: number
  fovRightDeg: number
  rangeM: number
  yawDeg: number
} {
  const primary = effectiveCameraLenses(cam, mode)[0]!
  return {
    fovDeg: primary.fovDeg,
    fovLeftDeg: primary.fovLeftDeg,
    fovRightDeg: primary.fovRightDeg,
    rangeM: primary.rangeM,
    yawDeg: primary.yawDeg,
  }
}

export function isDualCameraModel(modelId: string): boolean {
  const model = getCameraModel(modelId)
  return (model?.lenses?.length ?? 0) >= 2
}
