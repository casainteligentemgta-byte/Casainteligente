/**
 * Recuerda, por proyecto, de qué versión de la nube partió la copia de este
 * equipo (ver `sincronizacion.ts`). Vive en el navegador (localStorage).
 */
import type { BaseNube } from '@/lib/netvision/sincronizacion'

const CLAVE = 'nexus.netvision.nubeBase.v1'

type Mapa = Record<string, BaseNube>

function leer(): Mapa {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Mapa) : {}
  } catch {
    return {}
  }
}

function escribir(mapa: Mapa) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(mapa))
  } catch {
    /* sin almacenamiento: se usará la fecha de la copia como base aproximada */
  }
}

/** Base guardada del proyecto, o null si este equipo aún no la conoce. */
export function leerBaseNube(projectId: string): BaseNube | null {
  const b = leer()[projectId]
  return b && typeof b.updatedAt === 'string' ? { updatedAt: b.updatedAt, exacta: b.exacta === true } : null
}

/** La nube confirmó esta versión (al subir o al bajar): es la base exacta. */
export function guardarBaseNube(projectId: string, updatedAt: string | null | undefined) {
  if (!projectId || !updatedAt) return
  const mapa = leer()
  mapa[projectId] = { updatedAt, exacta: true }
  escribir(mapa)
}

/**
 * Base aproximada para una copia que este equipo abre sin haberla sincronizado
 * con este control: la fecha con que estaba guardada. No pisa una base ya conocida.
 */
export function anotarBaseAproximada(projectId: string, updatedAt: string | null | undefined) {
  if (!projectId || !updatedAt) return
  const mapa = leer()
  if (mapa[projectId]) return
  mapa[projectId] = { updatedAt, exacta: false }
  escribir(mapa)
}

export function olvidarBaseNube(projectId: string) {
  const mapa = leer()
  if (!(projectId in mapa)) return
  delete mapa[projectId]
  escribir(mapa)
}
