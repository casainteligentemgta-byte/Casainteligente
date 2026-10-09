/** Rotación 90° del plano NetVision (PDF/imagen rasterizado) y de la geometría 0–1. */

import { intensificarTrazosPlano } from '@/lib/netvision/utils/intensidadPlano'
import type { NetVisionProject } from '@/lib/netvision/types'
import { clamp01 } from '@/lib/netvision/utils/geometryHelpers'
import { encodePlanoCanvas } from '@/lib/netvision/utils/renderPdfPlano'
import {
  applyNightPlanoPalette,
  type NightPlanoOptions,
} from '@/lib/netvision/utils/nightPlanoPalette'
import { rotateCameraLabelOffset } from '@/lib/netvision/utils/cameraLabelOffset'
import {
  clampRotateQuarters,
  nextRotateQuarters,
} from '@/lib/netvision/utils/planoRotateQuarters'

export type PlanoRotateDir = 'cw' | 'ccw'
export { clampRotateQuarters, nextRotateQuarters }

export function rotateNormPoint(
  x: number,
  y: number,
  dir: PlanoRotateDir,
): { x: number; y: number } {
  if (dir === 'cw') return { x: clamp01(1 - y), y: clamp01(x) }
  return { x: clamp01(y), y: clamp01(1 - x) }
}

function wrapYaw(deg: number): number {
  const n = ((deg % 360) + 360) % 360
  return n
}

/** Invierte RGB (fondo blanco → negro, trazos negros → blancos). Conserva alfa. */
export function invertRgbPixels(data: Uint8ClampedArray | number[]): void {
  for (let i = 0; i + 2 < data.length; i += 4) {
    data[i] = 255 - (data[i] as number)
    data[i + 1] = 255 - (data[i + 1] as number)
    data[i + 2] = 255 - (data[i + 2] as number)
  }
}

function rotatePt(
  p: { x: number; y: number },
  dir: PlanoRotateDir,
): { x: number; y: number } {
  return rotateNormPoint(p.x, p.y, dir)
}

/** Rota cámaras, red, muros, cables y escala (90°). */
export function rotateProjectGeometry(
  project: NetVisionProject,
  dir: PlanoRotateDir,
): NetVisionProject {
  const dYaw = dir === 'cw' ? 90 : -90
  const cameras = project.cameras.map((c) => {
    const p = rotateNormPoint(c.x, c.y, dir)
    return {
      ...c,
      x: p.x,
      y: p.y,
      yawDeg: wrapYaw(c.yawDeg + dYaw),
      ...rotateCameraLabelOffset(c, dir),
      ...(c.leaderElbows?.length
        ? { leaderElbows: c.leaderElbows.map((e) => rotateNormPoint(e.x, e.y, dir)) }
        : {}),
    }
  })
  const networkNodes = project.networkNodes.map((n) => {
    const p = rotateNormPoint(n.x, n.y, dir)
    return { ...n, x: p.x, y: p.y }
  })
  const planDevices = (project.planDevices ?? []).map((d) => {
    const p = rotateNormPoint(d.x, d.y, dir)
    return {
      ...d,
      x: p.x,
      y: p.y,
      yawDeg: wrapYaw((d.yawDeg ?? 0) + dYaw),
    }
  })
  const infraDevices = (project.infraDevices ?? []).map((d) => {
    const p = rotateNormPoint(d.x, d.y, dir)
    return { ...d, x: p.x, y: p.y }
  })
  const structures = project.structures.map((s) => {
    const a = rotateNormPoint(s.x1, s.y1, dir)
    const b = rotateNormPoint(s.x2, s.y2, dir)
    return { ...s, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  })
  const undergroundSegments = (project.undergroundSegments ?? []).map((s) => {
    const a = rotateNormPoint(s.x1, s.y1, dir)
    const b = rotateNormPoint(s.x2, s.y2, dir)
    return { ...s, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  })
  const cableSegments = (project.cableSegments ?? []).map((s) => {
    const points = (s.points ?? []).map((p) => rotatePt(p, dir))
    const first = points[0] ?? rotateNormPoint(s.x1, s.y1, dir)
    const last = points[points.length - 1] ?? rotateNormPoint(s.x2, s.y2, dir)
    return {
      ...s,
      points,
      x1: first.x,
      y1: first.y,
      x2: last.x,
      y2: last.y,
    }
  })
  const cableRouteOverrides: Record<string, { x: number; y: number }[]> = {}
  for (const [key, pts] of Object.entries(project.cableRouteOverrides ?? {})) {
    cableRouteOverrides[key] = (pts ?? []).map((p) => rotatePt(p, dir))
  }
  return {
    ...project,
    cameras,
    networkNodes,
    planDevices,
    infraDevices,
    structures,
    undergroundSegments,
    cableSegments,
    cableRouteOverrides,
    scale: {
      ...project.scale,
      metersPerNormX: project.scale.metersPerNormY,
      metersPerNormY: project.scale.metersPerNormX,
      // Al girar 90° el alto pasa a ser el ancho: la proporción se invierte.
      ...(typeof project.scale.aspect === 'number' && project.scale.aspect > 0
        ? { aspect: 1 / project.scale.aspect }
        : {}),
    },
  }
}

/** Rota 90° un data URL (JPEG/PNG) en el navegador. */
export function rotatePlanoDataUrl90(
  dataUrl: string,
  dir: PlanoRotateDir,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      reject(new Error('La rotación del plano solo funciona en el navegador.'))
      return
    }
    const src = dataUrl.trim()
    if (!src) {
      reject(new Error('No hay plano para rotar.'))
      return
    }
    const img = new Image()
    if (/^https?:/i.test(src)) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      if (w < 1 || h < 1) {
        reject(new Error('El plano no tiene un tamaño válido para rotar.'))
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = h
      canvas.height = w
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se pudo crear el canvas para rotar el plano.'))
        return
      }
      if (dir === 'cw') {
        ctx.translate(canvas.width, 0)
        ctx.rotate(Math.PI / 2)
      } else {
        ctx.translate(0, canvas.height)
        ctx.rotate(-Math.PI / 2)
      }
      ctx.drawImage(img, 0, 0)
      resolve(encodePlanoCanvas(canvas))
    }
    img.onerror = () => reject(new Error('No se pudo leer el plano para rotarlo.'))
    img.src = src
  })
}

/** Aplica N giros horarios de 90° a un data URL (para reabrir el archivo original). */
export async function rotatePlanoDataUrlQuarters(
  dataUrl: string,
  quarters: number,
): Promise<string> {
  const n = clampRotateQuarters(quarters)
  let url = dataUrl
  for (let i = 0; i < n; i++) {
    url = await rotatePlanoDataUrl90(url, 'cw')
  }
  return url
}

/** Data URL con colores invertidos (para fondo negro / líneas blancas). */
export function invertPlanoDataUrl(
  dataUrl: string,
  options?: NightPlanoOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      reject(new Error('La inversión del plano solo funciona en el navegador.'))
      return
    }
    const src = dataUrl.trim()
    if (!src) {
      reject(new Error('No hay plano para invertir.'))
      return
    }
    const img = new Image()
    if (/^https?:/i.test(src)) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      if (w < 1 || h < 1) {
        reject(new Error('El plano no tiene un tamaño válido.'))
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se pudo crear el canvas para invertir el plano.'))
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, w, h)
      intensificarTrazosPlano(imageData.data, w, h, options?.intensidadTrazos)
      applyNightPlanoPalette(imageData.data, w, h, options)
      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('No se pudo leer el plano para invertirlo.'))
    img.src = src
  })
}
