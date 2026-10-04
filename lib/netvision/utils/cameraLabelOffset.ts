import type { DesignCamera } from '@/lib/netvision/types'

/** Desplazamiento por defecto del nombre (px de stage, esquina superior derecha del pin). */
export const DEFAULT_CAM_LABEL_DX_PX = 12
export const DEFAULT_CAM_LABEL_DY_PX = -18

const OFFSET_MAX = 0.85

export function clampLabelOffset(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  return Math.min(OFFSET_MAX, Math.max(-OFFSET_MAX, raw))
}

export function cameraLabelStagePos(
  cam: DesignCamera,
  offsetX: number,
  offsetY: number,
  drawW: number,
  drawH: number,
): { x: number; y: number } {
  const dx =
    cam.labelOffsetX != null ? cam.labelOffsetX * drawW : DEFAULT_CAM_LABEL_DX_PX
  const dy =
    cam.labelOffsetY != null ? cam.labelOffsetY * drawH : DEFAULT_CAM_LABEL_DY_PX
  return {
    x: offsetX + cam.x * drawW + dx,
    y: offsetY + cam.y * drawH + dy,
  }
}

export function labelOffsetFromNorm(
  cam: Pick<DesignCamera, 'x' | 'y'>,
  labelNormX: number,
  labelNormY: number,
): { labelOffsetX: number; labelOffsetY: number } {
  return {
    labelOffsetX: clampLabelOffset(labelNormX - cam.x) ?? 0,
    labelOffsetY: clampLabelOffset(labelNormY - cam.y) ?? 0,
  }
}

export function hasCustomLabelOffset(
  cam: Pick<DesignCamera, 'labelOffsetX' | 'labelOffsetY'>,
): boolean {
  return cam.labelOffsetX != null || cam.labelOffsetY != null
}

export function rotateCameraLabelOffset(
  cam: Pick<DesignCamera, 'labelOffsetX' | 'labelOffsetY'>,
  dir: 'cw' | 'ccw',
): Pick<DesignCamera, 'labelOffsetX' | 'labelOffsetY'> {
  if (cam.labelOffsetX == null && cam.labelOffsetY == null) return {}
  const dx = cam.labelOffsetX ?? 0
  const dy = cam.labelOffsetY ?? 0
  if (dir === 'cw') {
    return { labelOffsetX: -dy, labelOffsetY: dx }
  }
  return { labelOffsetX: dy, labelOffsetY: -dx }
}
