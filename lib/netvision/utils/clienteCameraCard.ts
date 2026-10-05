import type {
  CameraModel,
  CableRoute,
  ConexionCamara,
  DesignCamera,
} from '@/lib/netvision/types'
import {
  catalogFovLabel,
  conexionCamara,
  conexionesModelo,
  getCameraModelOrDefault,
  lenteElegida,
  splitterDeCamara,
} from '@/lib/netvision/catalog/cameras'
import { cableTypeLabel } from '@/lib/netvision/services/cableCalculator'
import {
  alcanceUtilCamara,
  type AlcanceUtilCamara,
} from '@/lib/netvision/services/dimensionamiento'

export type CameraConnectionKind = 'poe' | 'wifi' | 'battery'

const KIND: Record<ConexionCamara, CameraConnectionKind> = {
  cable: 'poe',
  wifi: 'wifi',
  bateria: 'battery',
}

/** Conexión de ficha de un modelo. */
export function inferCameraConnection(model: CameraModel): CameraConnectionKind {
  return KIND[conexionesModelo(model)[0]!]
}

export function cablesForCamera(routes: CableRoute[], cameraId: string): CableRoute[] {
  return routes.filter((r) => r.fromId === cameraId || r.toId === cameraId)
}

export function cameraCableMeters(routes: CableRoute[], cameraId: string): number {
  const m = cablesForCamera(routes, cameraId).reduce((s, r) => s + r.routeM, 0)
  return Math.round(m * 10) / 10
}

export type ClienteCameraCard = {
  id: string
  label: string
  modelName: string
  brand: string
  formFactor: CameraModel['formFactor']
  /** Foto del modelo (catálogo); `null` → la ficha dibuja la silueta por forma. */
  imageUrl: string | null
  formLabel: string
  resolution: string
  fovLabel: string
  rangeDayM: number
  rangeNightM: number
  mountHeightM: number
  tiltDeg: number
  poeWatts: number
  bitrateMbps: number
  qualities: string
  notes: string
  connection: CameraConnectionKind
  connectionLabel: string
  cables: Array<{ id: string; toLabel: string; typeLabel: string; meters: number }>
  cableMeters: number
  wired: boolean
  /** Voltaje del adaptador PoE (splitter) si el modelo lo necesita. */
  poeSplitterV: 5 | 12 | null
  /** Hasta dónde identifica, reconoce y detecta (según resolución y ángulo). */
  alcanceUtil: AlcanceUtilCamara
}

export function formFactorLabel(form: CameraModel['formFactor']): string {
  if (form === 'ptz') return 'PTZ'
  if (form === 'bullet') return 'Bala'
  return 'Domo'
}

export function buildClienteCameraCard(
  cam: DesignCamera,
  routes: CableRoute[],
): ClienteCameraCard {
  const model = getCameraModelOrDefault(cam.modelId)
  // La que eligió el instalador para esta cámara (cable o Wi‑Fi), no solo la de ficha.
  const connection = KIND[conexionCamara(cam)]
  const wired = connection === 'poe'
  const formLabel = formFactorLabel(model.formFactor)
  // Con lentes intercambiables se muestra la que lleva esta cámara.
  const lente = lenteElegida(model, cam)
  const fovLabel = lente ? `${lente.fovDeg}° · lente ${lente.focalMm} mm` : catalogFovLabel(model)
  const cables = wired
    ? cablesForCamera(routes, cam.id).map((r) => ({
        id: r.id,
        toLabel: r.fromId === cam.id ? r.toLabel : r.fromLabel,
        typeLabel: cableTypeLabel(r.type),
        meters: r.routeM,
      }))
    : []
  return {
    id: cam.id,
    label: cam.label,
    modelName: model.name,
    brand: model.brand,
    formFactor: model.formFactor,
    imageUrl: model.imageUrl?.trim() || null,
    formLabel,
    resolution: model.resolution,
    fovLabel,
    rangeDayM: model.rangeDayM,
    rangeNightM: model.rangeNightM,
    mountHeightM: cam.mountHeightM,
    tiltDeg: Math.round(cam.tiltDeg ?? 0),
    poeWatts: model.poeWatts,
    bitrateMbps: model.bitrateMbps,
    qualities: `${model.resolution} · ${formLabel} · ${fovLabel} · día ${model.rangeDayM} m / noche ${model.rangeNightM} m`,
    notes: (model.notes ?? '').trim(),
    connection,
    connectionLabel:
      connection === 'battery'
        ? 'Inalámbrica / batería'
        : connection === 'wifi'
          ? 'Wi‑Fi (sin tendido PoE)'
          : 'Cableada (PoE)',
    cables,
    cableMeters: wired ? cameraCableMeters(routes, cam.id) : 0,
    wired,
    poeSplitterV: splitterDeCamara(cam),
    alcanceUtil: alcanceUtilCamara(cam),
  }
}

export function totalClienteCableMeters(cards: ClienteCameraCard[]): number {
  const m = cards.filter((c) => c.wired).reduce((s, c) => s + c.cableMeters, 0)
  return Math.round(m * 10) / 10
}
