import type { NetVisionProject } from '@/lib/netvision/types'

export const NETVISION_HISTORY_MAX = 40

/**
 * Ajustes seguidos dentro de esta ventana cuentan como un solo paso: un arrastre,
 * un deslizador o escribir un nombre no gastan un paso por cada movimiento.
 * Agregar o quitar elementos siempre es un paso propio (ver `isSameGestureChange`).
 */
export const NETVISION_HISTORY_COALESCE_MS = 400

/** Textos más largos que esto (el plano como data URL) se comparten, no se copian. */
const SHARED_STRING_MIN_CHARS = 4096

/**
 * Copia el diseño para el historial. El plano (data URL de varios MB) no cambia
 * entre pasos, así que se comparte la misma cadena en vez de duplicarla 40 veces.
 */
export function cloneProjectSnapshot(project: NetVisionProject): NetVisionProject {
  const shared: Record<string, string> = {}
  const rest: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(project)) {
    if (typeof value === 'string' && value.length > SHARED_STRING_MIN_CHARS) {
      shared[key] = value
    } else {
      rest[key] = value
    }
  }
  return {
    ...(JSON.parse(JSON.stringify(rest)) as Record<string, unknown>),
    ...shared,
  } as NetVisionProject
}

export function pushProjectHistory(
  stack: NetVisionProject[],
  snapshot: NetVisionProject,
  max = NETVISION_HISTORY_MAX,
): NetVisionProject[] {
  const next = [...stack, cloneProjectSnapshot(snapshot)]
  if (next.length <= max) return next
  return next.slice(next.length - max)
}

export function popProjectHistory(stack: NetVisionProject[]): {
  rest: NetVisionProject[]
  restored: NetVisionProject | null
} {
  if (stack.length === 0) return { rest: stack, restored: null }
  const rest = stack.slice(0, -1)
  return { rest, restored: stack[stack.length - 1]! }
}

/** Historial de un proyecto: pasos para deshacer y pasos para rehacer. */
export type ProjectHistory = {
  /** Proyecto al que pertenecen los pasos; al cambiar de proyecto se vacía. */
  projectId: string | null
  past: NetVisionProject[]
  future: NetVisionProject[]
  /** Momento del último cambio registrado (ms), para unir un gesto en un paso. */
  lastChangeAt: number
}

export function emptyProjectHistory(projectId: string | null = null): ProjectHistory {
  return { projectId, past: [], future: [], lastChangeAt: 0 }
}

/**
 * ¿El cambio solo ajusta lo que ya había (mover, girar, renombrar)? Si se agregó
 * o quitó algo, o cambió el plano, no se une al gesto anterior: tocar «+ Cámara»
 * tres veces rápido son tres pasos, no uno.
 */
export function isSameGestureChange(prev: NetVisionProject, next: NetVisionProject): boolean {
  const a = prev as unknown as Record<string, unknown>
  const b = next as unknown as Record<string, unknown>
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))
  for (const key of keys) {
    const va = a[key]
    const vb = b[key]
    if (Array.isArray(va) || Array.isArray(vb)) {
      const la = Array.isArray(va) ? va.length : 0
      const lb = Array.isArray(vb) ? vb.length : 0
      if (la !== lb) return false
    } else if (
      (typeof va === 'string' && va.length > SHARED_STRING_MIN_CHARS) ||
      (typeof vb === 'string' && vb.length > SHARED_STRING_MIN_CHARS)
    ) {
      if (va !== vb) return false
    }
  }
  return true
}

/** Campos que cambian al guardar sin que cambie el diseño. */
const CAMPOS_DE_GUARDADO = new Set(['updatedAt'])

/**
 * ¿Es el mismo diseño? Guardar solo cambia la fecha: eso no es un paso que se
 * pueda deshacer ni debe borrar lo que quedaba por rehacer.
 */
export function isSameDesign(prev: NetVisionProject, next: NetVisionProject): boolean {
  if (prev === next) return true
  const a = prev as unknown as Record<string, unknown>
  const b = next as unknown as Record<string, unknown>
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))
  for (const key of keys) {
    if (CAMPOS_DE_GUARDADO.has(key)) continue
    const va = a[key]
    const vb = b[key]
    if (va === vb) continue
    if (typeof va === 'string' || typeof vb === 'string') return false
    if (JSON.stringify(va ?? null) !== JSON.stringify(vb ?? null)) return false
  }
  return true
}

/**
 * Registra un cambio hecho por el usuario (de `prev` a `next`).
 * - Mismo diseño (solo se guardó): el historial queda igual.
 * - Otro proyecto: el historial empieza de cero (no se deshace hacia el anterior).
 * - Cambio seguido del anterior (mismo gesto): no gasta otro paso.
 * - Cualquier cambio nuevo descarta lo que quedaba por rehacer.
 */
export function recordProjectChange(
  history: ProjectHistory,
  prev: NetVisionProject,
  next: NetVisionProject,
  now: number,
  max = NETVISION_HISTORY_MAX,
): ProjectHistory {
  if (prev.id !== next.id) return emptyProjectHistory(next.id)
  if (history.projectId === next.id && isSameDesign(prev, next)) {
    // Nada cambió (se guardó, o un arrastre topó con el borde del plano). Si venía
    // un gesto en curso, sigue siendo el mismo gesto.
    const enGesto =
      history.lastChangeAt > 0 &&
      now - history.lastChangeAt >= 0 &&
      now - history.lastChangeAt < NETVISION_HISTORY_COALESCE_MS
    return enGesto ? { ...history, lastChangeAt: now } : history
  }
  const sameProject = history.projectId === next.id
  const base = sameProject ? history : emptyProjectHistory(next.id)
  const sameGesture =
    base.past.length > 0 &&
    base.lastChangeAt > 0 &&
    now - base.lastChangeAt >= 0 &&
    now - base.lastChangeAt < NETVISION_HISTORY_COALESCE_MS &&
    isSameGestureChange(prev, next)
  if (sameGesture) {
    return { ...base, future: [], lastChangeAt: now }
  }
  return {
    projectId: next.id,
    past: pushProjectHistory(base.past, prev, max),
    future: [],
    lastChangeAt: now,
  }
}

/** Vuelve un paso atrás; el diseño actual queda disponible para rehacer. */
export function undoProjectHistory(
  history: ProjectHistory,
  current: NetVisionProject,
  max = NETVISION_HISTORY_MAX,
): { history: ProjectHistory; restored: NetVisionProject | null } {
  const { rest, restored } = popProjectHistory(history.past)
  if (!restored) return { history, restored: null }
  return {
    history: {
      projectId: history.projectId,
      past: rest,
      future: pushProjectHistory(history.future, current, max),
      lastChangeAt: 0,
    },
    restored,
  }
}

/** Repite el último paso deshecho. */
export function redoProjectHistory(
  history: ProjectHistory,
  current: NetVisionProject,
  max = NETVISION_HISTORY_MAX,
): { history: ProjectHistory; restored: NetVisionProject | null } {
  const { rest, restored } = popProjectHistory(history.future)
  if (!restored) return { history, restored: null }
  return {
    history: {
      projectId: history.projectId,
      past: pushProjectHistory(history.past, current, max),
      future: rest,
      lastChangeAt: 0,
    },
    restored,
  }
}
