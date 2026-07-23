import conduits from '@/data/netvision/conduits.json'
import { isDataCableType } from '@/lib/netvision/services/cableCalculator'
import { MANUAL_CABLE_TO_ID } from '@/lib/netvision/services/cableRoutingEngine'
import type { BomLine, CableRoute, ValidationResult } from '@/lib/netvision/types'

export type ConduitBox = {
  id: string
  label: string
  maxCat6: number
  usd: number
}

export type ConduitPlan = {
  nodeId: string
  nodeLabel: string
  cableCount: number
  box: ConduitBox
  occupancy: number
  ok: boolean
  cableIds: string[]
}

export function recommendConduitBox(cat6Count: number): ConduitBox {
  const boxes = conduits.boxes as ConduitBox[]
  return (
    boxes.find((b) => b.maxCat6 >= cat6Count) ?? boxes[boxes.length - 1]!
  )
}

/**
 * Agrupa cables por nodo destino y selecciona cajetín/ducto (ocupación ≤40% ≈ maxCat6).
 */
export function planConduits(routes: CableRoute[]): ConduitPlan[] {
  const byTo = new Map<string, CableRoute[]>()
  for (const r of routes) {
    if (r.toId === MANUAL_CABLE_TO_ID || !isDataCableType(r.type)) continue
    const list = byTo.get(r.toId) ?? []
    list.push(r)
    byTo.set(r.toId, list)
  }

  const maxOcc = conduits.maxOccupancy
  const plans: ConduitPlan[] = []

  Array.from(byTo.entries()).forEach(([nodeId, list]) => {
    const count = list.length
    const box = recommendConduitBox(count)
    const occupancy = box.maxCat6 > 0 ? count / box.maxCat6 : 1
    void maxOcc // capacidad maxCat6 ya refleja ocupación ≤40%
    plans.push({
      nodeId,
      nodeLabel: list[0]?.toLabel ?? nodeId,
      cableCount: count,
      box,
      occupancy: Math.round(Math.min(occupancy, 1) * 100) / 100,
      ok: count <= box.maxCat6,
      cableIds: list.map((r) => r.id),
    })
  })

  return plans.sort((a, b) => b.cableCount - a.cableCount)
}

export function validateConduits(plans: ConduitPlan[]): ValidationResult[] {
  const results: ValidationResult[] = []
  const maxPct = Math.round(conduits.maxOccupancy * 100)
  for (const p of plans) {
    if (!p.ok) {
      results.push({
        level: 'ERROR',
        code: 'CND-001',
        message: `${p.nodeLabel}: ${p.cableCount} cables no caben en ${p.box.label} (máx ${p.box.maxCat6})`,
        solution: `Usar ducto mayor o dividir rutas (ocupación máx ${maxPct}%)`,
        nodeId: p.nodeId,
      })
    } else if (p.occupancy >= 0.85) {
      results.push({
        level: 'WARNING',
        code: 'CND-002',
        message: `${p.nodeLabel}: cajetín al ${Math.round(p.occupancy * 100)}% de capacidad`,
        solution: 'Deja margen para mantenimiento / expansión',
        nodeId: p.nodeId,
      })
    }
  }
  return results
}

export function buildConduitBomLines(plans: ConduitPlan[]): BomLine[] {
  const byBox = new Map<string, { box: ConduitBox; qty: number }>()
  for (const p of plans) {
    const prev = byBox.get(p.box.id)
    if (prev) prev.qty += 1
    else byBox.set(p.box.id, { box: p.box, qty: 1 })
  }
  // 1 cajetín en destino + 1 en origen por cada cable (simplificado: + ceil(cables/4) en campo)
  const lines: BomLine[] = []
  Array.from(byBox.values()).forEach(({ box, qty }) => {
    lines.push({
      sku: box.id.toUpperCase(),
      category: 'conduit',
      description: `${box.label} (destino PoE)`,
      qty,
      unitUsd: box.usd,
      totalUsd: Math.round(qty * box.usd * 100) / 100,
    })
  })

  const fieldBoxes = plans.reduce((s, p) => s + Math.ceil(p.cableCount / 4), 0)
  if (fieldBoxes > 0) {
    const box = recommendConduitBox(4)
    lines.push({
      sku: 'BOX-FIELD',
      category: 'conduit',
      description: `${box.label} (puntos de campo / cámaras)`,
      qty: fieldBoxes,
      unitUsd: box.usd,
      totalUsd: Math.round(fieldBoxes * box.usd * 100) / 100,
    })
  }

  // Corrugado estimado: 0.3 USD/m × metros no disponible aquí → omitir o aproximar por nº cables
  const tubing = plans.reduce((s, p) => s + p.cableCount * 3, 0) // 3 m promedio protección
  if (tubing > 0) {
    lines.push({
      sku: 'TUBING-CORR',
      category: 'conduit',
      description: 'Tubing / corrugado protección (est.)',
      qty: tubing,
      unitUsd: 0.35,
      totalUsd: Math.round(tubing * 0.35 * 100) / 100,
    })
  }

  return lines
}
