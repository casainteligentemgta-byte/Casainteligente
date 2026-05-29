'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTasaBcvHoy } from '@/lib/contabilidad/useTasaBcvHoy';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';

export type RegistroAbonoClienteModalProps = {
  open: boolean;
  onClose: () => void;
  proyectoId: string;
  proyectoNombre?: string | null;
  onAbonoRegistrado?: () => void;
};

const SHELL = 'bg-[#0A0A0F]';
const INPUT =
  'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-white/20';
const LABEL = 'mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-500';

export default function RegistroAbonoClienteModal({
  open,
  onClose,
  proyectoId,
  proyectoNombre,
  onAbonoRegistrado,
}: RegistroAbonoClienteModalProps) {
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD');
  const [banco, setBanco] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fecha, setFecha] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, runLocked } = useSyncSubmitLock();

  const { tasa, loading: cargandoTasa } = useTasaBcvHoy(fecha || undefined);

  const reset = useCallback(() => {
    setMonto('');
    setMoneda('USD');
    setBanco('');
    setReferencia('');
    setFecha(new Date().toISOString().slice(0, 10));
    setObservaciones('');
    setError(null);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isSubmitting, onClose]);

  const equivalenteUsd = useMemo(() => {
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (moneda === 'USD') return n;
    if (!tasa || tasa <= 0) return null;
    return Math.round((n / tasa) * 100) / 100;
  }, [monto, moneda, tasa]);

  const guardar = async () => {
    setError(null);
    const montoN = Number(monto);
    if (!Number.isFinite(montoN) || montoN <= 0) {
      setError('Indique el monto recibido.');
      return;
    }
    if (!banco.trim()) {
      setError('Indique banco origen.');
      return;
    }
    if (!referencia.trim()) {
      setError('Indique cuenta o referencia de transferencia.');
      return;
    }
    if (!fecha) {
      setError('Indique fecha del abono.');
      return;
    }
    if (moneda === 'VES' && (!tasa || tasa <= 0)) {
      setError('Espere la tasa BCV del día o seleccione otra fecha.');
      return;
    }

    await runLocked(async () => {
      try {
        const res = await fetch(
          `/api/proyectos/${encodeURIComponent(proyectoId)}/abonos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              monto_recibido: montoN,
              moneda,
              banco_origen: banco.trim(),
              referencia_transferencia: referencia.trim(),
              fecha_abono: fecha,
              observaciones: observaciones.trim() || null,
              tasa_bcv: moneda === 'VES' ? tasa : null,
            }),
          },
        );
        const data = (await res.json()) as { error?: string; ok?: boolean };
        if (!res.ok) throw new Error(data.error || 'No se pudo registrar el abono.');
        toast.success('Ingreso de capital registrado.');
        onAbonoRegistrado?.();
        onClose();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al registrar abono.';
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
      aria-labelledby="modal-abono-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border border-white/10 ${SHELL} shadow-2xl max-h-[92vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <h2 id="modal-abono-title" className="text-base font-black text-zinc-100">
                Abono del cliente
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {proyectoNombre?.trim() || 'Proyecto'} — registro bimonetario
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
          <div>
            <label htmlFor="abono-monto" className={LABEL}>
              Monto recibido *
            </label>
            <input
              id="abono-monto"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={monto}
              disabled={isSubmitting}
              onChange={(e) => setMonto(e.target.value)}
              className={INPUT}
              placeholder="0.00"
            />
          </div>

          <div>
            <label htmlFor="abono-moneda" className={LABEL}>
              Moneda *
            </label>
            <select
              id="abono-moneda"
              value={moneda}
              disabled={isSubmitting}
              onChange={(e) => setMoneda(e.target.value as 'USD' | 'VES')}
              className={INPUT}
            >
              <option value="USD">USD</option>
              <option value="VES">VES (Bolívares)</option>
            </select>
          </div>

          {moneda === 'VES' ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Equivalente USD (BCV)
              </p>
              {cargandoTasa ? (
                <p className="mt-1 text-sm text-zinc-500">Consultando tasa…</p>
              ) : equivalenteUsd != null && tasa ? (
                <p className="mt-1 text-lg font-black text-amber-400">
                  ≈ ${equivalenteUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                  <span className="text-xs font-normal text-zinc-500">
                    (tasa {tasa.toLocaleString('es-VE')} Bs/USD)
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-amber-400/80">
                  Ingrese monto y fecha para calcular equivalente.
                </p>
              )}
            </div>
          ) : null}

          <div>
            <label htmlFor="abono-banco" className={LABEL}>
              Banco origen *
            </label>
            <input
              id="abono-banco"
              type="text"
              value={banco}
              disabled={isSubmitting}
              onChange={(e) => setBanco(e.target.value)}
              className={INPUT}
              placeholder="Ej: Banesco, Mercantil…"
            />
          </div>

          <div>
            <label htmlFor="abono-ref" className={LABEL}>
              Cuenta / referencia de transferencia *
            </label>
            <input
              id="abono-ref"
              type="text"
              value={referencia}
              disabled={isSubmitting}
              onChange={(e) => setReferencia(e.target.value)}
              className={INPUT}
              placeholder="Nº referencia o últimos dígitos"
            />
          </div>

          <div>
            <label htmlFor="abono-fecha" className={LABEL}>
              Fecha del abono *
            </label>
            <input
              id="abono-fecha"
              type="date"
              value={fecha}
              disabled={isSubmitting}
              onChange={(e) => setFecha(e.target.value)}
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="abono-obs" className={LABEL}>
              Observaciones
            </label>
            <textarea
              id="abono-obs"
              rows={2}
              value={observaciones}
              disabled={isSubmitting}
              onChange={(e) => setObservaciones(e.target.value)}
              className={`${INPUT} resize-none`}
              placeholder="Notas opcionales…"
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 text-sm font-black text-black disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? 'Registrando…' : 'Registrar Ingreso de Capital'}
          </button>
        </div>
      </div>
    </div>
  );
}
