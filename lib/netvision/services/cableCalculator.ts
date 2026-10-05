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

/** Límite de un tramo de cable de red (cobre) entre dos equipos activos. */
export const NETWORK_COPPER_MAX_M = 100

/**
 * Tipo de cable para una ruta automática. Un tramo de más de 100 m sigue siendo
 * cable de red: no se cambia a fibra, se avisa que necesita un switch intermedio.
 */
export function recommendCableType(lengthM: number): CableType {
  if (lengthM > 30 && lengthM <= 55) return 'CAT6A'
  return 'CAT6'
}

/** ¿El tramo de cable de red pasa del límite y necesita un switch en el camino? */
export function exceedsNetworkCopperLimit(lengthM: number, type?: CableType): boolean {
  if (type && !isNetworkCopperType(type)) return false
  return lengthM > (type ? cableMaxM(type) : NETWORK_COPPER_MAX_M)
}

/** Switches intermedios para que ningún tramo pase del límite (126 m → 1, 240 m → 2). */
export function intermediateSwitchesNeeded(
  lengthM: number,
  maxM = NETWORK_COPPER_MAX_M,
): number {
  if (!(lengthM > maxM) || !(maxM > 0)) return 0
  return Math.ceil(lengthM / maxM) - 1
}

function formatMeters(lengthM: number): string {
  return String(Math.round(lengthM * 10) / 10)
}

/** Aviso para un tramo de cable de red que pasa de 100 m. */
export function overLimitSwitchMessage(lengthM: number, maxM = NETWORK_COPPER_MAX_M): string {
  const n = intermediateSwitchesNeeded(lengthM, maxM)
  const need = n <= 1 ? 'necesita un switch intermedio' : `necesita ${n} switches intermedios`
  return `Tramo de ${formatMeters(lengthM)} m: supera los ${maxM} m, ${need}`
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
    if (!type || isNetworkCopperType(type)) {
      return overLimitSwitchMessage(lengthM, max)
    }
    return `Supera ${max} m para ${cableTypeLabel(type)} — acorta el tramo o usa un repetidor`
  }
  if (lengthM > 90 && (!type || isNetworkCopperType(type))) {
    return 'Cerca del límite de 100 m — deja margen de servicio'
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
