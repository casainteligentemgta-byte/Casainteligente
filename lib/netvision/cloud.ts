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

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T
  } catch {
    return { ok: false, authenticated: false, error: 'Respuesta inválida' } as T
  }
}

/** Lista proyectos del usuario en Supabase (requiere sesión). */
export async function cloudListProjects(): Promise<NetVisionCloudListResponse> {
  const res = await fetch('/api/netvision/projects', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  })
  return parseJson<NetVisionCloudListResponse>(res)
}

export async function cloudGetProject(
  id: string,
): Promise<NetVisionCloudProjectResponse> {
  const res = await fetch(`/api/netvision/projects/${encodeURIComponent(id)}`, {
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
  const res = await fetch(
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
  const res = await fetch(`/api/netvision/projects/${encodeURIComponent(id)}`, {
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
