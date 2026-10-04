import type {
  CableType,
  DesignCableSegment,
  DesignCamera,
  DesignNetworkNode,
  DesignPlanDevice,
  DesignStructure,
  DesignUndergroundSegment,
  PlanDeviceKind,
  PlanDiscipline,
  NetVisionCurrency,
  NetVisionProject,
  NetVisionProjectIndexEntry,
  NetworkNodeKind,
  ScaleCalibration,
  StructureMaterialId,
  UnitSystem,
} from '@/lib/netvision/types'
import { DRAWABLE_CABLE_TYPES } from '@/lib/netvision/services/cableCalculator'
import { defaultScale } from '@/lib/netvision/services/coverageCalculator'
import { DEFAULT_CAMERA_MODEL_ID } from '@/lib/netvision/catalog/cameras'
import {
  clampMountHeightM,
  clampTiltDeg,
  DEFAULT_MOUNT_HEIGHT_M,
  DEFAULT_TILT_DEG,
} from '@/lib/netvision/utils/cameraMount'
import { DEFAULT_STRUCTURE_MATERIAL_ID } from '@/lib/netvision/catalog/materials'
import { defaultModelIdForKind } from '@/lib/netvision/catalog/network'
import {
  defaultPlanDeviceId,
  getPlanDeviceModelOrDefault,
} from '@/lib/netvision/catalog/planDevices'
import {
  clampNetworkPlanSize,
  defaultNetworkPlanSize,
} from '@/lib/netvision/utils/networkNodeSize'
import {
  clampGrosorMuro,
  normalizeCotaColor,
} from '@/lib/netvision/utils/nightPlanoPalette'
import { clampLabelOffset } from '@/lib/netvision/utils/cameraLabelOffset'

/** Copia activa de trabajo (rápida). */
export const NETVISION_STORAGE_KEY = 'nexus.netvision.v1'
/** Biblioteca multi-proyecto en localStorage. */
export const NETVISION_LIBRARY_KEY = 'nexus.netvision.library.v1'
export const NETVISION_ACTIVE_ID_KEY = 'nexus.netvision.activeId.v1'
/** Plano (data URL) aparte para no tumbar la biblioteca si el CAD es grande. */
export const NETVISION_PLANO_KEY_PREFIX = 'nexus.netvision.plano.'

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
    planoInvertido: false,
    planoCotaColor: 'auto',
    planoGrosorMuro: 50,
    cameras: [],
    networkNodes: [],
    planDevices: [],
    structures: [],
    undergroundSegments: [],
    cableSegments: [],
    cableRouteOverrides: {},
    scale: defaultScale(),
    retentionDays: 30,
    complianceProfileId: 'VE',
  }
}

function planoStorageKey(id: string): string {
  return `${NETVISION_PLANO_KEY_PREFIX}${id}`
}

function readStoredPlano(id: string): string | null {
  try {
    const raw = localStorage.getItem(planoStorageKey(id))
    return raw && raw.length > 8 ? raw : null
  } catch {
    return null
  }
}

function writeStoredPlano(id: string, planoUrl: string | null): void {
  try {
    const key = planoStorageKey(id)
    if (!planoUrl) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, planoUrl)
  } catch {
    try {
      localStorage.removeItem(planoStorageKey(id))
    } catch {
      /* ignore quota */
    }
  }
}

function attachStoredPlano(project: NetVisionProject): NetVisionProject {
  if (project.planoUrl) return project
  const stored = readStoredPlano(project.id)
  return stored ? { ...project, planoUrl: stored } : project
}

function stripPlano(project: NetVisionProject): NetVisionProject {
  return project.planoUrl ? { ...project, planoUrl: null } : project
}

function readLibrary(): LibraryStore {
  try {
    const raw = localStorage.getItem(NETVISION_LIBRARY_KEY)
    if (!raw) return { version: 1, projects: {} }
    const parsed = JSON.parse(raw) as Partial<LibraryStore>
    const projects: Record<string, NetVisionProject> = {}
    if (parsed.projects && typeof parsed.projects === 'object') {
      for (const [id, p] of Object.entries(parsed.projects)) {
        try {
          const normalized = normalizeProject(p as Partial<NetVisionProject>, id)
          if (normalized.planoUrl) {
            writeStoredPlano(normalized.id, normalized.planoUrl)
          } else {
            const stored = readStoredPlano(normalized.id)
            if (stored) normalized.planoUrl = stored
          }
          projects[id] = normalized
        } catch {
          try {
            const rawP = p as Partial<NetVisionProject>
            const salvaged = emptyProject({
              id,
              name: typeof rawP.name === 'string' ? rawP.name : undefined,
            })
            if (Array.isArray(rawP.cameras)) {
              salvaged.cameras = rawP.cameras.flatMap((c) => {
                try {
                  return [normalizeCamera(c)]
                } catch {
                  return []
                }
              })
            }
            if (Array.isArray(rawP.networkNodes)) {
              salvaged.networkNodes = rawP.networkNodes.flatMap((n) => {
                try {
                  return [normalizeNetworkNode(n)]
                } catch {
                  return []
                }
              })
            }
            salvaged.planoNombre =
              typeof rawP.planoNombre === 'string' ? rawP.planoNombre : ''
            const stored = readStoredPlano(salvaged.id)
            salvaged.planoUrl =
              stored ||
              (typeof rawP.planoUrl === 'string' && rawP.planoUrl ? rawP.planoUrl : null)
            projects[id] = salvaged
          } catch {
            /* se omite solo ese registro */
          }
        }
      }
    }
    return { version: 1, projects }
  } catch {
    return { version: 1, projects: {} }
  }
}

function writeLibrary(store: LibraryStore) {
  const slim: LibraryStore = {
    version: 1,
    projects: Object.fromEntries(
      Object.entries(store.projects).map(([id, p]) => [id, stripPlano(p)]),
    ),
  }
  try {
    localStorage.setItem(NETVISION_LIBRARY_KEY, JSON.stringify(slim))
  } catch {
    /* la biblioteca sin plano ya es liviana; si aún falla, no borrar cámaras */
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
      planDeviceCount: (p.planDevices ?? []).length,
      structureCount: (p.structures ?? []).length,
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
  writeStoredPlano(next.id, next.planoUrl)
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
  const opened = attachStoredPlano(p)
  setActiveId(id)
  persistWorkingCopy(opened)
  return opened
}

/** Lee un proyecto de la biblioteca sin cambiar el activo (vista cliente). */
export function peekLocalProject(id: string): NetVisionProject | null {
  const lib = readLibrary()
  const p = lib.projects[id]
  if (!p) return null
  return attachStoredPlano(p)
}

export function deleteProject(id: string): NetVisionProject {
  const lib = readLibrary()
  delete lib.projects[id]
  writeStoredPlano(id, null)
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
  writeStoredPlano(project.id, project.planoUrl)
  try {
    sessionStorage.setItem(NETVISION_STORAGE_KEY, JSON.stringify(project))
  } catch {
    try {
      sessionStorage.setItem(
        NETVISION_STORAGE_KEY,
        JSON.stringify(stripPlano(project)),
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
      const parsed = attachStoredPlano(
        normalizeProject(JSON.parse(raw) as Partial<NetVisionProject>),
      )
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
    const p = attachStoredPlano(lib.projects[activeId]!)
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
    const opened = attachStoredPlano(first)
    setActiveId(opened.id)
    persistWorkingCopy(opened)
    return opened
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
  return next
}

/** Copia el proyecto con nuevo id/nombre y lo deja activo. */
export function duplicateProject(
  source: NetVisionProject,
  name?: string,
): NetVisionProject {
  const id = newId()
  const label =
    (name?.trim() || `${source.name.trim() || 'Proyecto'} (copia)`).slice(0, 120)
  const copy = normalizeProject(
    {
      ...source,
      id,
      name: label,
      updatedAt: nowIso(),
    },
    id,
  )
  const lib = readLibrary()
  lib.projects[copy.id] = copy
  writeLibrary(lib)
  setActiveId(copy.id)
  persistWorkingCopy(copy)
  return copy
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
    planoInvertido: Boolean(p.planoInvertido),
    planoCotaColor: normalizeCotaColor(p.planoCotaColor),
    planoGrosorMuro: clampGrosorMuro(p.planoGrosorMuro),
    cameras: Array.isArray(p.cameras) ? p.cameras.map(normalizeCamera) : [],
    networkNodes: Array.isArray(p.networkNodes)
      ? p.networkNodes.map(normalizeNetworkNode)
      : [],
    planDevices: Array.isArray(p.planDevices)
      ? p.planDevices.map(normalizePlanDevice)
      : [],
    structures: Array.isArray(p.structures)
      ? p.structures.map(normalizeStructure)
      : [],
    undergroundSegments: Array.isArray(p.undergroundSegments)
      ? p.undergroundSegments.map(normalizeUndergroundSegment)
      : [],
    cableSegments: Array.isArray(p.cableSegments)
      ? p.cableSegments.map(normalizeCableSegment)
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
  const fovLeftDeg =
    typeof c.fovLeftDeg === 'number' && Number.isFinite(c.fovLeftDeg)
      ? Math.min(85, Math.max(10, c.fovLeftDeg))
      : undefined
  const fovRightDeg =
    typeof c.fovRightDeg === 'number' && Number.isFinite(c.fovRightDeg)
      ? Math.min(85, Math.max(10, c.fovRightDeg))
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
    mountHeightM: clampMountHeightM(
      typeof c.mountHeightM === 'number' ? c.mountHeightM : DEFAULT_MOUNT_HEIGHT_M,
    ),
    tiltDeg: clampTiltDeg(typeof c.tiltDeg === 'number' ? c.tiltDeg : DEFAULT_TILT_DEG),
    ...(() => {
      const labelOffsetX = clampLabelOffset(c.labelOffsetX)
      const labelOffsetY = clampLabelOffset(c.labelOffsetY)
      return {
        ...(labelOffsetX != null ? { labelOffsetX } : {}),
        ...(labelOffsetY != null ? { labelOffsetY } : {}),
      }
    })(),
    ...(fovDeg != null ? { fovDeg } : {}),
    ...(fovLeftDeg != null ? { fovLeftDeg } : {}),
    ...(fovRightDeg != null ? { fovRightDeg } : {}),
    ...(rangeM != null ? { rangeM } : {}),
    ...normalizeLensVision(c.lensVision),
  }
}

/** Ajuste propio de las lentes secundarias (Dual): se conserva al guardar/cargar el diseño. */
function normalizeLensVision(raw: unknown): Pick<DesignCamera, 'lensVision'> | Record<string, never> {
  if (!raw || typeof raw !== 'object') return {}
  const num = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined
  const out: NonNullable<DesignCamera['lensVision']> = {}
  for (const [lensId, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!lensId || !v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const yaw = typeof o.yawDeg === 'number' && Number.isFinite(o.yawDeg) ? ((o.yawDeg % 360) + 360) % 360 : undefined
    const lens = {
      ...(yaw != null ? { yawDeg: yaw } : {}),
      ...(num(o.fovDeg, 20, 170) != null ? { fovDeg: num(o.fovDeg, 20, 170) } : {}),
      ...(num(o.fovLeftDeg, 10, 85) != null ? { fovLeftDeg: num(o.fovLeftDeg, 10, 85) } : {}),
      ...(num(o.fovRightDeg, 10, 85) != null ? { fovRightDeg: num(o.fovRightDeg, 10, 85) } : {}),
      ...(num(o.rangeM, 2, 120) != null ? { rangeM: num(o.rangeM, 2, 120) } : {}),
    }
    if (Object.keys(lens).length) out[lensId] = lens
  }
  return Object.keys(out).length ? { lensVision: out } : {}
}

const PLAN_DISCIPLINES: PlanDiscipline[] = ['sonido', 'domotica', 'electrico']
const PLAN_KINDS: PlanDeviceKind[] = [
  'speaker',
  'siren',
  'mic',
  'hub',
  'sensor',
  'relay',
  'keypad',
  'panel',
  'outlet',
  'light',
  'transformer',
]

function normalizePlanDevice(d: Partial<DesignPlanDevice>): DesignPlanDevice {
  const discipline = PLAN_DISCIPLINES.includes(d.discipline as PlanDiscipline)
    ? (d.discipline as PlanDiscipline)
    : 'sonido'
  const kind = PLAN_KINDS.includes(d.kind as PlanDeviceKind)
    ? (d.kind as PlanDeviceKind)
    : getPlanDeviceModelOrDefault(d.modelId ?? '', discipline).kind
  const looksPercent = (d.x ?? 0) > 1 || (d.y ?? 0) > 1
  const model = getPlanDeviceModelOrDefault(d.modelId ?? '', discipline)
  const rangeM =
    typeof d.rangeM === 'number' && Number.isFinite(d.rangeM)
      ? Math.min(40, Math.max(0.4, d.rangeM))
      : undefined
  const fovDeg =
    typeof d.fovDeg === 'number' && Number.isFinite(d.fovDeg)
      ? Math.min(360, Math.max(10, d.fovDeg))
      : undefined
  return {
    id: d.id ?? `${Date.now()}`,
    label: d.label ?? 'EQ-01',
    x: looksPercent ? (d.x ?? 0) / 100 : (d.x ?? 0),
    y: looksPercent ? (d.y ?? 0) / 100 : (d.y ?? 0),
    discipline,
    kind,
    modelId: d.modelId ?? defaultPlanDeviceId(discipline),
    yawDeg: typeof d.yawDeg === 'number' ? ((d.yawDeg % 360) + 360) % 360 : 0,
    ...(rangeM != null ? { rangeM } : {}),
    ...(fovDeg != null ? { fovDeg } : {}),
    ...(model.id && !d.modelId ? { modelId: model.id } : {}),
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
    planSizeNorm: clampNetworkPlanSize(
      typeof n.planSizeNorm === 'number'
        ? n.planSizeNorm
        : defaultNetworkPlanSize(kind),
    ),
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
    grosor: clampGrosorMuro(s.grosor),
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

const CABLE_TYPE_SET = new Set<string>(DRAWABLE_CABLE_TYPES.concat(['COAX']))

function normalizeCableSegment(
  s: Partial<DesignCableSegment>,
): DesignCableSegment {
  const type = (
    typeof s.type === 'string' && CABLE_TYPE_SET.has(s.type) ? s.type : 'CAT6'
  ) as CableType
  let points: { x: number; y: number }[] = []
  if (Array.isArray(s.points) && s.points.length >= 2) {
    points = s.points
      .filter(
        (p): p is { x: number; y: number } =>
          !!p && typeof p.x === 'number' && typeof p.y === 'number',
      )
      .map((p) => ({
        x: Math.min(1, Math.max(0, p.x)),
        y: Math.min(1, Math.max(0, p.y)),
      }))
  }
  if (points.length < 2) {
    const x1 = typeof s.x1 === 'number' ? s.x1 : 0.3
    const y1 = typeof s.y1 === 'number' ? s.y1 : 0.3
    const x2 = typeof s.x2 === 'number' ? s.x2 : 0.7
    const y2 = typeof s.y2 === 'number' ? s.y2 : 0.3
    points = [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ]
  }
  const first = points[0]!
  const last = points[points.length - 1]!
  return {
    id: s.id ?? `${Date.now()}`,
    label: s.label ?? 'CAB-01',
    type,
    points,
    x1: first.x,
    y1: first.y,
    x2: last.x,
    y2: last.y,
  }
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
