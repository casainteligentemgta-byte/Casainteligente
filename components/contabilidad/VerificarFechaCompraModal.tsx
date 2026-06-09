'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, X } from 'lucide-react';
import { formatearTasaBcv } from '@/lib/contabilidad/comprasMontos';
import {
  auditoriaFechaCompra,
  claseBlinkFechaCompra,
  fechaAnomalaRequiereAtencion,
  metaAlertaFechaCompra,
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
  const [fecha, setFecha] = useState(fechaFactura);
  const [tasaPreview, setTasaPreview] = useState<number | null>(tasaBcv ?? null);
  const [cargandoTasa, setCargandoTasa] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFecha(String(fechaFactura ?? '').slice(0, 10));
      setTasaPreview(tasaBcv ?? null);
      setConfirmado(false);
      setError(null);
      setGuardando(false);
    }
  }, [open, compraId, fechaFactura, tasaBcv]);

  const audit = useMemo(() => auditoriaFechaCompra(fecha), [fecha]);
  const meta = useMemo(
    () =>
      metaAlertaFechaCompra({
        fecha,
        alertaAlmacenada: audit.nivel === 'ok' ? null : audit.nivel,
      }),
    [fecha, audit.nivel],
  );
  const esAdvertencia =
    (meta.nivel === 'ok' ? nivelAlerta : meta.nivel) === 'advertencia';
  const requiereCheckbox = fechaAnomalaRequiereAtencion(audit.nivel);

  useEffect(() => {
    if (!open) return;
    const f = String(fecha ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
      setTasaPreview(null);
      return;
    }
    let cancelled = false;
    setCargandoTasa(true);
    void (async () => {
      try {
        const res = await fetch(`/api/finanzas/bcv-tasas?fechas=${encodeURIComponent(f)}`, {
          cache: 'no-store',
        });
        const data = (await res.json()) as { tasas?: Record<string, number> };
        if (!cancelled) setTasaPreview(data.tasas?.[f] ?? null);
      } catch {
        if (!cancelled) setTasaPreview(null);
      } finally {
        if (!cancelled) setCargandoTasa(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fecha]);

  if (!open) return null;

  const fechaRegistroCorta = fechaRegistro ? String(fechaRegistro).slice(0, 10) : null;
  const fechaCambio = fecha !== String(fechaFactura ?? '').slice(0, 10);

  const handleGuardar = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setError('Indique una fecha válida.');
      return;
    }
    if (requiereCheckbox && !confirmado) {
      setError('Marque la casilla para confirmar esta fecha fiscal.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contabilidad/compras/${encodeURIComponent(compraId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualizar_solo_fecha: fecha,
          confirmar_fecha_anomala: requiereCheckbox ? confirmado : undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        requiere_confirmacion?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error ?? 'No se pudo guardar la fecha');
      }
      await onConfirmado();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar la fecha');
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
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1c1c1e] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="verificar-fecha-titulo" className="text-sm font-extrabold text-white">
              Fecha fiscal (BCV)
            </h2>
            {(proveedor || factura) && (
              <p className="mt-0.5 text-[10px] text-zinc-500 truncate max-w-[240px]">
                {[proveedor, factura ? `#${factura}` : ''].filter(Boolean).join(' · ')}
              </p>
            )}
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

        {meta.nivel !== 'ok' ? (
          <p
            className={`mb-3 text-[11px] leading-snug ${
              esAdvertencia ? 'text-amber-300/90' : 'text-red-300/90'
            }`}
          >
            {audit.mensaje || mensajeAuditoria}
          </p>
        ) : null}

        <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
          Fecha de la factura
        </label>
        <input
          type="date"
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
          value={fecha}
          onChange={(e) => {
            setConfirmado(false);
            setFecha(e.target.value);
          }}
        />

        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
          <span>Tasa BCV de esta fecha</span>
          <span className="font-bold tabular-nums text-white">
            {cargandoTasa ? '…' : tasaPreview != null ? formatearTasaBcv(tasaPreview) : '—'}
          </span>
        </div>

        {fechaRegistroCorta && fechaRegistroCorta !== fecha ? (
          <p className="mt-2 text-[10px] text-zinc-600">
            Registro en sistema: {fechaRegistroCorta}
          </p>
        ) : null}

        {requiereCheckbox ? (
          <label className="mt-4 flex cursor-pointer items-start gap-2 text-[11px] text-zinc-300">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            <span>Confirmo que {fecha} es la fecha real de la factura fiscal.</span>
          </label>
        ) : fechaCambio ? (
          <p className="mt-3 text-[10px] text-zinc-500">
            Se actualizará la tasa BCV y los montos en USD de esta compra.
          </p>
        ) : null}

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
            className={`${claseBlinkFechaCompra(meta.nivel === 'ok' ? nivelAlerta : meta.nivel) ?? ''} inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-extrabold disabled:opacity-60 ${
              esAdvertencia && meta.nivel !== 'critico'
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
                : 'border-red-500/50 bg-red-500/20 text-red-200 hover:bg-red-500/30'
            }`}
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
            Guardar fecha
          </button>
        </div>
      </div>
    </div>
  );
}
