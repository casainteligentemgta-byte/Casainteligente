'use client';

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';
import { apiUrl } from '@/lib/http/apiUrl';

type Props = {
  proyectoId: string;
  proyectoNombre: string;
  limiteInicial: number;
  onGuardado?: (limite: number) => void;
  /** Botón trigger compacto para la fila de la tarjeta. */
  triggerClassName?: string;
};

const inputClass =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/20';

export default function ModalConfigFastTrack({
  proyectoId,
  proyectoNombre,
  limiteInicial,
  onGuardado,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [limite, setLimite] = useState(String(limiteInicial));
  const { isSubmitting, runLocked } = useSyncSubmitLock();

  useEffect(() => {
    if (open) setLimite(String(limiteInicial));
  }, [open, limiteInicial]);

  async function guardar() {
    const valor = Number(limite.replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error('Indique un monto válido (≥ 0 USD).');
      return;
    }

    await runLocked(async () => {
      const res = await fetch(apiUrl(`/api/proyectos/${encodeURIComponent(proyectoId)}/config-fasttrack`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limite_fast_track_usd: valor }),
      });
      const json = (await res.json()) as { error?: string; limite_fast_track_usd?: number };
      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo guardar el límite.');
        return;
      }
      const guardado = Number(json.limite_fast_track_usd ?? valor);
      onGuardado?.(guardado);
      toast.success(`Fast-Track: límite $${guardado.toFixed(2)} USD para ${proyectoNombre}.`);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        title="Configurar límite Fast-Track OCR"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-zinc-300 backdrop-blur-xl transition hover:border-[#FF9500]/40 hover:text-[#FF9500]'
        }
      >
        <Settings className="h-4 w-4" aria-hidden />
        <span className="sr-only">Configurar límite Fast-Track</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#0A0A0F]/95 backdrop-blur-xl text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-[#FF9500]">Límite Fast-Track OCR</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Facturas por Telegram por debajo de este monto (USD) y con confianza &gt;95% pueden aprobarse
              automáticamente. Proyecto: <span className="font-semibold text-zinc-200">{proyectoNombre}</span>.
            </DialogDescription>
          </DialogHeader>

          <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500">
            Límite máximo (USD)
            <input
              type="number"
              min={0}
              step={0.01}
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
              className={inputClass}
              disabled={isSubmitting}
            />
          </label>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/[0.08]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={isSubmitting}
              className="rounded-lg bg-[#FF9500] px-4 py-2 text-sm font-bold text-black hover:bg-[#FF9500]/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando…' : 'Guardar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
