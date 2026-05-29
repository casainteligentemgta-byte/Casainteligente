import type { ActualizacionAvanceCronograma } from '@/lib/proyectos/aplicarAvanceCronograma';

export const COLA_AVANCE_STORAGE_KEY = 'ci_cola_avance_campo_v1';

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
    const raw = localStorage.getItem(COLA_AVANCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is ReporteAvancePendiente =>
        Boolean(x) &&
        typeof x === 'object' &&
        (x as ReporteAvancePendiente).pendiente === true &&
        typeof (x as ReporteAvancePendiente).proyectoId === 'string' &&
        Array.isArray((x as ReporteAvancePendiente).payload?.actualizaciones),
    );
  } catch {
    return [];
  }
}

function escribirCola(items: ReporteAvancePendiente[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COLA_AVANCE_STORAGE_KEY, JSON.stringify(items));
}

export function listarColaAvanceOffline(proyectoId?: string): ReporteAvancePendiente[] {
  const cola = leerColaRaw();
  if (!proyectoId) return cola;
  return cola.filter((x) => x.proyectoId === proyectoId);
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

export function quitarDeColaAvanceOffline(id: string): void {
  escribirCola(leerColaRaw().filter((x) => x.id !== id));
}

export function contarColaAvanceOffline(proyectoId?: string): number {
  return listarColaAvanceOffline(proyectoId).length;
}
