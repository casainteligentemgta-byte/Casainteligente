/**
 * Trae un proyecto de la nube a este equipo, con el plano que le corresponde
 * (el que viene dentro, el de este equipo si es el mismo, o el de Storage).
 */
import { cloudGetProject } from '@/lib/netvision/cloud'
import { planoTrasBajar } from '@/lib/netvision/compartir'
import { descargarPlanoNube } from '@/lib/netvision/planoNube'
import { peekLocalProject, upsertLocalProject } from '@/lib/netvision/storage'
import type { NetVisionProject } from '@/lib/netvision/types'

export type ResultadoBajar =
  | { ok: true; project: NetVisionProject; planoFalta: boolean }
  | { ok: false; error: string }

export async function bajarProyectoDeNube(id: string): Promise<ResultadoBajar> {
  const r = await cloudGetProject(id)
  if (!r.ok || !r.project) return { ok: false, error: r.error || 'No se pudo descargar' }
  const remoto = r.project
  const planoLocal = peekLocalProject(id)?.planoUrl ?? null
  const decision = planoTrasBajar(remoto, planoLocal)
  if (decision === 'remoto') {
    return { ok: true, project: upsertLocalProject(remoto), planoFalta: false }
  }
  if (decision === 'ninguno') {
    return {
      ok: true,
      project: upsertLocalProject({ ...remoto, planoUrl: null }, { conservarPlanoLocal: false }),
      planoFalta: false,
    }
  }
  if (decision === 'local') {
    return { ok: true, project: upsertLocalProject({ ...remoto, planoUrl: planoLocal }), planoFalta: false }
  }
  // El plano grande no viene en el proyecto: se baja aparte de la nube.
  const plano = await descargarPlanoNube(id)
  if (plano) {
    return { ok: true, project: upsertLocalProject({ ...remoto, planoUrl: plano }), planoFalta: false }
  }
  // No se pudo bajar: se abre sin plano en vez de mostrar uno que ya no es.
  return {
    ok: true,
    project: upsertLocalProject({ ...remoto, planoUrl: null }, { conservarPlanoLocal: false }),
    planoFalta: remoto.planoHuella !== undefined,
  }
}
