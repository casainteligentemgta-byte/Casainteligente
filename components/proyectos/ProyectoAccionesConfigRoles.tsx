'use client';

import ModalBotUsuariosProyecto from '@/components/proyectos/ModalBotUsuariosProyecto';
import ModalConfigFastTrack from '@/components/proyectos/ModalConfigFastTrack';

type Props = {
  proyectoId: string;
  proyectoNombre: string;
  limiteFastTrackUsd: number;
  onGuardadoFastTrack?: (limite: number) => void;
};

/** Botones BOT (usuarios Telegram) + ⚙ (Fast-Track) por proyecto. */
export default function ProyectoAccionesConfigRoles({
  proyectoId,
  proyectoNombre,
  limiteFastTrackUsd,
  onGuardadoFastTrack,
}: Props) {
  return (
    <>
      <ModalBotUsuariosProyecto
        proyectoId={proyectoId}
        proyectoNombre={proyectoNombre}
        triggerClassName="inline-flex items-center gap-1.5 rounded-[10px] border border-[#34C759]/35 bg-[#34C759]/12 px-3 py-2 text-[12px] font-bold text-[#6ee7a0] transition hover:bg-[#34C759]/22"
      />
      <ModalConfigFastTrack
        proyectoId={proyectoId}
        proyectoNombre={proyectoNombre}
        limiteInicial={limiteFastTrackUsd}
        onGuardado={onGuardadoFastTrack}
        triggerClassName="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-zinc-300 backdrop-blur-xl transition hover:border-[#FF9500]/40 hover:text-[#FF9500]"
      />
    </>
  );
}
