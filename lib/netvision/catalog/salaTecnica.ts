import type {
  DesignInfraDevice,
  DesignNetworkNode,
  InfraDeviceModel,
  InfraKind,
  RackMount,
  RackSizeU,
} from '@/lib/netvision/types'
import { getNetworkModel } from '@/lib/netvision/catalog/network'

export const RACK_SIZES_U: readonly RackSizeU[] = [
  4, 6, 9, 12, 15, 18, 22, 27, 42,
]

export const HDD_CAPACITIES_TB = [1, 2, 4, 6, 8, 10, 12, 16, 20] as const

export const INFRA_KIND_LABEL: Record<InfraKind, string> = {
  monitor: 'Pantalla',
  hdd: 'Disco',
  ups: 'UPS',
  rack: 'Rack',
}

export const INFRA_KIND_PREFIX: Record<InfraKind, string> = {
  monitor: 'MON',
  hdd: 'HDD',
  ups: 'UPS',
  rack: 'RACK',
}

export const INFRA_KIND_COLOR: Record<InfraKind, string> = {
  monitor: '#38bdf8',
  hdd: '#a3e635',
  ups: '#f472b6',
  rack: '#94a3b8',
}

export const SALA_TECNICA_CATALOG: InfraDeviceModel[] = [
  {
    id: 'mon-22',
    kind: 'monitor',
    brand: 'Hikvision',
    name: 'Monitor 22"',
    inches: 22,
    rackUnits: 0,
    priceUsd: 160,
  },
  {
    id: 'mon-24',
    kind: 'monitor',
    brand: 'Hikvision',
    name: 'Monitor 24"',
    inches: 24,
    rackUnits: 0,
    priceUsd: 190,
  },
  {
    id: 'mon-27',
    kind: 'monitor',
    brand: 'Samsung',
    name: 'Monitor 27"',
    inches: 27,
    rackUnits: 0,
    priceUsd: 240,
  },
  {
    id: 'mon-32',
    kind: 'monitor',
    brand: 'Hikvision',
    name: 'Monitor 32"',
    inches: 32,
    rackUnits: 0,
    priceUsd: 320,
  },
  {
    id: 'mon-43',
    kind: 'monitor',
    brand: 'Hikvision',
    name: 'Monitor 43"',
    inches: 43,
    rackUnits: 0,
    priceUsd: 480,
  },
  {
    id: 'mon-55',
    kind: 'monitor',
    brand: 'Samsung',
    name: 'Monitor 55"',
    inches: 55,
    rackUnits: 0,
    priceUsd: 690,
  },
  {
    id: 'hdd-skyhawk',
    kind: 'hdd',
    brand: 'Seagate',
    name: 'SkyHawk vigilancia',
    capacityTb: 4,
    rackUnits: 1,
    priceUsd: 220,
  },
  {
    id: 'hdd-purple',
    kind: 'hdd',
    brand: 'WD',
    name: 'Purple vigilancia',
    capacityTb: 4,
    rackUnits: 1,
    priceUsd: 230,
  },
  {
    id: 'ups-600',
    kind: 'ups',
    brand: 'APC',
    name: 'Back-UPS 600 VA',
    va: 600,
    rackUnits: 0,
    priceUsd: 95,
  },
  {
    id: 'ups-1000',
    kind: 'ups',
    brand: 'APC',
    name: 'Back-UPS 1000 VA',
    va: 1000,
    rackUnits: 0,
    priceUsd: 165,
  },
  {
    id: 'ups-1500-1u',
    kind: 'ups',
    brand: 'APC',
    name: 'Smart-UPS 1500 VA 1U',
    va: 1500,
    rackUnits: 1,
    priceUsd: 380,
  },
  {
    id: 'ups-2200-2u',
    kind: 'ups',
    brand: 'APC',
    name: 'Smart-UPS 2200 VA 2U',
    va: 2200,
    rackUnits: 2,
    priceUsd: 620,
  },
  {
    id: 'ups-3000-2u',
    kind: 'ups',
    brand: 'APC',
    name: 'Smart-UPS 3000 VA 2U',
    va: 3000,
    rackUnits: 2,
    priceUsd: 890,
  },
  {
    id: 'rack-4u',
    kind: 'rack',
    brand: 'Casa Inteligente',
    name: 'Gabinete 4U pared',
    totalU: 4,
    rackUnits: 4,
    priceUsd: 85,
  },
  {
    id: 'rack-6u',
    kind: 'rack',
    brand: 'Casa Inteligente',
    name: 'Gabinete 6U pared',
    totalU: 6,
    rackUnits: 6,
    priceUsd: 110,
  },
  {
    id: 'rack-9u',
    kind: 'rack',
    brand: 'Casa Inteligente',
    name: 'Gabinete 9U pared',
    totalU: 9,
    rackUnits: 9,
    priceUsd: 150,
  },
  {
    id: 'rack-12u',
    kind: 'rack',
    brand: 'Casa Inteligente',
    name: 'Gabinete 12U',
    totalU: 12,
    rackUnits: 12,
    priceUsd: 210,
  },
  {
    id: 'rack-15u',
    kind: 'rack',
    brand: 'Casa Inteligente',
    name: 'Gabinete 15U',
    totalU: 15,
    rackUnits: 15,
    priceUsd: 260,
  },
  {
    id: 'rack-18u',
    kind: 'rack',
    brand: 'Casa Inteligente',
    name: 'Gabinete 18U',
    totalU: 18,
    rackUnits: 18,
    priceUsd: 320,
  },
  {
    id: 'rack-22u',
    kind: 'rack',
    brand: 'Casa Inteligente',
    name: 'Gabinete 22U',
    totalU: 22,
    rackUnits: 22,
    priceUsd: 390,
  },
  {
    id: 'rack-27u',
    kind: 'rack',
    brand: 'Casa Inteligente',
    name: 'Gabinete 27U piso',
    totalU: 27,
    rackUnits: 27,
    priceUsd: 520,
  },
  {
    id: 'rack-42u',
    kind: 'rack',
    brand: 'Casa Inteligente',
    name: 'Gabinete 42U piso',
    totalU: 42,
    rackUnits: 42,
    priceUsd: 890,
  },
]

export function infraCatalogByKind(kind: InfraKind): InfraDeviceModel[] {
  return SALA_TECNICA_CATALOG.filter((m) => m.kind === kind)
}

export function getInfraModel(id: string): InfraDeviceModel | undefined {
  return SALA_TECNICA_CATALOG.find((m) => m.id === id)
}

export function getInfraModelOrDefault(
  id: string,
  kind: InfraKind = 'monitor',
): InfraDeviceModel {
  return getInfraModel(id) ?? infraCatalogByKind(kind)[0]!
}

export function defaultInfraModelId(kind: InfraKind): string {
  return infraCatalogByKind(kind)[0]!.id
}

export function clampRackSizeU(raw: unknown): RackSizeU {
  const n = typeof raw === 'number' ? raw : Number(raw)
  const found = RACK_SIZES_U.find((u) => u === n)
  return found ?? 12
}

export function clampHddTb(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (HDD_CAPACITIES_TB.includes(n as (typeof HDD_CAPACITIES_TB)[number])) {
    return n
  }
  if (Number.isFinite(n)) {
    const nearest = HDD_CAPACITIES_TB.reduce((best, u) =>
      Math.abs(u - n) < Math.abs(best - n) ? u : best,
    )
    return nearest
  }
  return 4
}

export function hddPriceUsd(model: InfraDeviceModel, tb: number): number {
  const baseTb = model.capacityTb || 4
  const unit = model.priceUsd / Math.max(1, baseTb)
  return Math.round(unit * clampHddTb(tb))
}

export type MountableItem = {
  id: string
  label: string
  source: RackMount['source']
  heightU: number
  detail: string
  rackId?: string | null
  rackStartU?: number
}

export function recorderHeightU(modelId: string): number {
  const m = getNetworkModel(modelId)
  const u = m?.rackUnits
  return typeof u === 'number' && u > 0 ? Math.min(8, Math.round(u)) : 1
}

export function networkHeightU(node: DesignNetworkNode): number {
  if (node.kind === 'ap') return 0
  const m = getNetworkModel(node.modelId)
  const u = m?.rackUnits
  if (typeof u === 'number' && u > 0) return Math.min(8, Math.round(u))
  if (node.kind === 'nvr' || node.kind === 'switch') return 1
  return 0
}

export function infraHeightU(device: DesignInfraDevice): number {
  if (device.kind === 'rack') return 0
  const model = getInfraModelOrDefault(device.modelId, device.kind)
  const u = model.rackUnits
  return typeof u === 'number' && u > 0 ? Math.min(8, Math.round(u)) : 0
}

export function rackTotalU(rack: DesignInfraDevice): number {
  return clampRackSizeU(rack.rackUnits ?? getInfraModelOrDefault(rack.modelId, 'rack').totalU)
}

export function listMountables(
  networkNodes: DesignNetworkNode[],
  infra: DesignInfraDevice[],
): MountableItem[] {
  const recs = networkNodes
    .filter((n) => networkHeightU(n) > 0)
    .map((n) => {
      const m = getNetworkModel(n.modelId)
      const h = networkHeightU(n)
      const kindLabel =
        n.kind === 'switch'
          ? 'Switch'
          : m?.recorder === 'dvr'
            ? 'DVR'
            : n.kind === 'nvr'
              ? 'NVR'
              : n.kind
      return {
        id: n.id,
        label: n.label,
        source: 'network' as const,
        heightU: h,
        detail: `${kindLabel} · ${m?.name ?? n.modelId} · ${h}U`,
        rackId: null,
        rackStartU: undefined,
      }
    })
  const extras = infra
    .filter((d) => d.kind !== 'rack' && infraHeightU(d) > 0)
    .map((d) => {
      const m = getInfraModelOrDefault(d.modelId, d.kind)
      const extra =
        d.kind === 'hdd'
          ? ` · ${clampHddTb(d.capacityTb ?? m.capacityTb)} TB`
          : d.kind === 'ups' && m.va
            ? ` · ${m.va} VA`
            : ''
      return {
        id: d.id,
        label: d.label,
        source: 'infra' as const,
        heightU: infraHeightU(d),
        detail: `${INFRA_KIND_LABEL[d.kind]} · ${m.name}${extra} · ${infraHeightU(d)}U`,
        rackId: d.rackId ?? null,
        rackStartU: d.rackStartU,
      }
    })
  return [...recs, ...extras]
}

export function mountsOf(rack: DesignInfraDevice): RackMount[] {
  return Array.isArray(rack.mounts) ? rack.mounts : []
}

export function occupancy(
  rack: DesignInfraDevice,
  items: MountableItem[],
): Array<{ u: number; mount: RackMount | null; item: MountableItem | null }> {
  const total = rackTotalU(rack)
  const byId = new Map(items.map((i) => [i.id, i]))
  const slots: Array<{ u: number; mount: RackMount | null; item: MountableItem | null }> = []
  const taken = new Map<number, { mount: RackMount; item: MountableItem | null }>()
  for (const mount of mountsOf(rack)) {
    const item = byId.get(mount.deviceId) ?? null
    const h = item?.heightU ?? 1
    for (let i = 0; i < h; i++) {
      taken.set(mount.startU + i, { mount, item })
    }
  }
  for (let u = 1; u <= total; u++) {
    const hit = taken.get(u) ?? null
    slots.push({ u, mount: hit?.mount ?? null, item: hit?.item ?? null })
  }
  return slots
}

export function canPlaceInRack(
  rack: DesignInfraDevice,
  items: MountableItem[],
  startU: number,
  heightU: number,
  ignoreDeviceId?: string,
): boolean {
  const total = rackTotalU(rack)
  if (heightU < 1 || startU < 1 || startU + heightU - 1 > total) return false
  const byId = new Map(items.map((i) => [i.id, i]))
  for (const mount of mountsOf(rack)) {
    if (ignoreDeviceId && mount.deviceId === ignoreDeviceId) continue
    const other = byId.get(mount.deviceId)
    const h = other?.heightU ?? 1
    const a0 = startU
    const a1 = startU + heightU - 1
    const b0 = mount.startU
    const b1 = mount.startU + h - 1
    if (a0 <= b1 && b0 <= a1) return false
  }
  return true
}

export function firstFreeU(
  rack: DesignInfraDevice,
  items: MountableItem[],
  heightU: number,
): number | null {
  const total = rackTotalU(rack)
  for (let u = 1; u <= total - heightU + 1; u++) {
    if (canPlaceInRack(rack, items, u, heightU)) return u
  }
  return null
}

export function usedU(rack: DesignInfraDevice, items: MountableItem[]): number {
  const byId = new Map(items.map((i) => [i.id, i]))
  return mountsOf(rack).reduce((sum, m) => sum + (byId.get(m.deviceId)?.heightU ?? 1), 0)
}

export function mountIntoRack(
  rack: DesignInfraDevice,
  deviceId: string,
  source: RackMount['source'],
  startU: number,
): DesignInfraDevice {
  const next = mountsOf(rack).filter((m) => m.deviceId !== deviceId)
  next.push({ deviceId, source, startU })
  next.sort((a, b) => a.startU - b.startU)
  return { ...rack, mounts: next }
}

export function resizeRack(
  rack: DesignInfraDevice,
  sizeU: RackSizeU,
  items: MountableItem[],
): DesignInfraDevice {
  const mounts = mountsOf(rack).filter((m) => {
    const item = items.find((i) => i.id === m.deviceId)
    const h = item?.heightU ?? 1
    return m.startU >= 1 && m.startU + h - 1 <= sizeU
  })
  return {
    ...rack,
    rackUnits: sizeU,
    modelId: `rack-${sizeU}u`,
    mounts,
  }
}

export function unmountFromRacks(
  devices: DesignInfraDevice[],
  deviceId: string,
): DesignInfraDevice[] {
  return devices.map((d) => {
    if (d.kind === 'rack') {
      const mounts = mountsOf(d).filter((m) => m.deviceId !== deviceId)
      return mounts.length === mountsOf(d).length ? d : { ...d, mounts }
    }
    if (d.id === deviceId && (d.rackId || d.rackStartU)) {
      return { ...d, rackId: null, rackStartU: undefined }
    }
    return d
  })
}
