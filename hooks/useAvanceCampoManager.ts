'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ColaAvanceStorageError,
  COLA_AVANCE_STORAGE_KEY,
  contarColaAvanceOffline,
  encolarAvanceOfflineMerge,
} from '@/lib/campo/colaAvanceOffline';
import { sincronizarColaAvanceOffline } from '@/lib/campo/sincronizarColaAvanceOffline';
import type { ActualizacionAvanceCronograma } from '@/lib/proyectos/aplicarAvanceCronograma';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

export type ResultadoRegistrarAvanceFisico =
  | { offline: true }
  | { success: true; guardados: number }
  | { error: true; message?: string };

type Options = {
  onSynced?: () => void;
};

/**
 * Capa offline-first para avance diario de campo (Safari iPad).
 * Encola en `ci_cola_avance`, sincroniza al evento `online` y degrada a local ante fallos de red.
 */
export function useAvanceCampoManager(proyectoId: string, options?: Options) {
  const { onSynced } = options ?? {};
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tienePendientesOffline, setTienePendientesOffline] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [guardadoLocal, setGuardadoLocal] = useState(false);

  const refrescar = useCallback(() => {
    const n = contarColaAvanceOffline(proyectoId);
    setTienePendientesOffline(n > 0);
    return n;
  }, [proyectoId]);

  const encolarLocal = useCallback(
    (actualizaciones: ActualizacionAvanceCronograma[], mensajeOk: string) => {
      try {
        encolarAvanceOfflineMerge(proyectoId, actualizaciones);
        setGuardadoLocal(true);
        setTienePendientesOffline(true);
        refrescar();
        toast.warning(mensajeOk);
        return true;
      } catch (e) {
        if (e instanceof ColaAvanceStorageError) {
          toast.error(
            'La memoria local de Safari está al límite. Desactiva el modo incógnito o libera espacio para no perder los datos de campo.',
          );
        } else {
          console.error('Error de cuota en LocalStorage Safari:', e);
          toast.error('Error de almacenamiento local. Libera espacio en Safari.');
        }
        return false;
      }
    },
    [proyectoId, refrescar],
  );

  const procesarColaOffline = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const pendientes = refrescar();
    if (pendientes === 0) return;

    setSincronizando(true);
    toast.info(
      `Detectada señal. Sincronizando ${pendientes} reporte(s) de campo de forma automática…`,
    );

    try {
      const resultado = await sincronizarColaAvanceOffline(proyectoId);

      if (resultado.enviados > 0) {
        setGuardadoLocal(false);
        setTienePendientesOffline(contarColaAvanceOffline(proyectoId) > 0);
        onSynced?.();
        toast.success(
          'Todos los avances diarios del frente de obra han sido sincronizados en Supabase.',
        );
      }

      if (resultado.fallidos > 0) {
        console.error('Fallo el vaciado automático de la cola offline:', resultado.errores);
        toast.error(
          `No se pudieron sincronizar ${resultado.fallidos} reporte(s). Se reintentará al recuperar señal.`,
        );
      }

      refrescar();
    } catch (error) {
      console.error('Fallo el vaciado automático de la cola offline:', error);
    } finally {
      setSincronizando(false);
    }
  }, [proyectoId, refrescar, onSynced]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      refrescar();
    } catch {
      localStorage.removeItem(COLA_AVANCE_STORAGE_KEY);
      setTienePendientesOffline(false);
    }
  }, [refrescar]);

  useEffect(() => {
    window.addEventListener('online', procesarColaOffline);
    return () => window.removeEventListener('online', procesarColaOffline);
  }, [procesarColaOffline]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine && tienePendientesOffline) {
      void procesarColaOffline();
    }
  }, [tienePendientesOffline, procesarColaOffline]);

  const registrarAvanceFisico = useCallback(
    async (
      actualizaciones: ActualizacionAvanceCronograma[],
    ): Promise<ResultadoRegistrarAvanceFisico> => {
      if (!actualizaciones.length) {
        return { error: true, message: 'Sin partidas para registrar' };
      }

      setIsSubmitting(true);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const ok = encolarLocal(
          actualizaciones,
          'Reporte resguardado en la tablet de forma local debido a fallas de conexión.',
        );
        setIsSubmitting(false);
        return ok ? { offline: true } : { error: true };
      }

      try {
        const res = await fetch(
          `/api/proyectos/${encodeURIComponent(proyectoId)}/campo/avance`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actualizaciones }),
          },
        );
        const data = await parseFetchJson<{ error?: string; guardados?: number }>(res);
        if (!res.ok) {
          throw new Error(formatApiErrorBody(data, 'Error al registrar en base de datos'));
        }

        toast.success('Avance diario asentado con éxito.');
        setGuardadoLocal(false);
        onSynced?.();
        return { success: true, guardados: data.guardados ?? actualizaciones.length };
      } catch (err) {
        const online = typeof navigator !== 'undefined' && navigator.onLine;
        if (!online) {
          const ok = encolarLocal(
            actualizaciones,
            'Reporte guardado localmente. Sincronización pendiente por red.',
          );
          return ok ? { offline: true } : { error: true };
        }

        console.error('[registrarAvanceFisico] error de red, degradando a cola local:', err);
        toast.error('Error de comunicación con el servidor central. Resguardando de forma local…');

        const ok = encolarLocal(
          actualizaciones,
          'Reporte resguardado localmente. Se sincronizará al recuperar señal.',
        );
        return ok ? { offline: true } : { error: true, message: formatErrorMessage(err) };
      } finally {
        setIsSubmitting(false);
      }
    },
    [proyectoId, encolarLocal, onSynced],
  );

  return {
    registrarAvanceFisico,
    isSubmitting,
    tienePendientesOffline,
    pendientes: tienePendientesOffline ? contarColaAvanceOffline(proyectoId) : 0,
    guardadoLocal,
    sincronizando,
    refrescar,
    procesarColaOffline,
  };
}
