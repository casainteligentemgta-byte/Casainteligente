'use client'

import { useEffect, useRef, useState } from 'react'
import { Circle, Image as KonvaImage, Layer, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'

export type VisionCameraPin = {
  id: string
  name: string
  x: number
  y: number
  selected?: boolean
}

type Props = {
  backgroundUrl: string | null
  cameras: VisionCameraPin[]
  onAddAt: (normX: number, normY: number) => void
  onMove: (id: string, normX: number, normY: number) => void
  onSelect: (id: string) => void
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

export default function NexusVisionKonvaStage({
  backgroundUrl,
  cameras,
  onAddAt,
  onMove,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
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
    if (e.target !== e.target.getStage()) return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    const n = toNorm(pos.x, pos.y)
    onAddAt(n.x, n.y)
  }

  return (
    <div ref={containerRef} className="h-full min-h-[320px] w-full touch-none">
      <Stage width={width} height={height} onClick={handleStageClick} onTap={handleStageClick}>
        <Layer>
          {image ? (
            <KonvaImage image={image} x={offsetX} y={offsetY} width={drawW} height={drawH} listening={false} />
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

          {cameras.map((cam) => {
            const cx = offsetX + cam.x * drawW
            const cy = offsetY + cam.y * drawH
            const fill = cam.selected ? '#22d3ee' : '#06b6d4'
            return (
              <Circle
                key={cam.id}
                x={cx}
                y={cy}
                radius={cam.selected ? 14 : 11}
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
        </Layer>
      </Stage>
    </div>
  )
}
