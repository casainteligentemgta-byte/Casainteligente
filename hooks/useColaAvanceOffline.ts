'use client';

import { useCallback, useEffect, useState } from 'react';
import { contarColaAvanceOffline } from '@/lib/campo/colaAvanceOffline';
import { sincronizarColaAvanceOffline } from '@/lib/campo/sincronizarColaAvanceOffline';

export function useColaAvanceOffline(proyectoId: string, onSynced?: () => void) {
  const [pendientes, setPendientes] = useState(0);
  const [guardadoLocal, setGuardadoLocal] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  const refrescar = useCallback(() => {
    setPendientes(contarColaAvanceOffline(proyectoId));
  }, [proyectoId]);

  const flush = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setSincronizando(true);
    try {
      const r = await sincronizarColaAvanceOffline(proyectoId);
      if (r.enviados > 0) {
        setGuardadoLocal(false);
        onSynced?.();
      }
      refrescar();
      return r;
    } finally {
      setSincronizando(false);
    }
  }, [proyectoId, refrescar, onSynced]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  useEffect(() => {
    const onOnline = () => {
      void flush();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush]);

  useEffect(() => {
    if (navigator.onLine && pendientes > 0) {
      void flush();
    }
  }, [pendientes, flush]);

  return {
    pendientes,
    guardadoLocal,
    setGuardadoLocal,
    sincronizando,
    refrescar,
    flush,
  };
}
