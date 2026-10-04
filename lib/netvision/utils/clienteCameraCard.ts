import type { CameraModel, CableRoute, DesignCamera } from '@/lib/netvision/types'
import { catalogFovLabel, getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
import { cableTypeLabel } from '@/lib/netvision/services/cableCalculator'

export type CameraConnectionKind = 'poe' | 'wifi' | 'battery'

export function inferCameraConnection(model: CameraModel): CameraConnectionKind {
  const blob = `${model.id} ${model.name} ${model.notes ?? ''}`.toLowerCase()
  if (/bater[ií]a|battery|\bbc1c\b|\beb8\b/.test(blob)) return 'battery'
  if (/wifi|wi-?fi|inalámbr/.test(blob)) return 'wifi'
  return 'poe'
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
  const connection = inferCameraConnection(model)
  const wired = connection === 'poe'
  const formLabel = formFactorLabel(model.formFactor)
  const fovLabel = catalogFovLabel(model)
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
  }
}

export function totalClienteCableMeters(cards: ClienteCameraCard[]): number {
  const m = cards.filter((c) => c.wired).reduce((s, c) => s + c.cableMeters, 0)
  return Math.round(m * 10) / 10
}
