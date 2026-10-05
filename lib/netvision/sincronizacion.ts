/**
 * Sincronización con la nube sin pisar trabajo ajeno.
 *
 * Cada copia recuerda de qué versión de la nube partió (su «base»). Al subir,
 * si la nube ya no está en esa versión y el contenido es distinto, no se
 * sobrescribe: se avisa y el usuario decide con cuál quedarse.
 * Funciones puras (sin red ni almacenamiento) para poder probarlas.
 */

/** Versión de la nube de la que partió una copia local. */
export type BaseNube = {
  /** `updated_at` de la nube en ese momento. */
  updatedAt: string
  /**
   * true: es el valor exacto que devolvió la nube.
   * false: aproximada (copias anteriores a este control): la fecha con que se
   * abrió la copia en este equipo.
   */
  exacta: boolean
}

/** Margen para una base aproximada: retraso normal entre guardar y subir. */
export const TOLERANCIA_BASE_MS = 2 * 60 * 1000

function ordenado(valor: unknown, omitir: ReadonlySet<string> | null): unknown {
  if (Array.isArray(valor)) return valor.map((v) => ordenado(v, null))
  if (valor && typeof valor === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(valor as Record<string, unknown>).sort()) {
      if (omitir?.has(k)) continue
      const v = (valor as Record<string, unknown>)[k]
      if (v === undefined) continue
      out[k] = ordenado(v, null)
    }
    return out
  }
  return valor
}

/** Campos que cambian al guardar o al subir sin que cambie el diseño. */
const NO_ES_DISENO: ReadonlySet<string> = new Set(['updatedAt'])

/** ¿Los dos proyectos son el mismo diseño? (no importan la fecha ni el orden de las claves). */
export function mismoContenido(a: unknown, b: unknown): boolean {
  return JSON.stringify(ordenado(a, NO_ES_DISENO)) === JSON.stringify(ordenado(b, NO_ES_DISENO))
}

function ms(fecha: string | null | undefined): number {
  if (!fecha) return NaN
  return Date.parse(fecha)
}

/** ¿La base corresponde a la versión que hay ahora en la nube? */
export function baseVigente(base: BaseNube | null | undefined, remotoUpdatedAt: string): boolean {
  if (!base) return false
  const b = ms(base.updatedAt)
  const r = ms(remotoUpdatedAt)
  if (!Number.isFinite(b) || !Number.isFinite(r)) return false
  return base.exacta ? b === r : b >= r - TOLERANCIA_BASE_MS
}

export type DecisionGuardado = 'crear' | 'actualizar' | 'sin_cambios' | 'conflicto'

/**
 * Qué hacer al subir un proyecto.
 * - No existe en la nube: se crea.
 * - `forzar` (el usuario eligió conservar su copia): se actualiza.
 * - Mismo diseño: no hay nada que subir.
 * - Sin base (navegador con una versión anterior de la app): se actualiza, como antes.
 * - Base vigente: se actualiza. Si no: conflicto.
 */
export function decidirGuardado(args: {
  remotoUpdatedAt: string | null
  base: BaseNube | null | undefined
  forzar?: boolean
  mismoContenido: boolean
}): DecisionGuardado {
  if (!args.remotoUpdatedAt) return 'crear'
  if (args.forzar) return 'actualizar'
  if (args.mismoContenido) return 'sin_cambios'
  if (args.base === undefined) return 'actualizar'
  return baseVigente(args.base, args.remotoUpdatedAt) ? 'actualizar' : 'conflicto'
}

/** Lee la base enviada por el navegador; `undefined` si no vino o es inválida. */
export function leerBaseDePeticion(raw: unknown): BaseNube | null | undefined {
  if (raw === null) return null
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as { updatedAt?: unknown; exacta?: unknown }
  if (typeof r.updatedAt !== 'string' || !Number.isFinite(Date.parse(r.updatedAt))) return null
  return { updatedAt: r.updatedAt, exacta: r.exacta === true }
}

/** Resumen de la versión de la nube para mostrar en el aviso de conflicto. */
export type ConflictoNube = {
  updatedAt: string
  name: string
  cameras: number
}
