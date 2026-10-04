import type { PlanoRotuloInfo } from '@/lib/netvision/utils/planoRotulo'

export const PLANO_PRINT_STORAGE_KEY = 'nexus.netvision.planoPrint.v1'
export const PLANO_PRINT_PATH = '/nexus/vision/imprimir'

export type PlanoPrintPayload = {
  v: 1
  projectId: string
  returnHref: string
  imageDataUrl: string
  rotulo: PlanoRotuloInfo
  planoNombre?: string
  cameraCount?: number
  networkCount?: number
  structureCount?: number
}

export function buildPlanoPrintMeta(
  p: Pick<
    PlanoPrintPayload,
    'planoNombre' | 'cameraCount' | 'networkCount' | 'structureCount'
  >,
): string {
  const parts = [
    p.planoNombre?.trim() ? `Plano: ${p.planoNombre.trim()}` : null,
    p.cameraCount != null
      ? `${p.cameraCount} cámara${p.cameraCount === 1 ? '' : 's'}`
      : null,
    p.networkCount != null ? `${p.networkCount} red` : null,
    p.structureCount != null
      ? `${p.structureCount} estructura${p.structureCount === 1 ? '' : 's'}`
      : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

export function savePlanoPrintPayload(payload: PlanoPrintPayload): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    sessionStorage.setItem(PLANO_PRINT_STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    try {
      sessionStorage.setItem(
        PLANO_PRINT_STORAGE_KEY,
        JSON.stringify({ ...payload, imageDataUrl: '' }),
      )
    } catch {
      /* quota */
    }
    return false
  }
}

async function shrinkJpeg(
  dataUrl: string,
  maxWidth: number,
  quality: number,
): Promise<string | null> {
  if (typeof document === 'undefined' || !dataUrl.startsWith('data:image/')) {
    return null
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('No se pudo achicar la captura.'))
    el.src = dataUrl
  })
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) return null
  const scale = Math.min(1, maxWidth / w)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Guarda la captura; si no cabe, la achica. Devuelve false si quedó sin imagen. */
export async function savePlanoPrintPayloadResilient(
  payload: PlanoPrintPayload,
): Promise<boolean> {
  if (savePlanoPrintPayload(payload)) return Boolean(payload.imageDataUrl)
  if (payload.imageDataUrl) {
    try {
      const smaller = await shrinkJpeg(payload.imageDataUrl, 1400, 0.68)
      if (smaller && savePlanoPrintPayload({ ...payload, imageDataUrl: smaller })) {
        return true
      }
    } catch {
      /* ignore */
    }
  }
  savePlanoPrintPayload({ ...payload, imageDataUrl: '' })
  return false
}

export function loadPlanoPrintPayload(
  projectId?: string | null,
): PlanoPrintPayload | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PLANO_PRINT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PlanoPrintPayload
    if (!parsed || parsed.v !== 1 || !parsed.rotulo) return null
    if (projectId && parsed.projectId && parsed.projectId !== projectId) return null
    return parsed
  } catch {
    return null
  }
}

export function planoPrintHref(projectId: string, branch?: string | null): string {
  const params = new URLSearchParams()
  if (projectId.trim()) params.set('id', projectId.trim())
  if (branch?.trim()) params.set('rama', branch.trim())
  const q = params.toString()
  return q ? `${PLANO_PRINT_PATH}?${q}` : PLANO_PRINT_PATH
}
