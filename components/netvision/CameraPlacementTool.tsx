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
  DesignStructure,
  SpectrumCell,
  VisionBand,
} from '@/lib/netvision/types'
import { effectiveCameraVision } from '@/lib/netvision/catalog/cameras'
import { getStructureMaterialOrDefault } from '@/lib/netvision/catalog/materials'
import { degToRad, radToDeg } from '@/lib/netvision/utils/geometryHelpers'
import type { WifiCoverageCircle } from '@/lib/netvision/services/wifiPredictor'
import type { AccessChamber, UndergroundRun } from '@/lib/netvision/services/canalizationCalculator'

export type CameraPlacementToolProps = {
  backgroundUrl: string | null
  cameras: DesignCamera[]
  networkNodes: DesignNetworkNode[]
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
  /** Color del punto de borrador (muros cyan, sub naranja). */
  draftColor?: string
  showFov: boolean
  showWifi: boolean
  showSound?: boolean
  showLinks: boolean
  showCableRoutes?: boolean
  showUnderground?: boolean
  onAddAt: (normX: number, normY: number) => void
  onMove: (id: string, normX: number, normY: number) => void
  /** Ajuste interactivo de óptica (yaw / FOV / alcance) desde el plano. */
  onAdjustCameraVision?: (
    id: string,
    patch: { yawDeg?: number; fovDeg?: number; rangeM?: number },
  ) => void
  metersPerNormX?: number
  metersPerNormY?: number
  nightMode?: boolean
  onSelect: (id: string) => void
  stageRef?: React.MutableRefObject<Konva.Stage | null>
}

function spectrumFill(strength: number, hue: number, boost = 0) {
  const a = Math.min(0.72, 0.1 + boost + strength * 0.48)
  return `hsla(${hue}, 90%, ${42 + strength * 22}%, ${a})`
}

/** Semáforo de cobertura: verde detección, amarillo lejos, rojo dudoso. */
function visionBandFill(band: VisionBand | undefined, strength: number) {
  const a = Math.min(0.78, 0.28 + strength * 0.42)
  if (band === 'green') return `rgba(34, 197, 94, ${a})`
  if (band === 'yellow') return `rgba(234, 179, 8, ${a})`
  if (band === 'red') return `rgba(239, 68, 68, ${a})`
  return spectrumFill(strength, 190, 0.12)
}

const NODE_COLORS: Record<DesignNetworkNode['kind'], string> = {
  switch: '#a78bfa',
  ap: '#34d399',
  nvr: '#fbbf24',
  injector: '#fb7185',
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
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

function useHtmlImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!url) {
      setImage(null)
      return
    }
    let cancelled = false
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!cancelled) setImage(img)
    }
    img.onerror = () => {
      if (!cancelled) setImage(null)
    }
    img.src = url
    return () => {
      cancelled = true
    }
  }, [url])
  return image
}

export default function CameraPlacementTool({
  backgroundUrl,
  cameras,
  networkNodes,
  structures = [],
  sectors,
  visionSpectrum = [],
  wifiCircles,
  wifiSpectrum = [],
  soundSpectrum = [],
  linkLines,
  cableRoutes = [],
  undergroundRuns = [],
  selectedId,
  placeMode,
  draftPoint = null,
  draftColor = '#22d3ee',
  showFov,
  showWifi,
  showSound = false,
  showLinks,
  showCableRoutes = false,
  showUnderground = false,
  onAddAt,
  onMove,
  onAdjustCameraVision,
  metersPerNormX = 40,
  metersPerNormY = 40,
  nightMode = false,
  onSelect,
  stageRef,
}: CameraPlacementToolProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const localStageRef = useRef<Konva.Stage | null>(null)
  const { width, height } = useContainerSize(containerRef)
  const image = useHtmlImage(backgroundUrl)
  const [zoom, setZoom] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [pinching, setPinching] = useState(false)
  const viewRef = useRef({ zoom: 1, stagePos: { x: 0, y: 0 } })
  const pinchRef = useRef<PinchState | null>(null)
  const suppressTapUntilRef = useRef(0)

  viewRef.current = { zoom, stagePos }

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
    if (!placeMode || pinching) return
    if (Date.now() < suppressTapUntilRef.current) return
    if (e.target !== e.target.getStage()) return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = stage.getRelativePointerPosition()
    if (!pos) return
    const n = toNorm(pos.x, pos.y)
    onAddAt(n.x, n.y)
  }

  const setStage = (node: Konva.Stage | null) => {
    localStageRef.current = node
    if (stageRef) stageRef.current = node
  }

  // En iPad/tablet: un dedo siempre puede mover el plano; el tap corto sigue colocando.
  const canPan = !pinching

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
      <Stage
        ref={setStage}
        width={width}
        height={height}
        scaleX={zoom}
        scaleY={zoom}
        x={stagePos.x}
        y={stagePos.y}
        draggable={canPan}
        dragDistance={6}
        onDragEnd={(e) => {
          if (e.target !== e.target.getStage()) return
          const next = { x: e.target.x(), y: e.target.y() }
          viewRef.current = { ...viewRef.current, stagePos: next }
          setStagePos(next)
        }}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        style={{ cursor: placeMode ? 'crosshair' : 'grab' }}
      >
        <Layer>
          {image ? (
            <KonvaImage
              image={image}
              x={offsetX}
              y={offsetY}
              width={drawW}
              height={drawH}
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

          {showFov &&
            visionSpectrum.map((c, i) => (
              <Rect
                key={`vis-cell-${i}`}
                x={offsetX + c.x * drawW}
                y={offsetY + c.y * drawH}
                width={Math.max(1, c.w * drawW)}
                height={Math.max(1, c.h * drawH)}
                fill={visionBandFill(c.band, c.strength)}
                listening={false}
              />
            ))}

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
              const poly = s.polygon
              if (poly && poly.length >= 3) {
                const pts: number[] = []
                for (const p of poly) {
                  pts.push(offsetX + p.x * drawW, offsetY + p.y * drawH)
                }
                // Contorno del cono; el relleno lo da el semáforo del espectro
                return (
                  <Line
                    key={`fov-${s.cameraId}`}
                    points={pts}
                    closed
                    fill={
                      visionSpectrum.length > 0
                        ? 'rgba(6,182,212,0.04)'
                        : selected
                          ? 'rgba(34,211,238,0.42)'
                          : 'rgba(6,182,212,0.32)'
                    }
                    stroke={selected ? 'rgba(165,243,252,0.95)' : 'rgba(34,211,238,0.8)'}
                    strokeWidth={selected ? 2.5 : 2}
                    listening={false}
                  />
                )
              }
              const cx = offsetX + s.cx * drawW
              const cy = offsetY + s.cy * drawH
              const radius = s.radiusNorm * avg
              const angle = ((s.endAngleRad - s.startAngleRad) * 180) / Math.PI
              const rotation = (s.startAngleRad * 180) / Math.PI
              return (
                <Arc
                  key={`fov-${s.cameraId}`}
                  x={cx}
                  y={cy}
                  innerRadius={0}
                  outerRadius={Math.max(12, radius)}
                  angle={angle}
                  rotation={rotation}
                  fill={
                    visionSpectrum.length > 0
                      ? 'rgba(6,182,212,0.04)'
                      : selected
                        ? 'rgba(34,211,238,0.42)'
                        : 'rgba(6,182,212,0.32)'
                  }
                  stroke={selected ? 'rgba(165,243,252,0.95)' : 'rgba(34,211,238,0.8)'}
                  strokeWidth={selected ? 2.5 : 2}
                  listening={false}
                />
              )
            })}

          {structures.map((s) => {
            const mat = getStructureMaterialOrDefault(s.materialId)
            const selected = s.id === selectedId
            const x1 = offsetX + s.x1 * drawW
            const y1 = offsetY + s.y1 * drawH
            const x2 = offsetX + s.x2 * drawW
            const y2 = offsetY + s.y2 * drawH
            return (
              <Line
                key={`str-${s.id}`}
                points={[x1, y1, x2, y2]}
                stroke={mat.color}
                strokeWidth={selected ? 2 : 1.25}
                hitStrokeWidth={14}
                dash={mat.dash ?? undefined}
                lineCap="round"
                opacity={selected ? 1 : 0.9}
                onClick={(e) => {
                  e.cancelBubble = true
                  onSelect(s.id)
                }}
                onTap={(e) => {
                  e.cancelBubble = true
                  onSelect(s.id)
                }}
              />
            )
          })}

          {draftPoint ? (
            <Circle
              x={offsetX + draftPoint.x * drawW}
              y={offsetY + draftPoint.y * drawH}
              radius={6}
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
                  stroke={selected ? '#fef08a' : stroke}
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
                  hitStrokeWidth={14}
                  onClick={(e) => {
                    e.cancelBubble = true
                    onSelect(r.id)
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true
                    onSelect(r.id)
                  }}
                />
              )
            })}

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
                draggable
                onClick={(e) => {
                  e.cancelBubble = true
                  onSelect(cam.id)
                }}
                onTap={(e) => {
                  e.cancelBubble = true
                  onSelect(cam.id)
                }}
                onDragStart={(e) => {
                  e.cancelBubble = true
                  pauseStageDrag(e.target.getStage())
                  onSelect(cam.id)
                }}
                onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                  e.cancelBubble = true
                  const node = e.target as Konva.Circle
                  const n = toNorm(node.x(), node.y())
                  onMove(cam.id, n.x, n.y)
                  onSelect(cam.id)
                  resumeStageDrag(e.target.getStage())
                }}
              />
            )
          })}

          {/* Asas de visión encima del pin: orient./alcance/FOV tras mover o seleccionar */}
          {showFov &&
            onAdjustCameraVision &&
            cameras
              .filter((c) => c.id === selectedId)
              .map((cam) => {
                const vision = effectiveCameraVision(cam, nightMode ? 'night' : 'day')
                const sector = sectors.find((s) => s.cameraId === cam.id)
                const avgMPerNorm = Math.max((metersPerNormX + metersPerNormY) / 2, 0.01)
                const radiusNorm =
                  sector?.radiusNorm ?? vision.rangeM / avgMPerNorm
                const midAng = degToRad(vision.yawDeg)
                const half = degToRad(vision.fovDeg / 2)
                const tipX = offsetX + (cam.x + Math.cos(midAng) * radiusNorm) * drawW
                const tipY = offsetY + (cam.y + Math.sin(midAng) * radiusNorm) * drawH
                const leftAng = midAng - half
                const rightAng = midAng + half
                const wingR = radiusNorm * 0.72
                const leftX = offsetX + (cam.x + Math.cos(leftAng) * wingR) * drawW
                const leftY = offsetY + (cam.y + Math.sin(leftAng) * wingR) * drawH
                const rightX = offsetX + (cam.x + Math.cos(rightAng) * wingR) * drawW
                const rightY = offsetY + (cam.y + Math.sin(rightAng) * wingR) * drawH
                const cx = offsetX + cam.x * drawW
                const cy = offsetY + cam.y * drawH

                const applyFromPointer = (
                  px: number,
                  py: number,
                  mode: 'tip' | 'left' | 'right',
                ) => {
                  const n = toNorm(px, py)
                  const dx = n.x - cam.x
                  const dy = n.y - cam.y
                  const ang = radToDeg(Math.atan2(dy, dx))
                  const distNorm = Math.hypot(dx, dy)
                  if (mode === 'tip') {
                    const rangeM = Math.min(
                      120,
                      Math.max(2, distNorm * avgMPerNorm),
                    )
                    onAdjustCameraVision(cam.id, {
                      yawDeg: Math.round(((ang % 360) + 360) % 360),
                      rangeM: Math.round(rangeM * 10) / 10,
                    })
                    return
                  }
                  let delta = ang - vision.yawDeg
                  while (delta > 180) delta -= 360
                  while (delta < -180) delta += 360
                  const halfFov = Math.min(85, Math.max(10, Math.abs(delta)))
                  onAdjustCameraVision(cam.id, {
                    fovDeg: Math.round(halfFov * 2),
                  })
                }

                const bindHandleDrag = (mode: 'tip' | 'left' | 'right') => ({
                  onDragStart: (e: KonvaEventObject<DragEvent>) => {
                    e.cancelBubble = true
                    pauseStageDrag(e.target.getStage())
                    onSelect(cam.id)
                  },
                  onDragMove: (e: KonvaEventObject<DragEvent>) => {
                    e.cancelBubble = true
                    const node = e.target as Konva.Circle
                    applyFromPointer(node.x(), node.y(), mode)
                  },
                  onDragEnd: (e: KonvaEventObject<DragEvent>) => {
                    e.cancelBubble = true
                    const node = e.target as Konva.Circle
                    applyFromPointer(node.x(), node.y(), mode)
                    onSelect(cam.id)
                    resumeStageDrag(e.target.getStage())
                  },
                })

                return (
                  <Fragment key={`vis-handles-${cam.id}`}>
                    <Line
                      points={[cx, cy, tipX, tipY]}
                      stroke="rgba(165,243,252,0.9)"
                      strokeWidth={2}
                      dash={[5, 4]}
                      listening={false}
                    />
                    <Circle
                      x={tipX}
                      y={tipY}
                      radius={10}
                      fill="#22d3ee"
                      stroke="#ecfeff"
                      strokeWidth={2}
                      hitStrokeWidth={18}
                      draggable
                      onClick={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      {...bindHandleDrag('tip')}
                    />
                    <Circle
                      x={leftX}
                      y={leftY}
                      radius={8}
                      fill="#67e8f9"
                      stroke="#0f172a"
                      strokeWidth={1.5}
                      hitStrokeWidth={16}
                      draggable
                      onClick={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      {...bindHandleDrag('left')}
                    />
                    <Circle
                      x={rightX}
                      y={rightY}
                      radius={8}
                      fill="#67e8f9"
                      stroke="#0f172a"
                      strokeWidth={1.5}
                      hitStrokeWidth={16}
                      draggable
                      onClick={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true
                        onSelect(cam.id)
                      }}
                      {...bindHandleDrag('right')}
                    />
                  </Fragment>
                )
              })}

          {networkNodes.map((node) => {
            const cx = offsetX + node.x * drawW
            const cy = offsetY + node.y * drawH
            const selected = node.id === selectedId
            const color = NODE_COLORS[node.kind]
            const size = selected ? 16 : 13
            return (
              <Rect
                key={node.id}
                x={cx - size}
                y={cy - size}
                width={size * 2}
                height={size * 2}
                fill={color}
                stroke={selected ? '#fff' : '#0f172a'}
                strokeWidth={selected ? 2.5 : 2}
                cornerRadius={node.kind === 'ap' ? size : 3}
                shadowColor="black"
                shadowBlur={8}
                shadowOpacity={0.35}
                draggable
                onClick={(e) => {
                  e.cancelBubble = true
                  onSelect(node.id)
                }}
                onTap={(e) => {
                  e.cancelBubble = true
                  onSelect(node.id)
                }}
                onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                  const r = e.target as Konva.Rect
                  const n = toNorm(r.x() + size, r.y() + size)
                  onMove(node.id, n.x, n.y)
                }}
              />
            )
          })}

          {cameras.map((cam) => (
            <Text
              key={`lbl-${cam.id}`}
              x={offsetX + cam.x * drawW + 12}
              y={offsetY + cam.y * drawH - 18}
              text={cam.label}
              fontSize={11}
              fill="#e2e8f0"
              listening={false}
            />
          ))}

          {networkNodes.map((node) => (
            <Text
              key={`nlbl-${node.id}`}
              x={offsetX + node.x * drawW + 14}
              y={offsetY + node.y * drawH - 18}
              text={
                node.kind === 'ap' && node.wifiChannel
                  ? `${node.label}·ch${node.wifiChannel}`
                  : node.label
              }
              fontSize={11}
              fill="#e2e8f0"
              listening={false}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
