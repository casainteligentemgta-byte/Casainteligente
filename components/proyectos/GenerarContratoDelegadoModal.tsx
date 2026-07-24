'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileSignature, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';

export type GenerarContratoDelegadoModalProps = {
  open: boolean;
  onClose: () => void;
  proyectoId: string;
  proyectoNombre?: string | null;
  onContratoGenerado?: () => void;
};

const SHELL = 'bg-[#0A0A0F]';
const INPUT =
  'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-white/20';
const LABEL = 'mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-500';

type EntidadRow = { id: string; nombre: string };

export default function GenerarContratoDelegadoModal({
  open,
  onClose,
  proyectoId,
  proyectoNombre,
  onContratoGenerado,
}: GenerarContratoDelegadoModalProps) {
  const [entidades, setEntidades] = useState<EntidadRow[]>([]);
  const [entidadId, setEntidadId] = useState('');
  const [honorariosPct, setHonorariosPct] = useState('10');
  const [cargandoEntidades, setCargandoEntidades] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, runLocked } = useSyncSubmitLock();

  const reset = useCallback(() => {
    setEntidadId('');
    setHonorariosPct('10');
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    void (async () => {
      setCargandoEntidades(true);
      const supabase = createClient();
      const { data, error: e } = await supabase
        .from('ci_entidades')
        .select('id, nombre')
        .order('nombre');
      if (e) {
        setError(e.message);
        setEntidades([]);
      } else {
        setEntidades((data ?? []) as EntidadRow[]);
      }
      setCargandoEntidades(false);
    })();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isSubmitting, onClose]);

  const guardar = async () => {
    setError(null);
    if (!entidadId) {
      setError('Seleccione la entidad del grupo que ejecutará la obra.');
      return;
    }
    const pct = Number(honorariosPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError('Indique un % de honorarios entre 0 y 100.');
      return;
    }

    await runLocked(async () => {
      try {
        const res = await fetch(
          `/api/proyectos/${encodeURIComponent(proyectoId)}/contrato-ad`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entidad_ejecutora_id: entidadId,
              honorarios_admin_pct: pct,
            }),
          },
        );
        const data = (await res.json()) as { error?: string; ok?: boolean };
        if (!res.ok) throw new Error(data.error || 'No se pudo generar el contrato AD.');
        toast.success('Contrato de Administración Delegada registrado.');
        onContratoGenerado?.();
        onClose();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al registrar contrato AD.';
        setError(msg);
        toast.error(msg);
      }
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-ad-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border border-white/10 ${SHELL} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <FileSignature className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <h2 id="modal-ad-title" className="text-base font-black text-zinc-100">
                Contrato Administración Delegada
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {proyectoNombre?.trim() || 'Proyecto'} — requisito legal para compras y despacho.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 text-xs text-amber-200/90">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Sin este contrato en estado <strong>exitoso</strong>, el sistema bloquea órdenes de
                compra y despachos del proyecto para evitar que la constructora financie gastos de
                su propio bolsillo.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="ad-entidad" className={LABEL}>
              Entidad ejecutora (ci_entidades)
            </label>
            <select
              id="ad-entidad"
              value={entidadId}
              disabled={isSubmitting || cargandoEntidades}
              onChange={(e) => setEntidadId(e.target.value)}
              className={INPUT}
            >
              <option value="">
                {cargandoEntidades ? 'Cargando entidades…' : 'Seleccione entidad del grupo…'}
              </option>
              {entidades.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ad-honorarios" className={LABEL}>
              % Honorarios de administración
            </label>
            <input
              id="ad-honorarios"
              type="number"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              value={honorariosPct}
              disabled={isSubmitting}
              onChange={(e) => setHonorariosPct(e.target.value)}
              className={INPUT}
              placeholder="Ej: 10"
            />
          </div>

          {error ? (
            <p className="text-xs font-semibold text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (isSubmitting) return;
              void guardar();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-sm font-black text-black disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? 'Registrando…' : 'Generar Contrato AD'}
          </button>
        </div>
      </div>
    </div>
  );
}
