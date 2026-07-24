import {
  listarColaAvanceOffline,
  quitarDeColaAvanceOffline,
  type ReporteAvancePendiente,
} from '@/lib/campo/colaAvanceOffline';
import { formatApiErrorBody } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

export type ResultadoSyncCola = {
  enviados: number;
  fallidos: number;
  errores: string[];
};

async function enviarReporte(item: ReporteAvancePendiente): Promise<void> {
  const res = await fetch(
    `/api/proyectos/${encodeURIComponent(item.proyectoId)}/campo/avance`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.payload),
    },
  );
  const data = await parseFetchJson<{ error?: string }>(res);
  if (!res.ok) {
    throw new Error(formatApiErrorBody(data, 'Error al sincronizar avance offline'));
  }
}

/** Vacía la cola local hacia el API de campo (Safari iPad — reconexión automática). */
export async function sincronizarColaAvanceOffline(
  proyectoId?: string,
): Promise<ResultadoSyncCola> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { enviados: 0, fallidos: 0, errores: [] };
  }

  const cola = listarColaAvanceOffline(proyectoId);
  let enviados = 0;
  let fallidos = 0;
  const errores: string[] = [];

  for (const item of cola) {
    try {
      await enviarReporte(item);
      quitarDeColaAvanceOffline(item.id);
      enviados += 1;
    } catch (e) {
      fallidos += 1;
      errores.push(e instanceof Error ? e.message : 'Error de sincronización');
    }
  }

  return { enviados, fallidos, errores };
}
