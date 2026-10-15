import equipment from '@/data/netvision/equipment.json'
import type {
  CameraBrand,
  CameraLensOption,
  CameraModel,
  ConexionCamara,
  DesignCamera,
  LensVisionOverride,
} from '@/lib/netvision/types'
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

/** Voltaje del adaptador PoE (splitter) del MODELO, o null si no lo necesita. */
export function cameraPoeSplitterV(modelId: string): 5 | 12 | null {
  const v = getCameraModel(modelId)?.poeSplitterV
  return v === 5 || v === 12 ? v : null
}

/**
 * Formas de conectar un modelo; la primera es la de ficha. Si el catálogo no lo
 * declara, se deduce del nombre y las notas (batería → Wi‑Fi → cable).
 */
export function conexionesModelo(model: CameraModel): ConexionCamara[] {
  const declaradas = (model.conexiones ?? []).filter(
    (c): c is ConexionCamara => c === 'cable' || c === 'wifi' || c === 'bateria',
  )
  if (declaradas.length > 0) return declaradas
  const texto = `${model.id} ${model.name} ${model.notes ?? ''}`.toLowerCase()
  if (/bater[ií]a|battery|\bbc1c\b|\beb8\b/.test(texto)) return ['bateria']
  if (/wifi|wi-?fi|inalámbr/.test(texto)) return ['wifi']
  return ['cable']
}

/**
 * Conexión de una cámara del plano: la que eligió el instalador si el modelo la
 * admite; si no, la de ficha.
 */
export function conexionCamara(
  cam: Pick<DesignCamera, 'modelId' | 'conexion'>,
): ConexionCamara {
  const opciones = conexionesModelo(getCameraModelOrDefault(cam.modelId))
  if (cam.conexion && opciones.includes(cam.conexion)) return cam.conexion
  return opciones[0]!
}

/** ¿Va por cable de red? (lleva tendido, puerto PoE y, si aplica, adaptador). */
export function esCamaraCableada(cam: Pick<DesignCamera, 'modelId' | 'conexion'>): boolean {
  return conexionCamara(cam) === 'cable'
}

/** Solo las cámaras que van por cable de red. */
export function camarasCableadas<T extends Pick<DesignCamera, 'modelId' | 'conexion'>>(
  cameras: readonly T[],
): T[] {
  return cameras.filter(esCamaraCableada)
}

/**
 * Adaptador PoE (splitter) de ESTA cámara: solo si va por cable y su modelo no
 * trae PoE. Por Wi‑Fi se alimenta con su propia fuente y no lo lleva.
 */
export function splitterDeCamara(
  cam: Pick<DesignCamera, 'modelId' | 'conexion'>,
): 5 | 12 | null {
  return esCamaraCableada(cam) ? cameraPoeSplitterV(cam.modelId) : null
}

/** Cuántas cámaras del plano llevan adaptador PoE (splitter). */
export function contarSplittersPoe(
  cameras: readonly Pick<DesignCamera, 'modelId' | 'conexion'>[],
): number {
  return cameras.filter((c) => splitterDeCamara(c) !== null).length
}

/** Lentes fijas con las que se vende el modelo (vacío si solo hay una). */
export function opcionesLente(model: CameraModel): CameraLensOption[] {
  const ops = (model.lensOptions ?? []).filter(
    (o) => o && o.focalMm > 0 && o.fovDeg > 0 && Number.isFinite(o.fovDeg),
  )
  return ops.length >= 2 ? ops : []
}

/** Lente de ficha del modelo: la que coincide con su ángulo de catálogo. */
export function lenteDeFicha(model: CameraModel): CameraLensOption | null {
  const ops = opcionesLente(model)
  if (ops.length === 0) return null
  return (
    ops.find((o) => o.focalMm === model.focalMm) ??
    ops.find((o) => o.fovDeg === model.fovDeg) ??
    ops[0]!
  )
}

/** Lente con la que está montada la cámara: la elegida o, si no, la de ficha. */
export function lenteElegida(
  model: CameraModel,
  cam: Pick<DesignCamera, 'lensFocalMm'>,
): CameraLensOption | null {
  const ops = opcionesLente(model)
  if (ops.length === 0) return null
  return ops.find((o) => o.focalMm === cam.lensFocalMm) ?? lenteDeFicha(model)
}

/** ¿La cámara lleva una lente distinta a la de ficha? (otro código de compra). */
export function lenteNoEstandar(cam: Pick<DesignCamera, 'modelId' | 'lensFocalMm'>): number | null {
  const model = getCameraModel(cam.modelId)
  if (!model) return null
  const elegida = lenteElegida(model, cam)
  const ficha = lenteDeFicha(model)
  return elegida && ficha && elegida.focalMm !== ficha.focalMm ? elegida.focalMm : null
}

/**
 * Parche para cambiar la lente de una cámara: el cono del plano toma el ángulo
 * real de esa lente (se pierde el recorte manual, que ya no correspondería).
 */
export function parcheLente(modelId: string, focalMm: number): Partial<DesignCamera> {
  const model = getCameraModelOrDefault(modelId)
  const opcion = opcionesLente(model).find((o) => o.focalMm === focalMm)
  if (!opcion) return {}
  const halves = resolveFovHalves({}, opcion.fovDeg)
  return {
    lensFocalMm: opcion.focalMm,
    fovDeg: halves.total,
    fovLeftDeg: halves.left,
    fovRightDeg: halves.right,
  }
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
  /** Alcance de ficha día/noche. El cono se dibuja con esto; el semáforo CCTV usa identificarM. */
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
  const halves = resolveFovHalves(cam, lenteElegida(model, cam)?.fovDeg ?? model.fovDeg)
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
  /** Lente a conservar (p. ej. al restaurar el cono); sin valor = lente de ficha. */
  lensFocalMm?: number,
): {
  fovDeg: number
  fovLeftDeg: number
  fovRightDeg: number
  rangeM: number
  lensVision: DesignCamera['lensVision']
  lensFocalMm: number | undefined
} {
  const model = getCameraModelOrDefault(modelId)
  const lente = lensFocalMm != null ? lenteElegida(model, { lensFocalMm }) : null
  const primaryFov =
    model.lenses && model.lenses.length >= 2
      ? model.lenses[0]!.fovDeg
      : (lente?.fovDeg ?? model.fovDeg)
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
    // Al cambiar de modelo vuelve la lente de ficha; al restaurar se conserva la elegida.
    lensFocalMm: lente && lente.focalMm !== lenteDeFicha(model)?.focalMm ? lente.focalMm : undefined,
  }
}

/** Diferencias menores a esto se consideran el valor de ficha (redondeos del arrastre). */
const TOL_FOV_DEG = 0.5
const TOL_RANGE_M = 0.05

function numeroFinito(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Recorta una apertura (dos mitades) a un máximo, conservando la proporción izquierda/derecha. */
function recortarApertura(
  left: number,
  right: number,
  maxTotal: number,
): { fovDeg: number; fovLeftDeg: number; fovRightDeg: number } {
  const total = left + right
  if (total <= maxTotal || total <= 0) {
    const halves = resolveFovHalves({ fovLeftDeg: left, fovRightDeg: right }, total)
    return { fovDeg: halves.total, fovLeftDeg: halves.left, fovRightDeg: halves.right }
  }
  const factor = maxTotal / total
  const halves = resolveFovHalves(
    { fovLeftDeg: left * factor, fovRightDeg: right * factor },
    maxTotal,
  )
  return { fovDeg: halves.total, fovLeftDeg: halves.left, fovRightDeg: halves.right }
}

/**
 * Visión al cambiar el modelo de una cámara ya ajustada en el plano.
 *
 * - Lo que el usuario no tocó (apertura o alcance iguales a la ficha del modelo anterior)
 *   toma los valores de ficha del modelo nuevo, como antes.
 * - Lo que sí ajustó a mano se conserva, recortado solo si el modelo nuevo no llega:
 *   la apertura no pasa del ángulo de ficha del nuevo y el alcance no pasa de su alcance
 *   de ficha (día o noche, según el modo).
 * - Cámaras Dual: el ajuste de cada lente secundaria se conserva si el modelo nuevo tiene
 *   una lente con el mismo id; si no, esa lente vuelve a seguir a la primaria.
 * - La lente vuelve a la de ficha del modelo nuevo (otro código de compra).
 */
export function visionAlCambiarModelo(
  cam: DesignCamera,
  nuevoModelId: string,
  mode: 'day' | 'night' = 'day',
): ReturnType<typeof catalogVisionDefaults> {
  const base = catalogVisionDefaults(nuevoModelId, mode)
  if (!getCameraModel(cam.modelId)) return base

  const fichaAntes = catalogVisionDefaults(cam.modelId, mode, cam.lensFocalMm)
  const fichaAntesOtroModo = catalogVisionDefaults(
    cam.modelId,
    mode === 'night' ? 'day' : 'night',
    cam.lensFocalMm,
  )
  const nuevo = getCameraModelOrDefault(nuevoModelId)
  const nuevoDual = nuevo.lenses && nuevo.lenses.length >= 2 ? nuevo.lenses : null
  const nuevoMaxFov = base.fovDeg
  const nuevoMaxRange = base.rangeM

  const result = { ...base }

  // Apertura de la lente primaria.
  const tieneMitades = numeroFinito(cam.fovLeftDeg) || numeroFinito(cam.fovRightDeg)
  if (tieneMitades || numeroFinito(cam.fovDeg)) {
    const actual = resolveFovHalves(cam, fichaAntes.fovDeg)
    const aperturaAjustada =
      Math.abs(actual.left - fichaAntes.fovLeftDeg) > TOL_FOV_DEG ||
      Math.abs(actual.right - fichaAntes.fovRightDeg) > TOL_FOV_DEG
    if (aperturaAjustada) {
      Object.assign(result, recortarApertura(actual.left, actual.right, nuevoMaxFov))
    }
  }

  // Alcance de la lente primaria (se acepta la ficha de día o de noche como "no tocado").
  if (numeroFinito(cam.rangeM)) {
    const alcanceAjustado =
      Math.abs(cam.rangeM - fichaAntes.rangeM) > TOL_RANGE_M &&
      Math.abs(cam.rangeM - fichaAntesOtroModo.rangeM) > TOL_RANGE_M
    if (alcanceAjustado) result.rangeM = clampRange(Math.min(cam.rangeM, nuevoMaxRange))
  }

  // Lentes secundarias de cámaras Dual.
  if (nuevoDual && cam.lensVision) {
    const conservado: NonNullable<DesignCamera['lensVision']> = {}
    nuevoDual.forEach((lens, index) => {
      if (index === 0) return
      const lensId = lens.id || `lens-${index}`
      const own = cam.lensVision?.[lensId]
      if (!own) return
      const ajuste: LensVisionOverride = {}
      if (numeroFinito(own.yawDeg)) ajuste.yawDeg = own.yawDeg
      if (numeroFinito(own.fovLeftDeg) || numeroFinito(own.fovRightDeg) || numeroFinito(own.fovDeg)) {
        const h = resolveFovHalves(own, lens.fovDeg)
        Object.assign(ajuste, recortarApertura(h.left, h.right, clampFov(lens.fovDeg)))
      }
      if (numeroFinito(own.rangeM)) {
        const max = mode === 'night' ? lens.rangeNightM : lens.rangeDayM
        ajuste.rangeM = clampRange(Math.min(own.rangeM, max))
      }
      if (Object.keys(ajuste).length > 0) conservado[lensId] = ajuste
    })
    result.lensVision = Object.keys(conservado).length > 0 ? conservado : undefined
  }

  return result
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
