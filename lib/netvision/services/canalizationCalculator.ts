import underground from '@/data/netvision/underground.json'
import type {
  CableRoute,
  BomLine,
  DesignUndergroundSegment,
  ScaleCalibration,
  ValidationResult,
} from '@/lib/netvision/types'
import { distMeters } from '@/lib/netvision/utils/geometryHelpers'

export type ZoneType = 'pedestrian' | 'vehicle' | 'road_crossing' | 'railway'
export type TerrainType = 'soft' | 'medium' | 'rocky'
export type ChamberMaterial = 'hormigón' | 'polietileno' | 'fibra_vidrio'

export type UndergroundPipe = {
  id: string
  label: string
  innerMm: number
  maxCat6: number
  usdPerM: number
  material: string
}

export type AccessChamber = {
  id: string
  x: number
  y: number
  reason: 'entry' | 'exit' | 'spacing' | 'turn' | 'slope'
  material: ChamberMaterial
  depthCm: number
  diameterCm: number
}

export type UndergroundRun = {
  id: string
  routeId: string
  fromLabel: string
  toLabel: string
  lengthM: number
  cableCount: number
  zone: ZoneType
  depthCm: number
  pipe: UndergroundPipe
  occupancy: number
  points: { x: number; y: number }[]
  chambers: AccessChamber[]
  turnsOver30: number
}

export type ExcavationSpec = {
  lengthM: number
  depthM: number
  widthM: number
  volumeM3: number
  terrain: TerrainType
  needsShoring: boolean
  equipment: string[]
  hours: number
  permits: string[]
  costUsd: number
}

export type UndergroundPlan = {
  zone: ZoneType
  terrain: TerrainType
  chamberMaterial: ChamberMaterial
  runs: UndergroundRun[]
  excavation: ExcavationSpec
  totalPipeM: number
  totalChambers: number
}

const DEPTH = underground.depthsCm as Record<ZoneType, number>

export function minDepthCm(zone: ZoneType): number {
  return DEPTH[zone]
}

export function zoneLabel(zone: ZoneType): string {
  const map: Record<ZoneType, string> = {
    pedestrian: 'Peatonal',
    vehicle: 'Tráfico vehicular',
    road_crossing: 'Cruce de carretera',
    railway: 'Bajo ferrocarril',
  }
  return map[zone]
}

export function recommendPipe(cableCount: number): UndergroundPipe {
  const pipes = underground.pipes as UndergroundPipe[]
  return (
    pipes.find((p) => p.maxCat6 >= cableCount) ?? pipes[pipes.length - 1]!
  )
}

function angleDeg(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const v1x = a.x - b.x
  const v1y = a.y - b.y
  const v2x = c.x - b.x
  const v2y = c.y - b.y
  const dot = v1x * v2x + v1y * v2y
  const n1 = Math.hypot(v1x, v1y)
  const n2 = Math.hypot(v2x, v2y)
  if (n1 < 1e-9 || n2 < 1e-9) return 0
  const cos = Math.min(1, Math.max(-1, dot / (n1 * n2)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Cuenta cambios de dirección > 30° en polilínea. */
export function countTurnsOver30(points: { x: number; y: number }[]): number {
  let n = 0
  for (let i = 1; i < points.length - 1; i++) {
    const turn = 180 - angleDeg(points[i - 1]!, points[i]!, points[i + 1]!)
    if (turn > 30) n++
  }
  return n
}

export function estimateAccessChambers(lengthM: number, turnsOver30: number): number {
  const byDistance = Math.max(0, Math.ceil(lengthM / underground.maxChamberSpacingM) - 1)
  return Math.max(2, 2 + byDistance + turnsOver30)
}

export function placeChambersAlongRoute(
  runId: string,
  points: { x: number; y: number }[],
  lengthM: number,
  depthCm: number,
  material: ChamberMaterial,
): AccessChamber[] {
  const chambers: AccessChamber[] = []
  if (points.length < 2) return chambers

  const start = points[0]!
  const end = points[points.length - 1]!
  chambers.push({
    id: `${runId}-ch-entry`,
    x: start.x,
    y: start.y,
    reason: 'entry',
    material,
    depthCm,
    diameterCm: underground.minChamberDiameterCm,
  })

  // Pozos por cambio de dirección > 30°
  for (let i = 1; i < points.length - 1; i++) {
    const turn = 180 - angleDeg(points[i - 1]!, points[i]!, points[i + 1]!)
    if (turn > 30) {
      chambers.push({
        id: `${runId}-ch-turn-${i}`,
        x: points[i]!.x,
        y: points[i]!.y,
        reason: 'turn',
        material,
        depthCm,
        diameterCm: underground.minChamberDiameterCm,
      })
    }
  }

  // Pozos por espaciado máx 30 m a lo largo de la longitud
  const spacing = underground.maxChamberSpacingM
  if (lengthM > spacing) {
    const n = Math.floor(lengthM / spacing)
    for (let i = 1; i <= n; i++) {
      const t = (i * spacing) / lengthM
      if (t >= 0.98) continue
      // interpolar en polilínea por fracción de longitud (aprox en espacio norm)
      const idx = Math.min(
        points.length - 2,
        Math.floor(t * (points.length - 1)),
      )
      const localT = t * (points.length - 1) - idx
      const a = points[idx]!
      const b = points[idx + 1]!
      const x = a.x + (b.x - a.x) * localT
      const y = a.y + (b.y - a.y) * localT
      // evitar duplicar pozos de giro cercanos
      const nearTurn = chambers.some(
        (c) => Math.hypot(c.x - x, c.y - y) < 0.02,
      )
      if (!nearTurn) {
        chambers.push({
          id: `${runId}-ch-span-${i}`,
          x,
          y,
          reason: 'spacing',
          material,
          depthCm,
          diameterCm: underground.minChamberDiameterCm,
        })
      }
    }
  }

  chambers.push({
    id: `${runId}-ch-exit`,
    x: end.x,
    y: end.y,
    reason: 'exit',
    material,
    depthCm,
    diameterCm: underground.minChamberDiameterCm,
  })

  return chambers
}

/**
 * Construye plan subterráneo a partir de rutas de cable.
 * Agrupa por nodo destino (tronco común) + tramos individuales largos.
 */
export function buildUndergroundPlan(
  routes: CableRoute[],
  opts: {
    zone: ZoneType
    terrain: TerrainType
    chamberMaterial: ChamberMaterial
    /** solo tramos con routeM >= este umbral */
    minLengthM?: number
  },
): UndergroundPlan {
  const minLen = opts.minLengthM ?? 8
  const depthCm = minDepthCm(opts.zone)
  const eligible = routes.filter((r) => r.routeM >= minLen)

  // Agrupar por destino para un tronco subterráneo por switch
  const byTo = new Map<string, CableRoute[]>()
  for (const r of eligible) {
    const list = byTo.get(r.toId) ?? []
    list.push(r)
    byTo.set(r.toId, list)
  }

  const runs: UndergroundRun[] = []

  Array.from(byTo.entries()).forEach(([toId, list]) => {
    // Usar la ruta más larga como geometría del tronco; longitud = max de rutas
    const longest = [...list].sort((a, b) => b.routeM - a.routeM)[0]!
    const lengthM = Math.round(
      list.reduce((s, r) => s + r.routeM, 0) / list.length,
    )
    // Para tronco compartido usar max length como zanja principal
    const trenchLen = Math.max(...list.map((r) => r.routeM))
    const cableCount = list.length
    const pipe = recommendPipe(cableCount)
    const occupancy =
      pipe.maxCat6 > 0 ? Math.round((cableCount / pipe.maxCat6) * 100) / 100 : 1
    const turns = countTurnsOver30(longest.points)
    const runId = `ug-${toId}`
    const chambers = placeChambersAlongRoute(
      runId,
      longest.points,
      trenchLen,
      depthCm,
      opts.chamberMaterial,
    )
    runs.push({
      id: runId,
      routeId: longest.id,
      fromLabel: list.length > 1 ? `${list.length} equipos` : longest.fromLabel,
      toLabel: longest.toLabel,
      lengthM: trenchLen,
      cableCount,
      zone: opts.zone,
      depthCm,
      pipe,
      occupancy,
      points: longest.points,
      chambers,
      turnsOver30: turns,
    })
    void lengthM
  })

  return finalizeUndergroundPlan(
    opts.zone,
    opts.terrain,
    opts.chamberMaterial,
    runs,
  )
}

/** Tramo subterráneo dibujado a mano (2 puntos en el plano). */
export function buildManualUndergroundRun(
  seg: DesignUndergroundSegment,
  scale: ScaleCalibration,
  opts: {
    zone: ZoneType
    chamberMaterial: ChamberMaterial
    cableCount?: number
  },
): UndergroundRun {
  const points = [
    { x: seg.x1, y: seg.y1 },
    { x: seg.x2, y: seg.y2 },
  ]
  const lengthM =
    Math.round(
      distMeters(
        seg.x1,
        seg.y1,
        seg.x2,
        seg.y2,
        scale.metersPerNormX,
        scale.metersPerNormY,
      ) * 10,
    ) / 10
  const depthCm = minDepthCm(opts.zone)
  const cableCount = opts.cableCount ?? 1
  const pipe = recommendPipe(cableCount)
  const occupancy =
    pipe.maxCat6 > 0 ? Math.round((cableCount / pipe.maxCat6) * 100) / 100 : 1
  const turns = countTurnsOver30(points)
  const chambers = placeChambersAlongRoute(
    seg.id,
    points,
    lengthM,
    depthCm,
    opts.chamberMaterial,
  )
  return {
    id: seg.id,
    routeId: seg.id,
    fromLabel: seg.label,
    toLabel: 'manual',
    lengthM,
    cableCount,
    zone: opts.zone,
    depthCm,
    pipe,
    occupancy,
    points,
    chambers,
    turnsOver30: turns,
  }
}

function finalizeUndergroundPlan(
  zone: ZoneType,
  terrain: TerrainType,
  chamberMaterial: ChamberMaterial,
  runs: UndergroundRun[],
): UndergroundPlan {
  const totalPipeM = runs.reduce((s, r) => s + r.lengthM, 0)
  const allChambers = runs.flatMap((r) => r.chambers)
  const uniqueChambers: AccessChamber[] = []
  for (const ch of allChambers) {
    if (uniqueChambers.some((u) => Math.hypot(u.x - ch.x, u.y - ch.y) < 0.025)) {
      continue
    }
    uniqueChambers.push(ch)
  }
  const depthCm = runs[0]?.depthCm ?? minDepthCm(zone)
  const excavation = buildExcavationSpec(totalPipeM, depthCm, terrain, zone)
  return {
    zone,
    terrain,
    chamberMaterial,
    runs,
    excavation,
    totalPipeM: Math.round(totalPipeM * 10) / 10,
    totalChambers: uniqueChambers.length,
  }
}

/** Combina tramos auto (cable ≥ 8 m) con segmentos dibujados en el plano. */
export function withManualUndergroundSegments(
  base: UndergroundPlan,
  segments: DesignUndergroundSegment[],
  scale: ScaleCalibration,
): UndergroundPlan {
  if (!segments.length) return base
  const manualRuns = segments.map((seg) =>
    buildManualUndergroundRun(seg, scale, {
      zone: base.zone,
      chamberMaterial: base.chamberMaterial,
    }),
  )
  const autoIds = new Set(base.runs.map((r) => r.id))
  const runs = [
    ...base.runs,
    ...manualRuns.filter((r) => !autoIds.has(r.id)),
  ]
  return finalizeUndergroundPlan(
    base.zone,
    base.terrain,
    base.chamberMaterial,
    runs,
  )
}

export function buildExcavationSpec(
  lengthM: number,
  depthCm: number,
  terrain: TerrainType,
  zone: ZoneType,
): ExcavationSpec {
  const ex = underground.excavation
  const depthM = depthCm / 100
  const widthM = ex.trenchWidthM
  const volumeM3 = Math.round(lengthM * widthM * depthM * 100) / 100
  const usdPerM3 = ex.usdPerM3[terrain]
  const m3PerHour = ex.m3PerHour[terrain]
  const hours = m3PerHour > 0 ? Math.round((volumeM3 / m3PerHour) * 10) / 10 : 0
  return {
    lengthM,
    depthM,
    widthM,
    volumeM3,
    terrain,
    needsShoring: depthCm >= ex.shoringRequiredDepthCm,
    equipment: ex.equipment[terrain],
    hours,
    permits: ex.permits[zone],
    costUsd: Math.round(volumeM3 * usdPerM3 * 100) / 100,
  }
}

export function validateUnderground(plan: UndergroundPlan): ValidationResult[] {
  const results: ValidationResult[] = []
  const maxOcc = underground.maxOccupancy

  if (plan.runs.length === 0) {
    results.push({
      level: 'INFO',
      code: 'UG-000',
      message: 'Sin tramos subterráneos (rutas < 8 m o sin dibujo en plano)',
      solution: 'Dibuja un tramo en Sub o coloca enlaces de cable ≥ 8 m',
    })
    return results
  }

  for (const run of plan.runs) {
    if (run.occupancy > maxOcc + 0.01 && run.cableCount > run.pipe.maxCat6 * maxOcc) {
      // also check absolute maxCat6
    }
    if (run.cableCount > run.pipe.maxCat6) {
      results.push({
        level: 'ERROR',
        code: 'UG-001',
        message: `${run.toLabel}: ${run.cableCount} cables > capacidad ${run.pipe.label}`,
        solution: 'Usar tubería de mayor Ø o dividir el tronco',
        nodeId: run.id,
      })
    }
    if (run.depthCm < minDepthCm(run.zone)) {
      results.push({
        level: 'ERROR',
        code: 'UG-002',
        message: `Profundidad ${run.depthCm} cm insuficiente para zona ${zoneLabel(run.zone)}`,
        solution: `Mínimo ${minDepthCm(run.zone)} cm`,
      })
    }
  }

  if (plan.excavation.needsShoring) {
    results.push({
      level: 'WARNING',
      code: 'UG-003',
      message: `Excavación a ${plan.excavation.depthM} m — requiere apuntalamiento`,
      solution: 'Incluir entibado / cajón en el presupuesto de obra',
    })
  }

  results.push({
    level: 'INFO',
    code: 'UG-OK',
    message: `${plan.runs.length} tramos · ${plan.totalPipeM} m tubería · ${plan.totalChambers} cámaras · ${plan.excavation.volumeM3} m³`,
    solution: 'Revisa permisos y equipos en el panel Subterráneo',
  })

  return results
}

export function buildUndergroundBomLines(plan: UndergroundPlan): BomLine[] {
  const lines: BomLine[] = []
  const byPipe = new Map<string, { pipe: UndergroundPipe; m: number }>()
  for (const run of plan.runs) {
    const prev = byPipe.get(run.pipe.id)
    if (prev) prev.m += run.lengthM
    else byPipe.set(run.pipe.id, { pipe: run.pipe, m: run.lengthM })
  }
  Array.from(byPipe.values()).forEach(({ pipe, m }) => {
    const qty = Math.ceil(m * 10) / 10
    lines.push({
      sku: pipe.id.toUpperCase(),
      category: 'conduit',
      description: `${pipe.label} (subterráneo)`,
      qty,
      unitUsd: pipe.usdPerM,
      totalUsd: Math.round(qty * pipe.usdPerM * 100) / 100,
    })
  })

  const chamberCatalog = underground.chambers as {
    id: string
    label: string
    material: string
    usdEach: number
  }[]
  const mat = plan.chamberMaterial
  const ch =
    chamberCatalog.find((c) => c.material === mat) ?? chamberCatalog[0]!
  if (plan.totalChambers > 0) {
    lines.push({
      sku: ch.id.toUpperCase(),
      category: 'conduit',
      description: `${ch.label} (Ø${underground.minChamberDiameterCm} cm)`,
      qty: plan.totalChambers,
      unitUsd: ch.usdEach,
      totalUsd: plan.totalChambers * ch.usdEach,
    })
  }

  if (plan.excavation.volumeM3 > 0) {
    lines.push({
      sku: 'EXCAV-M3',
      category: 'accessory',
      description: `Excavación ${plan.excavation.terrain} (${plan.excavation.volumeM3} m³)`,
      qty: plan.excavation.volumeM3,
      unitUsd:
        Math.round(
          (plan.excavation.costUsd / Math.max(plan.excavation.volumeM3, 0.01)) *
            100,
        ) / 100,
      totalUsd: plan.excavation.costUsd,
    })
  }

  if (plan.excavation.needsShoring) {
    lines.push({
      sku: 'SHORING',
      category: 'accessory',
      description: 'Apuntalamiento / entibado (estimado)',
      qty: 1,
      unitUsd: 180,
      totalUsd: 180,
    })
  }

  return lines
}

/** Perfil 2D (sección) para vista “subterránea” sin Three.js. */
export function buildCrossSectionSvg(
  depthCm: number,
  pipeInnerMm: number,
  zone: ZoneType,
  width = 420,
  height = 220,
): string {
  const groundY = 36
  const maxDepthPx = height - 56
  const depthPx = Math.min(maxDepthPx, (depthCm / 120) * maxDepthPx)
  const pipeY = groundY + depthPx
  const pipeR = Math.max(6, (pipeInnerMm / 160) * 18)
  const cx = width / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0b1220"/>
  <text x="16" y="20" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif">Perfil subterráneo · ${zoneLabel(zone)} · ${depthCm} cm</text>
  <rect x="40" y="${groundY}" width="${width - 80}" height="${depthPx + 24}" fill="#3f2e1f" opacity="0.55"/>
  <line x1="40" y1="${groundY}" x2="${width - 40}" y2="${groundY}" stroke="#86efac" stroke-width="2"/>
  <text x="48" y="${groundY - 6}" fill="#86efac" font-size="10">nivel terreno</text>
  <circle cx="${cx}" cy="${pipeY}" r="${pipeR}" fill="none" stroke="#38bdf8" stroke-width="3"/>
  <text x="${cx + pipeR + 8}" y="${pipeY + 4}" fill="#7dd3fc" font-size="10">tubería Ø${pipeInnerMm} mm</text>
  <line x1="${cx - 80}" y1="${groundY}" x2="${cx - 80}" y2="${pipeY}" stroke="#fbbf24" stroke-dasharray="4 3"/>
  <text x="${cx - 76}" y="${(groundY + pipeY) / 2}" fill="#fbbf24" font-size="10">${depthCm} cm</text>
</svg>`
}
