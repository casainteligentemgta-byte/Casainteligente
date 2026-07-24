'use client'

/**
 * Compat: el editor Konva vive en CameraPlacementTool (NetVision Pro).
 * Se mantiene este módulo por imports legacy.
 */
export type { CameraPlacementToolProps as VisionStageProps } from '@/components/netvision/CameraPlacementTool'
export type VisionCameraPin = {
  id: string
  name: string
  x: number
  y: number
  selected?: boolean
}

export { default } from '@/components/netvision/CameraPlacementTool'
