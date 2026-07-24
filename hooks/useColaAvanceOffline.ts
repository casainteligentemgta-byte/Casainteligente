'use client';

import { useAvanceCampoManager } from '@/hooks/useAvanceCampoManager';

/** @deprecated Usar `useAvanceCampoManager` — wrapper de compatibilidad. */
export function useColaAvanceOffline(proyectoId: string, onSynced?: () => void) {
  const manager = useAvanceCampoManager(proyectoId, { onSynced });

  return {
    pendientes: manager.pendientes,
    guardadoLocal: manager.guardadoLocal,
    setGuardadoLocal: () => {},
    sincronizando: manager.sincronizando,
    refrescar: manager.refrescar,
    flush: manager.procesarColaOffline,
  };
}
