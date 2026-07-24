import type { ActualizacionAvanceCronograma } from '@/lib/proyectos/aplicarAvanceCronograma';

export const COLA_AVANCE_STORAGE_KEY = 'ci_cola_avance';
const COLA_AVANCE_LEGACY_KEY = 'ci_cola_avance_campo_v1';

export class ColaAvanceStorageError extends Error {
  constructor(cause?: unknown) {
    super('Error de almacenamiento local. Libera espacio en Safari.');
    this.name = 'ColaAvanceStorageError';
    if (cause instanceof Error) this.cause = cause;
  }
}

export type ReporteAvancePendiente = {
  id: string;
  proyectoId: string;
  pendiente: true;
  createdAt: string;
  payload: {
    actualizaciones: ActualizacionAvanceCronograma[];
  };
};

function leerColaRaw(): ReporteAvancePendiente[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw =
      localStorage.getItem(COLA_AVANCE_STORAGE_KEY) ??
      localStorage.getItem(COLA_AVANCE_LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items = parsed.filter(
      (x): x is ReporteAvancePendiente =>
        Boolean(x) &&
        typeof x === 'object' &&
        (x as ReporteAvancePendiente).pendiente === true &&
        typeof (x as ReporteAvancePendiente).proyectoId === 'string' &&
        Array.isArray((x as ReporteAvancePendiente).payload?.actualizaciones),
    );
    if (localStorage.getItem(COLA_AVANCE_LEGACY_KEY) && !localStorage.getItem(COLA_AVANCE_STORAGE_KEY)) {
      try {
        localStorage.setItem(COLA_AVANCE_STORAGE_KEY, JSON.stringify(items));
        localStorage.removeItem(COLA_AVANCE_LEGACY_KEY);
      } catch {
        /* migración best-effort */
      }
    }
    return items;
  } catch {
    return [];
  }
}

function escribirCola(items: ReporteAvancePendiente[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COLA_AVANCE_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error guardando caché offline en el iPad:', e);
    throw new ColaAvanceStorageError(e);
  }
}

export function listarColaAvanceOffline(proyectoId?: string): ReporteAvancePendiente[] {
  const cola = leerColaRaw();
  if (!proyectoId) return cola;
  return cola.filter((x) => x.proyectoId === proyectoId);
}

function claveActualizacion(act: ActualizacionAvanceCronograma): string {
  return (
    act.partida_id?.trim() ||
    act.id?.trim() ||
    act.codigo_partida?.trim() ||
    `${act.nombre_tarea ?? 'partida'}-${act.orden ?? 0}`
  );
}

export function encolarAvanceOffline(
  proyectoId: string,
  actualizaciones: ActualizacionAvanceCronograma[],
): ReporteAvancePendiente {
  const item: ReporteAvancePendiente = {
    id: crypto.randomUUID(),
    proyectoId,
    pendiente: true,
    createdAt: new Date().toISOString(),
    payload: { actualizaciones },
  };
  const cola = leerColaRaw();
  cola.push(item);
  escribirCola(cola);
  return item;
}

/** Fusiona partidas en el último lote pendiente del proyecto (evita duplicados offline). */
export function encolarAvanceOfflineMerge(
  proyectoId: string,
  actualizaciones: ActualizacionAvanceCronograma[],
): ReporteAvancePendiente {
  const cola = leerColaRaw();
  const idx = cola.findLastIndex((x) => x.proyectoId === proyectoId && x.pendiente);

  if (idx >= 0) {
    const merged = new Map<string, ActualizacionAvanceCronograma>();
    for (const act of cola[idx].payload.actualizaciones) {
      merged.set(claveActualizacion(act), act);
    }
    for (const act of actualizaciones) {
      merged.set(claveActualizacion(act), act);
    }
    cola[idx] = {
      ...cola[idx],
      createdAt: new Date().toISOString(),
      payload: { actualizaciones: Array.from(merged.values()) },
    };
    escribirCola(cola);
    return cola[idx];
  }

  return encolarAvanceOffline(proyectoId, actualizaciones);
}

export function quitarDeColaAvanceOffline(id: string): void {
  escribirCola(leerColaRaw().filter((x) => x.id !== id));
}

export function contarColaAvanceOffline(proyectoId?: string): number {
  return listarColaAvanceOffline(proyectoId).length;
}
