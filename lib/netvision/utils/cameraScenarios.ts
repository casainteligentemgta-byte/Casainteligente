/** Escenarios CCTV en el mismo plano PDF. */

import type { CameraScenario, DesignCamera } from '@/lib/netvision/types'

export const PRINCIPAL_SCENARIO_ID = 'principal'
export const ALL_SCENARIOS_ID = '*'

export const DEFAULT_CAMERA_SCENARIOS: CameraScenario[] = [
  { id: PRINCIPAL_SCENARIO_ID, name: 'Principal' },
]

export function cameraScenarioId(cam: { scenarioId?: string }): string {
  const id = cam.scenarioId?.trim()
  return id && id !== ALL_SCENARIOS_ID ? id : PRINCIPAL_SCENARIO_ID
}

function slugEscenario(name: string, used: Set<string>): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'escenario'
  let id = base
  let n = 2
  while (used.has(id) || id === ALL_SCENARIOS_ID) {
    id = `${base}-${n}`
    n += 1
  }
  return id
}

function nombreEscenario(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return s.slice(0, 40) || fallback
}

/** Siempre incluye Principal y recoge ids que ya usan las cámaras. */
export function ensureCameraScenarios(
  raw: unknown,
  cameras: readonly { scenarioId?: string }[] = [],
): CameraScenario[] {
  const byId = new Map<string, CameraScenario>()
  byId.set(PRINCIPAL_SCENARIO_ID, { ...DEFAULT_CAMERA_SCENARIOS[0]! })
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const row = item as { id?: unknown; name?: unknown }
      const id =
        typeof row.id === 'string' ? row.id.trim().slice(0, 40) : ''
      if (!id || id === ALL_SCENARIOS_ID) continue
      const name = nombreEscenario(
        row.name,
        id === PRINCIPAL_SCENARIO_ID ? 'Principal' : id,
      )
      byId.set(id, { id, name })
    }
  }
  for (const cam of cameras) {
    const id = cameraScenarioId(cam)
    if (byId.has(id)) continue
    byId.set(id, { id, name: nombreEscenario(id, 'Escenario') })
  }
  const ordered: CameraScenario[] = [byId.get(PRINCIPAL_SCENARIO_ID)!]
  for (const row of byId.values()) {
    if (row.id === PRINCIPAL_SCENARIO_ID) continue
    ordered.push(row)
  }
  return ordered
}

export function siguienteNombreEscenario(
  scenarios: readonly CameraScenario[],
): string {
  let n = scenarios.length + 1
  const names = new Set(scenarios.map((s) => s.name.toLowerCase()))
  while (names.has(`escenario ${n}`)) n += 1
  return `Escenario ${n}`
}

export function addCameraScenario(
  scenarios: readonly CameraScenario[],
  name?: string,
): { scenarios: CameraScenario[]; added: CameraScenario } {
  const current = ensureCameraScenarios(scenarios)
  const used = new Set(current.map((s) => s.id))
  const label = nombreEscenario(name, siguienteNombreEscenario(current))
  const added: CameraScenario = { id: slugEscenario(label, used), name: label }
  return { scenarios: [...current, added], added }
}

/** Quita un escenario (nunca Principal) y pasa sus cámaras a Principal. */
export function removeCameraScenario(
  scenarios: readonly CameraScenario[],
  cameras: readonly DesignCamera[],
  id: string,
): { scenarios: CameraScenario[]; cameras: DesignCamera[] } {
  const current = ensureCameraScenarios(scenarios, cameras)
  if (id === PRINCIPAL_SCENARIO_ID) {
    return { scenarios: current, cameras: [...cameras] }
  }
  return {
    scenarios: current.filter((s) => s.id !== id),
    cameras: cameras.map((c) =>
      cameraScenarioId(c) === id
        ? (() => {
            const next = { ...c }
            delete next.scenarioId
            return next
          })()
        : c,
    ),
  }
}

export function renameCameraScenario(
  scenarios: readonly CameraScenario[],
  id: string,
  name: string,
): CameraScenario[] {
  const label = nombreEscenario(name, '')
  if (!label) return ensureCameraScenarios(scenarios)
  return ensureCameraScenarios(scenarios).map((s) =>
    s.id === id ? { ...s, name: label } : s,
  )
}

export function camerasOfScenario(
  cameras: readonly DesignCamera[],
  scenarioId: string,
): DesignCamera[] {
  if (scenarioId === ALL_SCENARIOS_ID) return [...cameras]
  return cameras.filter((c) => cameraScenarioId(c) === scenarioId)
}
