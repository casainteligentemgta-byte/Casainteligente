import { getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
import { getNetworkModelOrDefault } from '@/lib/netvision/catalog/network'
import type {
  DesignCamera,
  DesignNetworkNode,
  ScaleCalibration,
  ValidationResult,
} from '@/lib/netvision/types'
import { distMeters } from '@/lib/netvision/utils/geometryHelpers'
import { recommendCableType } from '@/lib/netvision/services/cableCalculator'

export type PoeBudgetRow = {
  nodeId: string
  label: string
  kind: DesignNetworkNode['kind']
  budgetW: number
  usedW: number
  ports: number
  usedPorts: number
  ok: boolean
}

export type CameraLinkAdvice = {
  cameraId: string
  cameraLabel: string
  nearestNodeId: string | null
  nearestLabel: string | null
  distanceM: number
  cableType: ReturnType<typeof recommendCableType>
  cameraWatts: number
  needsInjector: boolean
}

function poeCapable(nodes: DesignNetworkNode[]): DesignNetworkNode[] {
  return nodes.filter((n) => {
    const m = getNetworkModelOrDefault(n.modelId, n.kind)
    return m.poeBudgetW > 0 && m.poePorts > 0
  })
}

/** Asigna cada cámara al nodo PoE más cercano (switch/NVR/injector). */
export function autoAssignCamerasToPoe(
  cameras: DesignCamera[],
  nodes: DesignNetworkNode[],
  scale: ScaleCalibration,
): DesignNetworkNode[] {
  const capable = poeCapable(nodes)
  if (capable.length === 0) {
    return nodes.map((n) => ({ ...n, linkedCameraIds: [] }))
  }

  const assignment = new Map<string, string[]>()
  for (const n of capable) assignment.set(n.id, [])

  for (const cam of cameras) {
    let best: DesignNetworkNode | null = null
    let bestD = Infinity
    for (const n of capable) {
      const d = distMeters(
        cam.x,
        cam.y,
        n.x,
        n.y,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      if (d < bestD) {
        bestD = d
        best = n
      }
    }
    if (best) assignment.get(best.id)!.push(cam.id)
  }

  return nodes.map((n) => ({
    ...n,
    linkedCameraIds: assignment.get(n.id) ?? [],
  }))
}

export function analyzePoeBudget(
  cameras: DesignCamera[],
  nodes: DesignNetworkNode[],
): { rows: PoeBudgetRow[]; validations: ValidationResult[] } {
  const camById = new Map(cameras.map((c) => [c.id, c]))
  const rows: PoeBudgetRow[] = []
  const validations: ValidationResult[] = []

  const capable = poeCapable(nodes)
  const totalCamW = cameras.reduce(
    (s, c) => s + getCameraModelOrDefault(c.modelId).poeWatts,
    0,
  )
  const totalBudget = capable.reduce(
    (s, n) => s + getNetworkModelOrDefault(n.modelId, n.kind).poeBudgetW,
    0,
  )

  if (cameras.length > 0 && capable.length === 0) {
    validations.push({
      level: 'ERROR',
      code: 'POE-000',
      message: 'Hay cámaras pero no hay switch/NVR/injector PoE en el plano',
      solution: 'Coloca un switch PoE o NVR con puertos PoE (modo Red)',
    })
  } else if (totalCamW > totalBudget + 0.01) {
    validations.push({
      level: 'ERROR',
      code: 'POE-001',
      message: `Demanda PoE ${totalCamW.toFixed(1)} W supera presupuesto ${totalBudget.toFixed(1)} W`,
      solution: 'Agrega switch PoE, upgrade de modelo o injectors',
    })
  }

  for (const n of capable) {
    const m = getNetworkModelOrDefault(n.modelId, n.kind)
    let usedW = 0
    for (const cid of n.linkedCameraIds) {
      const cam = camById.get(cid)
      if (cam) usedW += getCameraModelOrDefault(cam.modelId).poeWatts
    }
    // APs alimentados desde este switch no están en linkedCameraIds; se estima aparte en BOM
    const usedPorts = n.linkedCameraIds.length
    const ok = usedW <= m.poeBudgetW && usedPorts <= m.poePorts
    rows.push({
      nodeId: n.id,
      label: n.label,
      kind: n.kind,
      budgetW: m.poeBudgetW,
      usedW,
      ports: m.poePorts,
      usedPorts,
      ok,
    })
    if (usedW > m.poeBudgetW) {
      validations.push({
        level: 'ERROR',
        code: 'POE-002',
        message: `${n.label}: ${usedW.toFixed(1)} W > presupuesto ${m.poeBudgetW} W`,
        solution: 'Reasigna cámaras o usa un switch con más PoE budget',
        nodeId: n.id,
      })
    }
    if (usedPorts > m.poePorts) {
      validations.push({
        level: 'ERROR',
        code: 'POE-003',
        message: `${n.label}: ${usedPorts} cámaras > ${m.poePorts} puertos PoE`,
        solution: 'Agrega otro switch o reduce cámaras en este nodo',
        nodeId: n.id,
      })
    }
  }

  return { rows, validations }
}

export function adviseCameraLinks(
  cameras: DesignCamera[],
  nodes: DesignNetworkNode[],
  scale: ScaleCalibration,
): CameraLinkAdvice[] {
  const capable = poeCapable(nodes)
  return cameras.map((cam) => {
    let nearest: DesignNetworkNode | null = null
    let bestD = Infinity
    for (const n of capable) {
      const d = distMeters(
        cam.x,
        cam.y,
        n.x,
        n.y,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      if (d < bestD) {
        bestD = d
        nearest = n
      }
    }
    const watts = getCameraModelOrDefault(cam.modelId).poeWatts
    const cableType = nearest ? recommendCableType(bestD) : 'CAT6'
    return {
      cameraId: cam.id,
      cameraLabel: cam.label,
      nearestNodeId: nearest?.id ?? null,
      nearestLabel: nearest?.label ?? null,
      distanceM: nearest ? Math.round(bestD * 10) / 10 : 0,
      cableType,
      cameraWatts: watts,
      needsInjector: !nearest || bestD > 100,
    }
  })
}
