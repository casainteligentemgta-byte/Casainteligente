import cablesDb from '@/data/netvision/cables.json'
import type { BomLine, CableType } from '@/lib/netvision/types'

/** Tipos que el usuario puede dibujar en el plano (pestaña Cable). */
export const DRAWABLE_CABLE_TYPES: CableType[] = [
  'CAT5E',
  'CAT6',
  'CAT6A',
  'FIBER',
  'AUDIO',
  'POWER_12V',
]

export function cableTypeLabel(type: CableType): string {
  const row = cablesDb[type as keyof typeof cablesDb]
  if (row && typeof row === 'object' && 'label' in row) {
    return String((row as { label: string }).label)
  }
  return type
}

/** Cobre de datos (RJ45 / PoE). */
export function isNetworkCopperType(type: CableType): boolean {
  return type === 'CAT5E' || type === 'CAT6' || type === 'CAT6A'
}

/** Cables de datos que pueden ir a conducto / subterráneo. */
export function isDataCableType(type: CableType): boolean {
  return isNetworkCopperType(type) || type === 'FIBER' || type === 'COAX'
}

/** Cálculo de tipo de cable por distancia (Fase 2/4). */
export function recommendCableType(lengthM: number): CableType {
  if (lengthM > 100) return 'FIBER'
  if (lengthM > 55) return 'CAT6'
  if (lengthM > 30) return 'CAT6A'
  return 'CAT6'
}

export function cableMaxM(type: CableType): number {
  const row = cablesDb[type as keyof typeof cablesDb]
  if (row && typeof row === 'object' && 'maxM' in row) return Number(row.maxM)
  return 100
}

export function cableUsdPerM(type: CableType): number {
  const row = cablesDb[type as keyof typeof cablesDb]
  if (row && typeof row === 'object' && 'usdPerM' in row) return Number(row.usdPerM)
  return 0.12
}

export function rj45Usd(): number {
  return cablesDb.connectors.RJ45.usdEach
}

export function cableWarning(lengthM: number, type?: CableType): string | null {
  const max = type ? cableMaxM(type) : 100
  if (lengthM > max) {
    if (type === 'POWER_12V') {
      return `Supera ${max} m para 12V — riesgo de caída de tensión; usa calibre mayor o fuente local`
    }
    if (type === 'AUDIO') {
      return `Supera ${max} m para sonido — usa balun / amplificador o acorta el tramo`
    }
    return `Supera ${max} m para ${type ? cableTypeLabel(type) : 'cable'} — usar fibra o repetidor`
  }
  if (lengthM > 90 && (type === 'CAT6' || type === 'CAT5E' || !type)) {
    return 'Cerca del límite TIA 100 m — deja margen de servicio'
  }
  if (type === 'CAT6A' && lengthM > 55) {
    return 'Cat6A >55 m: limitar a 1G o usar Cat6/fibra'
  }
  if (type === 'POWER_12V' && lengthM > 20) {
    return '12V >20 m: verifica calibre y caída de tensión'
  }
  return null
}

/** Factor de holgura sobre ruta ortogonal (codos / servicio). */
export const ROUTE_SLACK = 1.15

export function buildCableBomLines(
  routes: { type: CableType; routeM: number }[],
): BomLine[] {
  const byType = new Map<CableType, number>()
  for (const r of routes) {
    byType.set(r.type, (byType.get(r.type) ?? 0) + r.routeM)
  }
  const lines: BomLine[] = []
  Array.from(byType.entries()).forEach(([type, meters]) => {
    const qty = Math.ceil(meters * 10) / 10
    const unit = cableUsdPerM(type)
    lines.push({
      sku: `CABLE-${type}`,
      category: 'cable',
      description: `Cable ${cableTypeLabel(type)}`,
      qty,
      unitUsd: unit,
      totalUsd: Math.round(qty * unit * 100) / 100,
    })
  })

  const copperRuns = routes.filter((r) => isNetworkCopperType(r.type)).length
  if (copperRuns > 0) {
    const connectors = copperRuns * 2
    const unit = rj45Usd()
    lines.push({
      sku: 'CONN-RJ45',
      category: 'connector',
      description: 'Conectores RJ45',
      qty: connectors,
      unitUsd: unit,
      totalUsd: Math.round(connectors * unit * 100) / 100,
    })
  }

  const fiberRuns = routes.filter((r) => r.type === 'FIBER').length
  if (fiberRuns > 0) {
    lines.push({
      sku: 'FIBER-TERM',
      category: 'connector',
      description: 'Terminaciones fibra (par)',
      qty: fiberRuns * 2,
      unitUsd: 8,
      totalUsd: fiberRuns * 2 * 8,
    })
  }

  return lines
}
