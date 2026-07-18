'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type Konva from 'konva'
import {
  Camera,
  Download,
  FileJson,
  Trash2,
  Upload,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/nexus/ui/button'
import { GlassCardMotion } from '@/components/nexus/GlassCard'
import { Mono } from '@/components/nexus/Mono'
import BOMGenerator from '@/components/netvision/BOMGenerator'
import CableRoutingEngine from '@/components/netvision/CableRoutingEngine'
import ConduitCalculator from '@/components/netvision/ConduitCalculator'
import DiagramGenerator from '@/components/netvision/DiagramGenerator'
import NetworkDesigner from '@/components/netvision/NetworkDesigner'
import NetVisionLayerHelp, {
  layerHelpTitle,
} from '@/components/netvision/NetVisionLayerHelp'
import UndergroundCanalizationTool from '@/components/netvision/UndergroundCanalizationTool'
import ComplianceValidatorPanel from '@/components/netvision/ComplianceValidator'
import BIMViewer from '@/components/netvision/BIMViewer'
import ValidationEngine from '@/components/netvision/ValidationEngine'
import {
  CAMERA_CATALOG,
  DEFAULT_CAMERA_MODEL_ID,
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
  defaultScale,
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
} from '@/lib/netvision/services/wifiPredictor'
import {
  buildCableRoutes,
  validateCableRoutes,
} from '@/lib/netvision/services/cableRoutingEngine'
import {
  planConduits,
  validateConduits,
} from '@/lib/netvision/services/conduitCalculator'
import {
  buildUndergroundPlan,
  validateUnderground,
  type ChamberMaterial,
  type TerrainType,
  type ZoneType,
} from '@/lib/netvision/services/canalizationCalculator'
import {
  complianceValidator,
  designFromRoutes,
  profilesForCountry,
} from '@/lib/netvision/services/complianceValidator'
import {
  clearProjectStorage,
  emptyProject,
  loadProject,
  saveProject,
} from '@/lib/netvision/storage'
import type {
  DesignCamera,
  DesignNetworkNode,
  NetVisionProject,
  NetworkNodeKind,
} from '@/lib/netvision/types'
import {
  downloadDataUrl,
  downloadJson,
  openSpecsPrintable,
  projectToExportJson,
} from '@/lib/netvision/utils/exporters'

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
  const [showLinks, setShowLinks] = useState(true)
  const [showCableRoutes, setShowCableRoutes] = useState(true)
  const [showUnderground, setShowUnderground] = useState(false)
  const [ugZone, setUgZone] = useState<ZoneType>('vehicle')
  const [ugTerrain, setUgTerrain] = useState<TerrainType>('medium')
  const [ugChamberMat, setUgChamberMat] = useState<ChamberMaterial>('polietileno')
  const [nightMode, setNightMode] = useState(false)
  const [loading, setLoading] = useState(false)
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
    'cctv' | 'red' | 'cable' | 'sub' | 'norm' | 'bim'
  >('cctv')
  const [viewMode, setViewMode] = useState<'plano' | 'diagrama'>('plano')
  const [complianceCountry, setComplianceCountry] = useState('VE')
  const fileRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)

  useEffect(() => {
    const p = loadProject()
    setProject(p)
    if (p.complianceProfileId) setComplianceCountry(p.complianceProfileId)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveProject(project)
  }, [project, hydrated])

  const sectors = useMemo(
    () => buildCoverageSectors(project.cameras, project.scale, nightMode ? 'night' : 'day'),
    [project.cameras, project.scale, nightMode],
  )

  const wifiCircles = useMemo(
    () => buildWifiCoverage(project.networkNodes, project.scale),
    [project.networkNodes, project.scale],
  )

  const linkAdvice = useMemo(
    () => adviseCameraLinks(project.cameras, project.networkNodes, project.scale),
    [project.cameras, project.networkNodes, project.scale],
  )

  const poeAnalysis = useMemo(
    () => analyzePoeBudget(project.cameras, project.networkNodes),
    [project.cameras, project.networkNodes],
  )

  const cableRoutes = useMemo(
    () => buildCableRoutes(project.cameras, project.networkNodes, project.scale),
    [project.cameras, project.networkNodes, project.scale],
  )

  const conduitPlans = useMemo(() => planConduits(cableRoutes), [cableRoutes])

  const undergroundPlan = useMemo(
    () =>
      buildUndergroundPlan(cableRoutes, {
        zone: ugZone,
        terrain: ugTerrain,
        chamberMaterial: ugChamberMat,
      }),
    [cableRoutes, ugZone, ugTerrain, ugChamberMat],
  )

  const validations = useMemo(() => {
    const cov = analyzeRedundancy(project.cameras, sectors)
    const wifi = analyzeWifiCoverage(project.networkNodes, project.scale)
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
      }))
      setSelectedId(null)
      setCalibrateMode(false)
      setCalibPoints([])
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

  const onAddAt = (normX: number, normY: number) => {
    if (!project.planoUrl) return

    if (calibrateMode) {
      const next = [...calibPoints, { x: normX, y: normY }]
      if (next.length >= 2) {
        const a = next[0]!
        const b = next[1]!
        const meters = Math.max(0.5, Number(calibMeters) || 10)
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

  const updateSelectedCam = (patch: Partial<DesignCamera>) => {
    if (!selectedId) return
    setProject((p) => ({
      ...p,
      cameras: p.cameras.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)),
    }))
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
    setProject((p) => ({
      ...p,
      cameras: p.cameras.filter((c) => c.id !== id),
      networkNodes: p.networkNodes.filter((n) => n.id !== id),
    }))
    if (selectedId === id) setSelectedId(null)
  }

  const limpiarPlano = () => {
    setProject(emptyProject())
    setSelectedId(null)
    clearProjectStorage()
  }

  const exportPng = () => {
    const stage = stageRef.current
    if (!stage) return
    downloadDataUrl('netvision-plano.png', stage.toDataURL({ pixelRatio: 2 }))
  }

  const exportJson = () => {
    downloadJson('netvision-design.json', projectToExportJson(project, bom))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">NetVision Pro</h1>
          <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">
            CCTV · redes · cableado · subterráneo · normas · BIM
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="glass"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {loading ? 'Cargando…' : 'Cargar PDF / imagen'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          {project.planoUrl ? (
            <>
              <Button type="button" variant="glass" onClick={exportPng}>
                <Download className="mr-2 h-4 w-4" />
                PNG
              </Button>
              <Button type="button" variant="glass" onClick={exportJson}>
                <FileJson className="mr-2 h-4 w-4" />
                JSON
              </Button>
              <Button
                type="button"
                variant="glass"
                onClick={() => openSpecsPrintable(project, bom)}
              >
                PDF specs
              </Button>
              <Button type="button" variant="glass" onClick={limpiarPlano}>
                <Undo2 className="mr-2 h-4 w-4" />
                Nuevo plano
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_300px_280px]">
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
                Revisa FOV, WiFi y enlaces.
              </p>
            </button>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
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
                <p className="truncate text-xs text-[var(--nexus-text-muted)]">
                  <Mono>{project.planoNombre || 'Plano'}</Mono>
                  {' · '}
                  {project.cameras.length} cam · {project.networkNodes.length} red
                  {' · '}
                  {project.scale.calibrated ? (
                    <span className="text-[var(--nexus-green)]">escala OK</span>
                  ) : (
                    <span className="text-amber-300">escala ~40 m</span>
                  )}
                </p>
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
                      FOV
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
                      }}
                    >
                      Calibrar
                    </button>
                    {calibrateMode ? (
                      <label className="flex items-center gap-1 text-[11px] text-[var(--nexus-text-dim)]">
                        m
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
                      className="max-w-[180px] rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white"
                      title="Modelo de cámara al agregar"
                    >
                      {CAMERA_CATALOG.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.brand} · {m.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
              </div>
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
                    calibrateMode ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                >
                  <CameraPlacementTool
                    backgroundUrl={project.planoUrl}
                    cameras={project.cameras}
                    networkNodes={project.networkNodes}
                    sectors={sectors}
                    wifiCircles={wifiCircles}
                    linkLines={linkLines}
                    cableRoutes={cableRoutes}
                    undergroundRuns={undergroundPlan.runs}
                    selectedId={selectedId}
                    placeMode={calibrateMode}
                    showFov={showFov}
                    showWifi={showWifi}
                    showLinks={showLinks}
                    showCableRoutes={showCableRoutes}
                    showUnderground={showUnderground}
                    onAddAt={onAddAt}
                    onMove={onMove}
                    onSelect={setSelectedId}
                    stageRef={stageRef}
                  />
                </div>
              )}
            </>
          )}
        </GlassCardMotion>

        <GlassCardMotion delay={0.04} className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
            {(
              [
                ['cctv', 'CCTV'],
                ['red', 'Red'],
                ['cable', 'Cable'],
                ['sub', 'Sub'],
                ['norm', 'Norm'],
                ['bim', 'BIM'],
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
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {sideTab === 'norm' ? (
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
          ) : sideTab === 'bim' ? (
            <BIMViewer project={project} cableRoutes={cableRoutes} />
          ) : sideTab === 'sub' ? (
            <div className="space-y-4">
              <UndergroundCanalizationTool
                plan={undergroundPlan}
                zone={ugZone}
                terrain={ugTerrain}
                chamberMaterial={ugChamberMat}
                onZone={setUgZone}
                onTerrain={setUgTerrain}
                onChamberMaterial={setUgChamberMat}
              />
              <div className="border-t border-white/10 pt-3">
                <h3 className="mb-2 text-xs font-bold uppercase text-[var(--nexus-text-muted)]">
                  Validaciones
                </h3>
                <ValidationEngine results={validations} onSelectCamera={setSelectedId} />
              </div>
            </div>
          ) : sideTab === 'cable' ? (
            <div className="space-y-4">
              <CableRoutingEngine
                routes={cableRoutes}
                onSelect={(fromId) => setSelectedId(fromId)}
              />
              <div className="border-t border-white/10 pt-3">
                <ConduitCalculator
                  plans={conduitPlans}
                  onSelectNode={setSelectedId}
                />
              </div>
              <div className="border-t border-white/10 pt-3">
                <h3 className="mb-2 text-xs font-bold uppercase text-[var(--nexus-text-muted)]">
                  Validaciones
                </h3>
                <ValidationEngine results={validations} onSelectCamera={setSelectedId} />
              </div>
            </div>
          ) : sideTab === 'red' ? (
            <NetworkDesigner
              nodes={project.networkNodes}
              defaultModels={defaultNetModels}
              poeRows={poeAnalysis.rows}
              linkAdvice={linkAdvice}
              disabled={!project.planoUrl || loading}
              onAddKind={addNetworkFromButton}
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
                      onChange={(e) => updateSelectedCam({ modelId: e.target.value })}
                      className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                    >
                      {CAMERA_CATALOG.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.brand} · {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[var(--nexus-text-dim)]">
                      Orientación (yaw) {selectedCam.yawDeg}°
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={359}
                      value={selectedCam.yawDeg}
                      onChange={(e) =>
                        updateSelectedCam({ yawDeg: Number(e.target.value) })
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                  <p className="text-[10px] text-[var(--nexus-text-dim)]">
                    {(() => {
                      const m = getCameraModelOrDefault(selectedCam.modelId)
                      return `${m.fovDeg}° FOV · ${m.poeWatts} W · ${m.bitrateMbps} Mbps`
                    })()}
                  </p>
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
                  Selecciona una cámara o nodo de red.
                </p>
              )}

              <div className="border-t border-white/10 pt-3">
                <h3 className="mb-2 text-xs font-bold uppercase text-[var(--nexus-text-muted)]">
                  Validaciones
                </h3>
                <ValidationEngine
                  results={validations}
                  onSelectCamera={setSelectedId}
                />
              </div>
            </>
          )}

          {sideTab === 'red' ? (
            <div className="border-t border-white/10 pt-3">
              <h3 className="mb-2 text-xs font-bold uppercase text-[var(--nexus-text-muted)]">
                Validaciones
              </h3>
              <ValidationEngine results={validations} onSelectCamera={setSelectedId} />
            </div>
          ) : null}
        </GlassCardMotion>

        <GlassCardMotion delay={0.08} className="space-y-3 p-4">
          <BOMGenerator
            bom={bom}
            retentionDays={project.retentionDays}
            onRetentionChange={(days) =>
              setProject((p) => ({ ...p, retentionDays: days }))
            }
          />
        </GlassCardMotion>
      </div>
    </div>
  )
}
