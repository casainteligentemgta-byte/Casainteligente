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
  /** Nombres fuera del dibujo (chips). El plano se captura sin etiquetas Konva. */
  cameraLabels?: { id: string; label: string }[]
}

export function labelEquiposRed(n: number): string {
  return n === 1 ? 'equipo de red' : 'equipos de red'
}

export function labelMuros(n: number): string {
  return n === 1 ? 'muro' : 'muros'
}

export function capitalizeLabel(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

const EXT_PLANO = /\.(pdf|png|jpe?g|webp|gif|dwg|dxf|svg)$/i
const NOMBRE_GENERICO =
  /^(plano|image|img|foto|scan|documento|untitled|sin[-_\s]?nombre)([-_\s]?\d*)?$/i

export function quitarExtensionPlano(nombre: string): string {
  return nombre.trim().replace(EXT_PLANO, '').trim()
}

/** Título sugerido para el archivo: proyecto + nombre del plano, sin extensión. */
export function sugerirNombrePdfPlano(opts: {
  projectName?: string | null
  planoNombre?: string | null
}): string {
  const proyecto = opts.projectName?.trim() || ''
  const plano = quitarExtensionPlano(opts.planoNombre || '')
  const planoUtil = plano && !NOMBRE_GENERICO.test(plano) ? plano : ''
  if (proyecto && planoUtil) {
    const p = proyecto.toLowerCase()
    const l = planoUtil.toLowerCase()
    if (l.includes(p) || p.includes(l)) {
      return proyecto.length >= planoUtil.length ? proyecto : planoUtil
    }
    return `${proyecto} ${planoUtil}`
  }
  return proyecto || planoUtil || 'Plano'
}

/** Nombre de archivo .pdf. Conserva espacios y acentos (p. ej. «Santa sofía baja 2.pdf»). */
export function nombreArchivoPdf(nombre: string): string {
  const base = nombre
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return `${base || 'Plano'}.pdf`
}

export function tituloPdfDesdeNombre(nombre: string): string {
  return nombreArchivoPdf(nombre).replace(/\.pdf$/i, '')
}

export function buildPlanoPrintMeta(
  p: Pick<PlanoPrintPayload, 'cameraCount'>,
): string {
  if (p.cameraCount == null) return ''
  return `${p.cameraCount} cámara${p.cameraCount === 1 ? '' : 's'}`
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
