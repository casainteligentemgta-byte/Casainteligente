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
import ProyectoRolesAplicacionPanel from '@/components/proyectos/ProyectoRolesAplicacionPanel';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';
import { apiUrl } from '@/lib/http/apiUrl';

type Props = {
  proyectoId: string;
  proyectoNombre: string;
  limiteInicial: number;
  onGuardado?: (limite: number) => void;
  /** Botón trigger compacto para la fila de la tarjeta. */
  triggerClassName?: string;
  /** Permite abrir el modal desde otro botón (p. ej. «Editar roles»). */
  registerAbrir?: (abrir: () => void) => void;
};

const inputClass =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/20';

export default function ModalConfigFastTrack({
  proyectoId,
  proyectoNombre,
  limiteInicial,
  onGuardado,
  triggerClassName,
  registerAbrir,
}: Props) {
  const [open, setOpen] = useState(false);
  const [limite, setLimite] = useState(String(limiteInicial));
  const { isSubmitting, runLocked } = useSyncSubmitLock();

  useEffect(() => {
    registerAbrir?.(() => setOpen(true));
  }, [registerAbrir]);

  useEffect(() => {
    if (open) setLimite(String(limiteInicial));
  }, [open, limiteInicial]);

  async function guardarFastTrack() {
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
      toast.success(`Fast-Track: límite $${guardado.toFixed(2)} USD.`);
    });
  }

  return (
    <>
      <button
        type="button"
        title="Configuración del proyecto"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-zinc-300 backdrop-blur-xl transition hover:border-[#FF9500]/40 hover:text-[#FF9500]'
        }
      >
        <Settings className="h-4 w-4" aria-hidden />
        <span className="sr-only">Configuración del proyecto</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/10 bg-[#0A0A0F]/95 backdrop-blur-xl text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-[#FF9500]">Configuración del proyecto</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Obra: <span className="font-semibold text-zinc-200">{proyectoNombre}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8">
            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-sm font-bold text-zinc-200">Límite Fast-Track OCR</h3>
              <p className="text-xs text-zinc-500">
                Facturas por Telegram por debajo de este monto (USD) y con confianza &gt;95% pueden
                aprobarse automáticamente.
              </p>
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
              <button
                type="button"
                onClick={() => void guardarFastTrack()}
                disabled={isSubmitting}
                className="rounded-lg bg-[#FF9500] px-4 py-2 text-sm font-bold text-black hover:bg-[#FF9500]/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando…' : 'Guardar Fast-Track'}
              </button>
            </section>

            <ProyectoRolesAplicacionPanel proyectoId={proyectoId} embedded={false} />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/[0.08]"
            >
              Cerrar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
