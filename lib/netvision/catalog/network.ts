import equipment from '@/data/netvision/equipment.json'
import type { NetworkDeviceModel, NetworkNodeKind } from '@/lib/netvision/types'

export const NETWORK_CATALOG: NetworkDeviceModel[] = (
  equipment.network ?? []
) as NetworkDeviceModel[]

export function networkCatalogByKind(kind: NetworkNodeKind): NetworkDeviceModel[] {
  return NETWORK_CATALOG.filter((m) => m.kind === kind)
}

export function getNetworkModel(id: string): NetworkDeviceModel | undefined {
  return NETWORK_CATALOG.find((m) => m.id === id)
}

export function getNetworkModelOrDefault(
  id: string,
  kind: NetworkNodeKind = 'switch',
): NetworkDeviceModel {
  return (
    getNetworkModel(id) ??
    NETWORK_CATALOG.find((m) => m.kind === kind) ??
    NETWORK_CATALOG[0]!
  )
}

export const DEFAULT_SWITCH_ID =
  NETWORK_CATALOG.find((m) => m.kind === 'switch')?.id ?? 'sw-poe-8'
export const DEFAULT_AP_ID =
  NETWORK_CATALOG.find((m) => m.kind === 'ap')?.id ?? 'ap-u6-lite'
export const DEFAULT_NVR_ID =
  NETWORK_CATALOG.find((m) => m.kind === 'nvr')?.id ?? 'nvr-ds7608'
export const DEFAULT_INJECTOR_ID =
  NETWORK_CATALOG.find((m) => m.kind === 'injector')?.id ?? 'inj-poe-gig'

export function defaultModelIdForKind(kind: NetworkNodeKind): string {
  if (kind === 'ap') return DEFAULT_AP_ID
  if (kind === 'nvr') return DEFAULT_NVR_ID
  if (kind === 'injector') return DEFAULT_INJECTOR_ID
  return DEFAULT_SWITCH_ID
}

export function labelPrefixForKind(kind: NetworkNodeKind): string {
  if (kind === 'ap') return 'AP'
  if (kind === 'nvr') return 'NVR'
  if (kind === 'injector') return 'INJ'
  return 'SW'
}
