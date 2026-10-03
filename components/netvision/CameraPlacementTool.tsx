'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import {
  Arc,
  Circle,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type {
  CableRoute,
  CoverageSector,
  DesignCamera,
  DesignNetworkNode,
  DesignPlanDevice,
  DesignStructure,
  SpectrumCell,
} from '@/lib/netvision/types'
import { planDeviceColor } from '@/lib/netvision/catalog/planDevices'
import { effectiveCameraLenses } from '@/lib/netvision/catalog/cameras'
import { getStructureMaterialOrDefault } from '@/lib/netvision/catalog/materials'
import { degToRad } from '@/lib/netvision/utils/geometryHelpers'
import { snapOrtho90 } from '@/lib/netvision/utils/structureDraw'
import {
  clampNetworkPlanSize,
  networkNodeHalfPx,
  resolveNetworkPlanSize,
} from '@/lib/netvision/utils/networkNodeSize'
import type { WifiCoverageCircle } from '@/lib/netvision/services/wifiPredictor'
import type { AccessChamber, UndergroundRun } from '@/lib/netvision/services/canalizationCalculator'
import { nearestSegmentOnRoute, MANUAL_CABLE_TO_ID } from '@/lib/netvision/services/cableRoutingEngine'
import {
  applyNightPlanoPalette,
  clampGrosorMuro,
  type NightPlanoOptions,
} from '@/lib/netvision/utils/nightPlanoPalette'
import { shouldSmoothPlanoImage } from '@/lib/netvision/utils/renderPdfPlano'
import {
  visionPatchFromPointer,
  type VisionHandleMode,
} from '@/lib/netvision/utils/visionAdjust'

export type CameraPlacementToolProps = {
  backgroundUrl: string | null
  /** Invierte el plano en pantalla (fondo negro, trazos blancos). No altera el archivo. */
  invertBackground?: boolean
  invertOptions?: NightPlanoOptions
  /** Grosor de muros dibujados (0–100). */
  wallStrokeGrosor?: number
  cameras: DesignCamera[]
  networkNodes: DesignNetworkNode[]
  planDevices?: DesignPlanDevice[]
  structures?: DesignStructure[]
  sectors: CoverageSector[]
  visionSpectrum?: SpectrumCell[]
  wifiCircles: WifiCoverageCircle[]
  wifiSpectrum?: SpectrumCell[]
  soundSpectrum?: SpectrumCell[]
  linkLines: { fromX: number; fromY: number; toX: number; toY: number; warn?: boolean }[]
  cableRoutes?: CableRoute[]
  undergroundRuns?: UndergroundRun[]
  selectedId: string | null
  placeMode: boolean
  draftPoint?: { x: number; y: number } | null
  /** Vértices del cable en curso (polilínea). */
  draftPoints?: { x: number; y: number }[]
  /** Cursor con snap ortho / imán mientras se traza. */
  draftCursor?: { x: number; y: number } | null
  /** Color del punto de borrador (muros cyan, sub naranja, cable amarillo). */
  draftColor?: string
  /** Etiqueta sobre el trazo (p. ej. cota de calibración). */
  draftLabel?: string | null
  showFov: boolean
  /** Opacidad del semáforo CCTV (0–1). Por defecto translúcido para ver el plano. */
  visionOpacity?: number
  showWifi: boolean
  showSound?: boolean
  showLinks: boolean
  showCableRoutes?: boolean
  showUnderground?: boolean
  /** Muros / vidrio / ventana / puerta en el plano. */
  showStructures?: boolean
  onAddAt: (normX: number, normY: number) => void
  onDraftPointerMove?: (normX: number, normY: number) => void
  onFinishPlace?: () => void
  /** En placeMode, tocar cámara/nodo ancla el trazo a ese punto. */
  snapPlaceToDevices?: boolean
  onMove: (id: string, normX: number, normY: number) => void
  /** Ajuste interactivo de óptica (yaw / FOV por lado / alcance) desde el plano. */
  onAdjustCameraVision?: (
    id: string,
    patch: {
      yawDeg?: number
      fovDeg?: number
      fovLeftDeg?: number
      fovRightDeg?: number
      rangeM?: number
    },
    /** Dual: lente a ajustar (cada cono mira por su cuenta). Sin valor = óptica primaria. */
    lensId?: string,
  ) => void
  metersPerNormX?: number
  metersPerNormY?: number
  nightMode?: boolean
  onSelect: (id: string) => void
  /** Toque (no arrastre): abrir ficha de configuración. */
  onInspect?: (id: string) => void
  /** Mover un quiebre (índice 0-based entre extremos) de una ruta auto. */
  onCableWaypointMove?: (
    routeId: string,
    midIndex: number,
    normX: number,
    normY: number,
  ) => void
  /** Insertar quiebre al tocar un segmento de la ruta. */
  onCableWaypointInsert?: (
    routeId: string,
    afterPointIndex: number,
    normX: number,
    normY: number,
  ) => void
  /** Doble toque en quiebre para eliminarlo. */
  onCableWaypointRemove?: (routeId: string, midIndex: number) => void
  /** Mover / redimensionar un muro (coords normalizadas 0–1). */
  onStructureMove?: (
    id: string,
    patch: { x1: number; y1: number; x2: number; y2: number },
  ) => void
  /** Cambiar tamaño del icono de red en el plano (fracción del ancho). */
  onNetworkSizeChange?: (id: string, planSizeNorm: number) => void
  stageRef?: React.MutableRefObject<Konva.Stage | null>
  /** Oculta el overlay +/−/% del plano (p. ej. si están en la barra junto al modelo). */
  showZoomOverlay?: boolean
  /** Notifica el factor de zoom actual (1 = 100%). */
  onZoomChange?: (zoom: number) => void
  /** API imperativa para botones externos de zoom. */
  zoomControlsRef?: React.MutableRefObject<NetVisionZoomControls | null>
}

export type NetVisionZoomControls = {
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
}

function spectrumFill(strength: number, hue: number, boost = 0) {
  const a = Math.min(0.72, 0.1 + boost + strength * 0.48)
  return `hsla(${hue}, 90%, ${42 + strength * 22}%, ${a})`
}

type SpectrumBand = 'red' | 'yellow' | 'green'

/** Semáforo de cobertura: verde / naranja / rojo translúcidos (se ve el plano debajo). */
function visionBandSolidFill(band: SpectrumBand): string {
  if (band === 'green') return 'rgba(34, 197, 94, 0.42)'
  if (band === 'yellow') return 'rgba(249, 115, 22, 0.36)'
  return 'rgba(239, 68, 68, 0.30)'
}

function sectorPolyPoints(
  poly: { x: number; y: number }[] | undefined,
  offsetX: number,
  offsetY: number,
  drawW: number,
  drawH: number,
): number[] | null {
  if (!poly || poly.length < 3) return null
  const pts: number[] = []
  for (const p of poly) {
    pts.push(offsetX + p.x * drawW, offsetY + p.y * drawH)
  }
  return pts
}

/**
 * Semáforo CCTV relleno con polígonos del FOV (elipse + recorte de muros).
 * Arcos circulares no cubrían el cono en planos apaisados y dejaban huecos.
 * Se pinta rojo → amarillo → verde para que en solapes gane la mejor detección.
 */
function VisionSpectrumLayer({
  sectors,
  offsetX,
  offsetY,
  drawW,
  drawH,
  opacity = 0.36,
}: {
  sectors: CoverageSector[]
  offsetX: number
  offsetY: number
  drawW: number
  drawH: number
  /** 0–1: qué tan opaco se ve el semáforo sobre el plano. */
  opacity?: number
}) {
  const bands: { band: SpectrumBand; polyOf: (s: CoverageSector) => { x: number; y: number }[] | undefined }[] =
    [
      { band: 'red', polyOf: (s) => s.polygon },
      { band: 'yellow', polyOf: (s) => s.yellowPolygon },
      { band: 'green', polyOf: (s) => s.greenPolygon },
    ]
  const layerOpacity = Math.min(1, Math.max(0.1, opacity))
  return (
    <Layer listening={false} opacity={layerOpacity}>
      {bands.flatMap(({ band, polyOf }) =>
        sectors.flatMap((s) => {
          const pts = sectorPolyPoints(polyOf(s), offsetX, offsetY, drawW, drawH)
          if (!pts) return []
          const lens = s.lensId ?? 'main'
          return [
            <Line
              key={`vis-band-${band}-${s.cameraId}-${lens}`}
              points={pts}
              closed
              fill={visionBandSolidFill(band)}
              listening={false}
              perfectDrawEnabled={false}
              strokeEnabled={false}
            />,
          ]
        }),
      )}
    </Layer>
  )
}

const NODE_COLORS: Record<DesignNetworkNode['kind'], string> = {
  switch: '#a78bfa',
  ap: '#34d399',
  nvr: '#fbbf24',
  injector: '#fb7185',
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 6
const ZOOM_STEP = 1.2
const PINCH_TAP_SUPPRESS_MS = 350

function clampZoom(scale: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale))
}

function touchDistance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function touchCenterInEl(el: HTMLElement, a: Touch, b: Touch) {
  const rect = el.getBoundingClientRect()
  return {
    x: (a.clientX + b.clientX) / 2 - rect.left,
    y: (a.clientY + b.clientY) / 2 - rect.top,
  }
}

type PinchState = {
  lastDist: number
  lastScale: number
  lastPos: { x: number; y: number }
}

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 640, height: 420 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      setSize({
        width: Math.max(280, Math.floor(rect.width)),
        height: Math.max(280, Math.floor(rect.height)),
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return size
}

/** Tope para no tumbar iPad al invertir un CAD de 3000+ px. */
const INVERT_MAX_EDGE = 2048

function invertLoadedImage(
  img: HTMLImageElement,
  options?: NightPlanoOptions,
): HTMLImageElement | null {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (w < 1 || h < 1) return null
  const scale = Math.min(1, INVERT_MAX_EDGE / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = scale < 1
  ctx.drawImage(img, 0, 0, cw, ch)
  const imageData = ctx.getImageData(0, 0, cw, ch)
  applyNightPlanoPalette(imageData.data, cw, ch, options)
  ctx.putImageData(imageData, 0, 0)
  const inverted = new window.Image()
  inverted.src = canvas.toDataURL('image/jpeg', 0.92)
  return inverted
}

function invertOptionsKey(opts?: NightPlanoOptions): string {
  return `${opts?.cotaColor ?? 'auto'}:${clampGrosorMuro(opts?.grosorMuro)}`
}

function wallDrawnStroke(selected: boolean, grosor: number): number {
  const t = 0.28 + (clampGrosorMuro(grosor) / 100) * 1.5
  return Math.max(0.35, (selected ? 2.5 : 1.25) * t)
}

function useHtmlImage(url: string | null, invert = false, invertOptions?: NightPlanoOptions) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!url) {
      setImage(null)
      return
    }
    let cancelled = false
    const img = new window.Image()
    if (/^https?:/i.test(url)) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      if (cancelled) return
      if (!invert) {
        setImage(img)
        return
      }
      try {
        const inverted = invertLoadedImage(img, invertOptions)
        if (!inverted) {
          setImage(img)
          return
        }
        if (inverted.complete && inverted.naturalWidth > 0) {
          setImage(inverted)
          return
        }
        inverted.onload = () => {
          if (!cancelled) setImage(inverted)
        }
        inverted.onerror = () => {
          if (!cancelled) setImage(img)
        }
      } catch {
        if (!cancelled) setImage(img)
      }
    }
    img.onerror = () => {
      if (!cancelled) setImage(null)
    }
    img.src = url
    return () => {
      cancelled = true
    }
  }, [url, invert, invertOptionsKey(invertOptions)])
  return image
}

export default function CameraPlacementTool({
  backgroundUrl,
  invertBackground = false,
  invertOptions,
  wallStrokeGrosor = 50,
  cameras,
  networkNodes,
  planDevices = [],
  structures = [],
  sectors,
  wifiCircles,
  wifiSpectrum = [],
  soundSpectrum = [],
  linkLines,
  cableRoutes = [],
  undergroundRuns = [],
  selectedId,
  placeMode,
  draftPoint = null,
  draftPoints,
  draftCursor = null,
  draftColor = '#22d3ee',
  draftLabel = null,
  showFov,
  visionOpacity = 0.36,
  showWifi,
  showSound = false,
  showLinks,
  showCableRoutes = false,
  showUnderground = false,
  showStructures = true,
  onAddAt,
  onDraftPointerMove,
  onFinishPlace,
  snapPlaceToDevices = false,
  onMove,
  onAdjustCameraVision,
  metersPerNormX = 40,
  metersPerNormY = 40,
  nightMode = false,
  onSelect,
  onInspect,
  onCableWaypointMove,
  onCableWaypointInsert,
  onCableWaypointRemove,
  onStructureMove,
  onNetworkSizeChange,
  stageRef,
  showZoomOverlay = true,
  onZoomChange,
  zoomControlsRef,
}: CameraPlacementToolProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const localStageRef = useRef<Konva.Stage | null>(null)
  const { width, height } = useContainerSize(containerRef)
  const image = useHtmlImage(backgroundUrl, invertBackground, invertOptions)
  const [zoom, setZoom] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [pinching, setPinching] = useState(false)
  /** Asas de apertura/orientación/alcance: visibles al elegir la cámara; se ocultan al soltar tras ajustar. */
  const [visionHandlesOpen, setVisionHandlesOpen] = useState(false)
  const prevSelectedIdRef = useRef<string | null>(null)
  const viewRef = useRef({ zoom: 1, stagePos: { x: 0, y: 0 } })
  const pinchRef = useRef<PinchState | null>(null)
  const suppressTapUntilRef = useRef(0)
  /** Konva dispara onClick y onTap en el mismo toque (tablet); no colocar dos veces. */
  const lastPlaceAtRef = useRef(0)

  viewRef.current = { zoom, stagePos }

  useEffect(() => {
    if (selectedId === prevSelectedIdRef.current) return
    prevSelectedIdRef.current = selectedId
    const isCam = !!selectedId && cameras.some((c) => c.id === selectedId)
    setVisionHandlesOpen(isCam)
  }, [selectedId, cameras])

  useEffect(() => {
    onZoomChange?.(zoom)
  }, [zoom, onZoomChange])

  useEffect(() => {
    setZoom(1)
    setStagePos({ x: 0, y: 0 })
    viewRef.current = { zoom: 1, stagePos: { x: 0, y: 0 } }
    pinchRef.current = null
    setPinching(false)
  }, [backgroundUrl])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const endPinch = () => {
      if (!pinchRef.current) return
      pinchRef.current = null
      setPinching(false)
      suppressTapUntilRef.current = Date.now() + PINCH_TAP_SUPPRESS_MS
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      localStageRef.current?.stopDrag()
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      if (!t0 || !t1) return
      const { zoom: z, stagePos: pos } = viewRef.current
      pinchRef.current = {
        lastDist: Math.max(1, touchDistance(t0, t1)),
        lastScale: z,
        lastPos: { ...pos },
      }
      setPinching(true)
    }

    const onTouchMove = (e: TouchEvent) => {
      const pinch = pinchRef.current
      if (!pinch || e.touches.length < 2) return
      e.preventDefault()
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      if (!t0 || !t1) return

      const dist = Math.max(1, touchDistance(t0, t1))
      const center = touchCenterInEl(el, t0, t1)
      const nextScale = clampZoom(pinch.lastScale * (dist / pinch.lastDist))
      const pointTo = {
        x: (center.x - pinch.lastPos.x) / pinch.lastScale,
        y: (center.y - pinch.lastPos.y) / pinch.lastScale,
      }
      const nextPos = {
        x: center.x - pointTo.x * nextScale,
        y: center.y - pointTo.y * nextScale,
      }

      pinch.lastDist = dist
      pinch.lastScale = nextScale
      pinch.lastPos = nextPos
      viewRef.current = { zoom: nextScale, stagePos: nextPos }
      setZoom(nextScale)
      setStagePos(nextPos)

      const stage = localStageRef.current
      if (stage) {
        stage.scale({ x: nextScale, y: nextScale })
        stage.position(nextPos)
        stage.batchDraw()
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) endPinch()
    }

    const onGesture = (e: Event) => {
      e.preventDefault()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    // Safari iPad: evita el zoom de página sobre el canvas
    el.addEventListener('gesturestart', onGesture as EventListener)
    el.addEventListener('gesturechange', onGesture as EventListener)
    el.addEventListener('gestureend', onGesture as EventListener)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('gesturestart', onGesture as EventListener)
      el.removeEventListener('gesturechange', onGesture as EventListener)
      el.removeEventListener('gestureend', onGesture as EventListener)
    }
  }, [])

  const pad = 16
  let drawW = width - pad * 2
  let drawH = height - pad * 2
  let offsetX = pad
  let offsetY = pad

  if (image && image.width > 0 && image.height > 0) {
    const fit = Math.min(drawW / image.width, drawH / image.height)
    drawW = image.width * fit
    drawH = image.height * fit
    offsetX = (width - drawW) / 2
    offsetY = (height - drawH) / 2
  }

  const avg = (drawW + drawH) / 2

  const toNorm = (px: number, py: number) => ({
    x: Math.min(1, Math.max(0, (px - offsetX) / Math.max(drawW, 1))),
    y: Math.min(1, Math.max(0, (py - offsetY) / Math.max(drawH, 1))),
  })

  const applyZoomAt = (nextScale: number, pointer: { x: number; y: number } | null) => {
    const { zoom: oldScale, stagePos: pos } = viewRef.current
    const scale = clampZoom(nextScale)
    if (scale === oldScale) return
    const focus = pointer ?? { x: width / 2, y: height / 2 }
    const mousePointTo = {
      x: (focus.x - pos.x) / oldScale,
      y: (focus.y - pos.y) / oldScale,
    }
    const nextPos = {
      x: focus.x - mousePointTo.x * scale,
      y: focus.y - mousePointTo.y * scale,
    }
    viewRef.current = { zoom: scale, stagePos: nextPos }
    setStagePos(nextPos)
    setZoom(scale)
  }

  const resetView = () => {
    viewRef.current = { zoom: 1, stagePos: { x: 0, y: 0 } }
    setZoom(1)
    setStagePos({ x: 0, y: 0 })
  }

  useEffect(() => {
    if (!zoomControlsRef) return
    zoomControlsRef.current = {
      zoomIn: () => applyZoomAt(viewRef.current.zoom * ZOOM_STEP, null),
      zoomOut: () => applyZoomAt(viewRef.current.zoom / ZOOM_STEP, null),
      reset: resetView,
    }
    return () => {
      zoomControlsRef.current = null
    }
    // applyZoomAt / resetView cierran sobre width/height actuales vía viewRef
    // eslint-disable-next-line react-hooks/exhaustive-deps -- API estable vía viewRef
  }, [zoomControlsRef, width, height])

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const direction = e.evt.deltaY > 0 ? -1 : 1
    applyZoomAt(
      viewRef.current.zoom * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP),
      pointer,
    )
  }

  const handleStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (pinching) return
    if (Date.now() < suppressTapUntilRef.current) return
    if (e.target !== e.target.getStage()) return
    // Toque vacío: ocultar asas tras configurar la apertura (la cámara sigue seleccionada).
    if (!placeMode) {
      setVisionHandlesOpen(false)
      return
    }
    const now = Date.now()
    if (now - lastPlaceAtRef.current < 280) return
    lastPlaceAtRef.current = now
    const stage = e.target.getStage()
    if (!stage) return
    const pos = stage.getRelativePointerPosition()
    if (!pos) return
    const n = toNorm(pos.x, pos.y)
    onAddAt(n.x, n.y)
  }

  const handleStageMouseMove = () => {
    if (!placeMode || !onDraftPointerMove) return
    const stage = localStageRef.current
    if (!stage) return
    const pos = stage.getRelativePointerPosition()
    if (!pos) return
    const n = toNorm(pos.x, pos.y)
    onDraftPointerMove(n.x, n.y)
  }

  const setStage = (node: Konva.Stage | null) => {
    localStageRef.current = node
    if (stageRef) stageRef.current = node
  }

  // En iPad/tablet: un dedo siempre puede mover el plano; el tap corto sigue colocando.
  const canPan = !pinching

  const inspect = (id: string) => {
    onSelect(id)
    onInspect?.(id)
  }

  const pauseStageDrag = (stage: Konva.Stage | null) => {
    if (stage) stage.draggable(false)
  }
  const resumeStageDrag = (stage: Konva.Stage | null) => {
    if (stage) stage.draggable(canPan)
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[320px] w-full overscroll-none touch-none select-none"
      style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      {showZoomOverlay ? (
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-stretch gap-1">
          <div className="pointer-events-auto flex overflow-hidden rounded-md border border-slate-600/80 bg-slate-900/90 shadow-lg backdrop-blur">
            <button
              type="button"
              title="Acercar"
              aria-label="Acercar"
              className="min-h-11 min-w-11 touch-manipulation px-3 py-2 text-base font-medium text-slate-100 hover:bg-slate-700/80 active:bg-slate-600/80"
              onClick={() => applyZoomAt(viewRef.current.zoom * ZOOM_STEP, null)}
            >
              +
            </button>
            <button
              type="button"
              title="Alejar"
              aria-label="Alejar"
              className="min-h-11 min-w-11 touch-manipulation border-l border-slate-600/80 px-3 py-2 text-base font-medium text-slate-100 hover:bg-slate-700/80 active:bg-slate-600/80"
              onClick={() => applyZoomAt(viewRef.current.zoom / ZOOM_STEP, null)}
            >
              −
            </button>
            <button
              type="button"
              title="Restablecer zoom"
              aria-label="Restablecer zoom"
              className="min-h-11 min-w-[3.25rem] touch-manipulation border-l border-slate-600/80 px-3 py-2 text-sm font-medium tabular-nums text-slate-200 hover:bg-slate-700/80 active:bg-slate-600/80"
              onClick={resetView}
            >
              {Math.round(zoom * 100)}%
            </button>
          </div>
          <p className="rounded bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">
            {placeMode
              ? 'Pellizca para zoom · toca para colocar · arrastra para mover'
              : 'Pellizca para zoom · un dedo para mover'}
          </p>
        </div>
      ) : null}
      <Stage
        ref={setStage}
        width={width}
        height={height}
        scaleX={zoom}
        scaleY={zoom}
        x={stagePos.x}
        y={stagePos.y}
        draggable={canPan}
        dragDistance={placeMode ? 16 : 6}
        onDragEnd={(e) => {
          if (e.target !== e.target.getStage()) return
          const next = { x: e.target.x(), y: e.target.y() }
          viewRef.current = { ...viewRef.current, stagePos: next }
          setStagePos(next)
        }}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseMove={handleStageMouseMove}
        onTouchMove={handleStageMouseMove}
        style={{ cursor: placeMode ? 'crosshair' : 'grab' }}
      >
        <Layer listening={false}>
          {image ? (
            <KonvaImage
              image={image}
              x={offsetX}
              y={offsetY}
              width={drawW}
              height={drawH}
              imageSmoothingEnabled={shouldSmoothPlanoImage(
                image.width,
                drawW,
                zoom,
              )}
              listening={false}
            />
          ) : (
            <Text
              x={24}
              y={height / 2 - 10}
              width={width - 48}
              align="center"
              text="Carga un plano (PDF o imagen) para ubicar equipos"
              fill="#94a3b8"
              fontSize={14}
              listening={false}
            />
          )}
        </Layer>
        {showFov ? (
          <VisionSpectrumLayer
            sectors={sectors}
            offsetX={offsetX}
            offsetY={offsetY}
            drawW={drawW}
            drawH={drawH}
            opacity={visionOpacity}
          />
        ) : null}
        <Layer>
          {showWifi &&
            wifiSpectrum.map((c, i) => (
              <Rect
                key={`wifi-cell-${i}`}
                x={offsetX + c.x * drawW}
                y={offsetY + c.y * drawH}
                width={Math.max(1, c.w * drawW)}
                height={Math.max(1, c.h * drawH)}
                fill={spectrumFill(c.strength, 152)}
                listening={false}
              />
            ))}

          {showWifi &&
            wifiSpectrum.length === 0 &&
            wifiCircles.map((c) => {
              const poly = c.polygon
              if (poly && poly.length >= 3) {
                const pts: number[] = []
                for (const p of poly) {
                  pts.push(offsetX + p.x * drawW, offsetY + p.y * drawH)
                }
                return (
                  <Line
                    key={`wifi-${c.nodeId}`}
                    points={pts}
                    closed
                    fill="rgba(52,211,153,0.12)"
                    stroke="rgba(52,211,153,0.55)"
                    strokeWidth={1}
                    dash={[6, 4]}
                    listening={false}
                  />
                )
              }
              const cx = offsetX + c.cx * drawW
              const cy = offsetY + c.cy * drawH
              const radius = Math.max(8, c.radiusNorm * avg)
              return (
                <Circle
                  key={`wifi-${c.nodeId}`}
                  x={cx}
                  y={cy}
                  radius={radius}
                  fill="rgba(52,211,153,0.12)"
                  stroke="rgba(52,211,153,0.55)"
                  strokeWidth={1}
                  dash={[6, 4]}
                  listening={false}
                />
              )
            })}

          {showSound &&
            soundSpectrum.map((c, i) => (
              <Rect
                key={`snd-cell-${i}`}
                x={offsetX + c.x * drawW}
                y={offsetY + c.y * drawH}
                width={Math.max(1, c.w * drawW)}
                height={Math.max(1, c.h * drawH)}
                fill={spectrumFill(c.strength, 280)}
                listening={false}
              />
            ))}

          {showFov &&
            sectors.map((s) => {
              const selected = s.cameraId === selectedId
              const isTele = s.lensId === 'tele'
              const stroke = isTele
                ? selected
                  ? 'rgba(253,186,116,0.95)'
                  : 'rgba(251,146,60,0.85)'
                : selected
                  ? 'rgba(165,243,252,0.95)'
                  : 'rgba(34,211,238,0.8)'
              const fill = 'rgba(0,0,0,0)'
              const fovKey = `fov-${s.cameraId}-${s.lensId ?? 'main'}`
              const poly = s.polygon
              const canSpin =
                selected &&
                !!onAdjustCameraVision &&
                !snapPlaceToDevices &&
                !placeMode
              const applyYawFromEvent = (e: KonvaEventObject<DragEvent>) => {
                const stage = e.target.getStage()
                const pos = stage?.getRelativePointerPosition()
                if (!pos || !onAdjustCameraVision) return
                const n = toNorm(pos.x, pos.y)
                onAdjustCameraVision(
                  s.cameraId,
                  visionPatchFromPointer({
                    mode: 'yaw',
                    camX: s.cx,
                    camY: s.cy,
                    pointerX: n.x,
                    pointerY: n.y,
                    yawDeg: 0,
                    avgMPerNorm: 1,
                  }),
                  s.lensId,
                )
              }
              const hitCx = offsetX + s.cx * drawW
              const hitCy = offsetY + s.cy * drawH
              const hitSweep = ((s.endAngleRad - s.startAngleRad) * 180) / Math.PI
              const hitRot = (s.startAngleRad * 180) / Math.PI
              const hitInner = Math.max(
                0,
                Math.hypot(
                  Math.cos((s.startAngleRad + s.endAngleRad) / 2) *
                    (s.innerRadiusNorm ?? 0) *
                    drawW,
                  Math.sin((s.startAngleRad + s.endAngleRad) / 2) *
                    (s.innerRadiusNorm ?? 0) *
                    drawH,
                ),
              )
              const hitR = Math.max(
                16,
                Math.hypot(
                  Math.cos((s.startAngleRad + s.endAngleRad) / 2) * s.radiusNorm * drawW,
                  Math.sin((s.startAngleRad + s.endAngleRad) / 2) * s.radiusNorm * drawH,
                ),
              )
              if (poly && poly.length >= 3) {
                const pts: number[] = []
                for (const p of poly) {
                  pts.push(offsetX + p.x * drawW, offsetY + p.y * drawH)
                }
                // Contorno del cono; el relleno lo da el semáforo del espectro
                return (
                  <Fragment key={fovKey}>
                  {canSpin ? (
                    <Arc
                      x={hitCx}
                      y={hitCy}
                      innerRadius={hitInner}
                      outerRadius={hitR}
                      angle={hitSweep}
                      rotation={hitRot}
                      fill="rgba(255,255,255,0.01)"
                      listening
                      draggable
                      dragDistance={4}
                      onMouseDown={(e) => {
                        e.cancelBubble = true
                        pauseStageDrag(e.target.getStage())
                      }}
                      onTouchStart={(e) => {
                        e.cancelBubble = true
                        pauseStageDrag(e.target.getStage())
                      }}
                      onDragStart={(e) => {
                        e.cancelBubble = true
                        pauseStageDrag(e.target.getStage())
                        onSelect(s.cameraId)
                      }}
                      onDragMove={(e) => {
                        e.cancelBubble = true
                        e.target.position({ x: hitCx, y: hitCy })
                        applyYawFromEvent(e)
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true
                        e.target.position({ x: hitCx, y: hitCy })
                        applyYawFromEvent(e)
                        setVisionHandlesOpen(false)
                        resumeStageDrag(e.target.getStage())
                      }}
                    />
                  ) : null}
                  <Line
                    points={pts}
                    closed
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={selected ? (isTele ? 2 : 2.5) : isTele ? 1.75 : 2}
                    dash={isTele ? [7, 5] : undefined}
                    listening={canSpin}
                    hitStrokeWidth={canSpin ? 28 : 0}
                    draggable={canSpin}
                    dragDistance={4}
                    onClick={(e) => {
                      e.cancelBubble = true
                      onSelect(s.cameraId)
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true
                      onSelect(s.cameraId)
                    }}
                    onDragStart={(e) => {
                      if (!canSpin) return
                      e.cancelBubble = true
                      pauseStageDrag(e.target.getStage())
                      onSelect(s.cameraId)
                    }}
                    onDragMove={(e) => {
                      if (!canSpin) return
                      e.cancelBubble = true
                      e.target.position({ x: 0, y: 0 })
                      applyYawFromEvent(e)
                    }}
                    onDragEnd={(e) => {
                      if (!canSpin) return
                      e.cancelBubble = true
                      e.target.position({ x: 0, y: 0 })
                      applyYawFromEvent(e)
                      resumeStageDrag(e.target.getStage())
                    }}
                  />
                  </Fragment>
                )
              }
              const cx = offsetX + s.cx * drawW
              const cy = offsetY + s.cy * drawH
              const radius = s.radiusNorm * avg
              const innerR = Math.max(0, (s.innerRadiusNorm ?? 0) * avg)
              const angle = ((s.endAngleRad - s.startAngleRad) * 180) / Math.PI
              const rotation = (s.startAngleRad * 180) / Math.PI
              return (
                <Arc
                  key={fovKey}
                  x={cx}
                  y={cy}
                  innerRadius={innerR}
                  outerRadius={Math.max(12, radius)}
                  angle={angle}
                  rotation={rotation}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={selected ? (isTele ? 2 : 2.5) : isTele ? 1.75 : 2}
                  dash={isTele ? [7, 5] : undefined}
                  listening={false}
                />
              )
            })}

          {showStructures &&
            structures.map((s) => {
            const mat = getStructureMaterialOrDefault(s.materialId)
            const selected = s.id === selectedId
            const x1 = offsetX + s.x1 * drawW
            const y1 = offsetY + s.y1 * drawH
            const x2 = offsetX + s.x2 * drawW
            const y2 = offsetY + s.y2 * drawH
            const canDrag = !!onStructureMove && !placeMode
            return (
              <Fragment key={`str-${s.id}`}>
                <Line
                  points={[x1, y1, x2, y2]}
                  stroke={mat.color}
                  strokeWidth={wallDrawnStroke(selected, wallStrokeGrosor)}
                  hitStrokeWidth={placeMode ? 0 : 16}
                  dash={mat.dash ?? undefined}
                  lineCap="round"
                  opacity={selected ? 1 : 0.9}
                  listening={!placeMode}
                  draggable={canDrag}
                  onClick={(e) => {
                    e.cancelBubble = true
                    onSelect(s.id)
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true
                    onSelect(s.id)
                  }}
                  onDragStart={(e) => {
                    e.cancelBubble = true
                    pauseStageDrag(e.target.getStage())
                    onSelect(s.id)
                  }}
                  onDragEnd={(e) => {
                    e.cancelBubble = true
                    const node = e.target as Konva.Line
                    const dx = node.x()
                    const dy = node.y()
                    node.position({ x: 0, y: 0 })
                    resumeStageDrag(e.target.getStage())
                    if (!onStructureMove) return
                    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
                    const n1 = toNorm(x1 + dx, y1 + dy)
                    const n2 = toNorm(x2 + dx, y2 + dy)
                    onStructureMove(s.id, {
                      x1: n1.x,
                      y1: n1.y,
                      x2: n2.x,
                      y2: n2.y,
                    })
                  }}
                />
                {selected && canDrag
                  ? (
                      [
                        { end: 'a' as const, x: x1, y: y1 },
                        { end: 'b' as const, x: x2, y: y2 },
                      ] as const
                    ).map((h) => (
                      <Circle
                        key={`str-${s.id}-${h.end}`}
                        x={h.x}
                        y={h.y}
                        radius={2.5}
                        fill={mat.color}
                        stroke="#fff"
                        strokeWidth={1}
                        hitStrokeWidth={14}
                        draggable
                        onClick={(e) => {
                          e.cancelBubble = true
                          onSelect(s.id)
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true
                          onSelect(s.id)
                        }}
                        onDragStart={(e) => {
                          e.cancelBubble = true
                          pauseStageDrag(e.target.getStage())
                          onSelect(s.id)
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true
                          if (!onStructureMove) return
                          const node = e.target as Konva.Circle
                          const n = toNorm(node.x(), node.y())
                          if (h.end === 'a') {
                            const snapped = snapOrtho90({ x: s.x2, y: s.y2 }, n)
                            onStructureMove(s.id, {
                              x1: snapped.x,
                              y1: snapped.y,
                              x2: s.x2,
                              y2: s.y2,
                            })
                          } else {
                            const snapped = snapOrtho90({ x: s.x1, y: s.y1 }, n)
                            onStructureMove(s.id, {
                              x1: s.x1,
                              y1: s.y1,
                              x2: snapped.x,
                              y2: snapped.y,
                            })
                          }
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true
                          if (!onStructureMove) return
                          const node = e.target as Konva.Circle
                          const n = toNorm(node.x(), node.y())
                          if (h.end === 'a') {
                            const snapped = snapOrtho90({ x: s.x2, y: s.y2 }, n)
                            onStructureMove(s.id, {
                              x1: snapped.x,
                              y1: snapped.y,
                              x2: s.x2,
                              y2: s.y2,
                            })
                          } else {
                            const snapped = snapOrtho90({ x: s.x1, y: s.y1 }, n)
                            onStructureMove(s.id, {
                              x1: s.x1,
                              y1: s.y1,
                              x2: snapped.x,
                              y2: snapped.y,
                            })
                          }
                          resumeStageDrag(e.target.getStage())
                        }}
                      />
                    ))
                  : null}
              </Fragment>
            )
          })}

          {(draftPoints && draftPoints.length > 0) || draftCursor ? (
            <>
              {draftPoints && draftPoints.length >= 1 ? (
                <Line
                  points={(draftCursor
                    ? [...draftPoints, draftCursor]
                    : draftPoints
                  ).flatMap((p) => [
                    offsetX + p.x * drawW,
                    offsetY + p.y * drawH,
                  ])}
                  stroke={draftColor}
                  strokeWidth={1.75}
                  dash={[5, 4]}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.9}
                  listening={false}
                />
              ) : null}
              {(draftPoints ?? []).map((p, i) => (
                <Circle
                  key={`draft-pt-${i}`}
                  x={offsetX + p.x * drawW}
                  y={offsetY + p.y * drawH}
                  radius={i === 0 ? 3 : 2.25}
                  fill={draftColor}
                  stroke="#fff"
                  strokeWidth={1}
                  listening={false}
                />
              ))}
              {draftCursor ? (
                <Circle
                  x={offsetX + draftCursor.x * drawW}
                  y={offsetY + draftCursor.y * drawH}
                  radius={2}
                  fill={draftColor}
                  opacity={0.7}
                  listening={false}
                />
              ) : null}
              {draftLabel && draftPoints && draftPoints[0] ? (
                <Text
                  x={
                    offsetX +
                    ((draftCursor ?? draftPoints[draftPoints.length - 1]!).x +
                      draftPoints[0].x) *
                      0.5 *
                      drawW +
                    8
                  }
                  y={
                    offsetY +
                    ((draftCursor ?? draftPoints[draftPoints.length - 1]!).y +
                      draftPoints[0].y) *
                      0.5 *
                      drawH -
                    16
                  }
                  text={draftLabel}
                  fill={draftColor}
                  fontSize={14}
                  fontStyle="bold"
                  listening={false}
                />
              ) : null}
            </>
          ) : draftPoint ? (
            <Circle
              x={offsetX + draftPoint.x * drawW}
              y={offsetY + draftPoint.y * drawH}
              radius={2.5}
              fill={draftColor}
              stroke="#fff"
              strokeWidth={1}
              listening={false}
            />
          ) : null}

          {showCableRoutes &&
            !showUnderground &&
            cableRoutes.map((r) => {
              const pts: number[] = []
              for (const p of r.points) {
                pts.push(offsetX + p.x * drawW, offsetY + p.y * drawH)
              }
              const selected = selectedId === r.id || selectedId === r.fromId
              const isManual = r.toId === MANUAL_CABLE_TO_ID
              const stroke = r.warn
                ? '#f87171'
                : r.type === 'FIBER'
                  ? 'rgba(167,139,250,0.9)'
                  : r.type === 'AUDIO'
                    ? 'rgba(244,114,182,0.9)'
                    : r.type === 'POWER_12V'
                      ? 'rgba(248,113,113,0.9)'
                      : r.type === 'CAT5E'
                        ? 'rgba(163,230,53,0.85)'
                        : 'rgba(250,204,21,0.85)'
              return (
                <Line
                  key={r.id}
                  points={pts}
                  stroke={
                    selected
                      ? '#fef08a'
                      : stroke
                  }
                  strokeWidth={selected ? 3.5 : r.warn ? 2.5 : 2}
                  dash={
                    r.type === 'FIBER'
                      ? [6, 4]
                      : r.type === 'AUDIO' || r.type === 'POWER_12V'
                        ? [4, 3]
                        : undefined
                  }
                  lineCap="round"
                  lineJoin="round"
                  hitStrokeWidth={placeMode ? 0 : 18}
                  listening={!placeMode}
                  onClick={(e) => {
                    e.cancelBubble = true
                    const already = selectedId === r.id
                    onSelect(r.id)
                    // 2º toque en la ruta auto seleccionada → insertar quiebre
                    if (isManual || !already || !onCableWaypointInsert || placeMode)
                      return
                    const stage = e.target.getStage()
                    const pos = stage?.getPointerPosition()
                    if (!pos) return
                    const transform = e.target.getAbsoluteTransform().copy().invert()
                    const local = transform.point(pos)
                    const nx = (local.x - offsetX) / Math.max(drawW, 1)
                    const ny = (local.y - offsetY) / Math.max(drawH, 1)
                    const hit = nearestSegmentOnRoute(r.points, nx, ny)
                    onCableWaypointInsert(r.id, hit.afterIndex, hit.point.x, hit.point.y)
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true
                    const already = selectedId === r.id
                    onSelect(r.id)
                    if (isManual || !already || !onCableWaypointInsert || placeMode)
                      return
                    const stage = e.target.getStage()
                    const pos = stage?.getPointerPosition()
                    if (!pos) return
                    const transform = e.target.getAbsoluteTransform().copy().invert()
                    const local = transform.point(pos)
                    const nx = (local.x - offsetX) / Math.max(drawW, 1)
                    const ny = (local.y - offsetY) / Math.max(drawH, 1)
                    const hit = nearestSegmentOnRoute(r.points, nx, ny)
                    onCableWaypointInsert(r.id, hit.afterIndex, hit.point.x, hit.point.y)
                  }}
                />
              )
            })}

          {/* Quiebres arrastrables de la ruta seleccionada */}
          {showCableRoutes &&
            !showUnderground &&
            !placeMode &&
            onCableWaypointMove &&
            cableRoutes
              .filter((r) => r.id === selectedId && r.toId !== MANUAL_CABLE_TO_ID)
              .flatMap((r) =>
                r.points.slice(1, -1).map((p, midIndex) => {
                  const cx = offsetX + p.x * drawW
                  const cy = offsetY + p.y * drawH
                  return (
                    <Circle
                      key={`${r.id}-wp-${midIndex}`}
                      x={cx}
                      y={cy}
                      radius={7}
                      fill="#facc15"
                      stroke="#fff"
                      strokeWidth={1.5}
                      draggable
                      onClick={(e) => {
                        e.cancelBubble = true
                        onSelect(r.id)
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true
                        onSelect(r.id)
                      }}
                      onDblClick={(e) => {
                        e.cancelBubble = true
                        onCableWaypointRemove?.(r.id, midIndex)
                      }}
                      onDblTap={(e) => {
                        e.cancelBubble = true
                        onCableWaypointRemove?.(r.id, midIndex)
                      }}
                      onDragStart={(e) => {
                        e.cancelBubble = true
                        pauseStageDrag(e.target.getStage())
                        onSelect(r.id)
                      }}
                      onDragMove={(e) => {
                        e.cancelBubble = true
                        const node = e.target as Konva.Circle
                        const n = toNorm(node.x(), node.y())
                        onCableWaypointMove(r.id, midIndex, n.x, n.y)
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true
                        const node = e.target as Konva.Circle
                        const n = toNorm(node.x(), node.y())
                        onCableWaypointMove(r.id, midIndex, n.x, n.y)
                        resumeStageDrag(e.target.getStage())
                      }}
                    />
                  )
                }),
              )}

          {showUnderground &&
            undergroundRuns.map((run) => {
              const pts: number[] = []
              for (const p of run.points) {
                pts.push(offsetX + p.x * drawW, offsetY + p.y * drawH)
              }
              const selected = selectedId === run.id
              return (
                <Line
                  key={run.id}
                  points={pts}
                  stroke={selected ? '#fdba74' : 'rgba(251,146,60,0.9)'}
                  strokeWidth={selected ? 5 : 3.5}
                  dash={[10, 6]}
                  lineCap="round"
                  lineJoin="round"
                  hitStrokeWidth={16}
                  onClick={(e) => {
                    e.cancelBubble = true
                    onSelect(run.id)
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true
                    onSelect(run.id)
                  }}
                />
              )
            })}

          {showUnderground &&
            undergroundRuns.flatMap((run) =>
              run.chambers.map((ch: AccessChamber) => {
                const cx = offsetX + ch.x * drawW
                const cy = offsetY + ch.y * drawH
                const s = 7
                return (
                  <Line
                    key={ch.id}
                    points={[cx, cy - s, cx + s, cy, cx, cy + s, cx - s, cy, cx, cy - s]}
                    closed
                    fill="#fb923c"
                    stroke="#7c2d12"
                    strokeWidth={1}
                    listening={false}
                  />
                )
              }),
            )}

          {showLinks &&
            !showCableRoutes &&
            linkLines.map((l, i) => (
              <Line
                key={`link-${i}`}
                points={[
                  offsetX + l.fromX * drawW,
                  offsetY + l.fromY * drawH,
                  offsetX + l.toX * drawW,
                  offsetY + l.toY * drawH,
                ]}
                stroke={l.warn ? '#f87171' : 'rgba(167,139,250,0.65)'}
                strokeWidth={l.warn ? 2 : 1.5}
                dash={l.warn ? [4, 4] : [8, 6]}
                listening={false}
              />
            ))}

          {cameras.map((cam) => {
            const cx = offsetX + cam.x * drawW
            const cy = offsetY + cam.y * drawH
            const selected = cam.id === selectedId
            return (
              <Circle
                key={cam.id}
                x={cx}
                y={cy}
                radius={selected ? 5 : 4}
                fill={selected ? '#22d3ee' : '#06b6d4'}
                stroke="#0f172a"
                strokeWidth={1.25}
                hitStrokeWidth={16}
                shadowColor="black"
                shadowBlur={3}
                shadowOpacity={0.3}
                listening={!placeMode || snapPlaceToDevices}
                draggable={!placeMode}
                onClick={(e) => {
                  e.cancelBubble = true
                  if (snapPlaceToDevices && placeMode) {
                    onAddAt(cam.x, cam.y)
                    return
                  }
                  setVisionHandlesOpen(true)
                  inspect(cam.id)
                }}
                onTap={(e) => {
                  e.cancelBubble = true
                  if (snapPlaceToDevices && placeMode) {
                    onAddAt(cam.x, cam.y)
                    return
                  }
                  setVisionHandlesOpen(true)
                  inspect(cam.id)
                }}
                onDragStart={(e) => {
                  e.cancelBubble = true
                  pauseStageDrag(e.target.getStage())
                  setVisionHandlesOpen(true)
                  onSelect(cam.id)
                }}
                onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                  e.cancelBubble = true
                  const node = e.target as Konva.Circle
                  const n = toNorm(node.x(), node.y())
                  onMove(cam.id, n.x, n.y)
                  setVisionHandlesOpen(true)
                  onSelect(cam.id)
                  resumeStageDrag(e.target.getStage())
                }}
              />
            )
          })}

          {/* Asas de visión: al seleccionar; se ocultan al soltar tras ajustar apertura/orient./alcance */}
          {showFov &&
            onAdjustCameraVision &&
            !snapPlaceToDevices &&
            visionHandlesOpen &&
            cameras
              .filter((c) => c.id === selectedId)
              .flatMap((cam) =>
                effectiveCameraLenses(cam, nightMode ? 'night' : 'day').map((vision, lensIndex) => {
                // Asas por lente: en Dual cada cono se orienta, abre y alarga por separado.
                const lensId = vision.lensId
                const secundaria = lensIndex > 0
                const colPrincipal = secundaria ? '#fb923c' : '#22d3ee'
                const colLados = secundaria ? '#fdba74' : '#67e8f9'
                const colTexto = secundaria ? '#ffedd5' : '#ecfeff'
                const colGuia = secundaria ? 'rgba(253,186,116,0.9)' : 'rgba(165,243,252,0.9)'
                const colGuiaLado = secundaria ? 'rgba(253,186,116,0.45)' : 'rgba(103,232,249,0.45)'
                const sector = sectors.find(
                  (s) => s.cameraId === cam.id && (s.lensId ?? 'main') === lensId,
                )
                const avgMPerNorm = Math.max((metersPerNormX + metersPerNormY) / 2, 0.01)
                const radiusNorm =
                  sector?.radiusNorm ?? vision.rangeM / avgMPerNorm
                const innerNorm = sector?.innerRadiusNorm ?? 0
                const midAng = degToRad(vision.yawDeg)
                const leftHalf = degToRad(vision.fovLeftDeg)
                const rightHalf = degToRad(vision.fovRightDeg)
                const leftAng = midAng - leftHalf
                const rightAng = midAng + rightHalf
                /** Asas a mitad de la zona visible (entre ciega e alcance). */
                const handleR = innerNorm + (radiusNorm - innerNorm) * 0.5
                const tipX = offsetX + (cam.x + Math.cos(midAng) * handleR) * drawW
                const tipY = offsetY + (cam.y + Math.sin(midAng) * handleR) * drawH
                const leftX = offsetX + (cam.x + Math.cos(leftAng) * handleR) * drawW
                const leftY = offsetY + (cam.y + Math.sin(leftAng) * handleR) * drawH
                const rightX = offsetX + (cam.x + Math.cos(rightAng) * handleR) * drawW
                const rightY = offsetY + (cam.y + Math.sin(rightAng) * handleR) * drawH
                const midLabelR = radiusNorm * 0.22
                const midLabelX = offsetX + (cam.x + Math.cos(midAng) * midLabelR) * drawW
                const midLabelY = offsetY + (cam.y + Math.sin(midAng) * midLabelR) * drawH
                const tipLabelX = offsetX + (cam.x + Math.cos(midAng) * radiusNorm) * drawW
                const tipLabelY = offsetY + (cam.y + Math.sin(midAng) * radiusNorm) * drawH
                const farX = tipLabelX
                const farY = tipLabelY
                const cx = offsetX + cam.x * drawW
                const cy = offsetY + cam.y * drawH

                const applyFromPointer = (
                  px: number,
                  py: number,
                  mode: VisionHandleMode,
                  fovStep?: number,
                ) => {
                  const n = toNorm(px, py)
                  onAdjustCameraVision(
                    cam.id,
                    visionPatchFromPointer({
                      mode,
                      camX: cam.x,
                      camY: cam.y,
                      pointerX: n.x,
                      pointerY: n.y,
                      yawDeg: vision.yawDeg,
                      avgMPerNorm,
                      fovStep,
                    }),
                    lensId,
                  )
                }

                const pointerFromEvent = (e: KonvaEventObject<DragEvent>) => {
                  const pos = e.target.getStage()?.getRelativePointerPosition()
                  if (pos) return pos
                  const node = e.target as Konva.Circle
                  return { x: node.x(), y: node.y() }
                }

                const bindHandleDrag = (mode: VisionHandleMode) => ({
                  onDragStart: (e: KonvaEventObject<DragEvent>) => {
                    e.cancelBubble = true
                    pauseStageDrag(e.target.getStage())
                    onSelect(cam.id)
                  },
                  onDragMove: (e: KonvaEventObject<DragEvent>) => {
                    e.cancelBubble = true
                    const pos = pointerFromEvent(e)
                    applyFromPointer(pos.x, pos.y, mode, mode === 'fov' ? 1 : undefined)
                  },
                  onDragEnd: (e: KonvaEventObject<DragEvent>) => {
                    e.cancelBubble = true
                    const pos = pointerFromEvent(e)
                    applyFromPointer(pos.x, pos.y, mode, mode === 'fov' ? 5 : undefined)
                    onSelect(cam.id)
                    // Tras configurar la apertura (o orientación/alcance), ocultar los puntos.
                    setVisionHandlesOpen(false)
                    resumeStageDrag(e.target.getStage())
                  },
                })

                return (
                  <Fragment key={`vis-handles-${cam.id}-${lensId}`}>
                    <Line
                      points={[cx, cy, farX, farY]}
                      stroke={colGuia}
                      strokeWidth={2}
                      dash={[5, 4]}
                      listening={false}
                    />
                    <Line
                      points={[cx, cy, leftX, leftY]}
                      stroke={colGuiaLado}
                      strokeWidth={1.5}
                      dash={[3, 4]}
                      listening={false}
                    />
                    <Line
                      points={[cx, cy, rightX, rightY]}
                      stroke={colGuiaLado}
                      strokeWidth={1.5}
                      dash={[3, 4]}
                      listening={false}
                    />
                    <Text
                      x={midLabelX - 36}
                      y={midLabelY - 9}
                      width={72}
                      align="center"
                      text={`${Math.round(vision.fovDeg)}°`}
                      fontSize={14}
                      fontStyle="bold"
                      fill={colTexto}
                      stroke="#0f172a"
                      strokeWidth={0.7}
                      listening={false}
                    />
                    <Text
                      x={tipLabelX - 28}
                      y={tipLabelY + 14}
                      width={56}
                      align="center"
                      text={`${vision.rangeM.toFixed(vision.rangeM >= 10 ? 0 : 1)} m`}
                      fontSize={12}
                      fontStyle="bold"
                      fill={colLados}
                      stroke="#0f172a"
                      strokeWidth={0.5}
                      listening={false}
                    />
                    <Circle
                      x={tipX}
                      y={tipY}
                      radius={13}
                      fill={colPrincipal}
                      stroke="#ecfeff"
                      strokeWidth={2.5}
                      hitStrokeWidth={28}
                      draggable
                      onClick={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      {...bindHandleDrag('yaw')}
                    />
                    <Circle
                      x={leftX}
                      y={leftY}
                      radius={12}
                      fill={colLados}
                      stroke="#ecfeff"
                      strokeWidth={2}
                      hitStrokeWidth={26}
                      draggable
                      onClick={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      {...bindHandleDrag('fov')}
                    />
                    <Circle
                      x={rightX}
                      y={rightY}
                      radius={12}
                      fill={colLados}
                      stroke="#ecfeff"
                      strokeWidth={2}
                      hitStrokeWidth={26}
                      draggable
                      onClick={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      {...bindHandleDrag('fov')}
                    />
                    <Circle
                      x={farX}
                      y={farY}
                      radius={11}
                      fill="#0f172a"
                      stroke={colPrincipal}
                      strokeWidth={3}
                      hitStrokeWidth={26}
                      draggable
                      onClick={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      {...bindHandleDrag('range')}
                    />
                  </Fragment>
                )
                }),
              )}

          {networkNodes.map((node) => {
            const cx = offsetX + node.x * drawW
            const cy = offsetY + node.y * drawH
            const selected = node.id === selectedId
            const color = NODE_COLORS[node.kind]
            const planSize = resolveNetworkPlanSize(node)
            const size = networkNodeHalfPx(planSize, drawW)
            const handleR = Math.max(4, Math.min(7, size * 0.45))
            return (
              <Fragment key={node.id}>
                <Rect
                  x={cx - size}
                  y={cy - size}
                  width={size * 2}
                  height={size * 2}
                  fill={color}
                  stroke={selected ? '#fff' : '#0f172a'}
                  strokeWidth={selected ? 1.75 : 1.25}
                  cornerRadius={node.kind === 'ap' ? size : Math.min(3, size * 0.35)}
                  shadowColor="black"
                  shadowBlur={selected ? 6 : 4}
                  shadowOpacity={0.28}
                  hitStrokeWidth={Math.max(10, 14 - size)}
                  listening={!placeMode || snapPlaceToDevices}
                  draggable={!placeMode}
                  onClick={(e) => {
                    e.cancelBubble = true
                    if (snapPlaceToDevices && placeMode) {
                      onAddAt(node.x, node.y)
                      return
                    }
                    inspect(node.id)
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true
                    if (snapPlaceToDevices && placeMode) {
                      onAddAt(node.x, node.y)
                      return
                    }
                    inspect(node.id)
                  }}
                  onDragStart={(e) => {
                    e.cancelBubble = true
                    pauseStageDrag(e.target.getStage())
                    onSelect(node.id)
                  }}
                  onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                    e.cancelBubble = true
                    const r = e.target as Konva.Rect
                    const n = toNorm(r.x() + size, r.y() + size)
                    onMove(node.id, n.x, n.y)
                    onSelect(node.id)
                    resumeStageDrag(e.target.getStage())
                  }}
                />
                {selected && onNetworkSizeChange && !placeMode ? (
                  <Circle
                    x={cx + size}
                    y={cy + size}
                    radius={handleR}
                    fill="#f8fafc"
                    stroke="#0f172a"
                    strokeWidth={1.25}
                    draggable
                    onClick={(e) => {
                      e.cancelBubble = true
                      onSelect(node.id)
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true
                      onSelect(node.id)
                    }}
                    onDragStart={(e) => {
                      e.cancelBubble = true
                      pauseStageDrag(e.target.getStage())
                      onSelect(node.id)
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true
                      const h = e.target as Konva.Circle
                      const dx = Math.abs(h.x() - cx)
                      const dy = Math.abs(h.y() - cy)
                      const halfPx = Math.max(dx, dy)
                      const next = clampNetworkPlanSize(halfPx / Math.max(drawW, 1))
                      const clampedHalf = networkNodeHalfPx(next, drawW)
                      h.position({ x: cx + clampedHalf, y: cy + clampedHalf })
                      onNetworkSizeChange(node.id, next)
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true
                      resumeStageDrag(e.target.getStage())
                      onSelect(node.id)
                    }}
                  />
                ) : null}
              </Fragment>
            )
          })}

          {cameras.map((cam) => {
            const selected = cam.id === selectedId
            const tilt = Math.round(cam.tiltDeg ?? 0)
            return (
              <Fragment key={`lbl-${cam.id}`}>
                <Text
                  x={offsetX + cam.x * drawW + 12}
                  y={offsetY + cam.y * drawH - 18}
                  text={cam.label}
                  fontSize={11}
                  fill="#e2e8f0"
                  listening={false}
                />
                {selected ? (
                  <Text
                    x={offsetX + cam.x * drawW + 12}
                    y={offsetY + cam.y * drawH - 6}
                    text={`${cam.mountHeightM.toFixed(1)} m · ${tilt}°`}
                    fontSize={9}
                    fill="#67e8f9"
                    listening={false}
                  />
                ) : null}
              </Fragment>
            )
          })}

          {planDevices.map((dev) => {
            const cx = offsetX + dev.x * drawW
            const cy = offsetY + dev.y * drawH
            const selected = dev.id === selectedId
            const color = planDeviceColor(dev.discipline)
            return (
              <Circle
                key={dev.id}
                x={cx}
                y={cy}
                radius={selected ? 6 : 5}
                fill={color}
                stroke={selected ? '#fff' : '#0f172a'}
                strokeWidth={selected ? 1.75 : 1.25}
                hitStrokeWidth={16}
                shadowColor="black"
                shadowBlur={3}
                shadowOpacity={0.3}
                listening={!placeMode || snapPlaceToDevices}
                draggable={!placeMode}
                onClick={(e) => {
                  e.cancelBubble = true
                  if (snapPlaceToDevices && placeMode) {
                    onAddAt(dev.x, dev.y)
                    return
                  }
                  inspect(dev.id)
                }}
                onTap={(e) => {
                  e.cancelBubble = true
                  if (snapPlaceToDevices && placeMode) {
                    onAddAt(dev.x, dev.y)
                    return
                  }
                  inspect(dev.id)
                }}
                onDragStart={(e) => {
                  e.cancelBubble = true
                  pauseStageDrag(e.target.getStage())
                  onSelect(dev.id)
                }}
                onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                  e.cancelBubble = true
                  const node = e.target as Konva.Circle
                  const n = toNorm(node.x(), node.y())
                  onMove(dev.id, n.x, n.y)
                  onSelect(dev.id)
                  resumeStageDrag(e.target.getStage())
                }}
              />
            )
          })}

          {networkNodes.map((node) => {
            const planSize = resolveNetworkPlanSize(node)
            const size = networkNodeHalfPx(planSize, drawW)
            return (
              <Text
                key={`nlbl-${node.id}`}
                x={offsetX + node.x * drawW + size + 4}
                y={offsetY + node.y * drawH - Math.max(12, size + 4)}
                text={
                  node.kind === 'ap' && node.wifiChannel
                    ? `${node.label}·ch${node.wifiChannel}`
                    : node.label
                }
                fontSize={10}
                fill="#e2e8f0"
                listening={false}
              />
            )
          })}

          {planDevices.map((dev) => (
            <Text
              key={`plbl-${dev.id}`}
              x={offsetX + dev.x * drawW + 12}
              y={offsetY + dev.y * drawH - 16}
              text={dev.label}
              fontSize={10}
              fill="#e2e8f0"
              listening={false}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
