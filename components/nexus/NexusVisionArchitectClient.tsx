'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import type Konva from 'konva'
import Link from 'next/link'
import {
  BookOpen,
  Camera,
  ChevronDown,
  Download,
  FilePlus,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/nexus/ui/button'
import { GlassCardMotion } from '@/components/nexus/GlassCard'
import { Mono } from '@/components/nexus/Mono'
import { useRegisterNexusRightPanel } from '@/components/nexus/NexusRightPanelContext'
import BOMGenerator from '@/components/netvision/BOMGenerator'
import NetVisionBranchNav, {
  type NetVisionBranchId,
} from '@/components/netvision/NetVisionBranchNav'
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
import NetVisionSelectedProps from '@/components/netvision/NetVisionSelectedProps'
import ComplianceValidatorPanel from '@/components/netvision/ComplianceValidator'
import ValidationEngine from '@/components/netvision/ValidationEngine'
import {
  CAMERA_BRANDS,
  DEFAULT_CAMERA_MODEL_ID,
  cameraCatalogGrouped,
  cameraCatalogOptionLabel,
  cameraVisionSummary,
  effectiveCameraLenses,
  effectiveCameraVision,
  catalogVisionDefaults,
  cameraPatchForLens,
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
  PLAN_DISCIPLINE_LABEL,
  PLAN_KIND_LABEL,
  defaultPlanDeviceId,
  getPlanDeviceModelOrDefault,
  labelPrefixForPlanKind,
  planDeviceKinds,
  planDevicesByDiscipline,
} from '@/lib/netvision/catalog/planDevices'
import {
  defaultNetworkPlanSize,
} from '@/lib/netvision/utils/networkNodeSize'
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
import {
  buildApCoverageSectors,
  buildPlanDeviceSectors,
} from '@/lib/netvision/services/planDeviceCoverage'
import { STRUCTURE_MATERIALS } from '@/lib/netvision/catalog/materials'
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
  DRAWABLE_CABLE_TYPES,
  cableTypeLabel,
} from '@/lib/netvision/services/cableCalculator'
import {
  planConduits,
  validateConduits,
} from '@/lib/netvision/services/conduitCalculator'
import {
  buildUndergroundPlan,
  validateUnderground,
  withManualUndergroundSegments,
  zoneLabel,
  type ChamberMaterial,
  type TerrainType,
  type ZoneType,
} from '@/lib/netvision/services/canalizationCalculator'
import {
  complianceValidator,
  designFromRoutes,
  listCountries,
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
  DesignPlanDevice,
  DesignStructure,
  DesignUndergroundSegment,
  NetVisionProject,
  NetworkNodeKind,
  PlanDeviceKind,
  PlanDiscipline,
  StructureMaterialId,
} from '@/lib/netvision/types'
import { snapOrtho90 } from '@/lib/netvision/utils/structureDraw'
import {
  sanitizeCablePoints,
  snapCableDrawPoint,
} from '@/lib/netvision/utils/cableDraw'
import { downloadDataUrl } from '@/lib/netvision/utils/exporters'
import { downloadNetVisionPlanPdf } from '@/lib/netvision/utils/exportPlanPdf'
import {
  rotateNormPoint,
  rotatePlanoDataUrl90,
  rotateProjectGeometry,
  type PlanoRotateDir,
} from '@/lib/netvision/utils/rotatePlano'
import { FOV_PRESETS_DEG, RANGE_PRESETS_M } from '@/lib/netvision/utils/visionAdjust'
import {
  DEFAULT_MOUNT_HEIGHT_M,
  DEFAULT_TILT_DEG,
  projectGroundCoverage,
} from '@/lib/netvision/utils/cameraMount'
import {
  detectWallsFromPdfBytes,
  structuresFromWallDetection,
  summarizePdfDetection,
} from '@/lib/netvision/detectWallsFromPdf'
import type { NetVisionZoomControls } from '@/components/netvision/CameraPlacementTool'
import { renderPdfFirstPageFromBytes } from '@/lib/netvision/utils/renderPdfPlano'
import {
  extractPdfDimensionsFromBytes,
  pickDimensionForSegment,
  rotatePlanoDimensions,
  type PlanoDimension,
} from '@/lib/netvision/utils/extractPdfDimensions'
import {
  popProjectHistory,
  pushProjectHistory,
} from '@/lib/netvision/utils/projectHistory'

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

function rotateStructuresCwQuarters(
  structures: DesignStructure[],
  quarters: number,
): DesignStructure[] {
  const q = ((quarters % 4) + 4) % 4
  if (q === 0) return structures
  return structures.map((s) => {
    let a = { x: s.x1, y: s.y1 }
    let b = { x: s.x2, y: s.y2 }
    for (let i = 0; i < q; i++) {
      a = rotateNormPoint(a.x, a.y, 'cw')
      b = rotateNormPoint(b.x, b.y, 'cw')
    }
    return { ...s, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  })
}

export default function NexusVisionArchitectClient() {
  const [project, setProject] = useState<NetVisionProject>(() => emptyProject())
  const [hydrated, setHydrated] = useState(false)
  const [showFov, setShowFov] = useState(true)
  const [showWifi, setShowWifi] = useState(false)
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
  const [cableDraftPoints, setCableDraftPoints] = useState<
    { x: number; y: number }[]
  >([])
  const [cableCursor, setCableCursor] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [drawCableType, setDrawCableType] = useState<CableType>('CAT6')

  const clearCableDraft = useCallback(() => {
    setCableDraftPoints([])
    setCableCursor(null)
  }, [])

  const cableMagnetPoints = useMemo(
    () => [
      ...project.cameras.map((c) => ({ x: c.x, y: c.y })),
      ...project.networkNodes.map((n) => ({ x: n.x, y: n.y })),
      ...(project.planDevices ?? []).map((d) => ({ x: d.x, y: d.y })),
    ],
    [project.cameras, project.networkNodes, project.planDevices],
  )
  const [ugZone, setUgZone] = useState<ZoneType>('vehicle')
  const [ugTerrain, setUgTerrain] = useState<TerrainType>('medium')
  const [ugChamberMat, setUgChamberMat] = useState<ChamberMaterial>('polietileno')
  const [nightMode, setNightMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const pdfBytesRef = useRef<Uint8Array | null>(null)
  const pdfRotateQuartersRef = useRef(0)
  const [canDetectPdfWalls, setCanDetectPdfWalls] = useState(false)
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
  const [calibCursor, setCalibCursor] = useState<{ x: number; y: number } | null>(null)
  const [calibMeters, setCalibMeters] = useState('10')
  const [planoDims, setPlanoDims] = useState<PlanoDimension[]>([])
  const [sideTab, setSideTab] = useState<NetVisionBranchId>('cctv')
  const [redFocusKind, setRedFocusKind] = useState<NetworkNodeKind>('switch')
  const [headerNavEl, setHeaderNavEl] = useState<HTMLElement | null>(null)
  /** Panel derecho (inspector): visible por defecto; se oculta con el botón. */
  const [inspectorOpen, setInspectorOpen] = useState(false)
  /** Menú desplegable con todas las cámaras del plano. */
  const [camerasMenuOpen, setCamerasMenuOpen] = useState(false)
  const [defaultPlanModels, setDefaultPlanModels] = useState<
    Record<PlanDiscipline, string>
  >({
    sonido: defaultPlanDeviceId('sonido'),
    domotica: defaultPlanDeviceId('domotica'),
    electrico: defaultPlanDeviceId('electrico'),
  })
  const [planFocusKind, setPlanFocusKind] = useState<PlanDeviceKind>('speaker')
  useRegisterNexusRightPanel(inspectorOpen, setInspectorOpen)
  const [viewMode, setViewMode] = useState<'plano' | 'diagrama'>('plano')
  const [complianceCountry, setComplianceCountry] = useState('VE')
  const fileRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const zoomControlsRef = useRef<NetVisionZoomControls | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [canUndo, setCanUndo] = useState(false)
  const historyRef = useRef<NetVisionProject[]>([])
  const lastProjectRef = useRef<NetVisionProject | null>(null)
  const undoApplyingRef = useRef(false)

  useEffect(() => {
    setHeaderNavEl(document.getElementById('netvision-header-nav'))
  }, [])

  useEffect(() => {
    if (!camerasMenuOpen) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      const roots = document.querySelectorAll('[data-cameras-menu]')
      for (const root of roots) {
        if (root.contains(t)) return
      }
      setCamerasMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [camerasMenuOpen])

  useEffect(() => {
    if (project.cameras.length === 0) setCamerasMenuOpen(false)
  }, [project.cameras.length])

  useEffect(() => {
    const p = loadProject()
    setProject(p)
    if (p.complianceProfileId) setComplianceCountry(p.complianceProfileId)
    setCalibMeters(defaultCalibrationInput(p.unitSystem ?? 'metric'))
    lastProjectRef.current = p
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveProject(project)
  }, [project, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (undoApplyingRef.current) {
      undoApplyingRef.current = false
      lastProjectRef.current = project
      return
    }
    const prev = lastProjectRef.current
    if (prev && prev !== project) {
      historyRef.current = pushProjectHistory(historyRef.current, prev)
      setCanUndo(historyRef.current.length > 0)
    }
    lastProjectRef.current = project
  }, [hydrated, project])

  const undoLast = useCallback(() => {
    const { rest, restored } = popProjectHistory(historyRef.current)
    if (!restored) return
    historyRef.current = rest
    setCanUndo(rest.length > 0)
    undoApplyingRef.current = true
    setProject(restored)
    setCalibrateMode(false)
    setCalibPoints([])
    setCalibCursor(null)
    setDrawStructureMaterial(null)
    setStructureDraft(null)
    setDrawUnderground(false)
    setUndergroundDraft(null)
    setDrawCable(false)
    clearCableDraft()
    setError(null)
    setInfo('Se deshizo el último cambio.')
  }, [clearCableDraft])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'z' || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      undoLast()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoLast])

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

  /** Escape / Enter: cable polilínea y muros. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cableDraftPoints.length > 0) {
          clearCableDraft()
          e.preventDefault()
          return
        }
        if (drawCable) {
          setDrawCable(false)
          clearCableDraft()
          e.preventDefault()
          return
        }
        if (structureDraft) {
          setStructureDraft(null)
          e.preventDefault()
        }
        return
      }
      if (
        (e.key === 'Enter' || e.key === ' ') &&
        drawCable &&
        cableDraftPoints.length >= 2
      ) {
        e.preventDefault()
        const points = sanitizeCablePoints(cableDraftPoints)
        if (points.length < 2) return
        addCableSegmentFromPoints(drawCableType, points)
        clearCableDraft()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // addCableSegmentFromPoints is stable enough via closure on project length
  }, [
    structureDraft,
    cableDraftPoints,
    drawCable,
    drawCableType,
    clearCableDraft,
  ])

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
    () => buildWifiCoverage(project.networkNodes, project.scale, structures),
    [project.networkNodes, project.scale, structures],
  )

  const wifiSpectrum = useMemo(
    () => buildWifiSpectrum(project.networkNodes, project.scale, structures),
    [project.networkNodes, project.scale, structures],
  )

  const planDevices = project.planDevices ?? []

  const soundSpectrum = useMemo(
    () =>
      buildSoundSpectrum(
        project.cameras,
        project.scale,
        structures,
        28,
        8,
        planDevices
          .filter((d) => d.discipline === 'sonido')
          .map((d) => ({
            x: d.x,
            y: d.y,
            rangeM:
              d.rangeM ??
              getPlanDeviceModelOrDefault(d.modelId, 'sonido').rangeM,
          })),
      ),
    [project.cameras, project.scale, structures, planDevices],
  )

  const planSectors = useMemo(() => {
    if (sideTab === 'sonido' || sideTab === 'domotica' || sideTab === 'electrico') {
      return buildPlanDeviceSectors(
        planDevices,
        project.scale,
        structures,
        sideTab,
      )
    }
    if (sideTab === 'internet') {
      return buildApCoverageSectors(
        project.networkNodes,
        (n) => getNetworkModelOrDefault(n.modelId, 'ap').wifiRangeM || 12,
        project.scale,
        structures,
      )
    }
    return []
  }, [sideTab, planDevices, project.scale, project.networkNodes, structures])

  const activeSectors = sideTab === 'cctv' ? sectors : planSectors
  const showActiveCoverage =
    sideTab === 'cctv'
      ? showFov
      : sideTab === 'sonido' ||
        sideTab === 'internet' ||
        sideTab === 'domotica' ||
        sideTab === 'electrico'

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
  const selectedPlanDevice = planDevices.find((d) => d.id === selectedId) ?? null
  const selectedStructure =
    structures.find((s) => s.id === selectedId) ?? null
  const selectedManualCable =
    (project.cableSegments ?? []).find((s) => s.id === selectedId) ?? null
  const selectedUnderground =
    (project.undergroundSegments ?? []).find((s) => s.id === selectedId) ?? null
  const hasSelection = !!(
    selectedCam ||
    selectedNet ||
    selectedPlanDevice ||
    selectedStructure ||
    selectedManualCable ||
    selectedUnderground
  )

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const lower = file.name.toLowerCase()
      if (/\.(dwg|dxf|dgn)$/.test(lower)) {
        throw new Error(
          'El CAD nativo (.dwg / .dxf) no se abre aquí. En AutoCAD o Revit exporta el plano a PDF y pulsa Cargar plano.',
        )
      }
      const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf')
      let url: string
      let detected: DesignStructure[] = []
      if (isPdf) {
        const data = new Uint8Array(await file.arrayBuffer())
        pdfBytesRef.current = data.slice()
        pdfRotateQuartersRef.current = 0
        setCanDetectPdfWalls(true)
        url = await renderPdfFirstPageFromBytes(data)
        let dims: PlanoDimension[] = []
        try {
          dims = await extractPdfDimensionsFromBytes(data)
        } catch {
          dims = []
        }
        setPlanoDims(dims)
        const dimHint =
          dims.length > 0
            ? ` ${dims.length} cota(s) leídas. Pulsa Calibrar y traza una línea sobre un acotamiento.`
            : ' No se leyeron cotas de texto; al calibrar escribe los metros a mano.'
        try {
          const result = await detectWallsFromPdfBytes(data)
          detected = structuresFromWallDetection(result, { makeId: uid })
          setInfo(summarizePdfDetection(result) + dimHint)
          if (detected.length > 0) {
            setSideTab('muros')
            setShowStructures(true)
          }
        } catch {
          setInfo(
            `PDF cargado. No se pudieron leer muros vectoriales; dibújalos en Muros.${dimHint}`,
          )
        }
      } else if (file.type.startsWith('image/')) {
        pdfBytesRef.current = null
        pdfRotateQuartersRef.current = 0
        setCanDetectPdfWalls(false)
        setPlanoDims([])
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
          reader.readAsDataURL(file)
        })
      } else {
        throw new Error('Usa un PDF (exportado del CAD) o una imagen (JPG/PNG/WEBP).')
      }
      setProject((p) => ({
        ...p,
        planoUrl: url,
        planoNombre: file.name,
        cameras: [],
        networkNodes: [],
        structures: detected,
        undergroundSegments: [],
        cableSegments: [],
        cableRouteOverrides: {},
      }))
      setSelectedId(null)
      setCalibrateMode(false)
      setCalibPoints([])
      setCalibCursor(null)
      setDrawStructureMaterial(null)
      setStructureDraft(null)
      setDrawUnderground(false)
      setUndergroundDraft(null)
      setDrawCable(false)
      clearCableDraft()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el plano')
    } finally {
      setLoading(false)
    }
  }, [clearCableDraft])

  const rotatePlano = useCallback(
    async (dir: PlanoRotateDir) => {
      const url = project.planoUrl
      if (!url || loading) return
      setError(null)
      setLoading(true)
      try {
        const rotated = await rotatePlanoDataUrl90(url, dir)
        pdfRotateQuartersRef.current =
          (pdfRotateQuartersRef.current + (dir === 'cw' ? 1 : 3)) % 4
        setProject((p) => ({ ...rotateProjectGeometry(p, dir), planoUrl: rotated }))
        setCalibPoints((pts) => pts.map((pt) => rotateNormPoint(pt.x, pt.y, dir)))
        setCalibCursor((c) => (c ? rotateNormPoint(c.x, c.y, dir) : null))
        setPlanoDims((dims) => rotatePlanoDimensions(dims, dir))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo rotar el plano')
      } finally {
        setLoading(false)
      }
    },
    [project.planoUrl, loading],
  )

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
    const vision = catalogVisionDefaults(defaultModelId, nightMode ? 'night' : 'day')
    const pin: DesignCamera = {
      id: uid(),
      x: Math.round(normX * 1000) / 1000,
      y: Math.round(normY * 1000) / 1000,
      label: `CAM-${String(n).padStart(2, '0')}`,
      modelId: defaultModelId,
      yawDeg: 0,
      mountHeightM: DEFAULT_MOUNT_HEIGHT_M,
      tiltDeg: DEFAULT_TILT_DEG,
      ...vision,
    }
    setError(null)
    setProject((p) => ({ ...p, cameras: [...p.cameras, pin] }))
    setSelectedId(pin.id)
    setInspectorOpen(false)
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

  /** Elige una cámara de la lista desplegable (plano + asas / ficha). */
  const selectCameraFromMenu = (id: string, openInspector = false) => {
    setSelectedId(id)
    setSideTab('cctv')
    setShowFov(true)
    setViewMode('plano')
    setCamerasMenuOpen(false)
    setInspectorOpen(openInspector)
  }

  const toggleCamerasMenu = () => {
    setCamerasMenuOpen((open) => {
      const next = !open
      if (next) setInspectorOpen(false)
      return next
    })
  }

  const selectSideTab = useCallback(
    (id: NetVisionBranchId) => {
      setSideTab(id)
      if (id === 'cctv') {
        setShowFov(true)
        setViewMode('plano')
      } else if (id === 'sonido') {
        setViewMode('plano')
        setPlanFocusKind('speaker')
      } else if (id === 'internet') {
        setViewMode('plano')
      } else if (id === 'domotica') {
        setShowFov(true)
        setViewMode('plano')
        setPlanFocusKind('hub')
      } else if (id === 'electrico') {
        setShowFov(true)
        setViewMode('plano')
        setPlanFocusKind('panel')
      }
      if (id === 'sub') {
        setShowUnderground(true)
        setViewMode('plano')
        setCalibrateMode(false)
        setDrawStructureMaterial(null)
        setStructureDraft(null)
        setDrawCable(false)
        clearCableDraft()
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
        clearCableDraft()
      } else {
        setDrawStructureMaterial(null)
        setStructureDraft(null)
        setDrawUnderground(false)
        setUndergroundDraft(null)
        setDrawCable(false)
        clearCableDraft()
      }
    },
    [],
  )

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
      planSizeNorm: defaultNetworkPlanSize(kind),
      linkedCameraIds: [],
      wifiChannel: kind === 'ap' ? 36 : undefined,
    }
    setError(null)
    setProject((p) => ({ ...p, networkNodes: [...p.networkNodes, node] }))
    setSelectedId(node.id)
    setInspectorOpen(false)
    setSideTab('internet')
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

  const addPlanDeviceAt = (
    discipline: PlanDiscipline,
    kind: PlanDeviceKind,
    normX: number,
    normY: number,
  ) => {
    if (!project.planoUrl) return
    const modelId =
      defaultPlanModels[discipline] &&
      getPlanDeviceModelOrDefault(defaultPlanModels[discipline], discipline).kind === kind
        ? defaultPlanModels[discipline]
        : planDevicesByDiscipline(discipline).find((m) => m.kind === kind)?.id ??
          defaultPlanDeviceId(discipline)
    const model = getPlanDeviceModelOrDefault(modelId, discipline)
    const count = planDevices.filter((d) => d.kind === model.kind).length + 1
    const prefix = labelPrefixForPlanKind(model.kind)
    const device: DesignPlanDevice = {
      id: uid(),
      x: Math.round(normX * 1000) / 1000,
      y: Math.round(normY * 1000) / 1000,
      label: `${prefix}-${String(count).padStart(2, '0')}`,
      discipline: model.discipline,
      kind: model.kind,
      modelId: model.id,
      yawDeg: 0,
    }
    setError(null)
    setProject((p) => ({
      ...p,
      planDevices: [...(p.planDevices ?? []), device],
    }))
    setSelectedId(device.id)
    setInspectorOpen(false)
    setSideTab(discipline)
    setViewMode('plano')
    setCalibrateMode(false)
    setCalibPoints([])
    setDrawStructureMaterial(null)
    setStructureDraft(null)
  }

  const addPlanDeviceFromButton = (discipline: PlanDiscipline, kind: PlanDeviceKind) => {
    if (!project.planoUrl) {
      setError('Carga un plano antes de agregar equipos.')
      return
    }
    const idx = planDevices.filter((d) => d.discipline === discipline).length
    const pos = buttonSpawnPos(idx, 0.48, 0.42)
    addPlanDeviceAt(discipline, kind, pos.x, pos.y)
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

  const addCableSegmentFromPoints = (
    type: CableType,
    rawPoints: { x: number; y: number }[],
  ) => {
    const points = sanitizeCablePoints(rawPoints)
    if (points.length < 2) {
      setError('El cable necesita al menos dos puntos.')
      return
    }
    const first = points[0]!
    const last = points[points.length - 1]!
    const n = (project.cableSegments?.length ?? 0) + 1
    const seg: DesignCableSegment = {
      id: uid(),
      label: `CAB-${String(n).padStart(2, '0')}`,
      type,
      points,
      x1: first.x,
      y1: first.y,
      x2: last.x,
      y2: last.y,
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

  const finishCableDraft = () => {
    if (cableDraftPoints.length < 2) {
      setError('Añade al menos dos puntos o pulsa Escape para cancelar.')
      return
    }
    addCableSegmentFromPoints(drawCableType, cableDraftPoints)
    clearCableDraft()
  }

  const onCalibPointerMove = (normX: number, normY: number) => {
    if (!calibrateMode) return
    const cursor = { x: normX, y: normY }
    setCalibCursor(cursor)
    const origin = calibPoints[0]
    if (!origin) return
    const hit = pickDimensionForSegment(origin, cursor, planoDims)
    if (hit) setCalibMeters(hit.label)
  }

  const onCablePointerMove = (normX: number, normY: number) => {
    if (!drawCable) return
    const from = cableDraftPoints[cableDraftPoints.length - 1] ?? null
    const snapped = snapCableDrawPoint(
      from,
      { x: normX, y: normY },
      cableMagnetPoints,
    )
    setCableCursor(snapped)
  }

  const onAddAt = (normX: number, normY: number) => {
    if (!project.planoUrl) return

    if (calibrateMode) {
      const next = [...calibPoints, { x: normX, y: normY }]
      if (next.length >= 2) {
        const a = next[0]!
        const b = next[1]!
        const hit = pickDimensionForSegment(a, b, planoDims)
        const meters = hit
          ? hit.meters
          : parseCalibrationToMeters(
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
        setCalibCursor(null)
        setCalibrateMode(false)
        if (hit) setCalibMeters(hit.label)
        setInfo(
          hit
            ? `Escala lista: ${hit.label} m según el acotamiento del plano.`
            : `Escala lista: ${formatLength(meters, project.unitSystem ?? 'metric')} (valor indicado).`,
        )
        setError(null)
      } else {
        setCalibPoints(next)
        setCalibCursor(null)
      }
      return
    }

    if (drawCable) {
      const from = cableDraftPoints[cableDraftPoints.length - 1] ?? null
      const snapped = snapCableDrawPoint(
        from,
        { x: normX, y: normY },
        cableMagnetPoints,
      )
      if (
        from &&
        Math.abs(from.x - snapped.x) + Math.abs(from.y - snapped.y) < 0.008
      ) {
        if (cableDraftPoints.length >= 2) finishCableDraft()
        return
      }
      setCableDraftPoints((pts) => [...pts, snapped])
      setCableCursor(snapped)
      setError(null)
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
      // Snap a 90° (horizontal o vertical) para esquinas ortogonales.
      const snapped = snapOrtho90(structureDraft, { x: normX, y: normY })
      const dx = Math.abs(structureDraft.x - snapped.x)
      const dy = Math.abs(structureDraft.y - snapped.y)
      if (dx + dy < 0.008) {
        setError('El segmento es demasiado corto; elige otro punto.')
        return
      }
      addStructureSegment(
        drawStructureMaterial,
        structureDraft.x,
        structureDraft.y,
        snapped.x,
        snapped.y,
      )
      // Continuar dibujando desde la esquina (muro polilínea con tramos H/V).
      setStructureDraft({ x: snapped.x, y: snapped.y })
      setError(null)
    }
  }

  const onMove = (id: string, normX: number, normY: number) => {
    const nx = Math.round(normX * 1000) / 1000
    const ny = Math.round(normY * 1000) / 1000
    setProject((p) => ({
      ...p,
      cameras: p.cameras.map((c) => (c.id === id ? { ...c, x: nx, y: ny } : c)),
      networkNodes: p.networkNodes.map((n) => (n.id === id ? { ...n, x: nx, y: ny } : n)),
      planDevices: (p.planDevices ?? []).map((d) =>
        d.id === id ? { ...d, x: nx, y: ny } : d,
      ),
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
        if ('fovLeftDeg' in patch && patch.fovLeftDeg === undefined) delete next.fovLeftDeg
        if ('fovRightDeg' in patch && patch.fovRightDeg === undefined) delete next.fovRightDeg
        if ('lensVision' in patch && patch.lensVision === undefined) delete next.lensVision
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
    patch: {
      yawDeg?: number
      fovDeg?: number
      fovLeftDeg?: number
      fovRightDeg?: number
      rangeM?: number
    },
    lensId?: string,
  ) => {
    const cam = project.cameras.find((c) => c.id === id)
    if (!cam) return
    // Dual: cada cono se ajusta por separado (la lente secundaria guarda su propio yaw/FOV/alcance).
    patchCamera(id, cameraPatchForLens(cam, lensId, patch))
  }

  const patchPlanDevice = (id: string, patch: Partial<DesignPlanDevice>) => {
    setProject((p) => ({
      ...p,
      planDevices: (p.planDevices ?? []).map((d) => {
        if (d.id !== id) return d
        const next: DesignPlanDevice = { ...d, ...patch }
        if ('rangeM' in patch && patch.rangeM === undefined) delete next.rangeM
        if ('fovDeg' in patch && patch.fovDeg === undefined) delete next.fovDeg
        return next
      }),
    }))
  }

  const patchNetworkNode = (id: string, patch: Partial<DesignNetworkNode>) => {
    setProject((p) => ({
      ...p,
      networkNodes: p.networkNodes.map((n) =>
        n.id === id ? { ...n, ...patch } : n,
      ),
    }))
  }

  const patchStructure = (id: string, patch: Partial<DesignStructure>) => {
    setProject((p) => ({
      ...p,
      structures: (p.structures ?? []).map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    }))
  }

  const patchCableType = (id: string, type: CableType) => {
    setProject((p) => ({
      ...p,
      cableSegments: (p.cableSegments ?? []).map((s) =>
        s.id === id ? { ...s, type } : s,
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
        planDevices: (p.planDevices ?? []).filter((d) => d.id !== id),
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
    setInfo(null)
    pdfBytesRef.current = null
    pdfRotateQuartersRef.current = 0
    setCanDetectPdfWalls(false)
    setPlanoDims([])
    setCalibCursor(null)
  }

  const detectWallsFromLoadedPdf = useCallback(async () => {
    const data = pdfBytesRef.current
    if (!data || !project.planoUrl || loading) return
    if ((project.structures?.length ?? 0) > 0) {
      const ok = window.confirm(
        'Esto reemplaza los muros, puertas y ventanas actuales por los detectados en el PDF. ¿Continuar?',
      )
      if (!ok) return
    }
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const result = await detectWallsFromPdfBytes(data)
      const detected = rotateStructuresCwQuarters(
        structuresFromWallDetection(result, { makeId: uid }),
        pdfRotateQuartersRef.current,
      )
      setInfo(summarizePdfDetection(result))
      setProject((p) => ({ ...p, structures: detected }))
      setSelectedId(null)
      if (detected.length > 0) {
        setSideTab('muros')
        setShowStructures(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron detectar muros del PDF')
    } finally {
      setLoading(false)
    }
  }, [loading, project.planoUrl, project.structures?.length])

  const switchToProject = (p: NetVisionProject) => {
    setProject(p)
    setSelectedId(null)
    setComplianceCountry(p.complianceProfileId || 'VE')
    setCalibPoints([])
    setCalibrateMode(false)
    setCalibMeters(defaultCalibrationInput(p.unitSystem ?? 'metric'))
    setError(null)
    setInfo(null)
    pdfBytesRef.current = null
    pdfRotateQuartersRef.current = 0
    setCanDetectPdfWalls(false)
    setPlanoDims([])
    setCalibCursor(null)
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
  const draftPoint =
    cableDraftPoints.length > 0
      ? cableDraftPoints[cableDraftPoints.length - 1]!
      : undergroundDraft ?? structureDraft
  const draftColor = calibrateMode
    ? '#a3e635'
    : drawCable || cableDraftPoints.length > 0
      ? '#facc15'
      : undergroundDraft || drawUnderground
        ? '#fb923c'
        : '#22d3ee'
  const draftLabel =
    calibrateMode && calibPoints.length >= 1
      ? `${calibMeters} m`
      : null

  const chipClass = (active: boolean) =>
    `rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-40 ${
      active
        ? 'bg-[var(--nexus-cyan)] text-black'
        : 'border border-white/15 text-[var(--nexus-text-muted)]'
    }`

  const branchSubmenu = (() => {
    if (sideTab === 'cctv') {
      const modelValue = selectedCam?.modelId ?? defaultModelId
      return (
        <>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
            {selectedCam ? 'Modelo seleccionado' : 'Tipo de cámara'}
          </span>
          <select
            value={modelValue}
            onChange={(e) => {
              const id = e.target.value
              if (selectedCam) {
                const vision = catalogVisionDefaults(id, nightMode ? 'night' : 'day')
                updateSelectedCam({
                  modelId: id,
                  ...vision,
                })
              } else {
                setDefaultModelId(id)
              }
            }}
            className="max-w-[min(100%,280px)] rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white"
            title="Tipo / modelo de cámara"
          >
            {cameraCatalogGrouped().map((g) => (
              <optgroup key={g.brand} label={g.brand}>
                {g.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {cameraCatalogOptionLabel(m)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            disabled={!project.planoUrl || loading}
            className={chipClass(false)}
            onClick={addCameraFromButton}
          >
            + Cámara
          </button>
          {!selectedCam ? (
            <span className="text-[10px] text-[var(--nexus-text-dim)]">
              Coloca primero · configura al tocar
            </span>
          ) : null}
        </>
      )
    }
    if (sideTab === 'sonido' || sideTab === 'domotica' || sideTab === 'electrico') {
      const kinds = planDeviceKinds(sideTab)
      const focus =
        kinds.includes(planFocusKind) ? planFocusKind : kinds[0]!
      return (
        <>
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              disabled={!project.planoUrl || loading}
              className={chipClass(focus === k)}
              onClick={() => {
                setPlanFocusKind(k)
                setDrawStructureMaterial(null)
                setStructureDraft(null)
                setCalibrateMode(false)
                addPlanDeviceFromButton(sideTab, k)
              }}
            >
              + {PLAN_KIND_LABEL[k]}
            </button>
          ))}
          <select
            value={
              selectedPlanDevice?.discipline === sideTab
                ? selectedPlanDevice.modelId
                : defaultPlanModels[sideTab]
            }
            onChange={(e) => {
              const id = e.target.value
              const model = getPlanDeviceModelOrDefault(id, sideTab)
              setDefaultPlanModels((m) => ({ ...m, [sideTab]: id }))
              setPlanFocusKind(model.kind)
              if (selectedPlanDevice?.discipline === sideTab) {
                patchPlanDevice(selectedPlanDevice.id, {
                  modelId: model.id,
                  kind: model.kind,
                  rangeM: undefined,
                  fovDeg: undefined,
                })
              }
            }}
            className="max-w-[min(100%,240px)] rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white"
            title={`Modelo ${PLAN_DISCIPLINE_LABEL[sideTab]}`}
          >
            {planDevicesByDiscipline(sideTab).map((m) => (
              <option key={m.id} value={m.id}>
                {PLAN_KIND_LABEL[m.kind]} · {m.brand} {m.name}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-[var(--nexus-text-dim)]">
            Coloca en el plano · toca para configurar
          </span>
        </>
      )
    }
    if (sideTab === 'internet') {
      const kinds: { kind: NetworkNodeKind; label: string }[] = [
        { kind: 'switch', label: 'Switch' },
        { kind: 'ap', label: 'AP' },
        { kind: 'nvr', label: 'NVR' },
        { kind: 'injector', label: 'Injector' },
      ]
      return (
        <>
          {kinds.map((k) => (
            <button
              key={k.kind}
              type="button"
              disabled={!project.planoUrl || loading}
              className={chipClass(redFocusKind === k.kind)}
              onClick={() => {
                setRedFocusKind(k.kind)
                setDrawStructureMaterial(null)
                setStructureDraft(null)
                setCalibrateMode(false)
                addNetworkFromButton(k.kind)
              }}
            >
              + {k.label}
            </button>
          ))}
          <select
            value={defaultNetModels[redFocusKind]}
            onChange={(e) =>
              setDefaultNetModels((m) => ({ ...m, [redFocusKind]: e.target.value }))
            }
            className="max-w-[min(100%,240px)] rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white"
            title={`Modelo ${redFocusKind}`}
          >
            {networkCatalogByKind(redFocusKind).map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand} · {m.name}
              </option>
            ))}
          </select>
        </>
      )
    }
    if (sideTab === 'muros') {
      return (
        <>
          {STRUCTURE_MATERIALS.map((m) => {
            const active = drawStructureMaterial === m.id
            return (
              <button
                key={m.id}
                type="button"
                disabled={!project.planoUrl || loading}
                className={chipClass(active)}
                style={!active ? { borderColor: `${m.color}66`, color: m.color } : undefined}
                onClick={() => {
                  const next = active ? null : m.id
                  setDrawStructureMaterial(next)
                  setStructureDraft(null)
                  setDrawUnderground(false)
                  setUndergroundDraft(null)
                  setDrawCable(false)
                  clearCableDraft()
                  if (next) {
                    setCalibrateMode(false)
                    setViewMode('plano')
                    setShowFov(true)
                    setShowStructures(true)
                  }
                }}
              >
                + {m.label}
              </button>
            )
          })}
        </>
      )
    }
    if (sideTab === 'cable') {
      return (
        <>
          {DRAWABLE_CABLE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={!project.planoUrl || loading}
              className={chipClass(drawCable && drawCableType === t)}
              onClick={() => {
                const activate = !(drawCable && drawCableType === t)
                setDrawCableType(t)
                setDrawCable(activate)
                clearCableDraft()
                if (activate) {
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
            >
              {cableTypeLabel(t)}
            </button>
          ))}
          {drawCable && cableDraftPoints.length >= 2 ? (
            <button
              type="button"
              className="rounded-md bg-yellow-400 px-2 py-1 text-[11px] font-semibold text-black"
              onClick={() => finishCableDraft()}
            >
              Terminar cable
            </button>
          ) : null}
        </>
      )
    }
    if (sideTab === 'sub') {
      const zones: ZoneType[] = ['pedestrian', 'vehicle', 'road_crossing', 'railway']
      return (
        <>
          <button
            type="button"
            disabled={!project.planoUrl || loading}
            className={chipClass(drawUnderground)}
            onClick={() => {
              const active = !drawUnderground
              setDrawUnderground(active)
              setUndergroundDraft(null)
              if (active) {
                setCalibrateMode(false)
                setDrawStructureMaterial(null)
                setStructureDraft(null)
                setDrawCable(false)
                clearCableDraft()
                setShowUnderground(true)
                setViewMode('plano')
              }
            }}
          >
            {drawUnderground ? 'Dibujando…' : '+ Trazar'}
          </button>
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              className={chipClass(ugZone === z)}
              onClick={() => setUgZone(z)}
            >
              {zoneLabel(z)}
            </button>
          ))}
        </>
      )
    }
    if (sideTab === 'norm') {
      return (
        <>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
            País / norma
          </span>
          <select
            value={complianceCountry}
            onChange={(e) => {
              const code = e.target.value
              setComplianceCountry(code)
              setProject((p) => ({ ...p, complianceProfileId: code }))
            }}
            className="max-w-[min(100%,220px)] rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white"
          >
            {listCountries().map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </>
      )
    }
    // ajustes
    return (
      <>
        <button
          type="button"
          className={chipClass((project.unitSystem ?? 'metric') === 'metric')}
          onClick={() => setProject((p) => ({ ...p, unitSystem: 'metric' }))}
        >
          Métrico
        </button>
        <button
          type="button"
          className={chipClass(project.unitSystem === 'imperial')}
          onClick={() => setProject((p) => ({ ...p, unitSystem: 'imperial' }))}
        >
          Imperial
        </button>
        {(['USD', 'VES', 'EUR'] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={chipClass((project.currency ?? 'USD') === c)}
            onClick={() => setProject((p) => ({ ...p, currency: c }))}
          >
            {c}
          </button>
        ))}
      </>
    )
  })()

  const openPlanoPicker = () => fileRef.current?.click()

  const archivoMenu = (
    <>
      <Button
        type="button"
        variant="glass"
        size="sm"
        className="w-full justify-start"
        onClick={openPlanoPicker}
        disabled={loading}
        title="PDF (exportado de CAD) o imagen JPG/PNG"
      >
        <Upload className="mr-1.5 h-3.5 w-3.5" />
        {loading ? 'Cargando…' : 'Cargar plano'}
      </Button>
      <Button
        type="button"
        variant="glass"
        size="sm"
        className="w-full justify-start"
        onClick={limpiarPlano}
        disabled={!project.planoUrl}
      >
        <FilePlus className="mr-1.5 h-3.5 w-3.5" />
        Nuevo plano
      </Button>
      <div className="w-full">
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
        className="w-full justify-start"
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
        className="w-full justify-start"
        onClick={() => void exportPdf()}
        disabled={!project.planoUrl || exportingPdf}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {exportingPdf ? 'PDF…' : 'PDF'}
      </Button>
      <Button type="button" variant="glass" size="sm" className="w-full justify-start" asChild>
        <Link href="/nexus/vision/manual/usuario">
          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
          Manual
        </Link>
      </Button>
      {project.planoUrl && viewMode === 'plano' ? (
        <div className="mt-1 space-y-2 border-t border-white/10 pt-2">
          <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
            Vista del plano
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Rotar el plano 90° a la izquierda"
              aria-label="Rotar el plano a la izquierda"
              disabled={loading}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-white hover:bg-white/10 disabled:opacity-40"
              onClick={() => void rotatePlano('ccw')}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-[var(--nexus-cyan)]">Rotar</span>
            <button
              type="button"
              title="Rotar el plano 90° a la derecha"
              aria-label="Rotar el plano a la derecha"
              disabled={loading}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-white hover:bg-white/10 disabled:opacity-40"
              onClick={() => void rotatePlano('cw')}
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            title={layerHelpTitle('calibrate')}
            className={`w-full rounded-md px-2 py-1.5 text-left text-[11px] font-semibold ${
              calibrateMode
                ? 'bg-[var(--nexus-cyan)] text-black'
                : 'text-[var(--nexus-cyan)] hover:bg-white/5'
            }`}
            onClick={() => {
              setCalibrateMode((v) => !v)
              setCalibPoints([])
              setCalibCursor(null)
              setDrawStructureMaterial(null)
              setStructureDraft(null)
              setDrawUnderground(false)
              setUndergroundDraft(null)
              setDrawCable(false)
              clearCableDraft()
            }}
          >
            Calibrar
          </button>
          {calibrateMode ? (
            <label className="flex items-center gap-1 px-1 text-[11px] text-[var(--nexus-text-dim)]">
              {lengthUnitLabel(project.unitSystem ?? 'metric')}
              <input
                value={calibMeters}
                onChange={(e) => setCalibMeters(e.target.value)}
                className="w-14 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-xs text-white"
                title="Si el PDF trae la cota, se rellena al trazar. Si no, escríbela."
              />
              ({calibPoints.length}/2)
              {planoDims.length > 0 ? (
                <span className="text-[10px] text-lime-300/90">{planoDims.length} cotas</span>
              ) : (
                <span className="text-[10px] text-amber-200/80">sin cotas PDF</span>
              )}
            </label>
          ) : null}
          <NetVisionLayerHelp />
          <details className="rounded-md border border-white/10 bg-black/30 px-2 py-1">
            <summary className="cursor-pointer text-[11px] font-semibold text-[var(--nexus-cyan)]">
              Capas
            </summary>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pb-1">
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
              <label
                title={layerHelpTitle('invert')}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]"
              >
                <input
                  type="checkbox"
                  checked={Boolean(project.planoInvertido)}
                  disabled={!project.planoUrl || loading}
                  onChange={(e) =>
                    setProject((p) => ({ ...p, planoInvertido: e.target.checked }))
                  }
                />
                Fondo negro
              </label>
            </div>
          </details>
          <div className="flex overflow-hidden rounded-md border border-white/15 bg-black/40">
            <button
              type="button"
              title="Acercar"
              aria-label="Acercar"
              className="min-h-9 min-w-9 px-2 text-sm font-medium text-white hover:bg-white/10"
              onClick={() => zoomControlsRef.current?.zoomIn()}
            >
              +
            </button>
            <button
              type="button"
              title="Alejar"
              aria-label="Alejar"
              className="min-h-9 min-w-9 border-l border-white/15 px-2 text-sm font-medium text-white hover:bg-white/10"
              onClick={() => zoomControlsRef.current?.zoomOut()}
            >
              −
            </button>
            <button
              type="button"
              title="Restablecer zoom"
              aria-label="Restablecer zoom"
              className="min-h-9 min-w-[3rem] border-l border-white/15 px-2 text-[11px] font-medium tabular-nums text-[var(--nexus-text-muted)] hover:bg-white/10"
              onClick={() => zoomControlsRef.current?.reset()}
            >
              {zoomPercent}%
            </button>
          </div>
        </div>
      ) : null}
    </>
  )

  const fileLine = <Mono>{project.planoNombre || 'Sin plano'}</Mono>

  const workLine = (
    <>
      <div className="flex shrink-0 gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5">
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
      {viewMode === 'plano' ? (
        <button
          type="button"
          disabled={!project.planoUrl || loading}
          onClick={addCameraFromButton}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--nexus-cyan)] px-2.5 py-1 text-[11px] font-semibold text-black disabled:opacity-40"
        >
          <Camera className="h-3.5 w-3.5" />
          Cámara
        </button>
      ) : null}
      {viewMode === 'plano' && project.cameras.length > 0 ? (
        <button
          type="button"
          aria-expanded={camerasMenuOpen}
          aria-haspopup="listbox"
          title="Ver todas las cámaras del plano"
          data-cameras-menu
          onClick={toggleCamerasMenu}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
            camerasMenuOpen
              ? 'border-[var(--nexus-cyan)] bg-[var(--nexus-cyan)]/20 text-[var(--nexus-cyan)]'
              : 'border-white/15 text-[var(--nexus-text-muted)] hover:bg-white/5 hover:text-white'
          }`}
        >
          Cámaras · {project.cameras.length}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${camerasMenuOpen ? 'rotate-180' : ''}`}
          />
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
          className="inline-flex shrink-0 items-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 disabled:opacity-40"
        >
          Calcular cobertura
        </button>
      ) : null}
      <button
        type="button"
        disabled={!canUndo}
        title="Deshacer el último cambio (Ctrl+Z)"
        aria-label="Deshacer"
        onClick={undoLast}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-[var(--nexus-text-muted)] hover:bg-white/5 hover:text-white disabled:opacity-40"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Deshacer
      </button>
      {calibrateMode ? (
        <span className="shrink-0 text-[10px] font-semibold text-lime-300">
          Calibrando {calibMeters} m ({calibPoints.length}/2)
        </span>
      ) : null}
    </>
  )

  const headerNav =
    headerNavEl &&
    createPortal(
      <NetVisionBranchNav
        active={sideTab}
        onSelect={selectSideTab}
        fileLine={fileLine}
        archivo={archivoMenu}
        tools={workLine}
        submenu={branchSubmenu}
      />,
      headerNavEl,
    )

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
    <div className="flex min-h-[calc(100dvh-7.25rem)] flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.pdf,.dwg,.dxf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          e.target.value = ''
          void onFile(file)
        }}
      />
      {headerNav}

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-lg border border-[rgba(0,242,254,0.3)] bg-[rgba(0,242,254,0.08)] px-3 py-2 text-sm text-[var(--nexus-cyan)]">
          {info}
        </p>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <GlassCardMotion className="flex h-full min-h-[360px] flex-col overflow-hidden p-1.5 sm:p-2">
          {!project.planoUrl ? (
            <button
              type="button"
              onClick={openPlanoPicker}
              className="flex min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[rgba(0,242,254,0.35)] bg-[radial-gradient(ellipse_at_center,rgba(0,242,254,0.12),transparent_70%)] px-4 text-center transition hover:border-[rgba(0,242,254,0.55)]"
            >
              <Camera className="h-10 w-10 text-[var(--nexus-cyan)]" />
              <p className="text-sm font-semibold text-white">Sube el plano del inmueble</p>
              <p className="max-w-sm text-xs text-[var(--nexus-text-dim)]">
                PDF vectorial (CAD): se detectan muros, puertas y ventanas al cargar.
                Luego coloca equipos en el plano amplio y tócalos para configurarlos.
                CCTV, sonido, internet, domótica y eléctrico.
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
                  className={`h-[calc(100dvh-11.5rem)] min-h-[420px] w-full overflow-hidden rounded-xl border border-[rgba(0,242,254,0.2)] bg-black ${
                    placeMode ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                >
                  <CameraPlacementTool
                    backgroundUrl={project.planoUrl}
                    invertBackground={Boolean(project.planoInvertido)}
                    cameras={project.cameras}
                    networkNodes={project.networkNodes}
                    planDevices={planDevices}
                    structures={structures}
                    sectors={activeSectors}
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
                    draftPoints={
                      calibrateMode
                        ? calibPoints
                        : drawCable
                          ? cableDraftPoints
                          : undefined
                    }
                    draftCursor={
                      calibrateMode ? calibCursor : drawCable ? cableCursor : null
                    }
                    draftColor={draftColor}
                    draftLabel={draftLabel}
                    showFov={showActiveCoverage}
                    showWifi={showWifi && sideTab !== 'sonido' && sideTab !== 'domotica' && sideTab !== 'electrico'}
                    showSound={showSound && sideTab === 'sonido'}
                    showLinks={showLinks}
                    showCableRoutes={showCableRoutes}
                    showUnderground={showUnderground || sideTab === 'sub'}
                    showStructures={showStructures}
                    onAddAt={onAddAt}
                    onDraftPointerMove={
                      drawCable
                        ? onCablePointerMove
                        : calibrateMode
                          ? onCalibPointerMove
                          : undefined
                    }
                    onFinishPlace={drawCable ? finishCableDraft : undefined}
                    snapPlaceToDevices={drawCable}
                    onMove={onMove}
                    onAdjustCameraVision={adjustCameraVision}
                    metersPerNormX={project.scale.metersPerNormX}
                    metersPerNormY={project.scale.metersPerNormY}
                    nightMode={nightMode}
                    onInspect={() => setInspectorOpen(true)}
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
                        clearCableDraft()
                      } else if ((project.structures ?? []).some((s) => s.id === id)) {
                        setSideTab('muros')
                        setViewMode('plano')
                        setShowStructures(true)
                        setDrawStructureMaterial(null)
                        setStructureDraft(null)
                        setDrawUnderground(false)
                        setUndergroundDraft(null)
                        setDrawCable(false)
                        clearCableDraft()
                      } else if (planDevices.some((d) => d.id === id)) {
                        const dev = planDevices.find((d) => d.id === id)!
                        setSideTab(dev.discipline)
                        setViewMode('plano')
                        setCalibrateMode(false)
                        setDrawStructureMaterial(null)
                        setStructureDraft(null)
                        setDrawUnderground(false)
                        setUndergroundDraft(null)
                        setDrawCable(false)
                        clearCableDraft()
                      } else if (project.networkNodes.some((n) => n.id === id)) {
                        setSideTab('internet')
                        setViewMode('plano')
                        setCalibrateMode(false)
                        setDrawStructureMaterial(null)
                        setStructureDraft(null)
                        setDrawUnderground(false)
                        setUndergroundDraft(null)
                        setDrawCable(false)
                        clearCableDraft()
                      } else if (cableRoutes.some((r) => r.id === id)) {
                        setSideTab('cable')
                        setShowCableRoutes(true)
                        setShowUnderground(false)
                        setViewMode('plano')
                      } else if (
                        (project.undergroundSegments ?? []).some((s) => s.id === id)
                      ) {
                        setSideTab('sub')
                        setShowUnderground(true)
                        setViewMode('plano')
                        setDrawCable(false)
                        clearCableDraft()
                      }
                    }}
                    onCableWaypointMove={moveBreakOnRoute}
                    onCableWaypointInsert={insertBreakOnRoute}
                    onCableWaypointRemove={removeBreakOnRoute}
                    onStructureMove={onStructureMove}
                    onNetworkSizeChange={(id, planSizeNorm) =>
                      patchNetworkNode(id, { planSizeNorm })
                    }
                    stageRef={stageRef}
                    showZoomOverlay={false}
                    zoomControlsRef={zoomControlsRef}
                    onZoomChange={(z) => setZoomPercent(Math.round(z * 100))}
                  />
                </div>
              )}
              {viewMode === 'plano' && showActiveCoverage ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-[var(--nexus-text-muted)]">
                  <span className="font-semibold uppercase tracking-wide text-white">
                    Semáforo
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                    Verde
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-yellow-400" />
                    Amarillo
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-red-500" />
                    Rojo
                  </span>
                </div>
              ) : null}
            </>
          )}
        </GlassCardMotion>

        {project.planoUrl &&
        viewMode === 'plano' &&
        project.cameras.length > 0 &&
        !inspectorOpen ? (
          <div
            className="absolute bottom-4 left-4 z-20"
            data-cameras-menu
          >
            <button
              type="button"
              aria-expanded={camerasMenuOpen}
              aria-haspopup="listbox"
              title="Ver todas las cámaras agregadas"
              onClick={toggleCamerasMenu}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-semibold shadow-lg backdrop-blur-md ${
                camerasMenuOpen
                  ? 'border-[var(--nexus-cyan)] bg-[var(--nexus-cyan)] text-black'
                  : 'border-white/20 bg-[#071018]/90 text-[var(--nexus-cyan)]'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Cámaras · {project.cameras.length}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${camerasMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {camerasMenuOpen ? (
              <div
                role="listbox"
                aria-label="Cámaras agregadas"
                className="absolute bottom-[calc(100%+8px)] left-0 max-h-[min(50vh,320px)] w-[min(280px,80vw)] overflow-y-auto rounded-xl border border-white/15 bg-[#071018]/98 p-1.5 shadow-xl backdrop-blur-md"
              >
                <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
                  Cámaras en el plano
                </p>
                {project.cameras.map((c) => {
                  const model = getCameraModelOrDefault(c.modelId)
                  const active = selectedId === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => selectCameraFromMenu(c.id, false)}
                      className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left ${
                        active
                          ? 'bg-[var(--nexus-cyan)] text-black'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="text-[12px] font-semibold">{c.label}</span>
                      <span
                        className={`line-clamp-1 text-[10px] ${
                          active ? 'text-black/70' : 'text-[var(--nexus-text-muted)]'
                        }`}
                      >
                        {model.brand} · {model.name}
                      </span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    setCamerasMenuOpen(false)
                    setSideTab('cctv')
                    setInspectorOpen(true)
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-[var(--nexus-cyan)] hover:bg-white/5"
                >
                  Abrir inspector CCTV
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedId && !inspectorOpen && project.planoUrl && viewMode === 'plano' ? (
          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            className="absolute bottom-4 right-4 z-20 rounded-full bg-[var(--nexus-cyan)] px-3.5 py-2 text-[11px] font-semibold text-black shadow-lg"
          >
            Configurar{' '}
            {selectedCam?.label ||
              selectedNet?.label ||
              selectedPlanDevice?.label ||
              selectedStructure?.label ||
              selectedManualCable?.label ||
              selectedUnderground?.label ||
              'elemento'}
          </button>
        ) : null}

        {inspectorOpen ? (
        <div className="absolute inset-x-0 bottom-0 z-30 max-h-[min(52dvh,480px)] overflow-y-auto rounded-t-2xl border border-white/15 bg-[#071018]/96 p-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md xl:inset-y-2 xl:bottom-2 xl:left-auto xl:right-2 xl:w-[min(340px,40vw)] xl:max-h-[calc(100%-1rem)] xl:rounded-2xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-muted)]">
              Configurar elemento
            </p>
            <button
              type="button"
              onClick={() => setInspectorOpen(false)}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--nexus-cyan)] hover:bg-white/10"
            >
              Cerrar · volver al plano
            </button>
          </div>
          <NetVisionSelectedProps
            camera={selectedCam}
            network={selectedNet}
            planDevice={selectedPlanDevice}
            structure={selectedStructure}
            cable={selectedManualCable}
            nightMode={nightMode}
            unitSystem={project.unitSystem ?? 'metric'}
            onPatchCamera={(patch) => {
              if (!selectedCam) return
              patchCamera(selectedCam.id, patch)
            }}
            onPatchNetwork={(patch) => {
              if (!selectedNet) return
              patchNetworkNode(selectedNet.id, patch)
            }}
            onPatchPlanDevice={(patch) => {
              if (!selectedPlanDevice) return
              patchPlanDevice(selectedPlanDevice.id, patch)
            }}
            onPatchStructure={(patch) => {
              if (!selectedStructure) return
              patchStructure(selectedStructure.id, patch)
            }}
            onPatchCableType={(type) => {
              if (!selectedManualCable) return
              patchCableType(selectedManualCable.id, type)
            }}
            onRemove={quitar}
          />
          {selectedUnderground ? (
            <div className="space-y-2 rounded-lg border border-orange-400/30 bg-orange-400/10 p-2.5 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-100">
                Seleccionado · Subterráneo
              </p>
              <p className="font-semibold text-white">{selectedUnderground.label}</p>
              <p className="text-[10px] text-[var(--nexus-text-dim)]">
                Tramo geométrico · zona/terreno se definen abajo para el plan.
              </p>
              <Button
                type="button"
                variant="glass"
                className="w-full"
                onClick={() => quitar(selectedUnderground.id)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Quitar tramo
              </Button>
            </div>
          ) : null}
          {sideTab === 'muros' ? (
            <StructureDesigner
              structures={structures}
              selectedId={selectedId}
              drawMaterialId={drawStructureMaterial}
              draftPoint={structureDraft}
              disabled={!project.planoUrl || loading}
              showOnPlan={showStructures}
              canDetectPdf={canDetectPdfWalls}
              detecting={loading && canDetectPdfWalls}
              onDetectFromPdf={() => void detectWallsFromLoadedPdf()}
              onShowOnPlan={setShowStructures}
              onDrawMaterial={(id) => {
                setDrawStructureMaterial(id)
                setStructureDraft(null)
                setDrawUnderground(false)
                setUndergroundDraft(null)
                setDrawCable(false)
                clearCableDraft()
                if (id) {
                  setCalibrateMode(false)
                  setViewMode('plano')
                  setShowFov(true)
                  setShowStructures(true)
                }
              }}
              onSelect={(id) => {
                setSelectedId(id)
                setInspectorOpen(true)
                setSideTab('muros')
              }}
              onRemove={quitar}
              onFinishDraft={() => setStructureDraft(null)}
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
          ) : sideTab === 'ajustes' ? (
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
                    clearCableDraft()
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
                draftPoint={
                  cableDraftPoints.length > 0
                    ? cableDraftPoints[cableDraftPoints.length - 1]!
                    : null
                }
                draftPointCount={cableDraftPoints.length}
                onFinishDraft={finishCableDraft}
                disabled={!project.planoUrl || loading}
                onDrawType={setDrawCableType}
                onDrawMode={(active) => {
                  setDrawCable(active)
                  clearCableDraft()
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
                  patchCableType(id, type)
                }}
              />
              <div className="border-t border-white/10 pt-3">
                <ConduitCalculator
                  plans={conduitPlans}
                  onSelectNode={setSelectedId}
                />
              </div>
            </div>
          ) : sideTab === 'sonido' || sideTab === 'domotica' || sideTab === 'electrico' ? (
            <div className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
                Plano {PLAN_DISCIPLINE_LABEL[sideTab]}
              </h2>
              <p className="text-[10px] text-[var(--nexus-text-dim)]">
                Coloca todos los equipos en el plano. Luego toca cada uno para
                modelo, alcance y orientación.
              </p>
              {planDevices.filter((d) => d.discipline === sideTab).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {planDevices
                    .filter((d) => d.discipline === sideTab)
                    .map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`min-h-8 rounded-md px-2 text-[11px] font-semibold ${
                          selectedId === d.id
                            ? 'bg-[var(--nexus-cyan)] text-black'
                            : 'border border-white/15 text-[var(--nexus-cyan)]'
                        }`}
                        onClick={() => {
                          setSelectedId(d.id)
                          setInspectorOpen(true)
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                </div>
              ) : (
                <p className="text-[10px] text-[var(--nexus-text-dim)]">
                  Usa + {PLAN_KIND_LABEL[planDeviceKinds(sideTab)[0]!]} arriba para
                  agregar el primero.
                </p>
              )}
            </div>
          ) : sideTab === 'internet' ? (
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
              onSelectNode={(id) => {
                setSelectedId(id)
                setInspectorOpen(true)
                setSideTab('internet')
              }}
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
              {project.cameras.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {project.cameras.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`min-h-8 rounded-md px-2 text-[11px] font-semibold ${
                        selectedId === c.id
                          ? 'bg-[var(--nexus-cyan)] text-black'
                          : 'border border-white/15 text-[var(--nexus-cyan)]'
                      }`}
                      onClick={() => selectCameraFromMenu(c.id, true)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-[var(--nexus-text-dim)]">
                  La cámara se agrega al plano; arrástrala para ubicarla. Elige el tipo en el
                  submenú CCTV bajo NetVision.
                </p>
              )}
              {selectedCam ? (
                <div className="space-y-2 text-xs">
                  {(() => {
                    const mode = nightMode ? 'night' : 'day'
                    const vision = effectiveCameraVision(selectedCam, mode)
                    const lenses = effectiveCameraLenses(selectedCam, mode)
                    const isDual = lenses.length >= 2
                    const model = getCameraModelOrDefault(selectedCam.modelId)
                    const ground = projectGroundCoverage({
                      heightM: selectedCam.mountHeightM,
                      tiltDeg: selectedCam.tiltDeg ?? 0,
                      hFovDeg: vision.fovDeg,
                      rangeM: vision.rangeM,
                    })
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
                        defaultOpen
                      >
                        <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-[10px] leading-relaxed">
                          <p className="font-semibold text-white">{model.name}</p>
                          <p className="text-[var(--nexus-cyan)]">{cameraVisionSummary(model)}</p>
                          {model.notes ? (
                            <p className="mt-1 text-[var(--nexus-text-muted)]">{model.notes}</p>
                          ) : null}
                        </div>
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
                                {l.lensId === 'tele' ? 'Naranja' : 'Cyan'} · {l.label}: {l.yawDeg}° · FOV{' '}
                                {l.fovDeg}° ·{' '}
                                {formatLength(l.rangeM, project.unitSystem ?? 'metric')}
                              </p>
                            ))}
                            {lenses.slice(1).map((l) => (
                              <div key={`yaw-${l.lensId}`} className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-1 text-orange-200">
                                  Orientación {l.label.replace(/\s*\d.*$/, '').toLowerCase()}
                                  <input
                                    type="number"
                                    min={0}
                                    max={359}
                                    step={5}
                                    value={l.yawDeg}
                                    onChange={(e) => {
                                      const v = Number(e.target.value)
                                      if (!Number.isFinite(v)) return
                                      adjustCameraVision(selectedCam.id, { yawDeg: ((v % 360) + 360) % 360 }, l.lensId)
                                    }}
                                    className="w-16 rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[11px] text-white"
                                  />
                                  °
                                </label>
                                <button
                                  type="button"
                                  className="text-[10px] text-[var(--nexus-text-muted)] underline"
                                  onClick={() => {
                                    const rest = { ...(selectedCam.lensVision ?? {}) }
                                    delete rest[l.lensId]
                                    updateSelectedCam({
                                      lensVision: Object.keys(rest).length ? rest : undefined,
                                    })
                                  }}
                                >
                                  Alinear con {lenses[0]!.label.replace(/\s*\d.*$/, '').toLowerCase()}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
                          Espectro de visión · semáforo
                        </p>
                        {lenses.map((l) => {
                          const lb = visionBandRangesM(l.rangeM, l.catalogRangeM)
                          return (
                            <p
                              key={`bands-${l.lensId}`}
                              className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-[10px] leading-relaxed"
                            >
                              {isDual ? (
                                <span className="font-semibold text-white/80">
                                  {l.lensId === 'tele' ? 'PTZ tele' : l.label.split(' (')[0]}
                                  {': '}
                                </span>
                              ) : null}
                              <span className="text-emerald-300">
                                Verde 0–
                                {formatLength(lb.greenMaxM, project.unitSystem ?? 'metric')}
                              </span>
                              {' · '}
                              <span className="text-orange-300">
                                naranja{' '}
                                {formatLength(lb.yellowMaxM, project.unitSystem ?? 'metric')}
                              </span>
                              {' · '}
                              <span className="text-red-300">
                                rojo hasta{' '}
                                {formatLength(lb.redMaxM, project.unitSystem ?? 'metric')}
                              </span>
                              .
                            </p>
                          )
                        })}
                        <p className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-[10px] leading-relaxed">
                          Montaje {formatLength(selectedCam.mountHeightM, project.unitSystem ?? 'metric')} ·
                          inclinación {Math.round(selectedCam.tiltDeg ?? 0)}°
                          {ground.nearM > 0.05
                            ? ` · en el piso ciega ${formatLength(ground.nearM, project.unitSystem ?? 'metric')} / llega ${formatLength(ground.farM, project.unitSystem ?? 'metric')}`
                            : ` · horizonte, llega ${formatLength(ground.farM, project.unitSystem ?? 'metric')}`}
                          . Ajústalo en la ficha de la cámara (arriba).
                          Verde y naranja son metros de ficha: estirar el cono no los agranda.
                          Si se solapan, prevalece verde sobre naranja y naranja sobre rojo.
                        </p>
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
                            Apertura {vision.fovDeg}°
                            {isDual ? ' · gran angular' : ''}
                            {selectedCam.fovDeg == null &&
                            selectedCam.fovLeftDeg == null &&
                            selectedCam.fovRightDeg == null
                              ? ' · catálogo'
                              : ''}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {FOV_PRESETS_DEG.map((deg) => (
                              <button
                                key={deg}
                                type="button"
                                className={`min-h-8 rounded-md px-2 text-[11px] font-semibold ${
                                  Math.abs(vision.fovDeg - deg) <= 2
                                    ? 'bg-[var(--nexus-cyan)] text-black'
                                    : 'border border-white/15 text-[var(--nexus-cyan)]'
                                }`}
                                onClick={() => {
                                  const half = Math.round(deg / 2)
                                  updateSelectedCam({
                                    fovDeg: deg,
                                    fovLeftDeg: half,
                                    fovRightDeg: deg - half,
                                  })
                                }}
                              >
                                {deg}°
                              </button>
                            ))}
                          </div>
                          <input
                            type="range"
                            min={20}
                            max={170}
                            value={vision.fovDeg}
                            onChange={(e) => {
                              const total = Number(e.target.value)
                              const half = Math.round(total / 2)
                              updateSelectedCam({
                                fovDeg: total,
                                fovLeftDeg: half,
                                fovRightDeg: total - half,
                              })
                            }}
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
                          <div className="mt-1 flex flex-wrap gap-1">
                            {RANGE_PRESETS_M.map((meters) => (
                              <button
                                key={meters}
                                type="button"
                                className={`min-h-8 rounded-md px-2 text-[11px] font-semibold ${
                                  Math.abs(vision.rangeM - meters) <= 0.6
                                    ? 'bg-[var(--nexus-cyan)] text-black'
                                    : 'border border-white/15 text-[var(--nexus-cyan)]'
                                }`}
                                onClick={() => updateSelectedCam({ rangeM: meters })}
                              >
                                {formatLength(meters, project.unitSystem ?? 'metric', 0)}
                              </button>
                            ))}
                          </div>
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
                        {Math.abs(vision.fovLeftDeg - vision.fovRightDeg) > 1 ? (
                          <button
                            type="button"
                            className="min-h-8 w-full rounded-md border border-[var(--nexus-cyan)]/40 bg-[var(--nexus-cyan)]/10 text-[11px] font-semibold text-[var(--nexus-cyan)]"
                            onClick={() => {
                              const half = Math.round(vision.fovDeg / 2)
                              updateSelectedCam({
                                fovDeg: half * 2,
                                fovLeftDeg: half,
                                fovRightDeg: half,
                              })
                            }}
                          >
                            Igualar lados ({vision.fovLeftDeg}° / {vision.fovRightDeg}°)
                          </button>
                        ) : null}
                        <details className="rounded-lg border border-white/10 bg-black/20 px-2 py-1">
                          <summary className="cursor-pointer text-[10px] text-[var(--nexus-text-dim)]">
                            Ajuste fino por lado (avanzado)
                          </summary>
                          <div className="mt-1.5 grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="text-[var(--nexus-text-dim)]">
                                Lado izq. {vision.fovLeftDeg}°
                              </span>
                              <input
                                type="range"
                                min={10}
                                max={85}
                                value={vision.fovLeftDeg}
                                onChange={(e) => {
                                  const left = Number(e.target.value)
                                  const right = vision.fovRightDeg
                                  updateSelectedCam({
                                    fovLeftDeg: left,
                                    fovRightDeg: right,
                                    fovDeg: left + right,
                                  })
                                }}
                                className="mt-1 w-full"
                              />
                            </label>
                            <label className="block">
                              <span className="text-[var(--nexus-text-dim)]">
                                Lado der. {vision.fovRightDeg}°
                              </span>
                              <input
                                type="range"
                                min={10}
                                max={85}
                                value={vision.fovRightDeg}
                                onChange={(e) => {
                                  const right = Number(e.target.value)
                                  const left = vision.fovLeftDeg
                                  updateSelectedCam({
                                    fovLeftDeg: left,
                                    fovRightDeg: right,
                                    fovDeg: left + right,
                                  })
                                }}
                                className="mt-1 w-full"
                              />
                            </label>
                          </div>
                        </details>
                        <button
                          type="button"
                          className="text-[10px] text-[var(--nexus-text-muted)] underline"
                          onClick={() => {
                            const vision = catalogVisionDefaults(
                              selectedCam.modelId,
                              nightMode ? 'night' : 'day',
                            )
                            updateSelectedCam(vision)
                          }}
                        >
                          Restaurar FOV/alcance del modelo ({model.fovDeg}° /{' '}
                          {nightMode ? model.rangeNightM : model.rangeDayM} m)
                        </button>
                        <p className="text-[10px] text-[var(--nexus-text-dim)]">
                          Plano: arrastra el cono o el punto del medio para girar; los lados
                          para la apertura; el anillo de la punta para el alcance.
                          {isDual
                            ? ' Dual: cada cono es autónomo; arrastra el cyan (angular) o el naranja (tele) para que miren a lugares distintos.'
                            : ''}
                        </p>
                      </NetVisionCollapsible>
                    )
                  })()}
                </div>
              ) : !hasSelection ? (
                <p className="text-xs text-[var(--nexus-text-dim)]">
                  Coloca equipos en el plano amplio. Toca uno para configurarlo.
                </p>
              ) : null}
            </>
          )}

          {inspectorFooter}
        </div>
        ) : null}
      </div>
    </div>
  )
}
