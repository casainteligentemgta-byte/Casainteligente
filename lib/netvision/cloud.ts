import type { NetVisionProject, NetVisionProjectIndexEntry } from '@/lib/netvision/types'
import { projectForCloud } from '@/lib/netvision/storage'
import { guardarBaseNube, leerBaseNube, olvidarBaseNube } from '@/lib/netvision/nubeBase'
import type { BaseNube, ConflictoNube } from '@/lib/netvision/sincronizacion'

export type NetVisionCloudIndexEntry = NetVisionProjectIndexEntry & {
  hasPlano: boolean
  source: 'cloud'
}

export type NetVisionCloudListResponse = {
  ok: boolean
  authenticated: boolean
  projects?: NetVisionCloudIndexEntry[]
  error?: string
}

export type NetVisionCloudProjectResponse = {
  ok: boolean
  authenticated: boolean
  project?: NetVisionProject
  error?: string
  /**
   * La nube tiene otra versión del proyecto y no se sobrescribió: el usuario
   * decide con cuál quedarse.
   */
  conflict?: ConflictoNube
}

/** `fetch` que no lanza: sin conexión devuelve una respuesta de error legible. */
async function fetchSeguro(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        authenticated: true,
        error: 'Sin conexión: no se pudo contactar la nube.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T
  } catch {
    return { ok: false, authenticated: false, error: 'Respuesta inválida' } as T
  }
}

/** Lista proyectos del usuario en Supabase (requiere sesión). */
export async function cloudListProjects(): Promise<NetVisionCloudListResponse> {
  const res = await fetchSeguro('/api/netvision/projects', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  })
  return parseJson<NetVisionCloudListResponse>(res)
}

export async function cloudGetProject(
  id: string,
): Promise<NetVisionCloudProjectResponse> {
  const res = await fetchSeguro(`/api/netvision/projects/${encodeURIComponent(id)}`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const r = await parseJson<NetVisionCloudProjectResponse>(res)
  // Lo que se baja pasa a ser la versión de la que parte este equipo.
  if (r.ok && r.project) guardarBaseNube(id, r.project.updatedAt)
  return r
}

/**
 * Sube el proyecto. Envía la versión de la nube de la que partió esta copia:
 * si la nube cambió desde otro equipo, no la pisa y devuelve `conflict`.
 * `forzar`: el usuario eligió conservar la copia de este equipo.
 */
export async function cloudUpsertProject(
  project: NetVisionProject,
  opciones: { forzar?: boolean } = {},
): Promise<NetVisionCloudProjectResponse> {
  const payload = projectForCloud(project)
  // Sin base conocida, vale como aproximada la fecha de la propia copia.
  const base: BaseNube = leerBaseNube(project.id) ?? { updatedAt: project.updatedAt, exacta: false }
  const res = await fetchSeguro(
    `/api/netvision/projects/${encodeURIComponent(project.id)}`,
    {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: payload, base, force: opciones.forzar === true }),
    },
  )
  const r = await parseJson<NetVisionCloudProjectResponse>(res)
  if (r.ok && r.project) guardarBaseNube(project.id, r.project.updatedAt)
  return r
}

export async function cloudDeleteProject(
  id: string,
): Promise<{ ok: boolean; authenticated: boolean; error?: string }> {
  const res = await fetchSeguro(`/api/netvision/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  const r = await parseJson<{ ok: boolean; authenticated: boolean; error?: string }>(res)
  if (r.ok) olvidarBaseNube(id)
  return r
}

/**
 * Sube todos los proyectos locales a la nube. Los que la nube tiene en otra
 * versión no se pisan: se devuelven en `conflictos` para resolverlos uno a uno.
 */
export async function cloudPushAll(
  projects: NetVisionProject[],
): Promise<{
  ok: boolean
  authenticated: boolean
  saved: number
  conflictos: string[]
  error?: string
}> {
  let saved = 0
  let authenticated = true
  const conflictos: string[] = []
  for (const p of projects) {
    const r = await cloudUpsertProject(p)
    if (!r.authenticated) {
      return { ok: false, authenticated: false, saved, conflictos, error: 'Inicia sesión para sincronizar' }
    }
    if (r.conflict) {
      conflictos.push(p.name)
      continue
    }
    if (!r.ok) {
      return {
        ok: false,
        authenticated: true,
        saved,
        conflictos,
        error: r.error || `Error al guardar ${p.name}`,
      }
    }
    saved += 1
    authenticated = r.authenticated
  }
  return { ok: true, authenticated, saved, conflictos }
}

export type NetVisionCompartirResponse = {
  ok: boolean
  authenticated: boolean
  /** Código del enlace; null si el proyecto no está compartido. */
  token?: string | null
  error?: string
}

function rutaCompartir(id: string): string {
  return `/api/netvision/projects/${encodeURIComponent(id)}/compartir`
}

/** ¿El proyecto ya tiene enlace para el cliente? */
export async function cloudEstadoCompartir(id: string): Promise<NetVisionCompartirResponse> {
  const res = await fetchSeguro(rutaCompartir(id), {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  })
  return parseJson<NetVisionCompartirResponse>(res)
}

/** Crea (o recupera) el enlace para el cliente. */
export async function cloudCompartir(id: string): Promise<NetVisionCompartirResponse> {
  const res = await fetchSeguro(rutaCompartir(id), {
    method: 'POST',
    credentials: 'same-origin',
  })
  return parseJson<NetVisionCompartirResponse>(res)
}

/** Anula el enlace: lo que se envió deja de abrir. */
export async function cloudDejarDeCompartir(id: string): Promise<NetVisionCompartirResponse> {
  const res = await fetchSeguro(rutaCompartir(id), {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  return parseJson<NetVisionCompartirResponse>(res)
}

export type NetVisionCompartidoResponse = {
  ok: boolean
  project?: NetVisionProject
  /** URL temporal del plano cuando no viene dentro del proyecto. */
  planoSignedUrl?: string | null
  error?: string
}

/** Proyecto compartido con el cliente (público, por código). */
export async function cloudProyectoCompartido(token: string): Promise<NetVisionCompartidoResponse> {
  const res = await fetchSeguro(`/api/netvision/compartido/${encodeURIComponent(token)}`, {
    method: 'GET',
    cache: 'no-store',
  })
  return parseJson<NetVisionCompartidoResponse>(res)
}
