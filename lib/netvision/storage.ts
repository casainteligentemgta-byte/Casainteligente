import type {
  DesignCamera,
  DesignNetworkNode,
  DesignStructure,
  DesignUndergroundSegment,
  NetVisionCurrency,
  NetVisionProject,
  NetVisionProjectIndexEntry,
  NetworkNodeKind,
  ScaleCalibration,
  StructureMaterialId,
  UnitSystem,
} from '@/lib/netvision/types'
import { defaultScale } from '@/lib/netvision/services/coverageCalculator'
import { DEFAULT_CAMERA_MODEL_ID } from '@/lib/netvision/catalog/cameras'
import { DEFAULT_STRUCTURE_MATERIAL_ID } from '@/lib/netvision/catalog/materials'
import { defaultModelIdForKind } from '@/lib/netvision/catalog/network'

/** Copia activa de trabajo (rápida). */
export const NETVISION_STORAGE_KEY = 'nexus.netvision.v1'
/** Biblioteca multi-proyecto en localStorage. */
export const NETVISION_LIBRARY_KEY = 'nexus.netvision.library.v1'
export const NETVISION_ACTIVE_ID_KEY = 'nexus.netvision.activeId.v1'

const LEGACY_V2 = 'nexus.vision.architect.v2'
const LEGACY_V1 = 'nexus.vision.architect.v1'

type LibraryStore = {
  version: 1
  projects: Record<string, NetVisionProject>
}

function nowIso(): string {
  return new Date().toISOString()
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function emptyProject(partial?: {
  name?: string
  id?: string
}): NetVisionProject {
  const id = partial?.id ?? newId()
  return {
    version: 2,
    id,
    name: partial?.name?.trim() || 'Proyecto sin nombre',
    description: '',
    client: '',
    updatedAt: nowIso(),
    unitSystem: 'metric',
    currency: 'USD',
    distributorMarginPct: 15,
    planoUrl: null,
    planoNombre: '',
    cameras: [],
    networkNodes: [],
    structures: [],
    undergroundSegments: [],
    cableRouteOverrides: {},
    scale: defaultScale(),
    retentionDays: 30,
    complianceProfileId: 'VE',
  }
}

function readLibrary(): LibraryStore {
  try {
    const raw = localStorage.getItem(NETVISION_LIBRARY_KEY)
    if (!raw) return { version: 1, projects: {} }
    const parsed = JSON.parse(raw) as Partial<LibraryStore>
    const projects: Record<string, NetVisionProject> = {}
    if (parsed.projects && typeof parsed.projects === 'object') {
      for (const [id, p] of Object.entries(parsed.projects)) {
        projects[id] = normalizeProject(p as Partial<NetVisionProject>, id)
      }
    }
    return { version: 1, projects }
  } catch {
    return { version: 1, projects: {} }
  }
}

function writeLibrary(store: LibraryStore) {
  try {
    localStorage.setItem(NETVISION_LIBRARY_KEY, JSON.stringify(store))
  } catch {
    try {
      const slimProjects: Record<string, NetVisionProject> = {}
      for (const [id, p] of Object.entries(store.projects)) {
        slimProjects[id] = { ...p, planoUrl: null }
      }
      localStorage.setItem(
        NETVISION_LIBRARY_KEY,
        JSON.stringify({ version: 1, projects: slimProjects }),
      )
    } catch {
      /* ignore quota */
    }
  }
}

function getActiveId(): string | null {
  try {
    return localStorage.getItem(NETVISION_ACTIVE_ID_KEY)
  } catch {
    return null
  }
}

function setActiveId(id: string) {
  try {
    localStorage.setItem(NETVISION_ACTIVE_ID_KEY, id)
  } catch {
    /* ignore */
  }
}

/** Límite aprox. para subir plano (data URL) a Supabase. */
export const NETVISION_CLOUD_MAX_PLANO_CHARS = 450_000

export function listProjectIndex(): NetVisionProjectIndexEntry[] {
  const { projects } = readLibrary()
  return Object.values(projects)
    .map((p) => ({
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      planoNombre: p.planoNombre,
      cameraCount: p.cameras.length,
      networkCount: p.networkNodes.length,
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function listLocalProjects(): NetVisionProject[] {
  return Object.values(readLibrary().projects).sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1,
  )
}

/** Copia lista para nube: omite plano si es demasiado grande. */
export function projectForCloud(project: NetVisionProject): NetVisionProject {
  const normalized = normalizeProject(project)
  const plano = normalized.planoUrl
  if (plano && plano.length > NETVISION_CLOUD_MAX_PLANO_CHARS) {
    return { ...normalized, planoUrl: null }
  }
  return normalized
}

/** Inserta o actualiza en biblioteca local (p. ej. al bajar de la nube). */
export function upsertLocalProject(project: NetVisionProject): NetVisionProject {
  const next = normalizeProject(project)
  const lib = readLibrary()
  const prev = lib.projects[next.id]
  if (prev?.planoUrl && !next.planoUrl) {
    // Conserva plano local si la nube no trae imagen
    next.planoUrl = prev.planoUrl
  }
  lib.projects[next.id] = next
  writeLibrary(lib)
  return next
}

export function projectFromPartial(
  p: Partial<NetVisionProject>,
  fallbackId?: string,
): NetVisionProject {
  return normalizeProject(p, fallbackId)
}

export function createProject(name?: string): NetVisionProject {
  const project = emptyProject({ name })
  const lib = readLibrary()
  lib.projects[project.id] = project
  writeLibrary(lib)
  setActiveId(project.id)
  persistWorkingCopy(project)
  return project
}

export function openProject(id: string): NetVisionProject | null {
  const lib = readLibrary()
  const p = lib.projects[id]
  if (!p) return null
  setActiveId(id)
  persistWorkingCopy(p)
  return p
}

export function deleteProject(id: string): NetVisionProject {
  const lib = readLibrary()
  delete lib.projects[id]
  writeLibrary(lib)
  const active = getActiveId()
  if (active === id) {
    const next = Object.values(lib.projects).sort((a, b) =>
      a.updatedAt < b.updatedAt ? 1 : -1,
    )[0]
    if (next) {
      setActiveId(next.id)
      persistWorkingCopy(next)
      return next
    }
    const fresh = emptyProject()
    lib.projects[fresh.id] = fresh
    writeLibrary(lib)
    setActiveId(fresh.id)
    persistWorkingCopy(fresh)
    return fresh
  }
  return loadProject()
}

export function renameProject(id: string, name: string): void {
  const lib = readLibrary()
  const p = lib.projects[id]
  if (!p) return
  p.name = name.trim() || p.name
  p.updatedAt = nowIso()
  writeLibrary(lib)
  if (getActiveId() === id) persistWorkingCopy(p)
}

function persistWorkingCopy(project: NetVisionProject) {
  try {
    sessionStorage.setItem(NETVISION_STORAGE_KEY, JSON.stringify(project))
  } catch {
    try {
      sessionStorage.setItem(
        NETVISION_STORAGE_KEY,
        JSON.stringify({ ...project, planoUrl: null }),
      )
    } catch {
      /* ignore */
    }
  }
}

/** Carga el proyecto activo (migra legacy / crea uno si no hay). */
export function loadProject(): NetVisionProject {
  try {
    const raw = sessionStorage.getItem(NETVISION_STORAGE_KEY)
    if (raw) {
      const parsed = normalizeProject(JSON.parse(raw) as Partial<NetVisionProject>)
      ensureInLibrary(parsed)
      setActiveId(parsed.id)
      return parsed
    }
  } catch {
    /* ignore */
  }

  const activeId = getActiveId()
  const lib = readLibrary()
  if (activeId && lib.projects[activeId]) {
    const p = lib.projects[activeId]!
    persistWorkingCopy(p)
    return p
  }

  try {
    const legacy =
      sessionStorage.getItem(LEGACY_V2) ?? sessionStorage.getItem(LEGACY_V1)
    if (legacy) {
      const migrated = migrateLegacy(JSON.parse(legacy))
      ensureInLibrary(migrated)
      setActiveId(migrated.id)
      persistWorkingCopy(migrated)
      return migrated
    }
  } catch {
    /* ignore */
  }

  const first = Object.values(lib.projects)[0]
  if (first) {
    setActiveId(first.id)
    persistWorkingCopy(first)
    return first
  }

  return createProject('Mi primer proyecto')
}

export function saveProject(project: NetVisionProject) {
  const next: NetVisionProject = {
    ...normalizeProject(project),
    updatedAt: nowIso(),
  }
  persistWorkingCopy(next)
  const lib = readLibrary()
  lib.projects[next.id] = next
  writeLibrary(lib)
  setActiveId(next.id)
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

/** Reinicia el diseño del proyecto activo (mantiene id, nombre y prefs). */
export function resetActiveDesign(current: NetVisionProject): NetVisionProject {
  const next: NetVisionProject = {
    ...emptyProject({ id: current.id, name: current.name }),
    description: current.description ?? '',
    client: current.client ?? '',
    unitSystem: current.unitSystem,
    currency: current.currency,
    distributorMarginPct: current.distributorMarginPct,
    complianceProfileId: current.complianceProfileId,
    retentionDays: current.retentionDays,
    updatedAt: nowIso(),
  }
  saveProject(next)
  return next
}

function ensureInLibrary(project: NetVisionProject) {
  const lib = readLibrary()
  if (!lib.projects[project.id]) {
    lib.projects[project.id] = project
    writeLibrary(lib)
  }
}

function normalizeProject(
  p: Partial<NetVisionProject>,
  fallbackId?: string,
): NetVisionProject {
  const base = emptyProject({
    id: typeof p.id === 'string' && p.id ? p.id : fallbackId,
    name: typeof p.name === 'string' ? p.name : undefined,
  })
  const scale: ScaleCalibration = {
    ...base.scale,
    ...(p.scale ?? {}),
  }
  const unitSystem = normalizeUnitSystem(p.unitSystem)
  const currency = normalizeCurrency(p.currency)
  const margin =
    typeof p.distributorMarginPct === 'number' && Number.isFinite(p.distributorMarginPct)
      ? Math.min(100, Math.max(0, p.distributorMarginPct))
      : 15

  const nameFromPlano =
    !p.name && p.planoNombre ? String(p.planoNombre).replace(/\.[^.]+$/, '') : null

  return {
    version: 2,
    id: typeof p.id === 'string' && p.id ? p.id : base.id,
    name: (typeof p.name === 'string' && p.name.trim()
      ? p.name.trim()
      : nameFromPlano || base.name
    ).slice(0, 120),
    description: typeof p.description === 'string' ? p.description : '',
    client: typeof p.client === 'string' ? p.client : '',
    updatedAt:
      typeof p.updatedAt === 'string' && p.updatedAt ? p.updatedAt : nowIso(),
    unitSystem,
    currency,
    distributorMarginPct: margin,
    planoUrl: p.planoUrl ?? null,
    planoNombre: p.planoNombre ?? '',
    cameras: Array.isArray(p.cameras) ? p.cameras.map(normalizeCamera) : [],
    networkNodes: Array.isArray(p.networkNodes)
      ? p.networkNodes.map(normalizeNetworkNode)
      : [],
    structures: Array.isArray(p.structures)
      ? p.structures.map(normalizeStructure)
      : [],
    undergroundSegments: Array.isArray(p.undergroundSegments)
      ? p.undergroundSegments.map(normalizeUndergroundSegment)
      : [],
    cableRouteOverrides: normalizeCableRouteOverrides(p.cableRouteOverrides),
    scale,
    retentionDays: typeof p.retentionDays === 'number' ? p.retentionDays : 30,
    complianceProfileId: p.complianceProfileId ?? 'VE',
  }
}

function normalizeUnitSystem(v: unknown): UnitSystem {
  if (v === 'imperial' || v === 'mixed' || v === 'metric') return v
  return 'metric'
}

function normalizeCurrency(v: unknown): NetVisionCurrency {
  if (v === 'VES' || v === 'EUR' || v === 'USD') return v
  return 'USD'
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

function normalizeUndergroundSegment(
  s: Partial<DesignUndergroundSegment>,
): DesignUndergroundSegment {
  return {
    id: s.id ?? `${Date.now()}`,
    label: s.label ?? 'SUB-01',
    x1: typeof s.x1 === 'number' ? s.x1 : 0.3,
    y1: typeof s.y1 === 'number' ? s.y1 : 0.3,
    x2: typeof s.x2 === 'number' ? s.x2 : 0.7,
    y2: typeof s.y2 === 'number' ? s.y2 : 0.3,
  }
}

function normalizeCableRouteOverrides(
  raw: unknown,
): Record<string, { x: number; y: number }[]> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, { x: number; y: number }[]> = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== 'string' || !key.includes('__')) continue
    if (!Array.isArray(val)) continue
    const mids = val
      .filter(
        (p): p is { x: number; y: number } =>
          !!p &&
          typeof p === 'object' &&
          typeof (p as { x?: unknown }).x === 'number' &&
          typeof (p as { y?: unknown }).y === 'number',
      )
      .map((p) => ({
        x: Math.min(1, Math.max(0, Math.round(p.x * 1000) / 1000)),
        y: Math.min(1, Math.max(0, Math.round(p.y * 1000) / 1000)),
      }))
    if (mids.length) out[key] = mids
  }
  return out
}

function migrateLegacy(parsed: {
  planoUrl?: string
  planoNombre?: string
  camaras?: Array<{ id: string; x: number; y: number; label: string }>
}): NetVisionProject {
  const base = emptyProject({
    name: parsed.planoNombre
      ? String(parsed.planoNombre).replace(/\.[^.]+$/, '')
      : 'Proyecto migrado',
  })
  base.planoUrl = parsed.planoUrl ?? null
  base.planoNombre = parsed.planoNombre ?? ''
  base.cameras = (parsed.camaras ?? []).map((c) => normalizeCamera(c))
  return base
}
