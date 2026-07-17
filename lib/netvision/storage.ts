import type { DesignCamera, NetVisionProject, ScaleCalibration } from '@/lib/netvision/types'
import { defaultScale } from '@/lib/netvision/services/coverageCalculator'
import { DEFAULT_CAMERA_MODEL_ID } from '@/lib/netvision/catalog/cameras'

export const NETVISION_STORAGE_KEY = 'nexus.netvision.v1'
const LEGACY_V2 = 'nexus.vision.architect.v2'
const LEGACY_V1 = 'nexus.vision.architect.v1'

export function emptyProject(): NetVisionProject {
  return {
    version: 1,
    planoUrl: null,
    planoNombre: '',
    cameras: [],
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
    // Evitar volcar planos enormes si fallan: intentar completo, si falla sin dataURL
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
    scale,
    retentionDays: typeof p.retentionDays === 'number' ? p.retentionDays : 30,
    complianceProfileId: p.complianceProfileId ?? 'VE',
  }
}

function normalizeCamera(c: Partial<DesignCamera> & { label?: string }): DesignCamera {
  const looksPercent = (c.x ?? 0) > 1 || (c.y ?? 0) > 1
  return {
    id: c.id ?? `${Date.now()}`,
    label: c.label ?? 'CAM',
    x: looksPercent ? (c.x ?? 0) / 100 : (c.x ?? 0),
    y: looksPercent ? (c.y ?? 0) / 100 : (c.y ?? 0),
    modelId: c.modelId ?? DEFAULT_CAMERA_MODEL_ID,
    yawDeg: typeof c.yawDeg === 'number' ? c.yawDeg : 0,
    mountHeightM: typeof c.mountHeightM === 'number' ? c.mountHeightM : 2.8,
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
