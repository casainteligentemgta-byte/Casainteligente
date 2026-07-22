'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type Konva from 'konva'
import Link from 'next/link'
import {
  BookOpen,
  Camera,
  Download,
  Trash2,
  Upload,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/nexus/ui/button'
import { GlassCardMotion } from '@/components/nexus/GlassCard'
import { Mono } from '@/components/nexus/Mono'
import { useRegisterNexusRightPanel } from '@/components/nexus/NexusRightPanelContext'
import BOMGenerator from '@/components/netvision/BOMGenerator'
import NetVisionCollapsible from '@/components/netvision/NetVisionCollapsible'
import NetVisionPrefsPanel from '@/components/netvision/NetVisionPrefsPanel'
import NetVisionProjectsPanel from '@/components/netvision/NetVisionProjectsPanel'
import CableRoutingEngine from '@/components/netvision/CableRoutingEngine'
import ConduitCalculator from '@/components/netvision/ConduitCalculator'
import DiagramGenerator from '@/components/netvision/DiagramGenerator'
import NetworkDesigner from '@/components/netvision/NetworkDesigner'
import NetVisionLayerHelp, {
  layerHelpTitle,
} from '@/components/netvision/NetVisionLayerHelp'
import StructureDesigner from '@/components/netvision/StructureDesigner'
import UndergroundCanalizationTool from '@/components/netvision/UndergroundCanalizationTool'
import ComplianceValidatorPanel from '@/components/netvision/ComplianceValidator'
import ValidationEngine from '@/components/netvision/ValidationEngine'
import {
  CAMERA_BRANDS,
  DEFAULT_CAMERA_MODEL_ID,
  cameraCatalogGrouped,
  effectiveCameraLenses,
  effectiveCameraVision,
  getCameraModelOrDefault,
} from '@/lib/netvision/catalog/cameras'
import {
  DEFAULT_AP_ID,
  DEFAULT_INJECTOR_ID,
  DEFAULT_NVR_ID,
  DEFAULT_SWITCH_ID,
  getNetworkModelOrDefault,
  labelPrefixForKind,
  networkCatalogByKind,
} from '@/lib/netvision/catalog/network'
import {
  buildCoverageSectors,
  buildVisionSpectrum,
  defaultScale,
  visionBandRangesM,
} from '@/lib/netvision/services/coverageCalculator'
import { buildBom } from '@/lib/netvision/services/bandwidthCalculator'
import { analyzeRedundancy } from '@/lib/netvision/services/redundancyAnalyzer'
import {
  adviseCameraLinks,
  analyzePoeBudget,
  autoAssignCamerasToPoe,
} from '@/lib/netvision/services/poeAnalyzer'
import { optimizeApChannels } from '@/lib/netvision/services/channelOptimizer'
import {
  analyzeWifiCoverage,
  buildWifiCoverage,
  buildWifiSpectrum,
} from '@/lib/netvision/services/wifiPredictor'
import { buildSoundSpectrum } from '@/lib/netvision/services/soundPredictor'
import { getStructureMaterialOrDefault } from '@/lib/netvision/catalog/materials'
import {
  buildCableRoutes,
  cableRouteKey,
  insertMidWaypoint,
  longestSegmentBreak,
  moveMidWaypoint,
  removeMidWaypoint,
  validateCableRoutes,
  withManualCableSegments,
  type NormPoint,
} from '@/lib/netvision/services/cableRoutingEngine'
import {
  planConduits,
  validateConduits,
} from '@/lib/netvision/services/conduitCalculator'
import {
  buildUndergroundPlan,
  validateUnderground,
  withManualUndergroundSegments,
  type ChamberMaterial,
  type TerrainType,
  type ZoneType,
} from '@/lib/netvision/services/canalizationCalculator'
import {
  complianceValidator,
  designFromRoutes,
  profilesForCountry,
} from '@/lib/netvision/services/complianceValidator'
import { cloudUpsertProject } from '@/lib/netvision/cloud'
import {
  emptyProject,
  loadProject,
  resetActiveDesign,
  saveProject,
} from '@/lib/netvision/storage'
import {
  defaultCalibrationInput,
  formatLength,
  lengthUnitLabel,
  parseCalibrationToMeters,
} from '@/lib/netvision/utils/units'
import type {
  CableType,
  DesignCableSegment,
  DesignCamera,
  DesignNetworkNode,
  DesignStructure,
  DesignUndergroundSegment,
  NetVisionProject,
  NetworkNodeKind,
  StructureMaterialId,
} from '@/lib/netvision/types'
import { downloadDataUrl } from '@/lib/netvision/utils/exporters'
import { downloadNetVisionPlanPdf } from '@/lib/netvision/utils/exportPlanPdf'
import type { NetVisionZoomControls } from '@/components/netvision/CameraPlacementTool'

const CameraPlacementTool = dynamic(
  () => import('@/components/netvision/CameraPlacementTool'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-[var(--nexus-text-muted)]">
        Cargando NetVision Pro…
      </div>
    ),
  },
)

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

async function renderPdfFirstPage(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 1.5 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el canvas del PDF.')
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.92)
}

export default function NexusVisionArchitectClient() {
  const [project, setProject] = useState<NetVisionProject>(() => emptyProject())
  const [hydrated, setHydrated] = useState(false)
  const [showFov, setShowFov] = useState(true)
  const [showWifi, setShowWifi] = useState(true)
  const [showSound, setShowSound] = useState(false)
  const [showLinks, setShowLinks] = useState(true)
  const [showCableRoutes, setShowCableRoutes] = useState(true)
  const [showUnderground, setShowUnderground] = useState(false)
  const [showStructures, setShowStructures] = useState(true)
  const [drawStructureMaterial, setDrawStructureMaterial] =
    useState<StructureMaterialId | null>(null)
  const [structureDraft, setStructureDraft] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [drawUnderground, setDrawUnderground] = useState(false)
  const [undergroundDraft, setUndergroundDraft] = useState<{
    x: number
    y: number
  } | null>(null)
  const [drawCable, setDrawCable] = useState(false)
  const [cableDraft, setCableDraft] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [drawCableType, setDrawCableType] = useState<CableType>('CAT6')
  const [ugZone, setUgZone] = useState<ZoneType>('vehicle')
  const [ugTerrain, setUgTerrain] = useState<TerrainType>('medium')
  const [ugChamberMat, setUgChamberMat] = useState<ChamberMaterial>('polietileno')
  const [nightMode, setNightMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [defaultModelId, setDefaultModelId] = useState(DEFAULT_CAMERA_MODEL_ID)
  const [defaultNetModels, setDefaultNetModels] = useState<Record<NetworkNodeKind, string>>({
    switch: DEFAULT_SWITCH_ID,
    ap: DEFAULT_AP_ID,
    nvr: DEFAULT_NVR_ID,
    injector: DEFAULT_INJECTOR_ID,
  })
  const [calibrateMode, setCalibrateMode] = useState(false)
  const [calibPoints, setCalibPoints] = useState<{ x: number; y: number }[]>([])
  const [calibMeters, setCalibMeters] = useState('10')
  const [sideTab, setSideTab] = useState<
    'cctv' | 'red' | 'muros' | 'cable' | 'sub' | 'norm' | 'prefs'
  >('cctv')
  /** Panel derecho (inspector): visible por defecto; se oculta con el botón. */
  const [inspectorOpen, setInspectorOpen] = useState(true)
  useRegisterNexusRightPanel(inspectorOpen, setInspectorOpen)
  const [viewMode, setViewMode] = useState<'plano' | 'diagrama'>('plano')
  const [complianceCountry, setComplianceCountry] = useState('VE')
  const fileRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const zoomControlsRef = useRef<NetVisionZoomControls | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)

  useEffect(() => {
    const p = loadProject()
    setProject(p)
    if (p.complianceProfileId) setComplianceCountry(p.complianceProfileId)
    setCalibMeters(defaultCalibrationInput(p.unitSystem ?? 'metric'))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveProject(project)
  }, [project, hydrated])

  /** Sync diferido a Supabase (si hay sesión). */
  useEffect(() => {
    if (!hydrated) return
    const t = window.setTimeout(() => {
      void cloudUpsertProject(project).then((r) => {
        if (!r.authenticated) return
        if (!r.ok && r.error) {
          // Silencioso si la tabla aún no existe; evita spamear UI
          if (r.error.includes('migración 274') || r.error.includes('42P01')) return
        }
      })
    }, 1800)
    return () => window.clearTimeout(t)
  }, [project, hydrated])

  useEffect(() => {
    if (!hydrated) return
    setCalibMeters(defaultCalibrationInput(project.unitSystem ?? 'metric'))
  }, [project.unitSystem, hydrated])

  const structures = project.structures ?? []

  const sectors = useMemo(
    () =>
      buildCoverageSectors(
        project.cameras,
        project.scale,
        nightMode ? 'night' : 'day',
        structures,
      ),
    [project.cameras, project.scale, nightMode, structures],
  )

  const visionSpectrum = useMemo(
    () =>
      buildVisionSpectrum(
        project.cameras,
        project.scale,
        nightMode ? 'night' : 'day',
        structures,
      ),
    [project.cameras, project.scale, nightMode, structures],
  )

  const wifiCircles = useMemo(
    () => buildWifiCoverage(project.networkNodes, project.scale),
    [project.networkNodes, project.scale],
  )

  const wifiSpectrum = useMemo(
    () => buildWifiSpectrum(project.networkNodes, project.scale, structures),
    [project.networkNodes, project.scale, structures],
  )

  const soundSpectrum = useMemo(
    () => buildSoundSpectrum(project.cameras, project.scale, structures),
    [project.cameras, project.scale, structures],
  )

  const linkAdvice = useMemo(
    () => adviseCameraLinks(project.cameras, project.networkNodes, project.scale),
    [project.cameras, project.networkNodes, project.scale],
  )

  const poeAnalysis = useMemo(
    () => analyzePoeBudget(project.cameras, project.networkNodes),
    [project.cameras, project.networkNodes],
  )

  const cableRouteOverrides = project.cableRouteOverrides ?? {}
  const cableSegments = project.cableSegments ?? []

  const cableRoutes = useMemo(
    () =>
      withManualCableSegments(
        buildCableRoutes(
          project.cameras,
          project.networkNodes,
          project.scale,
          cableRouteOverrides,
        ),
        cableSegments,
        project.scale,
      ),
    [
      project.cameras,
      project.networkNodes,
      project.scale,
      cableRouteOverrides,
      cableSegments,
    ],
  )

  const selectedCableRoute =
    cableRoutes.find((r) => r.id === selectedId) ?? null

  const setRouteMids = (routeId: string, mids: NormPoint[]) => {
    const route = cableRoutes.find((r) => r.id === routeId)
    if (!route) return
    const key = cableRouteKey(route.fromId, route.toId)
    setProject((p) => {
      const next = { ...(p.cableRouteOverrides ?? {}) }
      if (mids.length === 0) delete next[key]
      else next[key] = mids
      return { ...p, cableRouteOverrides: next }
    })
  }

  const ensureRouteMids = (routeId: string): NormPoint[] => {
    const route = cableRoutes.find((r) => r.id === routeId)
    if (!route) return []
    const key = cableRouteKey(route.fromId, route.toId)
    const existing = cableRouteOverrides[key]
    if (existing && existing.length > 0) return existing
    // Sembrar el codo L actual como primer quiebre editable
    return route.points.slice(1, -1).map((p) => ({ x: p.x, y: p.y }))
  }

  const addBreakToRoute = (routeId: string) => {
    const route = cableRoutes.find((r) => r.id === routeId)
    if (!route) return
    const seeded = ensureRouteMids(routeId)
    const composed = [
      route.points[0]!,
      ...seeded,
      route.points[route.points.length - 1]!,
    ]
    const br = longestSegmentBreak(composed)
    const mids = insertMidWaypoint(composed, br.afterIndex, br.point)
    setRouteMids(routeId, mids)
    setSelectedId(routeId)
    setSideTab('cable')
    setShowCableRoutes(true)
    setShowUnderground(false)
    setViewMode('plano')
  }

  const insertBreakOnRoute = (
    routeId: string,
    afterPointIndex: number,
    x: number,
    y: number,
  ) => {
    const route = cableRoutes.find((r) => r.id === routeId)
    if (!route) return
    const seeded = ensureRouteMids(routeId)
    const composed = [
      route.points[0]!,
      ...seeded,
      route.points[route.points.length - 1]!,
    ]
    // Si la ruta visible aún era L auto y seeded coincide, usar points actuales
    const base =
      composed.length === route.points.length ? route.points : composed
    const mids = insertMidWaypoint(base, afterPointIndex, { x, y })
    setRouteMids(routeId, mids)
    setSelectedId(routeId)
    setSideTab('cable')
  }

  const moveBreakOnRoute = (
    routeId: string,
    midIndex: number,
    x: number,
    y: number,
  ) => {
    const mids = moveMidWaypoint(ensureRouteMids(routeId), midIndex, { x, y })
    setRouteMids(routeId, mids)
  }

  const removeBreakOnRoute = (routeId: string, midIndex: number) => {
    const mids = removeMidWaypoint(ensureRouteMids(routeId), midIndex)
    setRouteMids(routeId, mids)
  }

  const removeLastBreakOnRoute = (routeId: string) => {
    const mids = ensureRouteMids(routeId)
    if (mids.length === 0) {
      setRouteMids(routeId, [])
      return
    }
    setRouteMids(routeId, mids.slice(0, -1))
  }

  const resetRoutePath = (routeId: string) => {
    setRouteMids(routeId, [])
  }

  const conduitPlans = useMemo(() => planConduits(cableRoutes), [cableRoutes])

  const undergroundSegments = project.undergroundSegments ?? []

  const undergroundPlan = useMemo(
    () =>
      withManualUndergroundSegments(
        buildUndergroundPlan(cableRoutes, {
          zone: ugZone,
          terrain: ugTerrain,
          chamberMaterial: ugChamberMat,
        }),
        undergroundSegments,
        project.scale,
      ),
    [
      cableRoutes,
      ugZone,
      ugTerrain,
      ugChamberMat,
      undergroundSegments,
      project.scale,
    ],
  )

  const validations = useMemo(() => {
    const cov = analyzeRedundancy(project.cameras, sectors)
    const wifi = analyzeWifiCoverage(
      project.networkNodes,
      project.scale,
      20,
      structures,
    )
    const cab = validateCableRoutes(cableRoutes)
    const cnd = validateConduits(conduitPlans)
    const ug = validateUnderground(undergroundPlan)
    const design = designFromRoutes(
      project.cameras,
      cableRoutes,
      project.networkNodes,
    )
    const norm = complianceValidator.validateAll(
      design,
      profilesForCountry(complianceCountry),
    )
    return [
      ...cov,
      ...poeAnalysis.validations,
      ...wifi,
      ...cab,
      ...cnd,
      ...ug,
      ...norm,
    ]
  }, [
    project.cameras,
    project.networkNodes,
    project.scale,
    structures,
    sectors,
    poeAnalysis.validations,
    cableRoutes,
    conduitPlans,
    undergroundPlan,
    complianceCountry,
  ])

  const bom = useMemo(
    () =>
      buildBom(
        project.cameras,
        project.retentionDays,
        project.networkNodes,
        cableRoutes,
        conduitPlans,
        undergroundPlan,
      ),
    [
      project.cameras,
      project.retentionDays,
      project.networkNodes,
      cableRoutes,
      conduitPlans,
      undergroundPlan,
    ],
  )

  const linkLines = useMemo(() => {
    const nodeById = new Map(project.networkNodes.map((n) => [n.id, n]))
    const camById = new Map(project.cameras.map((c) => [c.id, c]))
    return linkAdvice
      .filter((a) => a.nearestNodeId)
      .map((a) => {
        const cam = camById.get(a.cameraId)!
        const node = nodeById.get(a.nearestNodeId!)!
        return {
          fromX: cam.x,
          fromY: cam.y,
          toX: node.x,
          toY: node.y,
          warn: a.needsInjector || a.distanceM > 90,
        }
      })
  }, [linkAdvice, project.cameras, project.networkNodes])

  const selectedCam = project.cameras.find((c) => c.id === selectedId) ?? null
  const selectedNet = project.networkNodes.find((n) => n.id === selectedId) ?? null
  const selectedStructure =
    structures.find((s) => s.id === selectedId) ?? null

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      let url: string
      if (isPdf) {
        url = await renderPdfFirstPage(file)
      } else if (file.type.startsWith('image/')) {
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
          reader.readAsDataURL(file)
        })
      } else {
        throw new Error('Usa una imagen (JPG/PNG/WEBP) o un PDF.')
      }
      setProject((p) => ({
        ...p,
        planoUrl: url,
        planoNombre: file.name,
        cameras: [],
        networkNodes: [],
        structures: [],
        undergroundSegments: [],
        cableSegments: [],
        cableRouteOverrides: {},
      }))
      setSelectedId(null)
      setCalibrateMode(false)
      setCalibPoints([])
      setDrawStructureMaterial(null)
      setStructureDraft(null)
      setDrawUnderground(false)
      setUndergroundDraft(null)
      setDrawCable(false)
      setCableDraft(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el plano')
    } finally {
      setLoading(false)
    }
  }, [])

  /** Posición inicial al agregar por botón (leve desplazamiento para no apilar). */
  const buttonSpawnPos = (index: number, baseX: number, baseY: number) => {
    const offset = (index % 8) * 0.04
    const row = Math.floor(index / 8) * 0.04
    return {
      x: Math.min(0.9, Math.max(0.08, baseX + offset - 0.14)),
      y: Math.min(0.9, Math.max(0.08, baseY + row - 0.08)),
    }
  }

  const addCameraAt = (normX: number, normY: number) => {
    if (!project.planoUrl) return
    const n = project.cameras.length + 1
    const pin: DesignCamera = {
      id: uid(),
      x: Math.round(normX * 1000) / 1000,
      y: Math.round(normY * 1000) / 1000,
      label: `CAM-${String(n).padStart(2, '0')}`,
      modelId: defaultModelId,
      yawDeg: 0,
      mountHeightM: 2.8,
    }
    setError(null)
    setProject((p) => ({ ...p, cameras: [...p.cameras, pin] }))
    setSelectedId(pin.id)
    setSideTab('cctv')
    setViewMode('plano')
    setCalibrateMode(false)
    setCalibPoints([])
    setDrawStructureMaterial(null)
    setStructureDraft(null)
  }

  /** Agrega cámara por botón (centro del plano, con leve desplazamiento si ya hay otras). */
  const addCameraFromButton = () => {
    if (!project.planoUrl) {
      setError('Carga un plano antes de agregar equipos.')
      return
    }
    const pos = buttonSpawnPos(project.cameras.length, 0.5, 0.45)
    addCameraAt(pos.x, pos.y)
  }

  const addNetworkAt = (kind: NetworkNodeKind, normX: number, normY: number) => {
    if (!project.planoUrl) return
    const count = project.networkNodes.filter((n) => n.kind === kind).length + 1
    const prefix = labelPrefixForKind(kind)
    const node: DesignNetworkNode = {
      id: uid(),
      x: Math.round(normX * 1000) / 1000,
      y: Math.round(normY * 1000) / 1000,
      label: `${prefix}-${String(count).padStart(2, '0')}`,
      kind,
      modelId: defaultNetModels[kind],
      linkedCameraIds: [],
      wifiChannel: kind === 'ap' ? 36 : undefined,
    }
    setError(null)
    setProject((p) => ({ ...p, networkNodes: [...p.networkNodes, node] }))
    setSelectedId(node.id)
    setSideTab('red')
    setViewMode('plano')
    setCalibrateMode(false)
    setCalibPoints([])
  }

  /** Agrega switch / AP / NVR / injector por botón (sin clic en el plano). */
  const addNetworkFromButton = (kind: NetworkNodeKind) => {
    if (!project.planoUrl) {
      setError('Carga un plano antes de agregar equipos.')
      return
    }
    const bases: Record<NetworkNodeKind, { x: number; y: number }> = {
      switch: { x: 0.35, y: 0.35 },
      ap: { x: 0.65, y: 0.35 },
      nvr: { x: 0.35, y: 0.65 },
      injector: { x: 0.65, y: 0.65 },
    }
    const base = bases[kind]
    const idx = project.networkNodes.filter((n) => n.kind === kind).length
    const pos = buttonSpawnPos(idx, base.x, base.y)
    addNetworkAt(kind, pos.x, pos.y)
  }

  const addStructureSegment = (
    materialId: StructureMaterialId,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => {
    const n = (project.structures?.length ?? 0) + 1
    const prefix =
      materialId === 'door'
        ? 'PUE'
        : materialId === 'window'
          ? 'VEN'
          : materialId === 'glass'
            ? 'VID'
            : materialId === 'block'
              ? 'BLO'
              : 'DRY'
    const seg: DesignStructure = {
      id: uid(),
      label: `${prefix}-${String(n).padStart(2, '0')}`,
      materialId,
      x1: Math.round(x1 * 1000) / 1000,
      y1: Math.round(y1 * 1000) / 1000,
      x2: Math.round(x2 * 1000) / 1000,
      y2: Math.round(y2 * 1000) / 1000,
    }
    setError(null)
    setProject((p) => ({
      ...p,
      structures: [...(p.structures ?? []), seg],
    }))
    setSelectedId(seg.id)
    setSideTab('muros')
    setViewMode('plano')
  }

  const addUndergroundSegment = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => {
    const n = (project.undergroundSegments?.length ?? 0) + 1
    const seg: DesignUndergroundSegment = {
      id: uid(),
      label: `SUB-${String(n).padStart(2, '0')}`,
      x1: Math.round(x1 * 1000) / 1000,
      y1: Math.round(y1 * 1000) / 1000,
      x2: Math.round(x2 * 1000) / 1000,
      y2: Math.round(y2 * 1000) / 1000,
    }
    setError(null)
    setProject((p) => ({
      ...p,
      undergroundSegments: [...(p.undergroundSegments ?? []), seg],
    }))
    setSelectedId(seg.id)
    setSideTab('sub')
    setShowUnderground(true)
    setViewMode('plano')
  }

  const addCableSegment = (
    type: CableType,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => {
    const n = (project.cableSegments?.length ?? 0) + 1
    const seg: DesignCableSegment = {
      id: uid(),
      label: `CAB-${String(n).padStart(2, '0')}`,
      type,
      x1: Math.round(x1 * 1000) / 1000,
      y1: Math.round(y1 * 1000) / 1000,
      x2: Math.round(x2 * 1000) / 1000,
      y2: Math.round(y2 * 1000) / 1000,
    }
    setError(null)
    setProject((p) => ({
      ...p,
      cableSegments: [...(p.cableSegments ?? []), seg],
    }))
    setSelectedId(seg.id)
    setSideTab('cable')
    setShowCableRoutes(true)
    setShowUnderground(false)
    setViewMode('plano')
  }

  const onAddAt = (normX: number, normY: number) => {
    if (!project.planoUrl) return

    if (calibrateMode) {
      const next = [...calibPoints, { x: normX, y: normY }]
      if (next.length >= 2) {
        const a = next[0]!
        const b = next[1]!
        const meters = parseCalibrationToMeters(
          calibMeters,
          project.unitSystem ?? 'metric',
        )
        const distN = Math.hypot(a.x - b.x, a.y - b.y) || 1e-6
        const metersPerNorm = meters / distN
        setProject((p) => ({
          ...p,
          scale: {
            metersPerNormX: metersPerNorm,
            metersPerNormY: metersPerNorm,
            calibrated: true,
          },
        }))
        setCalibPoints([])
        setCalibrateMode(false)
      } else {
        setCalibPoints(next)
      }
      return
    }

    if (drawCable) {
      if (!cableDraft) {
        setCableDraft({ x: normX, y: normY })
        return
      }
      const dx = Math.abs(cableDraft.x - normX)
      const dy = Math.abs(cableDraft.y - normY)
      if (dx + dy < 0.01) {
        setError('El cable es demasiado corto; elige otro punto.')
        return
      }
      addCableSegment(drawCableType, cableDraft.x, cableDraft.y, normX, normY)
      setCableDraft(null)
      return
    }

    if (drawUnderground) {
      if (!undergroundDraft) {
        setUndergroundDraft({ x: normX, y: normY })
        return
      }
      const dx = Math.abs(undergroundDraft.x - normX)
      const dy = Math.abs(undergroundDraft.y - normY)
      if (dx + dy < 0.01) {
        setError('El tramo es demasiado corto; elige otro punto.')
        return
      }
      addUndergroundSegment(
        undergroundDraft.x,
        undergroundDraft.y,
        normX,
        normY,
      )
      setUndergroundDraft(null)
      return
    }

    if (drawStructureMaterial) {
      if (!structureDraft) {
        setStructureDraft({ x: normX, y: normY })
        return
      }
      const dx = Math.abs(structureDraft.x - normX)
      const dy = Math.abs(structureDraft.y - normY)
      if (dx + dy < 0.01) {
        setError('El segmento es demasiado corto; elige otro punto.')
        return
      }
      addStructureSegment(
        drawStructureMaterial,
        structureDraft.x,
        structureDraft.y,
        normX,
        normY,
      )
      setStructureDraft(null)
    }
  }

  const onMove = (id: string, normX: number, normY: number) => {
    const nx = Math.round(normX * 1000) / 1000
    const ny = Math.round(normY * 1000) / 1000
    setProject((p) => ({
      ...p,
      cameras: p.cameras.map((c) => (c.id === id ? { ...c, x: nx, y: ny } : c)),
      networkNodes: p.networkNodes.map((n) => (n.id === id ? { ...n, x: nx, y: ny } : n)),
    }))
  }

  const onStructureMove = (
    id: string,
    patch: { x1: number; y1: number; x2: number; y2: number },
  ) => {
    const clamp = (n: number) => Math.min(1, Math.max(0, Math.round(n * 1000) / 1000))
    const next = {
      x1: clamp(patch.x1),
      y1: clamp(patch.y1),
      x2: clamp(patch.x2),
      y2: clamp(patch.y2),
    }
    // Evitar muro degenerado
    if (Math.abs(next.x1 - next.x2) + Math.abs(next.y1 - next.y2) < 0.008) return
    setProject((p) => ({
      ...p,
      structures: (p.structures ?? []).map((s) =>
        s.id === id ? { ...s, ...next } : s,
      ),
    }))
  }

  const patchCamera = (id: string, patch: Partial<DesignCamera>) => {
    setProject((p) => ({
      ...p,
      cameras: p.cameras.map((c) => {
        if (c.id !== id) return c
        const next: DesignCamera = { ...c, ...patch }
        if ('fovDeg' in patch && patch.fovDeg === undefined) delete next.fovDeg
        if ('rangeM' in patch && patch.rangeM === undefined) delete next.rangeM
        return next
      }),
    }))
  }

  const updateSelectedCam = (patch: Partial<DesignCamera>) => {
    if (!selectedId) return
    patchCamera(selectedId, patch)
  }

  const adjustCameraVision = (
    id: string,
    patch: { yawDeg?: number; fovDeg?: number; rangeM?: number },
  ) => {
    patchCamera(id, patch)
  }

  const updateSelectedNet = (patch: Partial<DesignNetworkNode>) => {
    if (!selectedId) return
    setProject((p) => ({
      ...p,
      networkNodes: p.networkNodes.map((n) =>
        n.id === selectedId ? { ...n, ...patch } : n,
      ),
    }))
  }

  const quitar = (id: string) => {
    setProject((p) => {
      const overrides = { ...(p.cableRouteOverrides ?? {}) }
      for (const key of Object.keys(overrides)) {
        if (key.startsWith(`${id}__`) || key.endsWith(`__${id}`)) {
          delete overrides[key]
        }
      }
      return {
        ...p,
        cameras: p.cameras.filter((c) => c.id !== id),
        networkNodes: p.networkNodes.filter((n) => n.id !== id),
        structures: (p.structures ?? []).filter((s) => s.id !== id),
        undergroundSegments: (p.undergroundSegments ?? []).filter(
          (s) => s.id !== id,
        ),
        cableSegments: (p.cableSegments ?? []).filter((s) => s.id !== id),
        cableRouteOverrides: overrides,
      }
    })
    if (selectedId === id) setSelectedId(null)
  }

  const limpiarPlano = () => {
    const next = resetActiveDesign(project)
    setProject(next)
    setSelectedId(null)
    setError(null)
  }

  const switchToProject = (p: NetVisionProject) => {
    setProject(p)
    setSelectedId(null)
    setComplianceCountry(p.complianceProfileId || 'VE')
    setCalibPoints([])
    setCalibrateMode(false)
    setCalibMeters(defaultCalibrationInput(p.unitSystem ?? 'metric'))
    setError(null)
  }

  const exportPng = () => {
    const stage = stageRef.current
    if (!stage) return
    downloadDataUrl('netvision-plano.png', stage.toDataURL({ pixelRatio: 2 }))
  }

  const exportPdf = async () => {
    const stage = stageRef.current
    if (!stage || !project.planoUrl || exportingPdf) return
    setExportingPdf(true)
    setError(null)
    try {
      // JPEG reduce tamaño del PDF; capas visibles del Stage se capturan tal cual
      const imageDataUrl = stage.toDataURL({
        pixelRatio: 2,
        mimeType: 'image/jpeg',
        quality: 0.92,
      })
      await downloadNetVisionPlanPdf({
        imageDataUrl,
        projectName: project.name || 'Proyecto NetVision',
        planoNombre: project.planoNombre,
        cameraCount: project.cameras.length,
        networkCount: project.networkNodes.length,
        structureCount: (project.structures ?? []).length,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar el PDF del plano.')
    } finally {
      setExportingPdf(false)
    }
  }

  const placeMode =
    calibrateMode || !!drawStructureMaterial || drawUnderground || drawCable
  const draftPoint = cableDraft ?? undergroundDraft ?? structureDraft
  const draftColor =
    cableDraft || drawCable
      ? '#facc15'
      : undergroundDraft || drawUnderground
        ? '#fb923c'
        : '#22d3ee'

  const inspectorFooter = (
    <>
      <div className="border-t border-white/10 pt-3">
        <NetVisionCollapsible
          title="Validaciones"
          summary={
            validations.length === 0
              ? 'Sin avisos'
              : `${validations.length} aviso(s)`
          }
          defaultOpen={false}
        >
          <ValidationEngine results={validations} onSelectCamera={setSelectedId} />
        </NetVisionCollapsible>
      </div>
      <div className="border-t border-white/10 pt-3">
        <NetVisionCollapsible
          title="Presupuestos"
          summary={`${bom.lines.length} ítems · $${bom.totalUsd.toFixed(0)}`}
          defaultOpen={false}
        >
          <BOMGenerator
            bom={bom}
            retentionDays={project.retentionDays}
            onRetentionChange={(days) =>
              setProject((p) => ({ ...p, retentionDays: days }))
            }
            projectName={project.name}
            currency={project.currency ?? 'USD'}
            distributorMarginPct={project.distributorMarginPct ?? 15}
            onMarginChange={(pct) =>
              setProject((p) => ({ ...p, distributorMarginPct: pct }))
            }
          />
        </NetVisionCollapsible>
      </div>
    </>
  )

  return (
    <div className="mt-[2cm] space-y-3">
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Button
          type="button"
          variant="glass"
          size="sm"
          className="shrink-0"
          onClick={limpiarPlano}
          disabled={!project.planoUrl}
        >
          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
          Nuevo plano
        </Button>
        <Button
          type="button"
          variant="glass"
          size="sm"
          className="shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {loading ? 'Cargando…' : 'Cargar'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.pdf"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
        <div className="shrink-0">
          <NetVisionProjectsPanel
            activeId={project.id}
            projectName={project.name}
            onOpen={switchToProject}
            onNameChange={(name) =>
              setProject((p) => ({ ...p, name: name.slice(0, 120) }))
            }
            triggerSize="sm"
          />
        </div>
        <Button
          type="button"
          variant="glass"
          size="sm"
          className="shrink-0"
          onClick={exportPng}
          disabled={!project.planoUrl}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          PNG
        </Button>
        <Button
          type="button"
          variant="glass"
          size="sm"
          className="shrink-0"
          onClick={() => void exportPdf()}
          disabled={!project.planoUrl || exportingPdf}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {exportingPdf ? 'PDF…' : 'PDF'}
        </Button>
        <Button type="button" variant="glass" size="sm" className="shrink-0" asChild>
          <Link href="/nexus/vision/manual/usuario">
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Manual
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
              viewMode === 'plano'
                ? 'bg-[var(--nexus-cyan)] text-black'
                : 'text-[var(--nexus-text-muted)]'
            }`}
            onClick={() => setViewMode('plano')}
          >
            Plano
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
              viewMode === 'diagrama'
                ? 'bg-[var(--nexus-cyan)] text-black'
                : 'text-[var(--nexus-text-muted)]'
            }`}
            onClick={() => setViewMode('diagrama')}
          >
            Diagrama
          </button>
        </div>
        {project.planoUrl ? (
          <p className="truncate text-xs text-[var(--nexus-text-muted)]">
            <Mono>{project.planoNombre || 'Plano'}</Mono>
            {' · '}
            {project.cameras.length} cam · {project.networkNodes.length} red
            {' · '}
            {project.scale.calibrated ? (
              <span className="text-[var(--nexus-green)]">escala OK</span>
            ) : (
              <span className="text-amber-300">
                escala ~{formatLength(40, project.unitSystem ?? 'metric', 0)}
              </span>
            )}
          </p>
        ) : null}
        {viewMode === 'plano' ? (
          <button
            type="button"
            disabled={!project.planoUrl || loading}
            onClick={addCameraFromButton}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--nexus-cyan)] px-2.5 py-1 text-[11px] font-semibold text-black disabled:opacity-40"
          >
            <Camera className="h-3.5 w-3.5" />
            + Cámara
          </button>
        ) : null}
        {viewMode === 'plano' ? (
          <button
            type="button"
            disabled={!project.planoUrl || loading || project.cameras.length === 0}
            title="Calcula cobertura automática por alcance (semáforo verde/amarillo/rojo)"
            onClick={() => {
              setShowFov(true)
              setViewMode('plano')
              setSideTab('cctv')
              setError(null)
            }}
            className="inline-flex items-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 disabled:opacity-40"
          >
            Calcular cobertura
          </button>
        ) : null}
        {viewMode === 'plano' && project.planoUrl ? (
          <>
            <NetVisionLayerHelp />
            <label
              title={layerHelpTitle('fov')}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]"
            >
              <input
                type="checkbox"
                checked={showFov}
                onChange={(e) => setShowFov(e.target.checked)}
              />
              Visión
            </label>
            <label
              title={layerHelpTitle('wifi')}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]"
            >
              <input
                type="checkbox"
                checked={showWifi}
                onChange={(e) => setShowWifi(e.target.checked)}
              />
              WiFi
            </label>
            <label
              title={layerHelpTitle('sound')}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]"
            >
              <input
                type="checkbox"
                checked={showSound}
                onChange={(e) => setShowSound(e.target.checked)}
              />
              Sonido
            </label>
            <label
              title={layerHelpTitle('links')}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]"
            >
              <input
                type="checkbox"
                checked={showLinks}
                onChange={(e) => setShowLinks(e.target.checked)}
              />
              Enlaces
            </label>
            <label
              title={layerHelpTitle('routes')}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]"
            >
              <input
                type="checkbox"
                checked={showCableRoutes}
                onChange={(e) => setShowCableRoutes(e.target.checked)}
              />
              Rutas
            </label>
            <label
              title={layerHelpTitle('structures')}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]"
            >
              <input
                type="checkbox"
                checked={showStructures}
                onChange={(e) => setShowStructures(e.target.checked)}
              />
              Estructuras
            </label>
            <label
              title={layerHelpTitle('sub')}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]"
            >
              <input
                type="checkbox"
                checked={showUnderground}
                onChange={(e) => setShowUnderground(e.target.checked)}
              />
              Sub
            </label>
            <label
              title={layerHelpTitle('night')}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]"
            >
              <input
                type="checkbox"
                checked={nightMode}
                onChange={(e) => setNightMode(e.target.checked)}
              />
              Noche
            </label>
            <button
              type="button"
              title={layerHelpTitle('calibrate')}
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                calibrateMode
                  ? 'bg-[var(--nexus-cyan)] text-black'
                  : 'text-[var(--nexus-cyan)]'
              }`}
              onClick={() => {
                setCalibrateMode((v) => !v)
                setCalibPoints([])
                setDrawStructureMaterial(null)
                setStructureDraft(null)
                setDrawUnderground(false)
                setUndergroundDraft(null)
                setDrawCable(false)
                setCableDraft(null)
              }}
            >
              Calibrar
            </button>
            {calibrateMode ? (
              <label className="flex items-center gap-1 text-[11px] text-[var(--nexus-text-dim)]">
                {lengthUnitLabel(project.unitSystem ?? 'metric')}
                <input
                  value={calibMeters}
                  onChange={(e) => setCalibMeters(e.target.value)}
                  className="w-14 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-xs text-white"
                />
                ({calibPoints.length}/2)
              </label>
            ) : null}
            <select
              value={defaultModelId}
              onChange={(e) => setDefaultModelId(e.target.value)}
              className="max-w-[200px] rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white"
              title="Modelo de cámara al agregar"
            >
              {cameraCatalogGrouped().map((g) => (
                <optgroup key={g.brand} label={g.brand}>
                  {g.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div
              className="flex overflow-hidden rounded-md border border-white/15 bg-black/40"
              title="Zoom del plano"
            >
              <button
                type="button"
                title="Acercar"
                aria-label="Acercar"
                disabled={!project.planoUrl}
                className="min-h-8 min-w-8 touch-manipulation px-2 py-1 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40"
                onClick={() => zoomControlsRef.current?.zoomIn()}
              >
                +
              </button>
              <button
                type="button"
                title="Alejar"
                aria-label="Alejar"
                disabled={!project.planoUrl}
                className="min-h-8 min-w-8 touch-manipulation border-l border-white/15 px-2 py-1 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40"
                onClick={() => zoomControlsRef.current?.zoomOut()}
              >
                −
              </button>
              <button
                type="button"
                title="Restablecer zoom"
                aria-label="Restablecer zoom"
                disabled={!project.planoUrl}
                className="min-h-8 min-w-[3rem] touch-manipulation border-l border-white/15 px-2 py-1 text-[11px] font-medium tabular-nums text-[var(--nexus-text-muted)] hover:bg-white/10 disabled:opacity-40"
                onClick={() => zoomControlsRef.current?.reset()}
              >
                {zoomPercent}%
              </button>
            </div>
          </>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div
        className={
          inspectorOpen
            ? 'grid gap-6 xl:grid-cols-[1fr_300px]'
            : 'grid gap-6 xl:grid-cols-1'
        }
      >
        <GlassCardMotion className="overflow-hidden p-3 sm:p-4">
          {!project.planoUrl ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[rgba(0,242,254,0.35)] bg-[radial-gradient(ellipse_at_center,rgba(0,242,254,0.12),transparent_70%)] px-4 text-center transition hover:border-[rgba(0,242,254,0.55)]"
            >
              <Camera className="h-10 w-10 text-[var(--nexus-cyan)]" />
              <p className="text-sm font-semibold text-white">Sube el plano del inmueble</p>
              <p className="max-w-sm text-xs text-[var(--nexus-text-dim)]">
                Agrega cámara, switch, AP o NVR con los botones +; luego arrastra en el plano.
                CCTV: {CAMERA_BRANDS.join(', ')}.
              </p>
            </button>
          ) : (
            <>
              {viewMode === 'diagrama' ? (
                <DiagramGenerator
                  cameras={project.cameras}
                  networkNodes={project.networkNodes}
                  scale={project.scale}
                  planoNombre={project.planoNombre}
                  onSelectNode={setSelectedId}
                  expanded
                />
              ) : (
                <div
                  className={`h-[min(62vh,560px)] w-full overflow-hidden rounded-xl border border-[rgba(0,242,254,0.2)] bg-black ${
                    placeMode ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                >
                  <CameraPlacementTool
                    backgroundUrl={project.planoUrl}
                    cameras={project.cameras}
                    networkNodes={project.networkNodes}
                    structures={structures}
                    sectors={sectors}
                    visionSpectrum={visionSpectrum}
                    wifiCircles={wifiCircles}
                    wifiSpectrum={wifiSpectrum}
                    soundSpectrum={soundSpectrum}
                    linkLines={linkLines}
                    cableRoutes={cableRoutes}
                    undergroundRuns={undergroundPlan.runs}
                    selectedId={selectedId}
                    placeMode={placeMode}
                    draftPoint={draftPoint}
                    draftColor={draftColor}
                    showFov={showFov}
                    showWifi={showWifi}
                    showSound={showSound}
                    showLinks={showLinks}
                    showCableRoutes={showCableRoutes}
                    showUnderground={showUnderground || sideTab === 'sub'}
                    showStructures={showStructures}
                    onAddAt={onAddAt}
                    onMove={onMove}
                    onAdjustCameraVision={adjustCameraVision}
                    metersPerNormX={project.scale.metersPerNormX}
                    metersPerNormY={project.scale.metersPerNormY}
                    nightMode={nightMode}
                    onSelect={(id) => {
                      setSelectedId(id)
                      if (project.cameras.some((c) => c.id === id)) {
                        setShowFov(true)
                        setSideTab('cctv')
                        setViewMode('plano')
                        setCalibrateMode(false)
                        setDrawStructureMaterial(null)
                        setDrawUnderground(false)
                        setUndergroundDraft(null)
                        setDrawCable(false)
                        setCableDraft(null)
                      } else if ((project.structures ?? []).some((s) => s.id === id)) {
                        setSideTab('muros')
                        setViewMode('plano')
                        setShowStructures(true)
                        setDrawStructureMaterial(null)
                        setStructureDraft(null)
                        setDrawUnderground(false)
                        setUndergroundDraft(null)
                        setDrawCable(false)
                        setCableDraft(null)
                      } else if (cableRoutes.some((r) => r.id === id)) {
                        setSideTab('cable')
                        setShowCableRoutes(true)
                        setShowUnderground(false)
                        setViewMode('plano')
                      }
                    }}
                    onCableWaypointMove={moveBreakOnRoute}
                    onCableWaypointInsert={insertBreakOnRoute}
                    onCableWaypointRemove={removeBreakOnRoute}
                    onStructureMove={onStructureMove}
                    stageRef={stageRef}
                    showZoomOverlay={false}
                    zoomControlsRef={zoomControlsRef}
                    onZoomChange={(z) => setZoomPercent(Math.round(z * 100))}
                  />
                </div>
              )}
              {viewMode === 'plano' && showFov && project.cameras.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] text-[var(--nexus-text-muted)]">
                  <span className="font-semibold uppercase tracking-wide text-white">
                    Semáforo cobertura
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    Verde · detección objetos/personas
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-yellow-400" />
                    Amarillo · más lejos
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                    Rojo · detección dudosa (con visión)
                  </span>
                </div>
              ) : null}
            </>
          )}
        </GlassCardMotion>

        {inspectorOpen ? (
        <GlassCardMotion delay={0.04} className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
            {(
              [
                ['cctv', 'CCTV'],
                ['red', 'Red'],
                ['muros', 'Muros'],
                ['cable', 'Cable'],
                ['sub', 'Sub'],
                ['norm', 'Norm'],
                ['prefs', 'Prefs'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-md px-1.5 py-1 text-[10px] font-semibold ${
                  sideTab === id
                    ? 'bg-[var(--nexus-cyan)] text-black'
                    : 'text-[var(--nexus-text-muted)]'
                }`}
                onClick={() => {
                  setSideTab(id)
                  if (id === 'sub') {
                    setShowUnderground(true)
                    setViewMode('plano')
                    setCalibrateMode(false)
                    setDrawStructureMaterial(null)
                    setStructureDraft(null)
                    setDrawCable(false)
                    setCableDraft(null)
                  } else if (id === 'cable') {
                    setShowCableRoutes(true)
                    setShowUnderground(false)
                    setViewMode('plano')
                    setCalibrateMode(false)
                    setDrawStructureMaterial(null)
                    setStructureDraft(null)
                    setDrawUnderground(false)
                    setUndergroundDraft(null)
                  } else if (id === 'muros') {
                    setViewMode('plano')
                    setCalibrateMode(false)
                    setShowStructures(true)
                    setDrawUnderground(false)
                    setUndergroundDraft(null)
                    setDrawCable(false)
                    setCableDraft(null)
                  } else {
                    setDrawStructureMaterial(null)
                    setStructureDraft(null)
                    setDrawUnderground(false)
                    setUndergroundDraft(null)
                    setDrawCable(false)
                    setCableDraft(null)
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {sideTab === 'muros' ? (
            <StructureDesigner
              structures={structures}
              drawMaterialId={drawStructureMaterial}
              draftPoint={structureDraft}
              disabled={!project.planoUrl || loading}
              showOnPlan={showStructures}
              onShowOnPlan={setShowStructures}
              onDrawMaterial={(id) => {
                setDrawStructureMaterial(id)
                setStructureDraft(null)
                setDrawUnderground(false)
                setUndergroundDraft(null)
                setDrawCable(false)
                setCableDraft(null)
                if (id) {
                  setCalibrateMode(false)
                  setViewMode('plano')
                  setShowFov(true)
                  setShowStructures(true)
                }
              }}
              onSelect={setSelectedId}
              onRemove={quitar}
            />
          ) : sideTab === 'norm' ? (
            <ComplianceValidatorPanel
              countryCode={complianceCountry}
              onCountry={(code) => {
                setComplianceCountry(code)
                setProject((p) => ({ ...p, complianceProfileId: code }))
              }}
              cameras={project.cameras}
              networkNodes={project.networkNodes}
              cableRoutes={cableRoutes}
              conduitPlans={conduitPlans}
              onSelect={setSelectedId}
            />
          ) : sideTab === 'prefs' ? (
            <NetVisionPrefsPanel
              unitSystem={project.unitSystem ?? 'metric'}
              currency={project.currency ?? 'USD'}
              distributorMarginPct={project.distributorMarginPct ?? 15}
              description={project.description ?? ''}
              client={project.client ?? ''}
              onChange={(patch) => setProject((p) => ({ ...p, ...patch }))}
            />
          ) : sideTab === 'sub' ? (
            <div className="space-y-4">
              <UndergroundCanalizationTool
                plan={undergroundPlan}
                manualSegments={undergroundSegments}
                zone={ugZone}
                terrain={ugTerrain}
                chamberMaterial={ugChamberMat}
                drawMode={drawUnderground}
                draftPoint={undergroundDraft}
                disabled={!project.planoUrl || loading}
                onZone={setUgZone}
                onTerrain={setUgTerrain}
                onChamberMaterial={setUgChamberMat}
                onDrawMode={(active) => {
                  setDrawUnderground(active)
                  setUndergroundDraft(null)
                  if (active) {
                    setCalibrateMode(false)
                    setDrawStructureMaterial(null)
                    setStructureDraft(null)
                    setDrawCable(false)
                    setCableDraft(null)
                    setShowUnderground(true)
                    setViewMode('plano')
                  }
                }}
                onSelectSegment={setSelectedId}
                onRemoveSegment={quitar}
              />
            </div>
          ) : sideTab === 'cable' ? (
            <div className="space-y-4">
              <CableRoutingEngine
                routes={cableRoutes}
                selectedRouteId={selectedCableRoute?.id ?? null}
                onSelectRoute={(routeId) => {
                  setSelectedId(routeId)
                  setShowCableRoutes(true)
                  setShowUnderground(false)
                  setViewMode('plano')
                  setSideTab('cable')
                }}
                onAddBreak={addBreakToRoute}
                onResetRoute={resetRoutePath}
                onRemoveBreak={removeLastBreakOnRoute}
                manualSegments={cableSegments}
                drawType={drawCableType}
                drawMode={drawCable}
                draftPoint={cableDraft}
                disabled={!project.planoUrl || loading}
                onDrawType={setDrawCableType}
                onDrawMode={(active) => {
                  setDrawCable(active)
                  setCableDraft(null)
                  if (active) {
                    setCalibrateMode(false)
                    setDrawStructureMaterial(null)
                    setStructureDraft(null)
                    setDrawUnderground(false)
                    setUndergroundDraft(null)
                    setShowCableRoutes(true)
                    setShowUnderground(false)
                    setViewMode('plano')
                  }
                }}
                onSelect={(id) => {
                  setSelectedId(id)
                  setSideTab('cable')
                  setShowCableRoutes(true)
                }}
                onRemoveSegment={quitar}
                onChangeSegmentType={(id, type) => {
                  setProject((p) => ({
                    ...p,
                    cableSegments: (p.cableSegments ?? []).map((s) =>
                      s.id === id ? { ...s, type } : s,
                    ),
                  }))
                }}
              />
              <div className="border-t border-white/10 pt-3">
                <ConduitCalculator
                  plans={conduitPlans}
                  onSelectNode={setSelectedId}
                />
              </div>
            </div>
          ) : sideTab === 'red' ? (
            <NetworkDesigner
              nodes={project.networkNodes}
              defaultModels={defaultNetModels}
              poeRows={poeAnalysis.rows}
              linkAdvice={linkAdvice}
              disabled={!project.planoUrl || loading}
              onAddKind={(kind) => {
                setDrawStructureMaterial(null)
                setStructureDraft(null)
                setCalibrateMode(false)
                addNetworkFromButton(kind)
              }}
              onDefaultModel={(kind, modelId) =>
                setDefaultNetModels((m) => ({ ...m, [kind]: modelId }))
              }
              onOptimizeChannels={() =>
                setProject((p) => ({
                  ...p,
                  networkNodes: optimizeApChannels(p.networkNodes, p.scale),
                }))
              }
              onAutoAssignPoe={() =>
                setProject((p) => ({
                  ...p,
                  networkNodes: autoAssignCamerasToPoe(
                    p.cameras,
                    p.networkNodes,
                    p.scale,
                  ),
                }))
              }
              onSelectNode={setSelectedId}
              onRemoveNode={quitar}
            />
          ) : (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
                Inspector CCTV
              </h2>
              <button
                type="button"
                disabled={!project.planoUrl || loading}
                onClick={addCameraFromButton}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--nexus-cyan)] px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
              >
                <Camera className="h-3.5 w-3.5" />
                + Agregar cámara
              </button>
              <p className="text-[10px] text-[var(--nexus-text-dim)]">
                La cámara se agrega al plano; arrástrala para ubicarla. Modelo por defecto del
                selector de la barra.
              </p>
              {selectedCam ? (
                <div className="space-y-2 text-xs">
                  <label className="block">
                    <span className="text-[var(--nexus-text-dim)]">Etiqueta</span>
                    <input
                      value={selectedCam.label}
                      onChange={(e) => updateSelectedCam({ label: e.target.value })}
                      className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[var(--nexus-text-dim)]">Modelo</span>
                    <select
                      value={selectedCam.modelId}
                      onChange={(e) =>
                        updateSelectedCam({
                          modelId: e.target.value,
                          fovDeg: undefined,
                          rangeM: undefined,
                        })
                      }
                      className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                    >
                      {cameraCatalogGrouped().map((g) => (
                        <optgroup key={g.brand} label={g.brand}>
                          {g.models.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <p className="text-[10px] text-[var(--nexus-text-dim)]">
                    Marcas: {CAMERA_BRANDS.join(' · ')}
                  </p>
                  {(() => {
                    const mode = nightMode ? 'night' : 'day'
                    const vision = effectiveCameraVision(selectedCam, mode)
                    const lenses = effectiveCameraLenses(selectedCam, mode)
                    const isDual = lenses.length >= 2
                    const model = getCameraModelOrDefault(selectedCam.modelId)
                    const bands = visionBandRangesM(vision.rangeM)
                    const dualSummary = isDual
                      ? lenses
                          .map(
                            (l) =>
                              `${l.label.split(' ')[0]} ${l.fovDeg}°/${formatLength(l.rangeM, project.unitSystem ?? 'metric')}`,
                          )
                          .join(' · ')
                      : `${vision.yawDeg}° · FOV ${vision.fovDeg}° · ${formatLength(vision.rangeM, project.unitSystem ?? 'metric')}`
                    return (
                      <NetVisionCollapsible
                        title="Óptica · orientación / FOV / alcance"
                        summary={
                          isDual
                            ? `${vision.yawDeg}° · Dual · ${dualSummary}`
                            : dualSummary
                        }
                        defaultOpen={false}
                      >
                        {isDual ? (
                          <div className="space-y-1.5 rounded-lg border border-orange-400/25 bg-orange-400/5 px-2 py-1.5 text-[10px]">
                            <p className="font-semibold uppercase tracking-wide text-orange-200">
                              Dual · 2 espectros en el plano
                            </p>
                            {lenses.map((l) => (
                              <p
                                key={l.lensId}
                                className={
                                  l.lensId === 'tele'
                                    ? 'text-orange-200'
                                    : 'text-[var(--nexus-cyan)]'
                                }
                              >
                                {l.lensId === 'tele' ? 'Naranja' : 'Cyan'} · {l.label}: FOV{' '}
                                {l.fovDeg}° ·{' '}
                                {formatLength(l.rangeM, project.unitSystem ?? 'metric')}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
                          Espectro de visión · semáforo
                          {isDual ? ' (gran angular)' : ''}
                        </p>
                        <ul className="space-y-0.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-[10px]">
                          <li className="flex items-center gap-1.5 text-emerald-300">
                            <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                            0–
                            {formatLength(bands.greenMaxM, project.unitSystem ?? 'metric')} ·
                            detección objetos/personas
                          </li>
                          <li className="flex items-center gap-1.5 text-yellow-200">
                            <span className="h-2 w-2 rounded-sm bg-yellow-400" />
                            {formatLength(bands.greenMaxM, project.unitSystem ?? 'metric')}–
                            {formatLength(bands.yellowMaxM, project.unitSystem ?? 'metric')} · más
                            lejos
                          </li>
                          <li className="flex items-center gap-1.5 text-red-300">
                            <span className="h-2 w-2 rounded-sm bg-red-500" />
                            {formatLength(bands.yellowMaxM, project.unitSystem ?? 'metric')}–
                            {formatLength(bands.redMaxM, project.unitSystem ?? 'metric')} ·
                            detección dudosa
                          </li>
                        </ul>
                        <label className="block">
                          <span className="text-[var(--nexus-text-dim)]">
                            Orientación {vision.yawDeg}°
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={359}
                            value={vision.yawDeg}
                            onChange={(e) =>
                              updateSelectedCam({ yawDeg: Number(e.target.value) })
                            }
                            className="mt-1 w-full"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[var(--nexus-text-dim)]">
                            Apertura FOV {vision.fovDeg}°
                            {isDual ? ' · gran angular' : ''}
                            {selectedCam.fovDeg == null ? ' · catálogo' : ''}
                          </span>
                          <input
                            type="range"
                            min={20}
                            max={170}
                            value={vision.fovDeg}
                            onChange={(e) =>
                              updateSelectedCam({ fovDeg: Number(e.target.value) })
                            }
                            className="mt-1 w-full"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[var(--nexus-text-dim)]">
                            Alcance{' '}
                            {formatLength(vision.rangeM, project.unitSystem ?? 'metric')}
                            {isDual ? ' · gran angular' : ''}
                            {selectedCam.rangeM == null ? ' · catálogo' : ''}
                            {nightMode ? ' · noche' : ' · día'}
                          </span>
                          <input
                            type="range"
                            min={2}
                            max={120}
                            step={0.5}
                            value={vision.rangeM}
                            onChange={(e) =>
                              updateSelectedCam({ rangeM: Number(e.target.value) })
                            }
                            className="mt-1 w-full"
                          />
                        </label>
                        <button
                          type="button"
                          className="text-[10px] text-[var(--nexus-text-muted)] underline"
                          onClick={() =>
                            updateSelectedCam({ fovDeg: undefined, rangeM: undefined })
                          }
                        >
                          Restaurar FOV/alcance del modelo ({model.fovDeg}° /{' '}
                          {nightMode ? model.rangeNightM : model.rangeDayM} m)
                        </button>
                        <p className="text-[10px] text-[var(--nexus-text-dim)]">
                          En el plano: punto cyan = orientación/alcance; laterales = apertura.
                          {isDual
                            ? ' Dual: cono cyan (angular) + naranja (tele).'
                            : ''}
                          {` · ${model.poeWatts} W · ${model.bitrateMbps} Mbps`}
                        </p>
                      </NetVisionCollapsible>
                    )
                  })()}
                  <Button
                    type="button"
                    variant="glass"
                    className="w-full"
                    onClick={() => quitar(selectedCam.id)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Quitar cámara
                  </Button>
                </div>
              ) : selectedStructure ? (
                <div className="space-y-2 text-xs">
                  <p className="text-[10px] uppercase text-[var(--nexus-text-dim)]">
                    Estructura · {getStructureMaterialOrDefault(selectedStructure.materialId).label}
                  </p>
                  <p className="font-semibold text-white">{selectedStructure.label}</p>
                  <p className="text-[10px] text-[var(--nexus-text-dim)]">
                    {(() => {
                      const m = getStructureMaterialOrDefault(selectedStructure.materialId)
                      return m.blocksVision
                        ? `Corta visión · WiFi −${m.wifiLossDb} dB · Sonido −${m.soundLossDb} dB`
                        : `Transparente · WiFi −${m.wifiLossDb} dB · Sonido −${m.soundLossDb} dB`
                    })()}
                  </p>
                  <Button
                    type="button"
                    variant="glass"
                    className="w-full"
                    onClick={() => quitar(selectedStructure.id)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Quitar estructura
                  </Button>
                </div>
              ) : selectedNet ? (
                <div className="space-y-2 text-xs">
                  <p className="text-[10px] uppercase text-[var(--nexus-text-dim)]">
                    Nodo red · {selectedNet.kind}
                  </p>
                  <label className="block">
                    <span className="text-[var(--nexus-text-dim)]">Etiqueta</span>
                    <input
                      value={selectedNet.label}
                      onChange={(e) => updateSelectedNet({ label: e.target.value })}
                      className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[var(--nexus-text-dim)]">Modelo</span>
                    <select
                      value={selectedNet.modelId}
                      onChange={(e) => updateSelectedNet({ modelId: e.target.value })}
                      className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                    >
                      {networkCatalogByKind(selectedNet.kind).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.brand} · {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[10px] text-[var(--nexus-text-dim)]">
                    {(() => {
                      const m = getNetworkModelOrDefault(
                        selectedNet.modelId,
                        selectedNet.kind,
                      )
                      return `${m.poeBudgetW} W PoE · ${m.poePorts} puertos · $${m.priceUsd}`
                    })()}
                  </p>
                  <Button
                    type="button"
                    variant="glass"
                    className="w-full"
                    onClick={() => quitar(selectedNet.id)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Quitar nodo
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-[var(--nexus-text-dim)]">
                  Selecciona una cámara, nodo de red o muro.
                </p>
              )}
            </>
          )}

          {inspectorFooter}
        </GlassCardMotion>
        ) : null}
      </div>
    </div>
  )
}
