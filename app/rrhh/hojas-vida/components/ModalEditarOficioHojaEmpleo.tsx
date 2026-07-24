'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';

type Props = {
  open: boolean;
  empleadoId: string | null;
  nombreObrero: string;
  cargoActual: string;
  onClose: () => void;
  onGuardado: (cargoUOficio: string) => void;
};

export function ModalEditarOficioHojaEmpleo({
  open,
  empleadoId,
  nombreObrero,
  cargoActual,
  onClose,
  onGuardado,
}: Props) {
  const [draft, setDraft] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) setDraft(cargoActual.trim());
  }, [open, cargoActual]);

  if (!open || !empleadoId) return null;

  async function guardar() {
    const valor = draft.trim();
    if (!valor) {
      toast.error('Escribe el cargo u oficio a desempeñar');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(apiUrl(`/api/rrhh/empleados/${encodeURIComponent(empleadoId!)}/oficio-hoja-empleo`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cargoUOficio: valor }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; cargoUOficio?: string };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo guardar el oficio');
        return;
      }
      const guardado = (j.cargoUOficio ?? valor).trim();
      toast.success('Oficio actualizado en la hoja de empleo');
      onGuardado(guardado);
      onClose();
    } catch {
      toast.error('Error de red al guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#FF9500]/30 bg-[#0F1117] p-5 shadow-2xl">
        <h2 className="text-base font-bold text-white">Editar oficio — hoja de empleo</h2>
        <p className="mt-1 text-xs text-zinc-400">{nombreObrero}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          RRHH y Admin pueden corregir el campo «Cargo u oficio a desempeñar». Se actualiza el expediente y el PDF de
          hoja de empleo.
        </p>
        <label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
          Cargo u oficio a desempeñar
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={240}
            placeholder="Ej. Albañil, Vigilante, Operador de grúa…"
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#FF9500]/55"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando}
            className="rounded-lg border border-[#FF9500]/45 bg-[#FF9500]/20 px-3 py-2 text-xs font-semibold text-[#FFD60A] hover:bg-[#FF9500]/30 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar oficio'}
          </button>
        </div>
      </div>
    </div>
  );
}
