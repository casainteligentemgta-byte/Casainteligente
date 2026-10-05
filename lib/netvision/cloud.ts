import type { NetVisionProject, NetVisionProjectIndexEntry } from '@/lib/netvision/types'
import { projectForCloud } from '@/lib/netvision/storage'

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
  return parseJson<NetVisionCloudProjectResponse>(res)
}

export async function cloudUpsertProject(
  project: NetVisionProject,
): Promise<NetVisionCloudProjectResponse> {
  const payload = projectForCloud(project)
  const res = await fetchSeguro(
    `/api/netvision/projects/${encodeURIComponent(project.id)}`,
    {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: payload }),
    },
  )
  return parseJson<NetVisionCloudProjectResponse>(res)
}

export async function cloudDeleteProject(
  id: string,
): Promise<{ ok: boolean; authenticated: boolean; error?: string }> {
  const res = await fetchSeguro(`/api/netvision/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  return parseJson(res)
}

/** Sube todos los proyectos locales a la nube. */
export async function cloudPushAll(
  projects: NetVisionProject[],
): Promise<{ ok: boolean; authenticated: boolean; saved: number; error?: string }> {
  let saved = 0
  let authenticated = true
  for (const p of projects) {
    const r = await cloudUpsertProject(p)
    if (!r.authenticated) {
      return { ok: false, authenticated: false, saved, error: 'Inicia sesión para sincronizar' }
    }
    if (!r.ok) {
      return {
        ok: false,
        authenticated: true,
        saved,
        error: r.error || `Error al guardar ${p.name}`,
      }
    }
    saved += 1
    authenticated = r.authenticated
  }
  return { ok: true, authenticated, saved }
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
