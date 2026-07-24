import equipment from '@/data/netvision/equipment.json'
import { getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
import { getNetworkModelOrDefault } from '@/lib/netvision/catalog/network'
import { buildCableBomLines } from '@/lib/netvision/services/cableCalculator'
import { buildConduitBomLines, type ConduitPlan } from '@/lib/netvision/services/conduitCalculator'
import {
  buildUndergroundBomLines,
  type UndergroundPlan,
} from '@/lib/netvision/services/canalizationCalculator'
import type {
  BomLine,
  BomSummary,
  CableRoute,
  DesignCamera,
  DesignNetworkNode,
} from '@/lib/netvision/types'

export function totalBandwidthMbps(cameras: DesignCamera[]): number {
  return cameras.reduce((sum, c) => sum + getCameraModelOrDefault(c.modelId).bitrateMbps, 0)
}

export function totalPoeWatts(cameras: DesignCamera[]): number {
  return cameras.reduce((sum, c) => sum + getCameraModelOrDefault(c.modelId).poeWatts, 0)
}

/** Almacenamiento TB ≈ bitrate total × retención × 86400 / (8 × 1e12) con overhead 1.15 */
export function estimateStorageTb(totalMbps: number, retentionDays: number): number {
  if (totalMbps <= 0 || retentionDays <= 0) return 0
  const bits = totalMbps * 1e6 * retentionDays * 86400 * 1.15
  return bits / (8 * 1e12)
}

export function buildBom(
  cameras: DesignCamera[],
  retentionDays: number,
  networkNodes: DesignNetworkNode[] = [],
  cableRoutes: CableRoute[] = [],
  conduitPlans: ConduitPlan[] = [],
  undergroundPlan?: UndergroundPlan | null,
): BomSummary {
  const lines: BomLine[] = []
  const byModel = new Map<string, { qty: number; unit: number; desc: string }>()

  for (const cam of cameras) {
    const m = getCameraModelOrDefault(cam.modelId)
    const prev = byModel.get(m.id)
    if (prev) prev.qty += 1
    else byModel.set(m.id, { qty: 1, unit: m.priceUsd, desc: `${m.brand} ${m.name}` })
  }

  Array.from(byModel.entries()).forEach(([sku, v]) => {
    lines.push({
      sku,
      category: 'camera',
      description: v.desc,
      qty: v.qty,
      unitUsd: v.unit,
      totalUsd: v.qty * v.unit,
    })
  })

  const netByModel = new Map<
    string,
    { qty: number; unit: number; desc: string; category: BomLine['category'] }
  >()
  for (const n of networkNodes) {
    const m = getNetworkModelOrDefault(n.modelId, n.kind)
    const category: BomLine['category'] =
      n.kind === 'ap' ? 'wifi' : n.kind === 'nvr' ? 'nvr' : 'network'
    const prev = netByModel.get(m.id)
    if (prev) prev.qty += 1
    else
      netByModel.set(m.id, {
        qty: 1,
        unit: m.priceUsd,
        desc: `${m.brand} ${m.name}`,
        category,
      })
  }
  Array.from(netByModel.entries()).forEach(([sku, v]) => {
    lines.push({
      sku,
      category: v.category,
      description: v.desc,
      qty: v.qty,
      unitUsd: v.unit,
      totalUsd: v.qty * v.unit,
    })
  })

  const hasPhysicalNvr = networkNodes.some((n) => n.kind === 'nvr')
  const nvrMeta = equipment.nvr
  const channels = cameras.length
  if (!hasPhysicalNvr && channels > 0) {
    const nvrUnits = Math.ceil(channels / nvrMeta.channelsPerUnit)
    const unit =
      nvrMeta.baseChassisUsd +
      nvrMeta.channelPriceUsd * Math.min(channels, nvrMeta.channelsPerUnit)
    lines.push({
      sku: 'NVR-CH',
      category: 'nvr',
      description: `NVR ${nvrMeta.channelsPerUnit}ch (estimado)`,
      qty: nvrUnits,
      unitUsd: unit,
      totalUsd: nvrUnits * unit,
    })
  }

  const bw = totalBandwidthMbps(cameras)
  const storageTb = Math.ceil(estimateStorageTb(bw, retentionDays) * 10) / 10
  const storageUnits = storageTb > 0 ? Math.max(1, Math.ceil(storageTb)) : 0
  if (storageUnits > 0) {
    lines.push({
      sku: 'HDD-TB',
      category: 'storage',
      description: `Almacenamiento ${retentionDays} días (~${storageTb} TB)`,
      qty: storageUnits,
      unitUsd: equipment.storageUsdPerTb,
      totalUsd: storageUnits * equipment.storageUsdPerTb,
    })
  }

  const poe = totalPoeWatts(cameras)
  const poeBudgetOnSite = networkNodes.reduce((s, n) => {
    const m = getNetworkModelOrDefault(n.modelId, n.kind)
    return s + m.poeBudgetW
  }, 0)
  const deficit = Math.max(0, poe - poeBudgetOnSite)
  if (deficit > 0) {
    const injectors = Math.ceil(deficit / 30)
    lines.push({
      sku: 'POE-INJ-EST',
      category: 'poe',
      description: `Injectors PoE estimados (déficit ${deficit.toFixed(0)} W)`,
      qty: injectors,
      unitUsd: 28,
      totalUsd: injectors * 28,
    })
  } else if (poe > 0 && networkNodes.length === 0) {
    const injectors = Math.ceil(poe / 30)
    lines.push({
      sku: 'POE-BUDGET',
      category: 'poe',
      description: `Presupuesto PoE (${poe.toFixed(1)} W total)`,
      qty: Math.max(1, injectors),
      unitUsd: 45,
      totalUsd: Math.max(1, injectors) * 45,
    })
  }

  if (cableRoutes.length > 0) {
    lines.push(...buildCableBomLines(cableRoutes))
  }
  if (conduitPlans.length > 0) {
    lines.push(...buildConduitBomLines(conduitPlans))
  }
  if (undergroundPlan && undergroundPlan.runs.length > 0) {
    lines.push(...buildUndergroundBomLines(undergroundPlan))
  }

  const subtotalByCategory: Record<string, number> = {}
  for (const line of lines) {
    subtotalByCategory[line.category] = (subtotalByCategory[line.category] ?? 0) + line.totalUsd
  }
  const totalUsd = lines.reduce((s, l) => s + l.totalUsd, 0)

  return {
    lines,
    subtotalByCategory,
    totalUsd,
    totalPoeWatts: poe,
    totalBandwidthMbps: bw,
    storageTb,
    nvrChannels: channels,
  }
}
