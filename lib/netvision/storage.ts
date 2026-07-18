import type {
  DesignCamera,
  DesignNetworkNode,
  DesignStructure,
  NetVisionProject,
  NetworkNodeKind,
  ScaleCalibration,
  StructureMaterialId,
} from '@/lib/netvision/types'
import { defaultScale } from '@/lib/netvision/services/coverageCalculator'
import { DEFAULT_CAMERA_MODEL_ID } from '@/lib/netvision/catalog/cameras'
import { DEFAULT_STRUCTURE_MATERIAL_ID } from '@/lib/netvision/catalog/materials'
import { defaultModelIdForKind } from '@/lib/netvision/catalog/network'

export const NETVISION_STORAGE_KEY = 'nexus.netvision.v1'
const LEGACY_V2 = 'nexus.vision.architect.v2'
const LEGACY_V1 = 'nexus.vision.architect.v1'

export function emptyProject(): NetVisionProject {
  return {
    version: 1,
    planoUrl: null,
    planoNombre: '',
    cameras: [],
    networkNodes: [],
    structures: [],
    scale: defaultScale(),
    retentionDays: 30,
    complianceProfileId: 'VE',
  }
}

export function loadProject(): NetVisionProject {
  try {
    const raw = sessionStorage.getItem(NETVISION_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NetVisionProject>
      return normalizeProject(parsed)
    }
    const legacy =
      sessionStorage.getItem(LEGACY_V2) ?? sessionStorage.getItem(LEGACY_V1)
    if (legacy) return migrateLegacy(JSON.parse(legacy))
  } catch {
    /* ignore */
  }
  return emptyProject()
}

export function saveProject(project: NetVisionProject) {
  try {
    sessionStorage.setItem(NETVISION_STORAGE_KEY, JSON.stringify(project))
  } catch {
    try {
      const slim = { ...project, planoUrl: null }
      sessionStorage.setItem(NETVISION_STORAGE_KEY, JSON.stringify(slim))
    } catch {
      /* ignore quota */
    }
  }
}

export function clearProjectStorage() {
  try {
    sessionStorage.removeItem(NETVISION_STORAGE_KEY)
    sessionStorage.removeItem(LEGACY_V2)
    sessionStorage.removeItem(LEGACY_V1)
  } catch {
    /* ignore */
  }
}

function normalizeProject(p: Partial<NetVisionProject>): NetVisionProject {
  const base = emptyProject()
  const scale: ScaleCalibration = {
    ...base.scale,
    ...(p.scale ?? {}),
  }
  return {
    version: 1,
    planoUrl: p.planoUrl ?? null,
    planoNombre: p.planoNombre ?? '',
    cameras: Array.isArray(p.cameras) ? p.cameras.map(normalizeCamera) : [],
    networkNodes: Array.isArray(p.networkNodes)
      ? p.networkNodes.map(normalizeNetworkNode)
      : [],
    structures: Array.isArray(p.structures)
      ? p.structures.map(normalizeStructure)
      : [],
    scale,
    retentionDays: typeof p.retentionDays === 'number' ? p.retentionDays : 30,
    complianceProfileId: p.complianceProfileId ?? 'VE',
  }
}

function normalizeCamera(c: Partial<DesignCamera> & { label?: string }): DesignCamera {
  const looksPercent = (c.x ?? 0) > 1 || (c.y ?? 0) > 1
  const fovDeg =
    typeof c.fovDeg === 'number' && Number.isFinite(c.fovDeg)
      ? Math.min(170, Math.max(20, c.fovDeg))
      : undefined
  const rangeM =
    typeof c.rangeM === 'number' && Number.isFinite(c.rangeM)
      ? Math.min(120, Math.max(2, c.rangeM))
      : undefined
  return {
    id: c.id ?? `${Date.now()}`,
    label: c.label ?? 'CAM',
    x: looksPercent ? (c.x ?? 0) / 100 : (c.x ?? 0),
    y: looksPercent ? (c.y ?? 0) / 100 : (c.y ?? 0),
    modelId: c.modelId ?? DEFAULT_CAMERA_MODEL_ID,
    yawDeg: typeof c.yawDeg === 'number' ? c.yawDeg : 0,
    mountHeightM: typeof c.mountHeightM === 'number' ? c.mountHeightM : 2.8,
    ...(fovDeg != null ? { fovDeg } : {}),
    ...(rangeM != null ? { rangeM } : {}),
  }
}

function normalizeNetworkNode(
  n: Partial<DesignNetworkNode>,
): DesignNetworkNode {
  const kind = (n.kind ?? 'switch') as NetworkNodeKind
  const looksPercent = (n.x ?? 0) > 1 || (n.y ?? 0) > 1
  return {
    id: n.id ?? `${Date.now()}`,
    label: n.label ?? 'SW-01',
    kind,
    modelId: n.modelId ?? defaultModelIdForKind(kind),
    x: looksPercent ? (n.x ?? 0) / 100 : (n.x ?? 0),
    y: looksPercent ? (n.y ?? 0) / 100 : (n.y ?? 0),
    wifiChannel: typeof n.wifiChannel === 'number' ? n.wifiChannel : undefined,
    linkedCameraIds: Array.isArray(n.linkedCameraIds) ? n.linkedCameraIds : [],
  }
}

function normalizeStructure(s: Partial<DesignStructure>): DesignStructure {
  const materialId = (s.materialId ??
    DEFAULT_STRUCTURE_MATERIAL_ID) as StructureMaterialId
  return {
    id: s.id ?? `${Date.now()}`,
    label: s.label ?? 'MUR-01',
    materialId,
    x1: typeof s.x1 === 'number' ? s.x1 : 0.3,
    y1: typeof s.y1 === 'number' ? s.y1 : 0.3,
    x2: typeof s.x2 === 'number' ? s.x2 : 0.7,
    y2: typeof s.y2 === 'number' ? s.y2 : 0.3,
  }
}

function migrateLegacy(parsed: {
  planoUrl?: string
  planoNombre?: string
  camaras?: Array<{ id: string; x: number; y: number; label: string }>
}): NetVisionProject {
  const base = emptyProject()
  base.planoUrl = parsed.planoUrl ?? null
  base.planoNombre = parsed.planoNombre ?? ''
  base.cameras = (parsed.camaras ?? []).map((c) => normalizeCamera(c))
  return base
}
