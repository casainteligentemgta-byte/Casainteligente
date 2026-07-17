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
import ValidationEngine from '@/components/netvision/ValidationEngine'
import {
  CAMERA_CATALOG,
  DEFAULT_CAMERA_MODEL_ID,
  getCameraModelOrDefault,
} from '@/lib/netvision/catalog/cameras'
import {
  buildCoverageSectors,
  defaultScale,
} from '@/lib/netvision/services/coverageCalculator'
import { buildBom } from '@/lib/netvision/services/bandwidthCalculator'
import { analyzeRedundancy } from '@/lib/netvision/services/redundancyAnalyzer'
import {
  clearProjectStorage,
  loadProject,
  saveProject,
} from '@/lib/netvision/storage'
import type { DesignCamera, NetVisionProject } from '@/lib/netvision/types'
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
  const [project, setProject] = useState<NetVisionProject>(() => ({
    version: 1,
    planoUrl: null,
    planoNombre: '',
    cameras: [],
    scale: defaultScale(),
    retentionDays: 30,
    complianceProfileId: 'VE',
  }))
  const [hydrated, setHydrated] = useState(false)
  const [modoColocar, setModoColocar] = useState(true)
  const [showFov, setShowFov] = useState(true)
  const [nightMode, setNightMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [defaultModelId, setDefaultModelId] = useState(DEFAULT_CAMERA_MODEL_ID)
  const [calibrateMode, setCalibrateMode] = useState(false)
  const [calibPoints, setCalibPoints] = useState<{ x: number; y: number }[]>([])
  const [calibMeters, setCalibMeters] = useState('10')
  const fileRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)

  useEffect(() => {
    setProject(loadProject())
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

  const validations = useMemo(
    () => analyzeRedundancy(project.cameras, sectors),
    [project.cameras, sectors],
  )

  const bom = useMemo(
    () => buildBom(project.cameras, project.retentionDays),
    [project.cameras, project.retentionDays],
  )

  const selected = project.cameras.find((c) => c.id === selectedId) ?? null

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
      }))
      setSelectedId(null)
      setModoColocar(true)
      setCalibrateMode(false)
      setCalibPoints([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el plano')
    } finally {
      setLoading(false)
    }
  }, [])

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
      return
    }

    if (!modoColocar) return
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
    setProject((p) => ({ ...p, cameras: [...p.cameras, pin] }))
    setSelectedId(pin.id)
  }

  const onMove = (id: string, normX: number, normY: number) => {
    setProject((p) => ({
      ...p,
      cameras: p.cameras.map((c) =>
        c.id === id
          ? {
              ...c,
              x: Math.round(normX * 1000) / 1000,
              y: Math.round(normY * 1000) / 1000,
            }
          : c,
      ),
    }))
  }

  const updateSelected = (patch: Partial<DesignCamera>) => {
    if (!selectedId) return
    setProject((p) => ({
      ...p,
      cameras: p.cameras.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)),
    }))
  }

  const quitar = (id: string) => {
    setProject((p) => ({ ...p, cameras: p.cameras.filter((c) => c.id !== id) }))
    if (selectedId === id) setSelectedId(null)
  }

  const limpiarPlano = () => {
    setProject({
      version: 1,
      planoUrl: null,
      planoNombre: '',
      cameras: [],
      scale: defaultScale(),
      retentionDays: 30,
      complianceProfileId: 'VE',
    })
    setSelectedId(null)
    clearProjectStorage()
  }

  const exportPng = () => {
    const stage = stageRef.current
    if (!stage) return
    downloadDataUrl('netvision-plano.png', stage.toDataURL({ pixelRatio: 2 }))
  }

  const exportJson = () => {
    downloadJson(
      'netvision-design.json',
      projectToExportJson(project, bom),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">NetVision Pro</h1>
          <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">
            Diseño CCTV inteligente: cobertura FOV, catálogo multi-marca, BOM y export.
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
                PDF (primera página) o imagen. Calibra la escala, coloca cámaras del catálogo y
                revisa conos FOV + BOM.
              </p>
            </button>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p className="truncate text-xs text-[var(--nexus-text-muted)]">
                  <Mono>{project.planoNombre || 'Plano'}</Mono>
                  {' · '}
                  {project.cameras.length} cámara{project.cameras.length === 1 ? '' : 's'}
                  {' · '}
                  {project.scale.calibrated ? (
                    <span className="text-[var(--nexus-green)]">escala OK</span>
                  ) : (
                    <span className="text-amber-300">escala estimada ~40 m</span>
                  )}
                </p>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]">
                  <input
                    type="checkbox"
                    checked={modoColocar && !calibrateMode}
                    onChange={(e) => {
                      setModoColocar(e.target.checked)
                      if (e.target.checked) setCalibrateMode(false)
                    }}
                  />
                  Colocar
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]">
                  <input
                    type="checkbox"
                    checked={showFov}
                    onChange={(e) => setShowFov(e.target.checked)}
                  />
                  FOV
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--nexus-cyan)]">
                  <input
                    type="checkbox"
                    checked={nightMode}
                    onChange={(e) => setNightMode(e.target.checked)}
                  />
                  Noche
                </label>
                <button
                  type="button"
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    calibrateMode
                      ? 'bg-[var(--nexus-cyan)] text-black'
                      : 'text-[var(--nexus-cyan)]'
                  }`}
                  onClick={() => {
                    setCalibrateMode((v) => !v)
                    setCalibPoints([])
                    setModoColocar(false)
                  }}
                >
                  Calibrar escala
                </button>
                {calibrateMode ? (
                  <label className="flex items-center gap-1 text-[11px] text-[var(--nexus-text-dim)]">
                    Distancia real (m)
                    <input
                      value={calibMeters}
                      onChange={(e) => setCalibMeters(e.target.value)}
                      className="w-14 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-xs text-white"
                    />
                    · clic 2 puntos ({calibPoints.length}/2)
                  </label>
                ) : null}
                <select
                  value={defaultModelId}
                  onChange={(e) => setDefaultModelId(e.target.value)}
                  className="max-w-[200px] rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white"
                  title="Modelo al colocar"
                >
                  {CAMERA_CATALOG.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.brand} · {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className={`h-[min(62vh,560px)] w-full overflow-hidden rounded-xl border border-[rgba(0,242,254,0.2)] bg-black ${
                  modoColocar || calibrateMode ? 'cursor-crosshair' : 'cursor-default'
                }`}
              >
                <CameraPlacementTool
                  backgroundUrl={project.planoUrl}
                  cameras={project.cameras}
                  sectors={sectors}
                  selectedId={selectedId}
                  placeMode={modoColocar || calibrateMode}
                  showFov={showFov}
                  onAddAt={onAddAt}
                  onMove={onMove}
                  onSelect={setSelectedId}
                  stageRef={stageRef}
                />
              </div>
            </>
          )}
        </GlassCardMotion>

        <GlassCardMotion delay={0.04} className="space-y-3 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
            Inspector
          </h2>
          {selected ? (
            <div className="space-y-2 text-xs">
              <label className="block">
                <span className="text-[var(--nexus-text-dim)]">Etiqueta</span>
                <input
                  value={selected.label}
                  onChange={(e) => updateSelected({ label: e.target.value })}
                  className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                />
              </label>
              <label className="block">
                <span className="text-[var(--nexus-text-dim)]">Modelo</span>
                <select
                  value={selected.modelId}
                  onChange={(e) => updateSelected({ modelId: e.target.value })}
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
                  Orientación (yaw) {selected.yawDeg}°
                </span>
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={selected.yawDeg}
                  onChange={(e) => updateSelected({ yawDeg: Number(e.target.value) })}
                  className="mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-[var(--nexus-text-dim)]">Altura montaje (m)</span>
                <input
                  type="number"
                  step={0.1}
                  min={1}
                  max={12}
                  value={selected.mountHeightM}
                  onChange={(e) =>
                    updateSelected({ mountHeightM: Number(e.target.value) || 2.8 })
                  }
                  className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                />
              </label>
              <p className="text-[10px] text-[var(--nexus-text-dim)]">
                {(() => {
                  const m = getCameraModelOrDefault(selected.modelId)
                  return `${m.fovDeg}° FOV · día ${m.rangeDayM}m · noche ${m.rangeNightM}m · ${m.bitrateMbps} Mbps · ${m.poeWatts} W`
                })()}
              </p>
              <Button
                type="button"
                variant="glass"
                className="w-full"
                onClick={() => quitar(selected.id)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Quitar cámara
              </Button>
            </div>
          ) : (
            <p className="text-xs text-[var(--nexus-text-dim)]">
              Selecciona una cámara en el plano o la lista.
            </p>
          )}

          <div className="border-t border-white/10 pt-3">
            <h3 className="mb-2 text-xs font-bold uppercase text-[var(--nexus-text-muted)]">
              Cámaras
            </h3>
            {project.cameras.length === 0 ? (
              <p className="text-xs text-[var(--nexus-text-dim)]">Ninguna aún.</p>
            ) : (
              <ul className="max-h-52 space-y-1 overflow-auto">
                {project.cameras.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] ${
                        selectedId === c.id
                          ? 'border-[var(--nexus-cyan)] bg-[rgba(0,242,254,0.08)]'
                          : 'border-white/10 bg-black/20'
                      }`}
                    >
                      <span className="font-semibold text-white">{c.label}</span>
                      <span className="mt-0.5 block truncate text-[var(--nexus-text-dim)]">
                        {getCameraModelOrDefault(c.modelId).brand}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-white/10 pt-3">
            <h3 className="mb-2 text-xs font-bold uppercase text-[var(--nexus-text-muted)]">
              Validaciones
            </h3>
            <ValidationEngine results={validations} onSelectCamera={setSelectedId} />
          </div>
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
