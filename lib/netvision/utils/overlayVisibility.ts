/** Qué se ve en el mismo PDF: un sistema, un escenario CCTV, o todo. */

import type {
  DesignCamera,
  DesignInfraDevice,
  DesignNetworkNode,
  DesignPlanDevice,
  PlanDiscipline,
} from '@/lib/netvision/types'
import {
  ALL_SCENARIOS_ID,
  cameraScenarioId,
} from '@/lib/netvision/utils/cameraScenarios'

export type OverlayVista = 'solo' | 'todas'

export type OverlaySystem =
  | 'cctv'
  | 'sonido'
  | 'internet'
  | 'domotica'
  | 'alarma'
  | 'electrico'
  | 'tool'

export const OVERLAY_PLAN_SYSTEMS = [
  'cctv',
  'sonido',
  'internet',
  'domotica',
  'alarma',
  'electrico',
] as const

export type OverlayPlanSystem = (typeof OVERLAY_PLAN_SYSTEMS)[number]

export const OVERLAY_SYSTEM_LABEL: Record<OverlayPlanSystem, string> = {
  cctv: 'CCTV',
  sonido: 'Sonido',
  internet: 'Internet',
  domotica: 'Domótica',
  alarma: 'Alarma',
  electrico: 'Eléctrico',
}

export function overlaySystemFromBranch(id: string): OverlaySystem {
  if (
    id === 'cctv' ||
    id === 'sonido' ||
    id === 'internet' ||
    id === 'domotica' ||
    id === 'alarma' ||
    id === 'electrico'
  ) {
    return id
  }
  return 'tool'
}

export function isPlanDisciplineBranch(id: string): id is PlanDiscipline {
  return (
    id === 'sonido' ||
    id === 'domotica' ||
    id === 'alarma' ||
    id === 'electrico'
  )
}

export function visibleCameras(
  cameras: readonly DesignCamera[],
  opts: {
    vista: OverlayVista
    system: OverlaySystem
    scenarioId: string
  },
): DesignCamera[] {
  if (opts.vista === 'todas' || opts.system === 'tool') return [...cameras]
  if (opts.system !== 'cctv') return []
  if (opts.scenarioId === ALL_SCENARIOS_ID) return [...cameras]
  return cameras.filter((c) => cameraScenarioId(c) === opts.scenarioId)
}

export function visiblePlanDevices(
  devices: readonly DesignPlanDevice[],
  opts: { vista: OverlayVista; system: OverlaySystem },
): DesignPlanDevice[] {
  if (opts.vista === 'todas' || opts.system === 'tool') return [...devices]
  if (
    opts.system === 'sonido' ||
    opts.system === 'domotica' ||
    opts.system === 'alarma' ||
    opts.system === 'electrico'
  ) {
    return devices.filter((d) => d.discipline === opts.system)
  }
  return []
}

export function visibleNetworkNodes(
  nodes: readonly DesignNetworkNode[],
  opts: { vista: OverlayVista; system: OverlaySystem },
): DesignNetworkNode[] {
  if (
    opts.vista === 'todas' ||
    opts.system === 'tool' ||
    opts.system === 'internet'
  ) {
    return [...nodes]
  }
  return []
}

export function visibleInfraDevices(
  devices: readonly DesignInfraDevice[],
  opts: { vista: OverlayVista; system: OverlaySystem },
): DesignInfraDevice[] {
  if (opts.vista === 'todas' || opts.system === 'tool' || opts.system === 'cctv') {
    return [...devices]
  }
  return []
}

export function showOverlayWifi(opts: {
  vista: OverlayVista
  system: OverlaySystem
}): boolean {
  return (
    opts.vista === 'todas' ||
    opts.system === 'internet' ||
    opts.system === 'tool'
  )
}

export function showOverlaySound(opts: {
  vista: OverlayVista
  system: OverlaySystem
}): boolean {
  return (
    opts.vista === 'todas' ||
    opts.system === 'sonido' ||
    opts.system === 'tool'
  )
}
