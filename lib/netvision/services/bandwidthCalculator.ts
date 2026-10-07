import equipment from '@/data/netvision/equipment.json'
import {
  camarasCableadas,
  getCameraModelOrDefault,
  lenteNoEstandar,
  splitterDeCamara,
} from '@/lib/netvision/catalog/cameras'
import { getNetworkModelOrDefault } from '@/lib/netvision/catalog/network'
import { buildCableBomLines } from '@/lib/netvision/services/cableCalculator'
import { buildConduitBomLines, type ConduitPlan } from '@/lib/netvision/services/conduitCalculator'
import {
  buildUndergroundBomLines,
  type UndergroundPlan,
} from '@/lib/netvision/services/canalizationCalculator'
import {
  clampHddTb,
  getInfraModelOrDefault,
  hddPriceUsd,
} from '@/lib/netvision/catalog/salaTecnica'
import { getPlanDeviceModelOrDefault } from '@/lib/netvision/catalog/planDevices'
import type {
  BomLine,
  BomSummary,
  CableRoute,
  DesignCamera,
  DesignInfraDevice,
  DesignNetworkNode,
  DesignPlanDevice,
  ZanjaModo,
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

export type BomOpciones = {
  /**
   * Zanja de la canalización subterránea: solo entra a la lista con «cobrar».
   * Sin valor = no se cobra.
   */
  zanjaModo?: ZanjaModo
  /** Altavoces, sensores, tableros y demás equipos del plano de especialidad. */
  planDevices?: DesignPlanDevice[]
}

/** Precio de referencia del adaptador PoE (splitter), como el resto de accesorios estimados. */
export const SPLITTER_POE_USD: Record<5 | 12, number> = { 5: 5, 12: 6 }

export function buildBom(
  cameras: DesignCamera[],
  retentionDays: number,
  networkNodes: DesignNetworkNode[] = [],
  cableRoutes: CableRoute[] = [],
  conduitPlans: ConduitPlan[] = [],
  undergroundPlan?: UndergroundPlan | null,
  infraDevices: DesignInfraDevice[] = [],
  opciones: BomOpciones = {},
): BomSummary {
  const lines: BomLine[] = []
  const byModel = new Map<string, { qty: number; unit: number; desc: string }>()

  for (const cam of cameras) {
    const m = getCameraModelOrDefault(cam.modelId)
    // Con una lente distinta a la de ficha es otra referencia de compra: renglón aparte.
    const lente = lenteNoEstandar(cam)
    const clave = lente ? `${m.id}-${lente}mm` : m.id
    const prev = byModel.get(clave)
    if (prev) prev.qty += 1
    else
      byModel.set(clave, {
        qty: 1,
        unit: m.priceUsd,
        desc: lente ? `${m.brand} ${m.name} · lente ${lente} mm` : `${m.brand} ${m.name}`,
      })
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

  const planByModel = new Map<string, { qty: number; unit: number; desc: string }>()
  for (const d of opciones.planDevices ?? []) {
    const m = getPlanDeviceModelOrDefault(d.modelId, d.discipline)
    const prev = planByModel.get(m.id)
    if (prev) prev.qty += 1
    else
      planByModel.set(m.id, {
        qty: 1,
        unit: m.priceUsd,
        desc: `${m.brand} ${m.name}`,
      })
  }
  Array.from(planByModel.entries()).forEach(([sku, v]) => {
    lines.push({
      sku,
      category: 'accessory',
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

  // Adaptadores PoE (splitter) de las cámaras que no traen PoE propio.
  const splitters: Record<5 | 12, number> = { 5: 0, 12: 0 }
  for (const cam of cameras) {
    const v = splitterDeCamara(cam)
    if (v) splitters[v] += 1
  }
  for (const v of [12, 5] as const) {
    if (splitters[v] === 0) continue
    lines.push({
      sku: `POE-SPLITTER-${v}V`,
      category: 'poe',
      description: `Adaptador PoE (splitter) de ${v} V`,
      qty: splitters[v],
      unitUsd: SPLITTER_POE_USD[v],
      totalUsd: splitters[v] * SPLITTER_POE_USD[v],
    })
  }

  // Por Wi‑Fi o batería graban en su memoria o en la nube: no ocupan canal del
  // grabador, ni disco, ni PoE.
  const cableadas = camarasCableadas(cameras)
  const hasPhysicalNvr = networkNodes.some((n) => n.kind === 'nvr')
  const nvrMeta = equipment.nvr
  const channels = cableadas.length
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
  const storageTb =
    Math.ceil(estimateStorageTb(totalBandwidthMbps(cableadas), retentionDays) * 10) / 10
  const storageUnits = storageTb > 0 ? Math.max(1, Math.ceil(storageTb)) : 0
  const physicalDisks = infraDevices.filter((d) => d.kind === 'hdd')
  if (physicalDisks.length > 0) {
    for (const disk of physicalDisks) {
      const model = getInfraModelOrDefault(disk.modelId, 'hdd')
      const tb = clampHddTb(disk.capacityTb ?? model.capacityTb)
      const unit = hddPriceUsd(model, tb)
      lines.push({
        sku: `${model.id}-${tb}tb`,
        category: 'storage',
        description: `${model.brand} ${model.name} ${tb} TB`,
        qty: 1,
        unitUsd: unit,
        totalUsd: unit,
      })
    }
  } else if (storageUnits > 0) {
    lines.push({
      sku: 'HDD-TB',
      category: 'storage',
      description: `Almacenamiento ${retentionDays} días (~${storageTb} TB)`,
      qty: storageUnits,
      unitUsd: equipment.storageUsdPerTb,
      totalUsd: storageUnits * equipment.storageUsdPerTb,
    })
  }

  for (const d of infraDevices.filter((x) => x.kind !== 'hdd')) {
    const model = getInfraModelOrDefault(d.modelId, d.kind)
    const category: BomLine['category'] =
      d.kind === 'monitor' ? 'monitor' : d.kind === 'ups' ? 'power' : 'rack'
    const size =
      d.kind === 'rack' && d.rackUnits ? ` ${d.rackUnits}U` : ''
    lines.push({
      sku: `${model.id}-${d.id.slice(-4)}`,
      linkKey: model.id,
      category,
      description: `${model.brand} ${model.name}${size}`,
      qty: 1,
      unitUsd: model.priceUsd,
      totalUsd: model.priceUsd,
    })
  }

  const poe = totalPoeWatts(cableadas)
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
    const zanjaModo = opciones.zanjaModo ?? 'no_cobrar'
    if (zanjaModo === 'cobrar') {
      lines.push(...buildUndergroundBomLines(undergroundPlan))
    } else if (zanjaModo === 'otro_contratista') {
      // Queda como nota sin monto: la hace y la cobra otro contratista.
      lines.push({
        sku: 'ZANJA-TERCERO',
        category: 'conduit',
        description: `Canalización subterránea (${undergroundPlan.totalPipeM} m): a cargo de otro contratista`,
        qty: 1,
        unitUsd: 0,
        totalUsd: 0,
      })
    }
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
