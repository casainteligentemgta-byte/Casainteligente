/**
 * Enlace para el cliente: vista de solo lectura de un proyecto NetVision que
 * abre en cualquier teléfono sin iniciar sesión, con un código secreto.
 * Funciones puras (sin red) para poder probarlas.
 */
import type { NetVisionProject } from '@/lib/netvision/types'

export const NETVISION_PLANOS_BUCKET = 'netvision-planos'
/** Parámetro del enlace del cliente: /nexus/vision/cliente?c=<código>. */
export const PARAM_COMPARTIDO = 'c'

const TOKEN_RE = /^[A-Za-z0-9_-]{24,128}$/

/** ¿Tiene forma de código de enlace? (evita consultar con basura). */
export function esTokenCompartir(raw: unknown): raw is string {
  return typeof raw === 'string' && TOKEN_RE.test(raw)
}

/** Código secreto a partir de bytes aleatorios (base64 apto para URL). */
export function tokenDesdeBytes(bytes: Uint8Array): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += abc[bytes[i]! & 63]
  return out
}

/** Ruta del plano en Storage: una carpeta por usuario, un archivo por proyecto. */
export function rutaPlanoNube(userId: string, projectId: string): string {
  const limpio = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120)
  return `${limpio(userId)}/${limpio(projectId)}`
}

/** Enlace que se le envía al cliente. */
export function urlCompartida(origin: string, token: string, camaraId?: string | null): string {
  const base = origin.replace(/\/+$/, '')
  const q = new URLSearchParams({ [PARAM_COMPARTIDO]: token })
  if (camaraId) q.set('cam', camaraId)
  return `${base}/nexus/vision/cliente?${q.toString()}`
}

/**
 * Copia del proyecto para el cliente: lo que la vista necesita, sin datos
 * internos del instalador (margen, descripción interna, decisiones de cobro).
 */
export function proyectoParaCliente(project: NetVisionProject): NetVisionProject {
  return {
    ...project,
    description: '',
    distributorMarginPct: 0,
    zanjaModo: 'no_cobrar',
  }
}

/**
 * Huella barata del plano para saber si cambió desde la última subida
 * (largo + muestras; no es criptográfica, solo evita subir lo mismo).
 */
export function huellaPlano(planoUrl: string | null | undefined): string {
  if (!planoUrl) return ''
  const n = planoUrl.length
  let h = 2166136261
  const mezclar = (i: number) => {
    h ^= planoUrl.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // Principio y final completos + muestras repartidas por el medio.
  const borde = Math.min(256, n)
  for (let i = 0; i < borde; i++) mezclar(i)
  for (let i = Math.max(borde, n - 256); i < n; i++) mezclar(i)
  const paso = Math.max(1, Math.floor(n / 1024))
  for (let i = borde; i < n - 256; i += paso) mezclar(i)
  return `${n}:${(h >>> 0).toString(36)}`
}

/**
 * Al bajar un proyecto de la nube, ¿qué plano le corresponde?
 * - 'remoto': viene dentro del proyecto.
 * - 'ninguno': la nube dice que el proyecto no tiene plano.
 * - 'local': el plano de este equipo es el mismo que el de la nube.
 * - 'bajar': hay que traerlo de la nube (no hay plano aquí o es otro).
 */
export function planoTrasBajar(
  remoto: Pick<NetVisionProject, 'planoUrl' | 'planoHuella'>,
  planoLocal: string | null | undefined,
): 'remoto' | 'ninguno' | 'local' | 'bajar' {
  if (remoto.planoUrl) return 'remoto'
  if (remoto.planoHuella === '') return 'ninguno'
  // Copias anteriores a la huella: se conserva el plano local si lo hay.
  if (remoto.planoHuella === undefined) return planoLocal ? 'local' : 'bajar'
  return planoLocal && huellaPlano(planoLocal) === remoto.planoHuella ? 'local' : 'bajar'
}

/**
 * ¿El proyecto de la nube tiene plano guardado aparte (en Storage)?
 * Solo entonces se firma su URL: así no se entrega al cliente un plano viejo
 * de un proyecto al que ya se le quitó.
 */
export function tienePlanoAparte(project: Pick<NetVisionProject, 'planoUrl' | 'planoHuella'>): boolean {
  if (project.planoUrl) return false
  // Sin huella (copia anterior a este control) se asume que puede tenerlo.
  return project.planoHuella === undefined || project.planoHuella !== ''
}

/** Separa un data URL en tipo y bytes; null si no es un data URL base64. */
export function partesDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/.exec(dataUrl)
  if (!m) return null
  return { mime: m[1]!, base64: m[2]! }
}
