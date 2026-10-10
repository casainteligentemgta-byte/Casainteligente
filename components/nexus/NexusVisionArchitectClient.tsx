'use client'

import { imagenPlanoParaIa } from '@/lib/netvision/utils/imagenParaIa'
import { resumenMurosIa } from '@/lib/netvision/murosIa'
import { clampIntensidad, opacidadCobertura } from '@/lib/netvision/utils/intensidadPlano'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import type Konva from 'konva'
import Link from 'next/link'
import {
  BookOpen,
  Camera,
  ChevronDown,
  Copy,
  CopyPlus,
  Download,
  FilePlus,
  ListChecks,
  Presentation,
  Save,
  Trash2,
  Redo2,
  Undo2,
  Upload,
  Wrench,
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
import NetVisionPlanoLookControls from '@/components/netvision/NetVisionPlanoLookControls'
import NetVisionPlanoSetupMenu from '@/components/netvision/NetVisionPlanoSetupMenu'
import NetVisionRotateLayers from '@/components/netvision/NetVisionRotateLayers'
import NetVisionCameraVisionToggles from '@/components/netvision/NetVisionCameraVisionToggles'
import NetVisionCalibracionOkModal from '@/components/netvision/NetVisionCalibracionOkModal'
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
  lenteElegida,
} from '@/lib/netvision/catalog/cameras'
import {
  DEFAULT_AP_ID,
  DEFAULT_INJECTOR_ID,
  DEFAULT_DVR_ID,
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
  INFRA_KIND_PREFIX,
  clampHddTb,
  clampRackSizeU,
  defaultInfraModelId,
  getInfraModelOrDefault,
  listMountables,
  resizeRack,
  unmountFromRacks,
} from '@/lib/netvision/catalog/salaTecnica'
import NetVisionSalaTecnica from '@/components/netvision/NetVisionSalaTecnica'
import { subirPlanoNube } from '@/lib/netvision/planoNube'
import NetVisionDimensionamiento from '@/components/netvision/NetVisionDimensionamiento'
import NetVisionZanjaModo from '@/components/netvision/NetVisionZanjaModo'
import {
  dimensionarGrabacion,
  dimensionarUps,
} from '@/lib/netvision/services/dimensionamiento'
import {
  defaultNetworkPlanSize,
} from '@/lib/netvision/utils/networkNodeSize'
import { VISION_SEMAFORO_HEX, VISION_SEMAFORO_LEGEND } from '@/lib/netvision/utils/visionSemaforoPalette'
import {
  buildCoverageSectors,
  buildVisionSpectrum,
  cameraVisionBandQuality,
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
import { bajarProyectoDeNube } from '@/lib/netvision/bajarDeNube'
import { anotarBaseAproximada } from '@/lib/netvision/nubeBase'
import type { ConflictoNube } from '@/lib/netvision/sincronizacion'
import {
  duplicateProject,
  emptyProject,
  loadProject,
  openProject,
  resetActiveDesign,
  saveProject,
} from '@/lib/netvision/storage'
import {
  calibrationInputPlaceholder,
  formatLength,
  lengthUnitLabel,
  parseCalibrationInput,
} from '@/lib/netvision/utils/units'
import type {
  CableType,
  DesignCableSegment,
  DesignCamera,
  DesignInfraDevice,
  DesignNetworkNode,
  DesignPlanDevice,
  InfraKind,
  RackSizeU,
  DesignStructure,
  DesignUndergroundSegment,
  NetVisionProject,
  NetworkNodeKind,
  PlanDeviceKind,
  PlanDiscipline,
  StructureMaterialId,
} from '@/lib/netvision/types'
import {
  advanceStructureDraw,
  snapCalibrationPoint,
  snapOrtho90,
  snapToStructureJoints,
  snapToStructureJointsAligned,
  structureLabelPrefix,
} from '@/lib/netvision/utils/structureDraw'
import {
  sanitizeCablePoints,
  snapCableDrawPoint,
} from '@/lib/netvision/utils/cableDraw'
import { downloadDataUrl } from '@/lib/netvision/utils/exporters'
import {
  planoPrintHref,
  savePlanoPrintPayloadResilient,
} from '@/lib/netvision/utils/planoPrint'
import {
  buildPlanoRotulo,
  composePlanoRotuloImage,
} from '@/lib/netvision/utils/planoRotulo'
import NetVisionPlanoRotulo from '@/components/netvision/NetVisionPlanoRotulo'
import {
  clampRotateQuarters,
  nextRotateQuarters,
  rotateNormPoint,
  rotatePlanoDataUrl90,
  rotatePlanoDataUrlQuarters,
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
  type DetectWallsResult,
} from '@/lib/netvision/detectWallsFromPdf'
import type { NetVisionZoomControls } from '@/components/netvision/CameraPlacementTool'
import { renderPdfFirstPageFromBytes } from '@/lib/netvision/utils/renderPdfPlano'
import {
  extractPdfDimensionsFromBytes,
  pickDimensionForSegment,
  rotatePlanoDimensions,
  rotatePlanoDimensionsQuarters,
  type PlanoDimension,
} from '@/lib/netvision/utils/extractPdfDimensions'
import {
  emptyProjectHistory,
  recordProjectChange,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectHistory,
} from '@/lib/netvision/utils/projectHistory'
import {
  clampGrosorMuro,
  normalizeCotaColor,
} from '@/lib/netvision/utils/nightPlanoPalette'
import { nextCamMarkerColor } from '@/lib/netvision/utils/cameraMarkerColor'
import {
  alternarSeleccion,
  depurarSeleccion,
  duplicarCamaras,
  moverGrupo,
  resumenSeleccion,
  siguienteEtiquetaCamara,
} from '@/lib/netvision/utils/seleccionMultiple'
import {
  modeloPorDefectoDelProyecto,
  plantillaNuevaCamara,
} from '@/lib/netvision/utils/nuevaCamara'
import {
  isolateHiddenCameraIds,
  pruneHiddenCameraIds,
  toggleHiddenCameraId,
} from '@/lib/netvision/utils/cameraVisionVisibility'
import {
  ajustarEscalaSinCalibrar,
  CALIB_MIN_SEGMENT_NORM,
  calibrationToScale,
  computePlanCalibration,
  estadoEscala,
  type CalibrationOk,
} from '@/lib/netvision/utils/scaleCalibration'

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

/** Fecha y hora cortas para un aviso; '' si no es una fecha. */
function fechaLegible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
}

/** Otra moneda: la tasa anterior ya no sirve (una tasa en Bs no vale para euros). */
function cambiarMoneda(p: NetVisionProject, currency: NetVisionProject['currency']): NetVisionProject {
  if (p.currency === currency) return p
  const next = { ...p, currency }
  delete next.tasaCambio
  return next
}

export default function NexusVisionArchitectClient() {
  const [project, setProject] = useState<NetVisionProject>(() => emptyProject())
  /** Intensidad del espectro de las cámaras: se guarda en el proyecto (llega a la vista del cliente). */
  const visionOpacity = opacidadCobertura(project.coberturaIntensidad)
  const [hydrated, setHydrated] = useState(false)
  const [showFov, setShowFov] = useState(true)
  /** Opacidad del semáforo (translúcido por defecto para ver el plano). */
  /** Ids cuyo semáforo está apagado. Las cámaras nuevas se ven. */
  const [hiddenCoverageIds, setHiddenCoverageIds] = useState<string[]>([])
  const [showWifi, setShowWifi] = useState(false)
  const [showSound, setShowSound] = useState(false)
  const [showLinks, setShowLinks] = useState(true)
  const [showCableRoutes, setShowCableRoutes] = useState(true)
  const [showUnderground, setShowUnderground] = useState(false)
  const [showStructures, setShowStructures] = useState(true)
  /** Al exportar PDF se ocultan las etiquetas Konva: el plano llena el recuadro. */
  const [hideLabelsForPrint, setHideLabelsForPrint] = useState(false)
  const [drawStructureMaterial, setDrawStructureMaterial] =
    useState<StructureMaterialId | null>(null)
  const [structureDraft, setStructureDraft] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [structureCursor, setStructureCursor] = useState<{
    x: number
    y: number
  } | null>(null)
  const structureDraftRef = useRef<{ x: number; y: number } | null>(null)
  const drawStructureMaterialRef = useRef<StructureMaterialId | null>(null)
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
  const [lookPanelOpen, setLookPanelOpen] = useState(false)
  /** Primera carga del plano en este proyecto: rotar / calibrar / OK. */
  const [planoSetupOpen, setPlanoSetupOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  /** La nube tiene otra versión del proyecto: no se sube hasta que el usuario decida. */
  const [conflictoNube, setConflictoNube] = useState<{
    projectId: string
    remoto: ConflictoNube
  } | null>(null)
  const [resolviendoConflicto, setResolviendoConflicto] = useState(false)
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
  const [defaultDvrId, setDefaultDvrId] = useState(DEFAULT_DVR_ID)
  const [defaultInfra, setDefaultInfra] = useState<Record<InfraKind, string>>({
    monitor: defaultInfraModelId('monitor'),
    hdd: defaultInfraModelId('hdd'),
    ups: 'ups-1500-1u',
    rack: 'rack-12u',
  })
  const [defaultHddTb, setDefaultHddTb] = useState(4)
  const [defaultRackU, setDefaultRackU] = useState<RackSizeU>(12)
  const [calibrateMode, setCalibrateMode] = useState(false)
  const [calibPoints, setCalibPoints] = useState<{ x: number; y: number }[]>([])
  const [calibCursor, setCalibCursor] = useState<{ x: number; y: number } | null>(null)
  const [calibMeters, setCalibMeters] = useState('')
  const [calibMetersTouched, setCalibMetersTouched] = useState(false)
  const [calibOk, setCalibOk] = useState<CalibrationOk | null>(null)
  const calibInputRef = useRef<HTMLInputElement | null>(null)
  const calibPointsRef = useRef<{ x: number; y: number }[]>([])
  /** Proporción alto/ancho de la imagen del plano (null mientras no se conoce). */
  const [planoAspect, setPlanoAspect] = useState<number | null>(null)
  const [planoDims, setPlanoDims] = useState<PlanoDimension[]>([])
  const [sideTab, setSideTab] = useState<NetVisionBranchId>('cctv')
  const [redFocusKind, setRedFocusKind] = useState<NetworkNodeKind>('switch')
  const [headerNavEl, setHeaderNavEl] = useState<HTMLElement | null>(null)
  /** Inspector de cámara/elemento: solo al pulsar Configurar. */
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
  /** Selección múltiple: tocar varios equipos para moverlos, duplicarlos o borrarlos juntos. */
  const [multiMode, setMultiMode] = useState(false)
  const [multiIdsRaw, setMultiIds] = useState<string[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const historyRef = useRef<ProjectHistory>(emptyProjectHistory())
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
      for (let i = 0; i < roots.length; i++) {
        if (roots[i]?.contains(t)) return
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
    try {
      const p = loadProject()
      setProject(p)
      setDefaultModelId(modeloPorDefectoDelProyecto(p.cameras, DEFAULT_CAMERA_MODEL_ID))
      if (p.complianceProfileId) setComplianceCountry(p.complianceProfileId)
      setCalibMeters('')
      setCalibMetersTouched(false)
      lastProjectRef.current = p
      if (p.cameras.length > 0 && !p.planoUrl) {
        setInfo(
          `Proyecto «${p.name}» con ${p.cameras.length} cámaras. El plano no está en este dispositivo; pulsa Cargar plano (las cámaras se conservan).`,
        )
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo abrir el último proyecto. Entra en Mis proyectos.',
      )
    }
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
      // Un arrastre cuenta como un paso; al cambiar de proyecto el historial se vacía.
      historyRef.current = recordProjectChange(historyRef.current, prev, project, Date.now())
      setCanUndo(historyRef.current.past.length > 0)
      setCanRedo(historyRef.current.future.length > 0)
    }
    lastProjectRef.current = project
  }, [hydrated, project])

  /** Aplica un paso del historial (deshacer o rehacer) y cierra los trazos a medias. */
  const applyHistoryStep = useCallback(
    (direction: 'undo' | 'redo') => {
      const current = lastProjectRef.current
      if (!current) return
      const step =
        direction === 'undo'
          ? undoProjectHistory(historyRef.current, current)
          : redoProjectHistory(historyRef.current, current)
      const restored = step.restored
      if (!restored) return
      historyRef.current = step.history
      setCanUndo(step.history.past.length > 0)
      setCanRedo(step.history.future.length > 0)
      undoApplyingRef.current = true
      setProject(restored)
      setCalibrateMode(false)
      setCalibPoints([])
      setCalibCursor(null)
      setDrawStructureMaterial(null)
      setStructureDraft(null)
      setStructureCursor(null)
      setDrawUnderground(false)
      setUndergroundDraft(null)
      setDrawCable(false)
      clearCableDraft()
      setError(null)
      setInfo(
        direction === 'undo' ? 'Se deshizo el último cambio.' : 'Se rehízo el cambio.',
      )
    },
    [clearCableDraft],
  )

  // Proporción real de la imagen del plano (alto/ancho).
  useEffect(() => {
    const url = project.planoUrl
    if (!url) {
      setPlanoAspect(null)
      return
    }
    let cancelado = false
    const img = new window.Image()
    img.onload = () => {
      if (!cancelado && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setPlanoAspect(img.naturalHeight / img.naturalWidth)
      }
    }
    img.onerror = () => {
      if (!cancelado) setPlanoAspect(null)
    }
    img.src = url
    return () => {
      cancelado = true
    }
  }, [project.planoUrl])

  // Plano sin calibrar: el alto por defecto sigue la proporción de la imagen
  // (antes se asumía cuadrado). No cuenta como un cambio que se pueda deshacer.
  useEffect(() => {
    if (!hydrated) return
    const ajustada = ajustarEscalaSinCalibrar(project.scale, planoAspect)
    if (!ajustada) return
    setProject((p) => {
      const otra = ajustarEscalaSinCalibrar(p.scale, planoAspect)
      if (!otra) return p
      undoApplyingRef.current = true
      return { ...p, scale: otra }
    })
  }, [hydrated, project.scale, planoAspect])

  const escalaEstado = estadoEscala(project.scale, planoAspect)

  /** Entra en modo calibrar y cierra cualquier otro trazo a medias. */
  const iniciarCalibracion = () => {
    setCalibrateMode(true)
    setCalibPoints([])
    setCalibCursor(null)
    setDrawStructureMaterial(null)
    setStructureDraft(null)
    setDrawUnderground(false)
    setUndergroundDraft(null)
    setDrawCable(false)
    clearCableDraft()
    setViewMode('plano')
    setError(null)
    setCalibMetersTouched(false)
    setInfo(
      'Calibrar: arrastra el segmento sobre una cota (o toca los dos extremos) y escribe cuántos metros mide (ej. 4,40).',
    )
  }

  const undoLast = useCallback(() => applyHistoryStep('undo'), [applyHistoryStep])
  const redoLast = useCallback(() => applyHistoryStep('redo'), [applyHistoryStep])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      // Ctrl+Z deshace; Ctrl+Y o Ctrl+Mayús+Z rehace.
      const isUndo = key === 'z' && !e.shiftKey
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey)
      if (!isUndo && !isRedo) return
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
      if (isRedo) redoLast()
      else undoLast()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoLast, redoLast])

  /** Sync diferido a Supabase (si hay sesión). */
  useEffect(() => {
    if (!hydrated) return
    // Con un conflicto pendiente no se sube nada: decide el usuario.
    if (conflictoNube?.projectId === project.id) return
    const t = window.setTimeout(() => {
      void cloudUpsertProject(project).then((r) => {
        if (!r.authenticated) return
        if (r.conflict) {
          setConflictoNube({ projectId: project.id, remoto: r.conflict })
          return
        }
        if (!r.ok && r.error) {
          // Silencioso si la tabla aún no existe; evita spamear UI
          if (r.error.includes('migración 274') || r.error.includes('42P01')) return
        }
        // El plano grande no viaja en el JSON: se sube aparte y solo si cambió,
        // para que abra en otro equipo y en el enlace del cliente.
        if (r.ok) void subirPlanoNube(project)
      })
    }, 1800)
    return () => window.clearTimeout(t)
  }, [project, hydrated, conflictoNube])

  // Al abrir un proyecto se anota de qué versión parte esta copia (si aún no
  // se sabe), para no pisar la nube con una copia vieja de este equipo.
  useEffect(() => {
    if (!hydrated) return
    anotarBaseAproximada(project.id, project.updatedAt)
    setConflictoNube((c) => (c && c.projectId !== project.id ? null : c))
    // Solo al cambiar de proyecto: la fecha es la que tenía al abrirlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, project.id])

  useEffect(() => {
    if (!hydrated) return
    setCalibMeters('')
    setCalibMetersTouched(false)
  }, [project.unitSystem, hydrated])

  useEffect(() => {
    if (!calibrateMode || calibPoints.length !== 2) return
    const t = window.setTimeout(() => {
      calibInputRef.current?.focus()
      calibInputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(t)
  }, [calibrateMode, calibPoints.length])

  useEffect(() => {
    structureDraftRef.current = structureDraft
  }, [structureDraft])

  useEffect(() => {
    drawStructureMaterialRef.current = drawStructureMaterial
    if (!drawStructureMaterial) setStructureCursor(null)
  }, [drawStructureMaterial])

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
          return
        }
        if (drawStructureMaterial) {
          setDrawStructureMaterial(null)
          e.preventDefault()
          return
        }
        if (calibrateMode) {
          e.preventDefault()
          if (calibPoints.length > 0) {
            setCalibPoints([])
            setCalibCursor(null)
          } else {
            setCalibrateMode(false)
            setInfo(null)
          }
        }
        return
      }
      if (
        (e.key === 'Enter' || e.key === ' ') &&
        drawStructureMaterial &&
        structureDraft
      ) {
        e.preventDefault()
        setStructureDraft(null)
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
    drawStructureMaterial,
    cableDraftPoints,
    drawCable,
    drawCableType,
    clearCableDraft,
    calibrateMode,
    calibPoints.length,
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
      showFov
        ? buildVisionSpectrum(
            project.cameras,
            project.scale,
            nightMode ? 'night' : 'day',
            structures,
          )
        : [],
    [showFov, project.cameras, project.scale, nightMode, structures],
  )

  const wifiCircles = useMemo(
    () => buildWifiCoverage(project.networkNodes, project.scale, structures),
    [project.networkNodes, project.scale, structures],
  )

  const wifiSpectrum = useMemo(
    () =>
      showWifi ? buildWifiSpectrum(project.networkNodes, project.scale, structures) : [],
    [showWifi, project.networkNodes, project.scale, structures],
  )

  const planDevices = project.planDevices ?? []

  const soundSpectrum = useMemo(
    () =>
      showSound
        ? buildSoundSpectrum(
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
          )
        : [],
    [showSound, project.cameras, project.scale, structures, planDevices],
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

  const cameraIds = useMemo(() => project.cameras.map((c) => c.id), [project.cameras])
  const hiddenLive = useMemo(
    () => pruneHiddenCameraIds(hiddenCoverageIds, cameraIds),
    [hiddenCoverageIds, cameraIds],
  )
  const activeSectors =
    sideTab === 'cctv'
      ? sectors.filter((s) => !hiddenLive.includes(s.cameraId))
      : planSectors
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
    const cov = analyzeRedundancy(project.cameras, sectors, project.scale)
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
        project.infraDevices ?? [],
        { zanjaModo: project.zanjaModo, planDevices: project.planDevices ?? [] },
      ),
    [
      project.cameras,
      project.retentionDays,
      project.networkNodes,
      cableRoutes,
      conduitPlans,
      undergroundPlan,
      project.infraDevices,
      project.zanjaModo,
      project.planDevices,
    ],
  )

  /** ¿Alcanzan el grabador, el disco y el UPS para lo que se pide? */
  const dimGrabacion = useMemo(
    () =>
      dimensionarGrabacion(
        project.cameras,
        project.networkNodes,
        project.infraDevices ?? [],
        project.retentionDays,
      ),
    [project.cameras, project.networkNodes, project.infraDevices, project.retentionDays],
  )
  const dimUps = useMemo(
    () =>
      dimensionarUps(
        project.cameras,
        project.networkNodes,
        project.infraDevices ?? [],
        project.upsBackupMin,
      ),
    [project.cameras, project.networkNodes, project.infraDevices, project.upsBackupMin],
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
  useEffect(() => {
    if (!selectedCam) return
    setDefaultModelId(selectedCam.modelId)
  }, [selectedCam])
  const selectedNet = project.networkNodes.find((n) => n.id === selectedId) ?? null
  const selectedInfra =
    (project.infraDevices ?? []).find((d) => d.id === selectedId) ?? null
  const selectedPlanDevice = planDevices.find((d) => d.id === selectedId) ?? null
  const selectedStructure =
    structures.find((s) => s.id === selectedId) ?? null
  const sliderGrosor = clampGrosorMuro(
    selectedStructure?.grosor ?? project.planoGrosorMuro,
  )
  const selectedManualCable =
    (project.cableSegments ?? []).find((s) => s.id === selectedId) ?? null
  const selectedUnderground =
    (project.undergroundSegments ?? []).find((s) => s.id === selectedId) ?? null
  const hasSelection = !!(
    selectedCam ||
    selectedNet ||
    selectedInfra ||
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
      let dims: PlanoDimension[] = []
      if (isPdf) {
        const data = new Uint8Array(await file.arrayBuffer())
        pdfBytesRef.current = data.slice()
        pdfRotateQuartersRef.current = 0
        setCanDetectPdfWalls(true)
        url = await renderPdfFirstPageFromBytes(data)
        try {
          dims = await extractPdfDimensionsFromBytes(data)
        } catch {
          dims = []
        }
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
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
          reader.readAsDataURL(file)
        })
      } else {
        throw new Error('Usa un PDF (exportado del CAD) o una imagen (JPG/PNG/WEBP).')
      }
      const firstPlano = !project.planoUrl
      const keepDesign =
        project.cameras.length > 0 ||
        project.networkNodes.length > 0 ||
        (project.planDevices?.length ?? 0) > 0 ||
        (project.cableSegments?.length ?? 0) > 0
      const savedQuarters = clampRotateQuarters(project.planoRotateQuarters)
      const autoAlinear = keepDesign && savedQuarters > 0
      if (autoAlinear) {
        url = await rotatePlanoDataUrlQuarters(url, savedQuarters)
        pdfRotateQuartersRef.current = savedQuarters
        dims = rotatePlanoDimensionsQuarters(dims, savedQuarters)
        detected = rotateStructuresCwQuarters(detected, savedQuarters)
      }
      setPlanoDims(dims)
      if (keepDesign) {
        const cam = project.cameras.length
        setInfo(
          autoAlinear
            ? `${file.name} actualizado. Se conservan ${cam} cámara${cam === 1 ? '' : 's'}; el plano se giró para coincidir con el diseño.`
            : `${file.name} actualizado. Se conservan ${cam} cámara${cam === 1 ? '' : 's'}. Usa PDF para girar el dibujo o Cámaras para girar los equipos, sin el plano.`,
        )
      }
      setProject((p) => {
        const preserve =
          p.cameras.length > 0 ||
          p.networkNodes.length > 0 ||
          (p.planDevices?.length ?? 0) > 0 ||
          (p.cableSegments?.length ?? 0) > 0
        if (preserve) {
          return {
            ...p,
            planoUrl: url,
            planoNombre: file.name,
            structures:
              (p.structures?.length ?? 0) > 0 ? p.structures : detected,
          }
        }
        return {
          ...p,
          planoUrl: url,
          planoNombre: file.name,
          cameras: [],
          networkNodes: [],
          structures: detected,
          undergroundSegments: [],
          cableSegments: [],
          cableRouteOverrides: {},
          planoRotateQuarters: 0,
        }
      })
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
      const needAlignSetup = keepDesign && !autoAlinear
      if (firstPlano || needAlignSetup) {
        setLookPanelOpen(false)
        setPlanoSetupOpen(true)
        setInspectorOpen(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el plano')
    } finally {
      setLoading(false)
    }
  }, [
    clearCableDraft,
    project.cameras.length,
    project.networkNodes.length,
    project.planDevices,
    project.cableSegments,
    project.planoUrl,
    project.planoRotateQuarters,
  ])

  /** Gira el PDF/imagen. Las cámaras y el resto del diseño se quedan. */
  const rotatePlanoPdf = useCallback(
    async (dir: PlanoRotateDir) => {
      const url = project.planoUrl
      if (!url || loading) return
      setError(null)
      setLoading(true)
      try {
        const rotated = await rotatePlanoDataUrl90(url, dir)
        pdfRotateQuartersRef.current = nextRotateQuarters(
          pdfRotateQuartersRef.current,
          dir,
        )
        setProject((p) => ({
          ...p,
          planoUrl: rotated,
          planoRotateQuarters: nextRotateQuarters(p.planoRotateQuarters, dir),
        }))
        setCalibPoints((pts) => pts.map((pt) => rotateNormPoint(pt.x, pt.y, dir)))
        setCalibCursor((c) => (c ? rotateNormPoint(c.x, c.y, dir) : null))
        setPlanoDims((dims) => rotatePlanoDimensions(dims, dir))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo girar el PDF')
      } finally {
        setLoading(false)
      }
    },
    [project.planoUrl, loading],
  )

  /** Gira cámaras, muros y cables. El PDF no se mueve. */
  const rotateCamaras = useCallback((dir: PlanoRotateDir) => {
    setError(null)
    setProject((p) => rotateProjectGeometry(p, dir))
  }, [])

  const hayEquiposParaGirar =
    project.cameras.length > 0 ||
    project.networkNodes.length > 0 ||
    (project.planDevices?.length ?? 0) > 0 ||
    (project.infraDevices?.length ?? 0) > 0 ||
    project.structures.length > 0 ||
    (project.cableSegments?.length ?? 0) > 0

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
    const plantilla = plantillaNuevaCamara(project.cameras, selectedId, defaultModelId)
    const vision = catalogVisionDefaults(plantilla.modelId, nightMode ? 'night' : 'day')
    const pin: DesignCamera = {
      id: uid(),
      x: Math.round(normX * 1000) / 1000,
      y: Math.round(normY * 1000) / 1000,
      label: siguienteEtiquetaCamara(project.cameras.map((c) => c.label)),
      modelId: plantilla.modelId,
      yawDeg: 0,
      mountHeightM: DEFAULT_MOUNT_HEIGHT_M,
      tiltDeg: DEFAULT_TILT_DEG,
      markerColor: nextCamMarkerColor(project.cameras.length),
      labelOffsetX: 0.07 + (project.cameras.length % 3) * 0.035,
      labelOffsetY: -0.09 - (Math.floor(project.cameras.length / 3) % 3) * 0.05,
      ...vision,
      ...(plantilla.conexion ? { conexion: plantilla.conexion } : {}),
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
    setStructureCursor(null)
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

  const showAllCameraCoverage = () => {
    setHiddenCoverageIds([])
    setShowFov(true)
    setSideTab('cctv')
    setViewMode('plano')
  }

  const soloCameraCoverage = (id: string) => {
    setHiddenCoverageIds(isolateHiddenCameraIds(cameraIds, id))
    setShowFov(true)
    setSideTab('cctv')
    setViewMode('plano')
  }

  const toggleCameraCoverage = (id: string) => {
    setHiddenCoverageIds((prev) => toggleHiddenCameraId(prev, id))
    setShowFov(true)
    setSideTab('cctv')
    setViewMode('plano')
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

  const addNetworkAt = (
    kind: NetworkNodeKind,
    normX: number,
    normY: number,
    modelId?: string,
  ) => {
    if (!project.planoUrl) return
    const mid = modelId ?? defaultNetModels[kind]
    const prefix = labelPrefixForKind(kind, mid)
    const count =
      project.networkNodes.filter(
        (n) => labelPrefixForKind(n.kind, n.modelId) === prefix,
      ).length + 1
    const node: DesignNetworkNode = {
      id: uid(),
      x: Math.round(normX * 1000) / 1000,
      y: Math.round(normY * 1000) / 1000,
      label: `${prefix}-${String(count).padStart(2, '0')}`,
      kind,
      modelId: mid,
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

  const addRecorderFromButton = (recorder: 'nvr' | 'dvr') => {
    const modelId = recorder === 'dvr' ? defaultDvrId : defaultNetModels.nvr
    if (!project.planoUrl) {
      setError('Carga un plano antes de agregar equipos.')
      return
    }
    const idx = project.networkNodes.filter((n) => n.kind === 'nvr').length
    const pos = buttonSpawnPos(idx, 0.35, 0.65)
    addNetworkAt('nvr', pos.x, pos.y, modelId)
    setSideTab('cctv')
    setInspectorOpen(false)
  }

  const addInfraFromButton = (kind: InfraKind) => {
    if (!project.planoUrl) {
      setError('Carga un plano antes de agregar equipos.')
      return
    }
    const modelId =
      kind === 'rack' ? `rack-${defaultRackU}u` : defaultInfra[kind]
    const model = getInfraModelOrDefault(modelId, kind)
    const count = (project.infraDevices ?? []).filter((d) => d.kind === kind).length + 1
    const bases: Record<InfraKind, { x: number; y: number }> = {
      monitor: { x: 0.72, y: 0.28 },
      hdd: { x: 0.28, y: 0.72 },
      ups: { x: 0.55, y: 0.72 },
      rack: { x: 0.18, y: 0.55 },
    }
    const base = bases[kind]
    const idx = count - 1
    const pos = buttonSpawnPos(idx, base.x, base.y)
    const device: DesignInfraDevice = {
      id: uid(),
      label: `${INFRA_KIND_PREFIX[kind]}-${String(count).padStart(2, '0')}`,
      kind,
      modelId: model.id,
      x: pos.x,
      y: pos.y,
      ...(kind === 'hdd' ? { capacityTb: defaultHddTb } : {}),
      ...(kind === 'rack' ? { rackUnits: defaultRackU, mounts: [] } : {}),
    }
    setError(null)
    setProject((p) => ({
      ...p,
      infraDevices: [...(p.infraDevices ?? []), device],
    }))
    setSelectedId(device.id)
    setInspectorOpen(false)
    setSideTab('cctv')
    setViewMode('plano')
  }

  const patchInfraDevice = (id: string, patch: Partial<DesignInfraDevice>) => {
    setProject((p) => ({
      ...p,
      infraDevices: (p.infraDevices ?? []).map((d) =>
        d.id === id ? { ...d, ...patch } : d,
      ),
    }))
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
    setStructureCursor(null)
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
    const prefix = structureLabelPrefix(materialId)
    const seg: DesignStructure = {
      id: uid(),
      label: `${prefix}-00`,
      materialId,
      x1: Math.round(x1 * 1000) / 1000,
      y1: Math.round(y1 * 1000) / 1000,
      x2: Math.round(x2 * 1000) / 1000,
      y2: Math.round(y2 * 1000) / 1000,
      grosor: clampGrosorMuro(project.planoGrosorMuro),
    }
    setError(null)
    setProject((p) => {
      const n = (p.structures ?? []).length + 1
      const labeled = {
        ...seg,
        label: `${prefix}-${String(n).padStart(2, '0')}`,
      }
      return {
        ...p,
        structures: [...(p.structures ?? []), labeled],
      }
    })
    setSelectedId(seg.id)
    setSideTab('muros')
    setViewMode('plano')
    setShowStructures(true)
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

  calibPointsRef.current = calibPoints

  const onCalibPointerMove = (normX: number, normY: number) => {
    if (!calibrateMode) return
    const origin = calibPoints[0] ?? null
    const snapped = snapCalibrationPoint(
      origin,
      { x: normX, y: normY },
      project.structures ?? [],
    )
    setCalibCursor(snapped)
    if (calibMetersTouched || calibPoints.length >= 2 || !origin) return
    const hit = pickDimensionForSegment(origin, snapped, planoDims)
    if (hit) setCalibMeters(hit.label)
  }

  const commitCalibSegment = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => {
    const segmentNorm = Math.hypot(a.x - b.x, a.y - b.y)
    if (!(segmentNorm >= CALIB_MIN_SEGMENT_NORM)) {
      calibPointsRef.current = [a]
      setCalibPoints([a])
      setCalibCursor(b)
      setError(
        'El trazo es demasiado corto. Arrastra un segmento más largo sobre la cota.',
      )
      return
    }
    const hit = pickDimensionForSegment(a, b, planoDims)
    if (hit && !calibMetersTouched) setCalibMeters(hit.label)
    calibPointsRef.current = [a, b]
    setCalibPoints([a, b])
    setCalibCursor(null)
    setError(null)
    setInfo(null)
  }

  const onCalibStrokeStart = (normX: number, normY: number) => {
    const pt = snapCalibrationPoint(
      null,
      { x: normX, y: normY },
      project.structures ?? [],
    )
    if (calibPointsRef.current.length >= 2) {
      calibPointsRef.current = [pt]
      setCalibPoints([pt])
      setCalibCursor(pt)
      return
    }
    if (calibPointsRef.current.length === 0) {
      calibPointsRef.current = [pt]
      setCalibPoints([pt])
      setCalibCursor(pt)
    }
  }

  const onCalibStrokeEnd = (normX: number, normY: number) => {
    const a = calibPointsRef.current[0]
    if (!a) return
    const b = snapCalibrationPoint(a, { x: normX, y: normY }, project.structures ?? [])
    commitCalibSegment(a, b)
  }

  const onCalibPointMove = (index: number, normX: number, normY: number) => {
    const pts = calibPointsRef.current
    if (pts.length < 2) return
    const other = pts[index === 0 ? 1 : 0]!
    const snapped = snapCalibrationPoint(
      other,
      { x: normX, y: normY },
      project.structures ?? [],
    )
    const next =
      index === 0 ? [snapped, other] : [other, snapped]
    calibPointsRef.current = next
    setCalibPoints(next)
    setCalibCursor(null)
    const hit = pickDimensionForSegment(next[0]!, next[1]!, planoDims)
    if (hit && !calibMetersTouched) setCalibMeters(hit.label)
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

  const onStructurePointerMove = (normX: number, normY: number) => {
    if (!drawStructureMaterial) return
    if (!structureDraft) {
      setStructureCursor(
        snapToStructureJoints({ x: normX, y: normY }, project.structures ?? []),
      )
      return
    }
    const snapped = snapOrtho90(structureDraft, { x: normX, y: normY })
    setStructureCursor(
      snapToStructureJointsAligned(
        structureDraft,
        snapped,
        project.structures ?? [],
      ),
    )
  }

  const applyCalibScale = useCallback(() => {
    if (calibPoints.length < 2) {
      setError('Marca los dos extremos del segmento en el plano.')
      return
    }
    const a = calibPoints[0]!
    const b = calibPoints[1]!
    const system = project.unitSystem ?? 'metric'
    const meters = parseCalibrationInput(calibMeters, system)
    if (meters == null) {
      setError(
        system === 'imperial'
          ? 'Escribe cuántos pies mide este tramo en el plano (ej. 14.5).'
          : 'Escribe cuántos metros mide este tramo en el plano (ej. 4,40).',
      )
      return
    }
    const hit = pickDimensionForSegment(a, b, planoDims)
    const usedCota =
      Boolean(hit) &&
      !calibMetersTouched &&
      hit != null &&
      Math.abs(hit.meters - meters) < 1e-6
    const outcome = computePlanCalibration({
      a,
      b,
      meters,
      aspect: planoAspect ?? undefined,
      source: usedCota ? 'cota' : 'manual',
      label: calibMeters.trim() || (hit && usedCota ? hit.label : String(meters)),
    })
    if (!outcome.ok) {
      setError(
        outcome.reason === 'short'
          ? 'El trazo es demasiado corto. Marca los dos extremos de una cota más larga.'
          : 'Revisa los metros del tramo e inténtalo otra vez (entre 0,4 y 200 m).',
      )
      return
    }
    setProject((p) => ({
      ...p,
      scale: calibrationToScale(outcome),
    }))
    setCalibPoints([])
    setCalibCursor(null)
    setCalibrateMode(false)
    setCalibMetersTouched(false)
    setCalibOk(outcome)
    setInfo(null)
    setError(null)
  }, [
    calibPoints,
    calibMeters,
    calibMetersTouched,
    project.unitSystem,
    planoAspect,
    planoDims,
  ])

  const onAddAt = (normX: number, normY: number) => {
    if (!project.planoUrl) return

    if (calibrateMode) {
      if (calibPoints.length >= 2) return
      const snapped = snapCalibrationPoint(
        calibPoints[0] ?? null,
        { x: normX, y: normY },
        project.structures ?? [],
      )
      const next = [...calibPoints, snapped]
      if (next.length >= 2) {
        commitCalibSegment(next[0]!, next[1]!)
      } else {
        calibPointsRef.current = next
        setCalibPoints(next)
        setCalibCursor(snapped)
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

    const material = drawStructureMaterialRef.current ?? drawStructureMaterial
    if (material) {
      const walls = project.structures ?? []
      const next = advanceStructureDraw(
        structureDraftRef.current ?? structureDraft,
        { x: normX, y: normY },
        walls,
      )
      if (next.type === 'start') {
        structureDraftRef.current = next.draft
        setStructureDraft(next.draft)
        setStructureCursor(next.draft)
        setError(null)
        return
      }
      if (next.type === 'too-short') {
        setError('El segmento es demasiado corto; elige otro punto.')
        return
      }
      addStructureSegment(material, next.x1, next.y1, next.x2, next.y2)
      // Continuar dibujando desde la esquina (muro polilínea con tramos H/V).
      structureDraftRef.current = next.nextDraft
      setStructureDraft(next.nextDraft)
      setStructureCursor(next.nextDraft)
      setError(null)
    }
  }

  const onMove = (id: string, normX: number, normY: number) => {
    const nx = Math.round(normX * 1000) / 1000
    const ny = Math.round(normY * 1000) / 1000
    // Selección múltiple: arrastrar uno de los elegidos mueve todo el grupo.
    if (multiMode && multiIds.length > 1 && multiIds.includes(id)) {
      setProject((p) => moverGrupo(p, multiIds, id, { x: nx, y: ny }))
      return
    }
    setProject((p) => ({
      ...p,
      cameras: p.cameras.map((c) => (c.id === id ? { ...c, x: nx, y: ny } : c)),
      networkNodes: p.networkNodes.map((n) => (n.id === id ? { ...n, x: nx, y: ny } : n)),
      planDevices: (p.planDevices ?? []).map((d) =>
        d.id === id ? { ...d, x: nx, y: ny } : d,
      ),
      infraDevices: (p.infraDevices ?? []).map((d) =>
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
    if (patch.modelId) setDefaultModelId(patch.modelId)
    setProject((p) => ({
      ...p,
      cameras: p.cameras.map((c) => {
        if (c.id !== id) return c
        const next: DesignCamera = { ...c, ...patch }
        if ('fovDeg' in patch && patch.fovDeg === undefined) delete next.fovDeg
        if ('fovLeftDeg' in patch && patch.fovLeftDeg === undefined) delete next.fovLeftDeg
        if ('fovRightDeg' in patch && patch.fovRightDeg === undefined) delete next.fovRightDeg
        if ('lensVision' in patch && patch.lensVision === undefined) delete next.lensVision
        if ('lensFocalMm' in patch && patch.lensFocalMm === undefined) delete next.lensFocalMm
        if ('conexion' in patch && patch.conexion === undefined) delete next.conexion
        if ('rangeM' in patch && patch.rangeM === undefined) delete next.rangeM
        if ('labelOffsetX' in patch && patch.labelOffsetX === undefined) {
          delete next.labelOffsetX
        }
        if ('labelOffsetY' in patch && patch.labelOffsetY === undefined) {
          delete next.labelOffsetY
        }
        if ('leaderElbows' in patch && !patch.leaderElbows?.length) {
          delete next.leaderElbows
        }
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

  /** Grosor: si hay muro elegido, solo esa línea; si no, el default del siguiente. */
  const applyGrosorMuro = (value: number) => {
    const grosor = clampGrosorMuro(value)
    setProject((p) => {
      const selected = (p.structures ?? []).find((s) => s.id === selectedId)
      if (!selected) return { ...p, planoGrosorMuro: grosor }
      return {
        ...p,
        structures: (p.structures ?? []).map((s) =>
          s.id === selected.id ? { ...s, grosor } : s,
        ),
      }
    })
  }

  const patchCableType = (id: string, type: CableType) => {
    setProject((p) => ({
      ...p,
      cableSegments: (p.cableSegments ?? []).map((s) =>
        s.id === id ? { ...s, type } : s,
      ),
    }))
  }

  /** Quita uno o varios elementos del plano en un solo paso (se puede deshacer). */
  const quitarVarios = (ids: string[]) => {
    if (ids.length === 0) return
    const fuera = new Set(ids)
    setProject((p) => {
      const overrides = { ...(p.cableRouteOverrides ?? {}) }
      for (const key of Object.keys(overrides)) {
        if (ids.some((id) => key.startsWith(`${id}__`) || key.endsWith(`__${id}`))) {
          delete overrides[key]
        }
      }
      let infra = (p.infraDevices ?? []).filter((d) => !fuera.has(d.id))
      for (const id of ids) infra = unmountFromRacks(infra, id)
      return {
        ...p,
        cameras: p.cameras.filter((c) => !fuera.has(c.id)),
        networkNodes: p.networkNodes.filter((n) => !fuera.has(n.id)),
        planDevices: (p.planDevices ?? []).filter((d) => !fuera.has(d.id)),
        infraDevices: infra,
        structures: (p.structures ?? []).filter((s) => !fuera.has(s.id)),
        undergroundSegments: (p.undergroundSegments ?? []).filter(
          (s) => !fuera.has(s.id),
        ),
        cableSegments: (p.cableSegments ?? []).filter((s) => !fuera.has(s.id)),
        cableRouteOverrides: overrides,
      }
    })
    if (selectedId && fuera.has(selectedId)) setSelectedId(null)
  }

  const quitar = (id: string) => quitarVarios([id])

  /** Equipos elegidos que siguen existiendo (p. ej. tras deshacer). */
  const multiIds = useMemo(
    () => depurarSeleccion(project, multiIdsRaw),
    [project, multiIdsRaw],
  )
  const multiCamIds = multiIds.filter((id) => project.cameras.some((c) => c.id === id))

  const salirSeleccionMultiple = () => {
    setMultiMode(false)
    setMultiIds([])
  }

  // Al tomar otra herramienta (calibrar, pared, cable, canalización) se sale de la
  // selección múltiple: así un toque no marca equipos mientras se dibuja.
  useEffect(() => {
    if (calibrateMode || drawStructureMaterial || drawUnderground || drawCable) {
      setMultiMode(false)
      setMultiIds([])
    }
  }, [calibrateMode, drawStructureMaterial, drawUnderground, drawCable])

  const entrarSeleccionMultiple = () => {
    setMultiMode(true)
    setMultiIds([])
    setSelectedId(null)
    setInspectorOpen(false)
    setViewMode('plano')
    setCalibrateMode(false)
    setCalibPoints([])
    setDrawStructureMaterial(null)
    setStructureDraft(null)
    setStructureCursor(null)
    setDrawUnderground(false)
    setUndergroundDraft(null)
    setDrawCable(false)
    clearCableDraft()
    setError(null)
    setInfo('Selección múltiple: toca los equipos que quieres elegir.')
  }

  /** Copia cámaras con su modelo y ajustes; las copias quedan elegidas para moverlas. */
  const duplicarCamarasPorId = (ids: string[]) => {
    const copias = duplicarCamaras(project.cameras, ids, uid)
    if (copias.length === 0) return
    setProject((p) => ({ ...p, cameras: [...p.cameras, ...copias] }))
    setError(null)
    if (multiMode) {
      setMultiIds(copias.map((c) => c.id))
      setInfo(
        `${copias.length === 1 ? 'Cámara duplicada' : `${copias.length} cámaras duplicadas`}. Las copias quedaron elegidas: arrastra una para ubicarlas.`,
      )
    } else {
      setSelectedId(copias[0]!.id)
      setInspectorOpen(false)
      setShowFov(true)
      setInfo(`Cámara duplicada como ${copias[0]!.label}. Arrástrala a su lugar.`)
    }
  }

  const cambiarModeloVarias = (modelId: string) => {
    if (!modelId || multiCamIds.length === 0) return
    const vision = catalogVisionDefaults(modelId, nightMode ? 'night' : 'day')
    for (const id of multiCamIds) patchCamera(id, { modelId, ...vision, conexion: undefined })
    setInfo(
      `Modelo cambiado en ${multiCamIds.length} ${multiCamIds.length === 1 ? 'cámara' : 'cámaras'}.`,
    )
  }

  const eliminarSeleccion = () => {
    if (multiIds.length === 0) return
    const ok = window.confirm(
      `¿Eliminar ${resumenSeleccion(project, multiIds)}? Puedes recuperarlos con Deshacer.`,
    )
    if (!ok) return
    quitarVarios(multiIds)
    setMultiIds([])
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
    setPlanoSetupOpen(false)
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

  const [detectandoIa, setDetectandoIa] = useState(false)
  /** Muros, puertas y ventanas detectados con IA en la imagen del plano (fotos, escaneos, PDF). */
  const detectarMurosConIa = useCallback(async () => {
    if (!project.planoUrl || loading || detectandoIa) return
    if ((project.structures?.length ?? 0) > 0) {
      const ok = window.confirm(
        'La IA reemplaza los muros, puertas y ventanas actuales por los que detecte en el plano. ¿Continuar?',
      )
      if (!ok) return
    }
    setError(null)
    setInfo('Analizando el plano con IA… puede tardar hasta un minuto.')
    setDetectandoIa(true)
    try {
      const imagen = await imagenPlanoParaIa(project.planoUrl, clampIntensidad(project.planoIntensidad))
      const res = await fetch('/api/netvision/detectar-muros', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen }),
      })
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        resultado?: DetectWallsResult
      }
      if (!res.ok || !j.resultado) {
        throw new Error(j.error || 'No se pudieron detectar los muros con IA.')
      }
      const detected = structuresFromWallDetection(j.resultado, { makeId: uid })
      setInfo(resumenMurosIa(j.resultado))
      if (detected.length > 0) {
        setProject((p) => ({ ...p, structures: detected }))
        setSelectedId(null)
        setSideTab('muros')
        setShowStructures(true)
      }
    } catch (e) {
      setInfo(null)
      setError(e instanceof Error ? e.message : 'No se pudieron detectar los muros con IA.')
    } finally {
      setDetectandoIa(false)
    }
  }, [loading, detectandoIa, project.planoUrl, project.planoIntensidad, project.structures?.length])

  const switchToProject = (p: NetVisionProject) => {
    try {
      setProject(p)
      setSelectedId(null)
      setDefaultModelId(modeloPorDefectoDelProyecto(p.cameras, DEFAULT_CAMERA_MODEL_ID))
      setComplianceCountry(p.complianceProfileId || 'VE')
      setCalibPoints([])
      setCalibrateMode(false)
      setCalibMeters('')
      setCalibMetersTouched(false)
      setError(null)
      pdfBytesRef.current = null
      pdfRotateQuartersRef.current = clampRotateQuarters(p.planoRotateQuarters)
      setCanDetectPdfWalls(false)
      setPlanoDims([])
      setCalibCursor(null)
      setPlanoSetupOpen(false)
      if (p.cameras.length > 0 && !p.planoUrl) {
        setInfo(
          `Abierto «${p.name}» (${p.cameras.length} cámaras). Falta el plano en este iPad/navegador: Cargar plano no borra las cámaras.`,
        )
      } else {
        setInfo(
          `Abierto «${p.name}»${p.cameras.length ? ` · ${p.cameras.length} cámaras` : ''}`,
        )
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo abrir el proyecto. Prueba de nuevo o recarga la página.',
      )
    }
  }

  const persistProjectNow = useCallback(async () => {
    const saved = saveProject(project)
    setProject(saved)
    const r = await cloudUpsertProject(saved)
    const cam = saved.cameras.length
    const red = saved.networkNodes.length
    const eq = (saved.planDevices ?? []).length
    const parts = [
      cam ? `${cam} cam` : null,
      red ? `${red} red` : null,
      eq ? `${eq} equipos` : null,
    ].filter(Boolean)
    const summary = parts.length ? parts.join(' · ') : 'diseño vacío'
    if (r.conflict) {
      setConflictoNube({ projectId: saved.id, remoto: r.conflict })
      setInfo(
        `Guardado en este equipo («${saved.name}»: ${summary}). No se subió a la nube: allí hay otra versión.`,
      )
    } else if (r.ok && r.authenticated) {
      void subirPlanoNube(saved)
      setInfo(`Proyecto guardado («${saved.name}»: ${summary}) · nube OK`)
    } else if (r.authenticated === false) {
      setInfo(`Proyecto guardado en este navegador («${saved.name}»: ${summary})`)
    } else {
      setInfo(`Proyecto guardado localmente («${saved.name}»: ${summary})`)
    }
    setError(null)
  }, [project])

  /** Conflicto con la nube: se queda la copia de este equipo y se sube. */
  const conservarCopiaLocal = async () => {
    if (resolviendoConflicto) return
    setResolviendoConflicto(true)
    const r = await cloudUpsertProject(project, { forzar: true })
    setResolviendoConflicto(false)
    if (r.ok) {
      setConflictoNube(null)
      void subirPlanoNube(project)
      setError(null)
      setInfo('Se conservó la versión de este equipo y quedó guardada en la nube.')
    } else {
      setError(r.error || 'No se pudo subir a la nube. Revisa la conexión e inténtalo de nuevo.')
    }
  }

  /** Conflicto con la nube: se abre la versión de la nube en este equipo. */
  const usarCopiaNube = async () => {
    if (resolviendoConflicto) return
    setResolviendoConflicto(true)
    const r = await bajarProyectoDeNube(project.id)
    setResolviendoConflicto(false)
    if (!r.ok) {
      setError(`No se pudo abrir la versión de la nube: ${r.error}`)
      return
    }
    setConflictoNube(null)
    switchToProject(openProject(r.project.id) ?? r.project)
    setInfo(
      r.planoFalta
        ? 'Se abrió la versión de la nube. No se pudo bajar su plano: vuelve a cargarlo.'
        : 'Se abrió la versión de la nube. Con Deshacer vuelves a la que tenías en este equipo.',
    )
  }

  const saveProjectAsCopy = useCallback(() => {
    const suggested = `${project.name.trim() || 'Proyecto'} (copia)`
    const name = window.prompt('Nombre del nuevo proyecto', suggested)
    if (name == null) return
    const copy = duplicateProject(project, name)
    switchToProject(copy)
    setInfo(`Copia guardada como «${copy.name}»`)
  }, [project])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        // En inputs de nombre también queremos guardar con Ctrl+S
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') {
          e.preventDefault()
          void persistProjectNow()
        }
        return
      }
      e.preventDefault()
      void persistProjectNow()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [persistProjectNow])

  const planoRotulo = useMemo(
    () =>
      buildPlanoRotulo({
        projectName: project.name,
        branch: sideTab,
      }),
    [project.name, sideTab],
  )

  const capturePlanoConRotulo = async (mimeType?: 'image/jpeg') => {
    const stage = stageRef.current
    if (!stage) return null
    const raw = mimeType
      ? stage.toDataURL({ pixelRatio: 2, mimeType, quality: 0.92 })
      : stage.toDataURL({ pixelRatio: 2 })
    return composePlanoRotuloImage(
      raw,
      buildPlanoRotulo({
        projectName: project.name,
        branch: sideTab,
      }),
      { night: Boolean(project.planoInvertido) },
    )
  }

  const exportPng = () => {
    void (async () => {
      const framed = await capturePlanoConRotulo()
      if (framed) downloadDataUrl('netvision-plano.png', framed)
    })()
  }

  const exportPdf = async () => {
    const stage = stageRef.current
    if (!stage || !project.planoUrl || exportingPdf) return
    setExportingPdf(true)
    setError(null)
    try {
      saveProject(project)
      const rotulo = buildPlanoRotulo({
        projectName: project.name,
        branch: sideTab,
      })
      // Sin etiquetas Konva: el recorte abraza el plano y los nombres van en chips.
      flushSync(() => setHideLabelsForPrint(true))
      stage.batchDraw()
      // 2× para que el plano siga nítido cuando la hoja recorta el margen y lo agranda.
      const imageDataUrl = stage.toDataURL({
        pixelRatio: 2,
        mimeType: 'image/jpeg',
        quality: 0.82,
      })
      await savePlanoPrintPayloadResilient({
        v: 1,
        projectId: project.id,
        returnHref: '/nexus/vision',
        imageDataUrl,
        rotulo,
        planoNombre: project.planoNombre,
        cameraCount: project.cameras.length,
        cameraLabels: project.cameras.map((c) => ({ id: c.id, label: c.label })),
      })
      window.location.assign(planoPrintHref(project.id, sideTab))
    } catch (e) {
      setHideLabelsForPrint(false)
      setError(e instanceof Error ? e.message : 'No se pudo exportar el PDF del plano.')
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
    calibrateMode && calibPoints.length >= 1 && calibMeters.trim()
      ? `${calibMeters.trim()} ${lengthUnitLabel(project.unitSystem ?? 'metric')}`
      : calibrateMode && calibPoints.length >= 2
        ? '¿metros?'
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
              }
              setDefaultModelId(id)
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
          <button
            type="button"
            disabled={!project.planoUrl || loading}
            className={chipClass(false)}
            onClick={() => addRecorderFromButton('nvr')}
          >
            + NVR
          </button>
          <button
            type="button"
            disabled={!project.planoUrl || loading}
            className={chipClass(false)}
            onClick={() => addRecorderFromButton('dvr')}
          >
            + DVR
          </button>
          <button
            type="button"
            disabled={!project.planoUrl || loading}
            className={chipClass(false)}
            onClick={() => addInfraFromButton('monitor')}
          >
            + Pantalla
          </button>
          <button
            type="button"
            disabled={!project.planoUrl || loading}
            className={chipClass(false)}
            onClick={() => addInfraFromButton('hdd')}
          >
            + Disco
          </button>
          <button
            type="button"
            disabled={!project.planoUrl || loading}
            className={chipClass(false)}
            onClick={() => addInfraFromButton('ups')}
          >
            + UPS
          </button>
          <button
            type="button"
            disabled={!project.planoUrl || loading}
            className={chipClass(false)}
            onClick={() => addInfraFromButton('rack')}
          >
            + Rack
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
                  setStructureCursor(null)
                  setDrawUnderground(false)
                  setUndergroundDraft(null)
                  setDrawCable(false)
                  clearCableDraft()
                  if (next) {
                    setCalibrateMode(false)
                    setViewMode('plano')
                    setShowStructures(true)
                    setInspectorOpen(false)
                  }
                }}
              >
                + {m.label}
              </button>
            )
          })}
          {drawStructureMaterial ? (
            <button
              type="button"
              className="rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-black"
              onClick={() => {
                setDrawStructureMaterial(null)
                setStructureDraft(null)
                setStructureCursor(null)
              }}
            >
              Listo · dejar de colocar
            </button>
          ) : null}
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
            onClick={() => setProject((p) => cambiarMoneda(p, c))}
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
        onClick={() => void persistProjectNow()}
        title="Guardar CCTV, red, domótica y resto del diseño (Ctrl+S)"
      >
        <Save className="mr-1.5 h-3.5 w-3.5" />
        Guardar proyecto
      </Button>
      <Button
        type="button"
        variant="glass"
        size="sm"
        className="w-full justify-start"
        onClick={saveProjectAsCopy}
        title="Duplicar el proyecto con otro nombre"
      >
        <Copy className="mr-1.5 h-3.5 w-3.5" />
        Guardar como…
      </Button>
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
      <Button
        type="button"
        variant="glass"
        size="sm"
        className="w-full justify-start"
        data-nv-vista-cliente
        onClick={() => {
          saveProject(project)
          const vista = window.open(
            `/nexus/vision/cliente?id=${encodeURIComponent(project.id)}`,
            '_blank',
          )
          if (vista) vista.opener = null
        }}
        disabled={!project.planoUrl}
      >
        <Presentation className="mr-1.5 h-3.5 w-3.5" />
        Vista cliente
      </Button>
      <Button type="button" variant="glass" size="sm" className="w-full justify-start" asChild>
        <Link href="/nexus/vision/manual/usuario">
          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
          Manual
        </Link>
      </Button>
      <Button type="button" variant="glass" size="sm" className="w-full justify-start" asChild>
        <Link href="/nexus/vision/tecnico">
          <Wrench className="mr-1.5 h-3.5 w-3.5" />
          Técnico IA
        </Link>
      </Button>
      {project.planoUrl && viewMode === 'plano' ? (
        <div className="mt-1 space-y-2 border-t border-white/10 pt-2">
          <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
            Vista del plano
          </p>
          <NetVisionRotateLayers
            variant="side"
            disabled={loading}
            camerasDisabled={!hayEquiposParaGirar}
            onRotatePdf={(dir) => void rotatePlanoPdf(dir)}
            onRotateCameras={rotateCamaras}
          />
          <button
            type="button"
            data-nv-calibrar
            title={layerHelpTitle('calibrate')}
            className={`w-full rounded-md px-2 py-1.5 text-left text-[11px] font-semibold ${
              calibrateMode
                ? 'bg-[var(--nexus-cyan)] text-black'
                : 'text-[var(--nexus-cyan)] hover:bg-white/5'
            }`}
            onClick={() => {
              if (calibrateMode) {
                setCalibrateMode(false)
                setCalibPoints([])
                setCalibCursor(null)
                setCalibMetersTouched(false)
                setInfo(null)
                return
              }
              iniciarCalibracion()
            }}
          >
            Calibrar
          </button>
          {calibrateMode ? (
            <div className="flex flex-col gap-1.5 px-1">
              <label className="flex flex-col gap-1 text-[11px] text-[var(--nexus-text-dim)]">
                <span>Este tramo mide en el plano</span>
                <span className="flex items-center gap-1.5">
                  <input
                    data-nv-calib-metros
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={calibrationInputPlaceholder(
                      project.unitSystem ?? 'metric',
                    )}
                    value={calibMeters}
                    onChange={(e) => {
                      setCalibMeters(e.target.value)
                      setCalibMetersTouched(true)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applyCalibScale()
                      }
                    }}
                    className="min-w-0 flex-1 rounded border border-lime-400/40 bg-black/50 px-2 py-1.5 text-sm font-semibold text-white"
                    title="Metraje real de la línea que marcas: 4,40 o 4.40"
                  />
                  <span className="shrink-0 text-xs font-semibold text-lime-200">
                    {lengthUnitLabel(project.unitSystem ?? 'metric')}
                  </span>
                </span>
              </label>
              <p className="text-[10px] text-[var(--nexus-text-muted)]">
                {calibPoints.length < 2
                  ? `Arrastra el segmento o toca los dos extremos (${calibPoints.length}/2).`
                  : 'Ajusta los extremos si hace falta, confirma el metraje y pulsa Aplicar.'}
                {planoDims.length > 0 ? (
                  <span className="text-lime-300/90">
                    {' '}
                    {planoDims.length} cotas PDF
                  </span>
                ) : (
                  <span className="text-amber-200/80"> sin cotas PDF</span>
                )}
              </p>
              {calibPoints.length >= 2 ? (
                <button
                  type="button"
                  data-nv-calib-aplicar-side
                  onClick={applyCalibScale}
                  className="w-full rounded-md bg-lime-400 px-2 py-1.5 text-[11px] font-bold text-black"
                >
                  Aplicar escala
                </button>
              ) : null}
            </div>
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
              {showFov ? (
                <label
                  className="inline-flex min-w-[9rem] flex-1 cursor-pointer items-center gap-1.5 text-[10px] text-[var(--nexus-text-muted)]"
                  title="Intensidad del espectro de las cámaras sobre el plano (se guarda en el proyecto y se ve igual en la vista del cliente)"
                >
                  <span className="shrink-0">Intensidad</span>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    step={1}
                    value={Math.round(visionOpacity * 100)}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setProject((p) => ({ ...p, coberturaIntensidad: v }))
                    }}
                    className="h-1.5 w-full accent-[var(--nexus-cyan)]"
                  />
                  <span className="w-8 tabular-nums text-[var(--nexus-cyan)]">
                    {Math.round(visionOpacity * 100)}%
                  </span>
                </label>
              ) : null}
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
            </div>
          </details>
          <div className="rounded-md border border-white/10 bg-black/30 px-2 py-2">
            <p className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
              Apariencia
            </p>
            <NetVisionPlanoLookControls
              invertido={Boolean(project.planoInvertido)}
              cotaColor={normalizeCotaColor(project.planoCotaColor)}
              grosorMuro={sliderGrosor}
              disabled={!project.planoUrl || loading}
              onInvertido={(value) =>
                setProject((p) => ({ ...p, planoInvertido: value }))
              }
              onCotaColor={(value) =>
                setProject((p) => ({ ...p, planoCotaColor: value }))
              }
              onGrosorMuro={applyGrosorMuro}
              intensidadPlano={clampIntensidad(project.planoIntensidad)}
              onIntensidadPlano={(value) => setProject((p) => ({ ...p, planoIntensidad: value }))}
            />
          </div>
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
          title="Calcula cobertura automática: verde identifica rostros, naranja 1 m más, rojo el resto del cono"
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
      {viewMode === 'plano' ? (
        <button
          type="button"
          disabled={!project.planoUrl || loading}
          title={layerHelpTitle('invert')}
          aria-pressed={Boolean(project.planoInvertido)}
          onClick={() =>
            setProject((p) => ({ ...p, planoInvertido: !p.planoInvertido }))
          }
          className={`inline-flex shrink-0 items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40 ${
            project.planoInvertido
              ? 'border-white/70 bg-white text-black'
              : 'border-white/15 text-[var(--nexus-text-muted)] hover:bg-white/5 hover:text-white'
          }`}
        >
          Fondo negro
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
      <button
        type="button"
        disabled={!canRedo}
        title="Rehacer el cambio deshecho (Ctrl+Y)"
        aria-label="Rehacer"
        data-nv-rehacer
        onClick={redoLast}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-[var(--nexus-text-muted)] hover:bg-white/5 hover:text-white disabled:opacity-40"
      >
        <Redo2 className="h-3.5 w-3.5" />
        Rehacer
      </button>
      <button
        type="button"
        disabled={!project.planoUrl || loading}
        title="Elegir varios equipos para moverlos, duplicarlos, cambiarles el modelo o eliminarlos"
        aria-pressed={multiMode}
        data-nv-multi
        onClick={() => (multiMode ? salirSeleccionMultiple() : entrarSeleccionMultiple())}
        className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40 ${
          multiMode
            ? 'border-cyan-300 bg-[var(--nexus-cyan)] text-black'
            : 'border-white/15 text-[var(--nexus-text-muted)] hover:bg-white/5 hover:text-white'
        }`}
      >
        <ListChecks className="h-3.5 w-3.5" />
        Selección múltiple
      </button>
      {calibrateMode ? (
        <label
          data-nv-calib-barra
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-lime-400/50 bg-lime-400/10 px-2 py-1 text-[11px] font-semibold text-lime-100"
        >
          <span className="hidden sm:inline">Este tramo mide</span>
          <span className="sm:hidden">Tramo</span>
          <input
            data-nv-calib-metros-bar
            inputMode="decimal"
            autoComplete="off"
            placeholder={calibrationInputPlaceholder(project.unitSystem ?? 'metric')}
            value={calibMeters}
            onChange={(e) => {
              setCalibMeters(e.target.value)
              setCalibMetersTouched(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyCalibScale()
              }
            }}
            className="h-7 w-20 rounded border border-lime-400/40 bg-black/50 px-1.5 text-sm font-bold text-white"
          />
          <span>{lengthUnitLabel(project.unitSystem ?? 'metric')}</span>
          {calibPoints.length >= 2 ? (
            <button
              type="button"
              data-nv-calib-aplicar-bar
              onClick={applyCalibScale}
              className="rounded bg-lime-400 px-2 py-0.5 text-[11px] font-bold text-black"
            >
              Aplicar
            </button>
          ) : (
            <span className="font-medium text-lime-200/80">
              ({calibPoints.length}/2)
            </span>
          )}
        </label>
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
            tasaCambio={project.tasaCambio}
            onTasaChange={(tasaCambio) =>
              setProject((p) => {
                const next = { ...p, tasaCambio }
                if (tasaCambio === undefined) delete next.tasaCambio
                return next
              })
            }
            distributorMarginPct={project.distributorMarginPct ?? 15}
            onMarginChange={(pct) =>
              setProject((p) => ({ ...p, distributorMarginPct: pct }))
            }
            zanjaModo={project.zanjaModo ?? 'no_cobrar'}
            zanjaMetros={undergroundPlan.totalPipeM}
            onZanjaModo={(zanjaModo) => setProject((p) => ({ ...p, zanjaModo }))}
            projectClient={project.client ?? ''}
            ventasBudgetId={project.ventasBudgetId}
            onVentasBudgetId={(id) =>
              setProject((p) => {
                const next = { ...p, ventasBudgetId: id }
                if (!id) delete next.ventasBudgetId
                return next
              })
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

      {calibOk ? (
        <NetVisionCalibracionOkModal
          result={calibOk}
          unitSystem={project.unitSystem ?? 'metric'}
          onClose={() => setCalibOk(null)}
        />
      ) : null}

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
      {conflictoNube && conflictoNube.projectId === project.id ? (
        <div
          data-nv-conflicto-nube
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-50"
        >
          <span className="min-w-0 flex-1 basis-64">
            La nube tiene otra versión de este proyecto
            {fechaLegible(conflictoNube.remoto.updatedAt)
              ? ` (guardada el ${fechaLegible(conflictoNube.remoto.updatedAt)}, ${conflictoNube.remoto.cameras} ${conflictoNube.remoto.cameras === 1 ? 'cámara' : 'cámaras'})`
              : ''}
            . No se sobrescribió y lo que hagas aquí queda solo en este equipo hasta que elijas.
          </span>
          <span className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              data-nv-conflicto-usar-nube
              disabled={resolviendoConflicto}
              onClick={() => void usarCopiaNube()}
              className="min-h-10 rounded-lg bg-white px-3 text-[12px] font-bold text-black disabled:opacity-50"
            >
              Abrir la de la nube
            </button>
            <button
              type="button"
              data-nv-conflicto-conservar
              disabled={resolviendoConflicto}
              onClick={() => void conservarCopiaLocal()}
              className="min-h-10 rounded-lg border border-white/40 px-3 text-[12px] font-bold text-white disabled:opacity-50"
            >
              Conservar la de este equipo
            </button>
          </span>
        </div>
      ) : null}
      {project.planoUrl &&
      !calibrateMode &&
      (escalaEstado === 'calibracion_antigua' ||
        (escalaEstado === 'sin_calibrar' && project.cameras.length > 0)) ? (
        <div
          data-nv-escala-aviso={escalaEstado}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
        >
          <span className="min-w-0 flex-1 basis-64">
            {escalaEstado === 'calibracion_antigua'
              ? 'Este plano no es cuadrado y se calibró con la versión anterior: las medidas a lo alto salen deformadas. Vuelve a calibrarlo para corregir metros de cable y alcances.'
              : 'Plano sin calibrar: los metros son aproximados (se asumen 40 m de ancho). Calíbralo con una medida conocida.'}
          </span>
          <button
            type="button"
            onClick={iniciarCalibracion}
            className="min-h-10 shrink-0 rounded-lg bg-amber-400 px-3 text-[12px] font-bold text-black"
          >
            Calibrar ahora
          </button>
        </div>
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
                  className={`relative h-[calc(100dvh-11.5rem)] min-h-[420px] w-full overflow-hidden rounded-xl bg-black ${
                    placeMode ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                >
                  <NetVisionPlanoRotulo rotulo={planoRotulo}>
                  <CameraPlacementTool
                    backgroundUrl={project.planoUrl}
                    invertBackground={Boolean(project.planoInvertido)}
                    invertOptions={{
                      cotaColor: normalizeCotaColor(project.planoCotaColor),
                      grosorMuro: clampGrosorMuro(project.planoGrosorMuro),
                      intensidadTrazos: clampIntensidad(project.planoIntensidad),
                    }}
                    wallStrokeGrosor={clampGrosorMuro(project.planoGrosorMuro)}
                    cameras={project.cameras}
                    networkNodes={project.networkNodes}
                    planDevices={planDevices}
                    infraDevices={project.infraDevices ?? []}
                    structures={structures}
                    sectors={activeSectors}
                    coverageHiddenIds={hiddenLive}
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
                          : drawStructureMaterial && structureDraft
                            ? [structureDraft]
                            : undefined
                    }
                    draftCursor={
                      calibrateMode
                        ? calibCursor
                        : drawCable
                          ? cableCursor
                          : drawStructureMaterial
                            ? structureCursor
                            : null
                    }
                    draftColor={draftColor}
                    draftLabel={draftLabel}
                    showFov={showActiveCoverage}
                    visionOpacity={visionOpacity}
                    showWifi={showWifi && sideTab !== 'sonido' && sideTab !== 'domotica' && sideTab !== 'electrico'}
                    showSound={showSound && sideTab === 'sonido'}
                    showLinks={showLinks}
                    showCableRoutes={showCableRoutes}
                    showUnderground={showUnderground || sideTab === 'sub'}
                    showStructures={showStructures}
                    onAddAt={onAddAt}
                    lockPan={calibrateMode}
                    onDraftStrokeStart={
                      calibrateMode ? onCalibStrokeStart : undefined
                    }
                    onDraftStrokeEnd={calibrateMode ? onCalibStrokeEnd : undefined}
                    onDraftPointMove={
                      calibrateMode ? onCalibPointMove : undefined
                    }
                    onDraftPointerMove={
                      drawCable
                        ? onCablePointerMove
                        : calibrateMode
                          ? onCalibPointerMove
                          : drawStructureMaterial
                            ? onStructurePointerMove
                            : undefined
                    }
                    onFinishPlace={drawCable ? finishCableDraft : undefined}
                    snapPlaceToDevices={drawCable}
                    onMove={onMove}
                    onPatchCamera={(id, patch) => patchCamera(id, patch)}
                    onAdjustCameraVision={adjustCameraVision}
                    metersPerNormX={project.scale.metersPerNormX}
                    metersPerNormY={project.scale.metersPerNormY}
                    nightMode={nightMode}
                    showCameraLabels={!hideLabelsForPrint}
                    multiSelectedIds={multiMode ? multiIds : undefined}
                    onToggleMulti={
                      multiMode
                        ? (id) => setMultiIds((ids) => alternarSeleccion(ids, id))
                        : undefined
                    }
                    onSelect={(id) => {
                      // En selección múltiple el toque elige equipos; no abre fichas.
                      if (multiMode) return
                      setSelectedId(id)
                      if (id && project.cameras.some((c) => c.id === id)) {
                        setShowFov(true)
                        setSideTab('cctv')
                        setViewMode('plano')
                        setCalibrateMode(false)
                        setDrawStructureMaterial(null)
                        setStructureDraft(null)
                        setDrawUnderground(false)
                        setUndergroundDraft(null)
                        setDrawCable(false)
                        clearCableDraft()
                      } else if ((project.structures ?? []).some((s) => s.id === id)) {
                        setSideTab('muros')
                        setViewMode('plano')
                        setShowStructures(true)
                        if (!drawStructureMaterial) {
                          setStructureDraft(null)
                          setDrawUnderground(false)
                          setUndergroundDraft(null)
                          setDrawCable(false)
                          clearCableDraft()
                        }
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
                      } else if (
                        (project.infraDevices ?? []).some((d) => d.id === id)
                      ) {
                        setSideTab('cctv')
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
                  </NetVisionPlanoRotulo>
                  {calibrateMode && calibPoints.length >= 2 ? (
                    <div
                      data-nv-calib-panel
                      className="absolute left-1/2 top-3 z-30 w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-lime-400/45 bg-[#071018]/95 p-3 shadow-2xl backdrop-blur-md"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-lime-200">
                        Escala del plano
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/55">
                        Arrastra los puntos verdes para ajustar el tramo.
                      </p>
                      <label className="mt-2 flex flex-col gap-1 text-[12px] text-white/85">
                        Este tramo mide, en el plano
                        <span className="flex items-center gap-2">
                          <input
                            ref={calibInputRef}
                            data-nv-calib-metros-overlay
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder={calibrationInputPlaceholder(
                              project.unitSystem ?? 'metric',
                            )}
                            value={calibMeters}
                            onChange={(e) => {
                              setCalibMeters(e.target.value)
                              setCalibMetersTouched(true)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                applyCalibScale()
                              }
                            }}
                            className="min-h-11 min-w-0 flex-1 rounded-lg border border-lime-400/50 bg-black/60 px-3 text-lg font-bold text-white"
                          />
                          <span className="shrink-0 text-sm font-semibold text-lime-200">
                            {lengthUnitLabel(project.unitSystem ?? 'metric')}
                          </span>
                        </span>
                      </label>
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          data-nv-calib-aplicar
                          onClick={applyCalibScale}
                          className="min-h-10 flex-1 rounded-lg bg-lime-400 px-3 text-[12px] font-bold text-black hover:bg-lime-300"
                        >
                          Aplicar escala
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCalibPoints([])
                            setCalibCursor(null)
                          }}
                          className="min-h-10 rounded-lg border border-white/25 px-3 text-[12px] font-semibold text-white/80 hover:bg-white/10"
                        >
                          Trazar de nuevo
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="pointer-events-none absolute left-3 top-14 z-20 w-[min(20.5rem,calc(100%-1.5rem))]">
                    {planoSetupOpen ? (
                      <NetVisionPlanoSetupMenu
                        calibrating={calibrateMode}
                        disabled={loading}
                        camerasDisabled={!hayEquiposParaGirar}
                        onRotatePdf={(dir) => void rotatePlanoPdf(dir)}
                        onRotateCameras={rotateCamaras}
                        onCalibrate={() => {
                          if (calibrateMode) {
                            setCalibrateMode(false)
                            setCalibPoints([])
                            setCalibCursor(null)
                            setCalibMetersTouched(false)
                            setInfo(null)
                            return
                          }
                          iniciarCalibracion()
                        }}
                        onOk={() => {
                          setPlanoSetupOpen(false)
                          setLookPanelOpen(false)
                          setInspectorOpen(false)
                          setCalibrateMode(false)
                          setCalibPoints([])
                          setCalibCursor(null)
                          setInfo(null)
                        }}
                      />
                    ) : lookPanelOpen ? (
                      <div className="pointer-events-auto rounded-xl border border-white/20 bg-[#071018]/92 p-2.5 shadow-xl backdrop-blur-md">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
                            Apariencia del plano
                          </p>
                          <button
                            type="button"
                            title="Ocultar apariencia"
                            aria-label="Ocultar apariencia"
                            onClick={() => setLookPanelOpen(false)}
                            className="rounded-md px-1.5 py-0.5 text-[11px] text-[var(--nexus-text-muted)] hover:bg-white/10 hover:text-white"
                          >
                            −
                          </button>
                        </div>
                        <NetVisionPlanoLookControls
                          compact
                          invertido={Boolean(project.planoInvertido)}
                          cotaColor={normalizeCotaColor(project.planoCotaColor)}
                          grosorMuro={sliderGrosor}
                          disabled={loading}
                          onInvertido={(value) =>
                            setProject((p) => ({ ...p, planoInvertido: value }))
                          }
                          onCotaColor={(value) =>
                            setProject((p) => ({ ...p, planoCotaColor: value }))
                          }
                          onGrosorMuro={applyGrosorMuro}
                          intensidadPlano={clampIntensidad(project.planoIntensidad)}
                          onIntensidadPlano={(value) =>
                            setProject((p) => ({ ...p, planoIntensidad: value }))
                          }
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        title={layerHelpTitle('invert')}
                        onClick={() => setLookPanelOpen(true)}
                        className={`pointer-events-auto min-h-9 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur-md ${
                          project.planoInvertido
                            ? 'border-white/70 bg-white text-black'
                            : 'border-white/20 bg-[#071018]/92 text-[var(--nexus-cyan)]'
                        }`}
                      >
                        Apariencia
                      </button>
                    )}
                  </div>
                  {drawStructureMaterial ? (
                    <div className="pointer-events-none absolute inset-x-2 bottom-16 z-30 flex justify-center">
                      <button
                        type="button"
                        data-nv-muros-listo
                        onClick={() => {
                          setDrawStructureMaterial(null)
                          setStructureDraft(null)
                          setStructureCursor(null)
                        }}
                        className="pointer-events-auto min-h-11 rounded-full bg-amber-400 px-4 py-2 text-[13px] font-bold text-black shadow-lg"
                      >
                        Listo · dejar de colocar muros
                      </button>
                    </div>
                  ) : null}
                  {project.cameras.length > 0 &&
                  !inspectorOpen &&
                  !drawStructureMaterial &&
                  !planoSetupOpen ? (
                    <div
                      className="absolute inset-x-2 bottom-12 z-20 flex items-center gap-2 rounded-xl border border-white/15 bg-[#071018]/90 px-2 py-1.5 shadow-lg backdrop-blur-md"
                      data-cameras-menu
                    >
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          aria-expanded={camerasMenuOpen}
                          aria-haspopup="listbox"
                          title="Ver todas las cámaras agregadas"
                          onClick={toggleCamerasMenu}
                          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold ${
                            camerasMenuOpen
                              ? 'border-[var(--nexus-cyan)] bg-[var(--nexus-cyan)] text-black'
                              : 'border-white/20 bg-black/40 text-[var(--nexus-cyan)]'
                          }`}
                        >
                          <Camera className="h-3.5 w-3.5" />
                          {project.cameras.length}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${camerasMenuOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {camerasMenuOpen ? (
                          <div
                            role="listbox"
                            aria-label="Cámaras agregadas"
                            className="absolute bottom-[calc(100%+8px)] left-0 max-h-[min(50vh,320px)] w-[min(280px,80vw)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-xl"
                          >
                            <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
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
                                      : 'text-zinc-800 hover:bg-zinc-100'
                                  }`}
                                >
                                  <span className="text-[12px] font-semibold">{c.label}</span>
                                  <span
                                    className={`line-clamp-1 text-[10px] ${
                                      active ? 'text-black/70' : 'text-zinc-500'
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
                              className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[10px] font-semibold text-sky-700 hover:bg-zinc-100"
                            >
                              Abrir inspector CCTV
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <NetVisionCameraVisionToggles
                          cameras={project.cameras}
                          hiddenIds={hiddenLive}
                          compact
                          onShowAll={showAllCameraCoverage}
                          onSolo={soloCameraCoverage}
                          onToggle={toggleCameraCoverage}
                          onSelect={(id) => selectCameraFromMenu(id, false)}
                        />
                      </div>
                    </div>
                  ) : null}
                  {selectedId &&
                  !inspectorOpen &&
                  !multiMode &&
                  !drawStructureMaterial &&
                  !planoSetupOpen ? (
                    <div className="absolute right-3 top-14 z-20 flex flex-col items-end gap-2">
                      <button
                        type="button"
                        data-nv-configurar
                        onClick={() => setInspectorOpen(true)}
                        className="min-h-10 rounded-full bg-[var(--nexus-cyan)] px-3.5 py-2 text-[11px] font-semibold text-black shadow-lg"
                      >
                        {selectedCam
                          ? 'Configurar cámara'
                          : `Configurar ${
                              selectedNet?.label ||
                              selectedPlanDevice?.label ||
                              selectedStructure?.label ||
                              selectedManualCable?.label ||
                              selectedUnderground?.label ||
                              'elemento'
                            }`}
                      </button>
                      {selectedCam ? (
                        <button
                          type="button"
                          data-nv-duplicar
                          title="Crea otra cámara igual (mismo modelo y ajustes)"
                          onClick={() => duplicarCamarasPorId([selectedCam.id])}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/25 bg-[#071018]/95 px-3.5 py-2 text-[11px] font-semibold text-white shadow-lg"
                        >
                          <CopyPlus className="h-3.5 w-3.5" />
                          Duplicar
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {multiMode ? (
                    <div
                      data-nv-multi-barra
                      className="absolute inset-x-2 bottom-[6.5rem] z-20 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-400/40 bg-[#071018]/95 p-2 text-[11px] text-white shadow-lg backdrop-blur-md"
                    >
                      <span className="min-w-0 flex-1 basis-40">
                        <span className="font-semibold">
                          {multiIds.length
                            ? resumenSeleccion(project, multiIds)
                            : 'Toca los equipos que quieres elegir'}
                        </span>
                        {multiIds.length > 1 ? (
                          <span className="block text-[10px] text-[var(--nexus-text-dim)]">
                            Arrastra uno para moverlos todos
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        disabled={project.cameras.length === 0}
                        onClick={() => setMultiIds(project.cameras.map((c) => c.id))}
                        className="min-h-10 rounded-lg border border-white/20 px-3 font-semibold disabled:opacity-40"
                      >
                        Todas las cámaras
                      </button>
                      {multiCamIds.length > 0 ? (
                        <select
                          value=""
                          aria-label="Cambiar modelo de las cámaras elegidas"
                          onChange={(e) => cambiarModeloVarias(e.target.value)}
                          className="min-h-10 max-w-[11rem] rounded-lg border border-white/20 bg-black/50 px-2 font-semibold text-white"
                        >
                          <option value="">Cambiar modelo…</option>
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
                      ) : null}
                      {multiCamIds.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => duplicarCamarasPorId(multiCamIds)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/20 px-3 font-semibold"
                        >
                          <CopyPlus className="h-3.5 w-3.5" />
                          Duplicar
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={multiIds.length === 0}
                        onClick={eliminarSeleccion}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-400/50 px-3 font-semibold text-red-200 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={salirSeleccionMultiple}
                        className="min-h-10 rounded-lg bg-[var(--nexus-cyan)] px-3.5 font-semibold text-black"
                      >
                        Listo
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              {viewMode === 'plano' && showActiveCoverage ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-[var(--nexus-text-muted)]">
                  <span className="font-semibold uppercase tracking-wide text-white">
                    Semáforo
                  </span>
                  {VISION_SEMAFORO_LEGEND.map((item) => (
                    <span key={item.band} className="inline-flex items-center gap-1">
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: item.hex }}
                      />
                      {item.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </GlassCardMotion>

        {inspectorOpen && !planoSetupOpen ? (
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
          {selectedInfra ? (
            <div className="mb-3 space-y-2 rounded-lg border border-white/15 bg-black/25 p-2.5 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
                Seleccionado · {selectedInfra.kind === 'monitor' ? 'Pantalla' : selectedInfra.kind === 'hdd' ? 'Disco' : selectedInfra.kind === 'ups' ? 'UPS' : 'Rack'}
              </p>
              <label className="block">
                <span className="text-[var(--nexus-text-dim)]">Etiqueta</span>
                <input
                  value={selectedInfra.label}
                  onChange={(e) =>
                    patchInfraDevice(selectedInfra.id, { label: e.target.value })
                  }
                  className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                />
              </label>
              {selectedInfra.kind === 'hdd' ? (
                <label className="block">
                  <span className="text-[var(--nexus-text-dim)]">Capacidad</span>
                  <select
                    value={clampHddTb(selectedInfra.capacityTb ?? 4)}
                    onChange={(e) =>
                      patchInfraDevice(selectedInfra.id, {
                        capacityTb: clampHddTb(Number(e.target.value)),
                      })
                    }
                    className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                  >
                    {[1, 2, 4, 6, 8, 10, 12, 16, 20].map((tb) => (
                      <option key={tb} value={tb}>
                        {tb} TB
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {selectedInfra.kind === 'rack' ? (
                <label className="block">
                  <span className="text-[var(--nexus-text-dim)]">Tamaño</span>
                  <select
                    value={clampRackSizeU(selectedInfra.rackUnits)}
                    onChange={(e) => {
                      const u = clampRackSizeU(Number(e.target.value))
                      const next = resizeRack(
                        selectedInfra,
                        u,
                        listMountables(
                          project.networkNodes,
                          project.infraDevices ?? [],
                        ),
                      )
                      patchInfraDevice(selectedInfra.id, {
                        rackUnits: next.rackUnits,
                        modelId: next.modelId,
                        mounts: next.mounts,
                      })
                    }}
                    className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                  >
                    {[4, 6, 9, 12, 15, 18, 22, 27, 42].map((u) => (
                      <option key={u} value={u}>
                        {u}U
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Button
                type="button"
                variant="glass"
                className="w-full"
                onClick={() => quitar(selectedInfra.id)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Quitar
              </Button>
            </div>
          ) : null}
          {sideTab === 'cctv' ? (
            <div className="mb-3">
              <NetVisionSalaTecnica
                networkNodes={project.networkNodes}
                infraDevices={project.infraDevices ?? []}
                defaultNvrId={defaultNetModels.nvr}
                defaultDvrId={defaultDvrId}
                defaultInfra={defaultInfra}
                defaultHddTb={defaultHddTb}
                defaultRackU={defaultRackU}
                disabled={!project.planoUrl || loading}
                onDefaultNvr={(id) =>
                  setDefaultNetModels((m) => ({ ...m, nvr: id }))
                }
                onDefaultDvr={setDefaultDvrId}
                onDefaultInfra={(kind, id) =>
                  setDefaultInfra((m) => ({ ...m, [kind]: id }))
                }
                onDefaultHddTb={setDefaultHddTb}
                onDefaultRackU={setDefaultRackU}
                onAddRecorder={addRecorderFromButton}
                onAddInfra={addInfraFromButton}
                onPatchInfra={patchInfraDevice}
                onSelect={(id) => {
                  setSelectedId(id)
                  setInspectorOpen(true)
                }}
              />
              <div className="mt-3">
                <NetVisionDimensionamiento
                  grabacion={dimGrabacion}
                  ups={dimUps}
                  disabled={loading}
                  onDias={(dias) => setProject((p) => ({ ...p, retentionDays: dias }))}
                  onMinutos={(minutos) =>
                    setProject((p) => ({ ...p, upsBackupMin: minutos }))
                  }
                />
              </div>
            </div>
          ) : null}
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
              onDetectIa={() => void detectarMurosConIa()}
              detectingIa={detectandoIa}
              onShowOnPlan={setShowStructures}
              grosorMuro={sliderGrosor}
              onGrosorMuro={applyGrosorMuro}
              onDrawMaterial={(id) => {
                setDrawStructureMaterial(id)
                setStructureDraft(null)
                setStructureCursor(null)
                setDrawUnderground(false)
                setUndergroundDraft(null)
                setDrawCable(false)
                clearCableDraft()
                if (id) {
                  setCalibrateMode(false)
                  setViewMode('plano')
                  setShowStructures(true)
                  setInspectorOpen(false)
                }
              }}
              onSelect={(id) => {
                setSelectedId(id)
                setInspectorOpen(true)
                setSideTab('muros')
              }}
              onRemove={quitar}
              onFinishDraft={() => {
                setStructureDraft(null)
                setStructureCursor(null)
              }}
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
              onChange={(patch) =>
                setProject((p) =>
                  patch.currency && patch.currency !== p.currency
                    ? { ...cambiarMoneda(p, patch.currency), ...patch }
                    : { ...p, ...patch },
                )
              }
            />
          ) : sideTab === 'sub' ? (
            <div className="space-y-4">
              <NetVisionZanjaModo
                modo={project.zanjaModo ?? 'no_cobrar'}
                metros={undergroundPlan.totalPipeM}
                disabled={loading}
                onChange={(zanjaModo) => setProject((p) => ({ ...p, zanjaModo }))}
              />
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
                <NetVisionCameraVisionToggles
                  cameras={project.cameras}
                  hiddenIds={hiddenLive}
                  onShowAll={showAllCameraCoverage}
                  onSolo={(id) => {
                    soloCameraCoverage(id)
                    selectCameraFromMenu(id, true)
                  }}
                  onToggle={toggleCameraCoverage}
                  onSelect={(id) => selectCameraFromMenu(id, true)}
                />
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
                          const lb = visionBandRangesM(
                            l.rangeM,
                            l.catalogRangeM,
                            cameraVisionBandQuality(selectedCam, l.lensId),
                          )
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
                              <span style={{ color: VISION_SEMAFORO_HEX.green }}>
                                Verde 0–
                                {formatLength(lb.greenMaxM, project.unitSystem ?? 'metric')}
                                {' '}
                                (identifica rostros)
                              </span>
                              {lb.yellowMaxM > lb.greenMaxM + 0.05 ? (
                                <>
                                  {' · '}
                                  <span style={{ color: VISION_SEMAFORO_HEX.yellow }}>
                                    naranja hasta{' '}
                                    {formatLength(lb.yellowMaxM, project.unitSystem ?? 'metric')}
                                  </span>
                                </>
                              ) : null}
                              {lb.redMaxM > lb.yellowMaxM + 0.05 ? (
                                <>
                                  {' · '}
                                  <span style={{ color: VISION_SEMAFORO_HEX.red }}>
                                    rojo hasta{' '}
                                    {formatLength(lb.redMaxM, project.unitSystem ?? 'metric')}
                                  </span>
                                </>
                              ) : null}
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
                          Verde es hasta dónde identifica un rostro a esta altura.
                          Naranja son 1 m más. Más allá es rojo.
                          Estirar el cono no agranda el verde: solo alarga el rojo.
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
                              selectedCam.lensFocalMm,
                            )
                            updateSelectedCam(vision)
                          }}
                        >
                          Restaurar FOV/alcance del modelo (
                          {lenteElegida(model, selectedCam)?.fovDeg ?? model.fovDeg}° /{' '}
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
