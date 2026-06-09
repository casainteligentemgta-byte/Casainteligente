'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Loader2, X } from 'lucide-react';
import { formatearTasaBcv } from '@/lib/contabilidad/comprasMontos';
import {
  claseBlinkFechaCompra,
  type NivelAlertaFechaCompra,
} from '@/lib/contabilidad/auditoriaFechaCompra';

type Props = {
  open: boolean;
  compraId: string;
  fechaFactura: string;
  fechaRegistro?: string | null;
  tasaBcv?: number | null;
  proveedor?: string;
  factura?: string;
  nivelAlerta?: NivelAlertaFechaCompra;
  mensajeAuditoria: string;
  onClose: () => void;
  onConfirmado: () => void | Promise<void>;
};

export default function VerificarFechaCompraModal({
  open,
  compraId,
  fechaFactura,
  fechaRegistro,
  tasaBcv,
  proveedor,
  factura,
  nivelAlerta = 'critico',
  mensajeAuditoria,
  onClose,
  onConfirmado,
}: Props) {
  const esAdvertencia = nivelAlerta === 'advertencia';
  const [confirmado, setConfirmado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setConfirmado(false);
      setError(null);
      setGuardando(false);
    }
  }, [open, compraId]);

  if (!open) return null;

  const fechaRegistroCorta = fechaRegistro ? String(fechaRegistro).slice(0, 10) : null;

  const handleGuardar = async () => {
    if (!confirmado) {
      setError('Marque la casilla para confirmar la fecha fiscal.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contabilidad/compras/${encodeURIComponent(compraId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmar_solo_fecha: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'No se pudo verificar la fecha');
      await onConfirmado();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al verificar la fecha');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verificar-fecha-titulo"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1c1e] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-xl p-2 ${
                esAdvertencia ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
              }`}
            >
              <CalendarClock size={20} />
            </div>
            <div>
              <h2 id="verificar-fecha-titulo" className="text-sm font-extrabold text-white">
                Verificar fecha de factura
              </h2>
              <p className="mt-1 text-[11px] leading-snug text-zinc-400">
                {proveedor ? `${proveedor}` : 'Compra'}
                {factura ? ` · #${factura}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className={`space-y-3 rounded-xl border p-3 text-[12px] ${
            esAdvertencia
              ? 'border-amber-500/25 bg-amber-500/8'
              : 'border-red-500/25 bg-red-500/8'
          }`}
        >
          <p className={`leading-snug ${esAdvertencia ? 'text-amber-200' : 'text-red-300'}`}>
            {mensajeAuditoria}
          </p>
          <dl className="space-y-2 text-zinc-300">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Fecha fiscal (BCV y contabilidad)</dt>
              <dd className="font-bold text-white tabular-nums">{fechaFactura || '—'}</dd>
            </div>
            {fechaRegistroCorta && fechaRegistroCorta !== fechaFactura ? (
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Registro en sistema</dt>
                <dd className="font-semibold tabular-nums">{fechaRegistroCorta}</dd>
              </div>
            ) : null}
            {tasaBcv != null && tasaBcv > 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Tasa BCV de esa fecha</dt>
                <dd className="font-semibold tabular-nums">{formatearTasaBcv(tasaBcv)}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <p className="mt-3 text-[11px] leading-snug text-zinc-500">
          La fecha fiscal es la que figura en la factura y define la tasa BCV y el periodo contable.
          Si el OCR o la captura falló, use Modificar factura para corregirla antes de confirmar.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-[12px] text-zinc-200">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
          />
          <span>
            Confirmo que <strong className="text-white">{fechaFactura}</strong> es la fecha real de
            la factura fiscal y debe usarse para BCV y reportes.
          </span>
        </label>

        {error ? <p className="mt-3 text-[11px] text-red-400">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-zinc-400 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleGuardar()}
            disabled={guardando}
            className={`${claseBlinkFechaCompra(nivelAlerta) ?? ''} inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-extrabold disabled:opacity-60 ${
              esAdvertencia
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
                : 'border-red-500/50 bg-red-500/20 text-red-200 hover:bg-red-500/30'
            }`}
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
            Verificar fecha
          </button>
        </div>
      </div>
    </div>
  );
}
