import equipment from '@/data/netvision/equipment.json'
import { getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
import type { BomLine, BomSummary, DesignCamera } from '@/lib/netvision/types'

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

export function buildBom(cameras: DesignCamera[], retentionDays: number): BomSummary {
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

  const nvrMeta = equipment.nvr
  const channels = cameras.length
  const nvrUnits = channels === 0 ? 0 : Math.ceil(channels / nvrMeta.channelsPerUnit)
  if (nvrUnits > 0) {
    const unit =
      nvrMeta.baseChassisUsd + nvrMeta.channelPriceUsd * Math.min(channels, nvrMeta.channelsPerUnit)
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
  if (poe > 0) {
    const injectors = Math.ceil(poe / 30) // switch PoE ~30W útiles por puerto agrupado
    lines.push({
      sku: 'POE-BUDGET',
      category: 'poe',
      description: `Presupuesto PoE (${poe.toFixed(1)} W total)`,
      qty: Math.max(1, injectors),
      unitUsd: 45,
      totalUsd: Math.max(1, injectors) * 45,
    })
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
