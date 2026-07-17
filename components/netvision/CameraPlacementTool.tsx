'use client'

import { useEffect, useRef, useState } from 'react'
import { Arc, Circle, Image as KonvaImage, Layer, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { CoverageSector, DesignCamera } from '@/lib/netvision/types'

export type CameraPlacementToolProps = {
  backgroundUrl: string | null
  cameras: DesignCamera[]
  sectors: CoverageSector[]
  selectedId: string | null
  placeMode: boolean
  showFov: boolean
  onAddAt: (normX: number, normY: number) => void
  onMove: (id: string, normX: number, normY: number) => void
  onSelect: (id: string) => void
  stageRef?: React.MutableRefObject<Konva.Stage | null>
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
  sectors,
  selectedId,
  placeMode,
  showFov,
  onAddAt,
  onMove,
  onSelect,
  stageRef,
}: CameraPlacementToolProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const localStageRef = useRef<Konva.Stage | null>(null)
  const { width, height } = useContainerSize(containerRef)
  const image = useHtmlImage(backgroundUrl)

  const pad = 16
  let drawW = width - pad * 2
  let drawH = height - pad * 2
  let offsetX = pad
  let offsetY = pad

  if (image && image.width > 0 && image.height > 0) {
    const scale = Math.min(drawW / image.width, drawH / image.height)
    drawW = image.width * scale
    drawH = image.height * scale
    offsetX = (width - drawW) / 2
    offsetY = (height - drawH) / 2
  }

  const toNorm = (px: number, py: number) => ({
    x: Math.min(1, Math.max(0, (px - offsetX) / Math.max(drawW, 1))),
    y: Math.min(1, Math.max(0, (py - offsetY) / Math.max(drawH, 1))),
  })

  const handleStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!placeMode) return
    if (e.target !== e.target.getStage()) return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    const n = toNorm(pos.x, pos.y)
    onAddAt(n.x, n.y)
  }

  const setStage = (node: Konva.Stage | null) => {
    localStageRef.current = node
    if (stageRef) stageRef.current = node
  }

  return (
    <div ref={containerRef} className="h-full min-h-[320px] w-full touch-none">
      <Stage
        ref={setStage}
        width={width}
        height={height}
        onClick={handleStageClick}
        onTap={handleStageClick}
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
              text="Carga un plano (PDF o imagen) para ubicar cámaras"
              fill="#94a3b8"
              fontSize={14}
              listening={false}
            />
          )}

          {showFov &&
            sectors.map((s) => {
              const cx = offsetX + s.cx * drawW
              const cy = offsetY + s.cy * drawH
              // Escala radio: usar promedio de drawW/drawH para radio visual
              const avg = (drawW + drawH) / 2
              const radius = s.radiusNorm * avg
              const angle = ((s.endAngleRad - s.startAngleRad) * 180) / Math.PI
              const rotation = (s.startAngleRad * 180) / Math.PI
              const selected = s.cameraId === selectedId
              return (
                <Arc
                  key={`fov-${s.cameraId}`}
                  x={cx}
                  y={cy}
                  innerRadius={0}
                  outerRadius={Math.max(8, radius)}
                  angle={angle}
                  rotation={rotation}
                  fill={selected ? 'rgba(34,211,238,0.28)' : 'rgba(6,182,212,0.18)'}
                  stroke={selected ? 'rgba(34,211,238,0.85)' : 'rgba(6,182,212,0.45)'}
                  strokeWidth={1}
                  listening={false}
                />
              )
            })}

          {cameras.map((cam) => {
            const cx = offsetX + cam.x * drawW
            const cy = offsetY + cam.y * drawH
            const selected = cam.id === selectedId
            const fill = selected ? '#22d3ee' : '#06b6d4'
            return (
              <Circle
                key={cam.id}
                x={cx}
                y={cy}
                radius={selected ? 14 : 11}
                fill={fill}
                stroke="#0f172a"
                strokeWidth={2}
                shadowColor="black"
                shadowBlur={8}
                shadowOpacity={0.35}
                draggable
                onClick={(e) => {
                  e.cancelBubble = true
                  onSelect(cam.id)
                }}
                onTap={(e) => {
                  e.cancelBubble = true
                  onSelect(cam.id)
                }}
                onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                  const node = e.target as Konva.Circle
                  const n = toNorm(node.x(), node.y())
                  onMove(cam.id, n.x, n.y)
                }}
              />
            )
          })}

          {cameras.map((cam) => {
            const cx = offsetX + cam.x * drawW
            const cy = offsetY + cam.y * drawH
            return (
              <Text
                key={`lbl-${cam.id}`}
                x={cx + 12}
                y={cy - 18}
                text={cam.label}
                fontSize={11}
                fill="#e2e8f0"
                listening={false}
              />
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}
