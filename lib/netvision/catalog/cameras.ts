import equipment from '@/data/netvision/equipment.json'
import type { CameraBrand, CameraModel, DesignCamera, LensVisionOverride } from '@/lib/netvision/types'
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

/** Voltaje del adaptador PoE (splitter) que lleva la cámara, o null si no lo necesita. */
export function cameraPoeSplitterV(modelId: string): 5 | 12 | null {
  const v = getCameraModel(modelId)?.poeSplitterV
  return v === 5 || v === 12 ? v : null
}

/** Cuántas cámaras del plano llevan adaptador PoE (splitter). */
export function contarSplittersPoe(cameras: readonly Pick<DesignCamera, 'modelId'>[]): number {
  return cameras.filter((c) => cameraPoeSplitterV(c.modelId) !== null).length
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

/** FOV de catálogo para la lista: dual muestra ambas ópticas. */
export function catalogFovLabel(model: CameraModel): string {
  if (model.lenses && model.lenses.length >= 2) {
    const wide = model.lenses[0]!
    const tele = model.lenses[1]!
    return `Dual ${wide.fovDeg}°+${tele.fovDeg}°`
  }
  return `${model.fovDeg}°`
}

/** Etiqueta del selector de modelo (nombre + facultades de visión). */
export function cameraCatalogOptionLabel(model: CameraModel): string {
  return `${model.name} · ${catalogFovLabel(model)}`
}

/** Resumen corto para inspector: resolución, forma, FOV, alcances día/noche. */
export function cameraVisionSummary(model: CameraModel): string {
  const form =
    model.formFactor === 'ptz' ? 'PTZ' : model.formFactor === 'bullet' ? 'bullet' : 'domo'
  return `${model.resolution} · ${form} · ${catalogFovLabel(model)} · día ${model.rangeDayM} m / noche ${model.rangeNightM} m`
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
  /** Alcance dibujado (cono / anillo). */
  rangeM: number
  /** Alcance de ficha día/noche. El semáforo usa estos metros fijos. */
  catalogRangeM: number
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
 * La lente primaria usa yaw / fov / rangeM del pin; cada lente secundaria usa cam.lensVision[lensId]
 * (por defecto mira hacia donde mira la primaria). Así cada cono puede apuntar a un lugar distinto.
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
      const lensId = lens.id || (index === 0 ? 'wide' : `lens-${index}`)
      // Primaria: campos de la cámara. Secundarias: su propio ajuste (cada cono mira donde se le indique).
      const own: LensVisionOverride = index === 0 ? cam : (cam.lensVision?.[lensId] ?? {})
      const halves = resolveFovHalves(own, lens.fovDeg)
      const rangeM =
        typeof own.rangeM === 'number' && Number.isFinite(own.rangeM)
          ? clampRange(own.rangeM)
          : clampRange(catalogRange)
      const lensYaw =
        index > 0 && typeof own.yawDeg === 'number' && Number.isFinite(own.yawDeg)
          ? ((own.yawDeg % 360) + 360) % 360
          : yawDeg
      return {
        lensId,
        label: lens.label || (index === 0 ? 'Gran angular' : 'Tele'),
        fovDeg: halves.total,
        fovLeftDeg: halves.left,
        fovRightDeg: halves.right,
        rangeM,
        catalogRangeM: clampRange(catalogRange),
        yawDeg: lensYaw,
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
      catalogRangeM: clampRange(catalogRange),
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
  catalogRangeM: number
  yawDeg: number
} {
  const primary = effectiveCameraLenses(cam, mode)[0]!
  return {
    fovDeg: primary.fovDeg,
    fovLeftDeg: primary.fovLeftDeg,
    fovRightDeg: primary.fovRightDeg,
    rangeM: primary.rangeM,
    catalogRangeM: primary.catalogRangeM,
    yawDeg: primary.yawDeg,
  }
}

export function isDualCameraModel(modelId: string): boolean {
  const model = getCameraModel(modelId)
  return (model?.lenses?.length ?? 0) >= 2
}

/**
 * FOV / alcance del catálogo para precargar al elegir marca·modelo.
 * Dual: usa la lente primaria (gran angular).
 */
export function catalogVisionDefaults(
  modelId: string,
  mode: 'day' | 'night' = 'day',
): {
  fovDeg: number
  fovLeftDeg: number
  fovRightDeg: number
  rangeM: number
  lensVision: DesignCamera['lensVision']
} {
  const model = getCameraModelOrDefault(modelId)
  const primaryFov =
    model.lenses && model.lenses.length >= 2
      ? model.lenses[0]!.fovDeg
      : model.fovDeg
  const halves = resolveFovHalves({}, primaryFov)
  const primaryRange =
    model.lenses && model.lenses.length >= 2
      ? mode === 'night'
        ? model.lenses[0]!.rangeNightM
        : model.lenses[0]!.rangeDayM
      : mode === 'night'
        ? model.rangeNightM
        : model.rangeDayM
  return {
    fovDeg: halves.total,
    fovLeftDeg: halves.left,
    fovRightDeg: halves.right,
    rangeM: clampRange(primaryRange),
    // Al cambiar de modelo o restaurar, las lentes secundarias vuelven a seguir a la primaria.
    lensVision: undefined,
  }
}

/** Id de la lente primaria de una cámara Dual (la que usa los campos del pin), o null si no es Dual. */
export function primaryLensId(modelId: string): string | null {
  const model = getCameraModel(modelId)
  if (!model?.lenses || model.lenses.length < 2) return null
  return model.lenses[0]!.id || 'wide'
}

/**
 * Parche de cámara para ajustar una lente concreta.
 * Primaria (o cámara de una sola óptica) → campos del pin. Secundaria → cam.lensVision[lensId].
 */
export function cameraPatchForLens(
  cam: DesignCamera,
  lensId: string | undefined,
  patch: LensVisionOverride,
): Partial<DesignCamera> {
  const primary = primaryLensId(cam.modelId)
  if (!lensId || !primary || lensId === primary || lensId === 'main') return { ...patch }
  const prev = cam.lensVision?.[lensId] ?? {}
  return {
    lensVision: {
      ...(cam.lensVision ?? {}),
      [lensId]: { ...prev, ...patch },
    },
  }
}
