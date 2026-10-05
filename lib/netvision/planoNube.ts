/**
 * Plano del proyecto en la nube (Supabase Storage), desde el navegador y con
 * la sesión del usuario. El JSON del proyecto no lleva el plano cuando es
 * grande; aquí se sube aparte para que abra en otro equipo y en el enlace del
 * cliente.
 */
import { createClient } from '@/lib/supabase/client'
import {
  NETVISION_PLANOS_BUCKET,
  huellaPlano,
  partesDataUrl,
  rutaPlanoNube,
} from '@/lib/netvision/compartir'
import type { NetVisionProject } from '@/lib/netvision/types'

const CLAVE_HUELLA = 'nexus.netvision.planoNube.'

function huellaSubida(projectId: string): string {
  try {
    return localStorage.getItem(`${CLAVE_HUELLA}${projectId}`) ?? ''
  } catch {
    return ''
  }
}

function recordarHuella(projectId: string, huella: string) {
  try {
    localStorage.setItem(`${CLAVE_HUELLA}${projectId}`, huella)
  } catch {
    /* sin almacenamiento local: se volverá a subir la próxima vez */
  }
}

/** Convierte el plano (data URL o URL) en un archivo para subir. */
async function planoComoBlob(planoUrl: string): Promise<Blob | null> {
  const partes = partesDataUrl(planoUrl)
  if (partes) {
    const bin = atob(partes.base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: partes.mime })
  }
  try {
    const res = await fetch(planoUrl)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

function blobComoDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

export type ResultadoPlanoNube =
  | { ok: true; subido: boolean }
  | { ok: false; autenticado: boolean; error: string }

/**
 * Sube el plano del proyecto si cambió desde la última subida.
 * `forzar` lo sube siempre (al compartir, para garantizar que está arriba).
 */
export async function subirPlanoNube(
  project: Pick<NetVisionProject, 'id' | 'planoUrl'>,
  opciones: { forzar?: boolean } = {},
): Promise<ResultadoPlanoNube> {
  if (!project.planoUrl) return { ok: true, subido: false }
  const huella = huellaPlano(project.planoUrl)
  if (!opciones.forzar && huella && huellaSubida(project.id) === huella) {
    return { ok: true, subido: false }
  }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, autenticado: false, error: 'Inicia sesión para guardar el plano en la nube.' }
    const blob = await planoComoBlob(project.planoUrl)
    if (!blob) return { ok: false, autenticado: true, error: 'No se pudo leer el plano para subirlo.' }
    const { error } = await supabase.storage
      .from(NETVISION_PLANOS_BUCKET)
      .upload(rutaPlanoNube(user.id, project.id), blob, {
        upsert: true,
        contentType: blob.type || 'image/png',
        cacheControl: '0',
      })
    if (error) return { ok: false, autenticado: true, error: error.message }
    recordarHuella(project.id, huella)
    return { ok: true, subido: true }
  } catch (e) {
    return {
      ok: false,
      autenticado: true,
      error: e instanceof Error ? e.message : 'No se pudo subir el plano.',
    }
  }
}

/** Baja el plano del proyecto del usuario (para abrirlo en otro equipo). */
export async function descargarPlanoNube(projectId: string): Promise<string | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase.storage
      .from(NETVISION_PLANOS_BUCKET)
      .download(rutaPlanoNube(user.id, projectId))
    if (error || !data) return null
    const dataUrl = await blobComoDataUrl(data)
    if (dataUrl) recordarHuella(projectId, huellaPlano(dataUrl))
    return dataUrl
  } catch {
    return null
  }
}

/** Baja un plano desde una URL firmada (enlace del cliente) como data URL. */
export async function descargarPlanoFirmado(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return await blobComoDataUrl(await res.blob())
  } catch {
    return null
  }
}
