'use client';

import { useCallback, useRef } from 'react';
import ModalConfigFastTrack from '@/components/proyectos/ModalConfigFastTrack';
import ModalRolesAutorizadosProyecto from '@/components/proyectos/ModalRolesAutorizadosProyecto';

type Props = {
  proyectoId: string;
  proyectoNombre: string;
  limiteFastTrackUsd: number;
  onGuardadoFastTrack?: (limite: number) => void;
};

/** Botones Roles (ver) + ⚙ (configurar) enlazados por proyecto. */
export default function ProyectoAccionesConfigRoles({
  proyectoId,
  proyectoNombre,
  limiteFastTrackUsd,
  onGuardadoFastTrack,
}: Props) {
  const abrirConfigRef = useRef<(() => void) | null>(null);
  const registrarAbrirConfig = useCallback((fn: () => void) => {
    abrirConfigRef.current = fn;
  }, []);

  return (
    <>
      <ModalRolesAutorizadosProyecto
        proyectoId={proyectoId}
        proyectoNombre={proyectoNombre}
        onEditarRoles={() => abrirConfigRef.current?.()}
        triggerClassName="inline-flex items-center gap-1.5 rounded-[10px] border border-[#007AFF]/35 bg-[#007AFF]/12 px-3 py-2 text-[12px] font-bold text-[#7ec8ff] transition hover:bg-[#007AFF]/22"
      />
      <ModalConfigFastTrack
        proyectoId={proyectoId}
        proyectoNombre={proyectoNombre}
        limiteInicial={limiteFastTrackUsd}
        onGuardado={onGuardadoFastTrack}
        triggerClassName="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-zinc-300 backdrop-blur-xl transition hover:border-[#FF9500]/40 hover:text-[#FF9500]"
        registerAbrir={registrarAbrirConfig}
      />
    </>
  );
}
