'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  extractedDesdeForm,
  formDesdeExtracted,
  lineaVacia,
  type ExtractedCanalHeader,
  type FacturaCanalForm,
  normalizarMonedaExtracted,
} from '@/lib/contabilidad/extractedCanal';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-sky-500/50';

type Props = {
  open: boolean;
  titulo?: string;
  extracted: ExtractedCanalHeader | null;
  onClose: () => void;
  onGuardar: (extracted: ExtractedCanalHeader) => Promise<void>;
};

export default function EditarFacturaCanalModal({
  open,
  titulo = 'Modificar factura',
  extracted,
  onClose,
  onGuardar,
}: Props) {
  const [form, setForm] = useState<FacturaCanalForm>(() => formDesdeExtracted(extracted));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(formDesdeExtracted(extracted));
      setError(null);
    }
  }, [open, extracted]);

  if (!open) return null;

  const simboloMoneda = form.moneda === 'USD' ? 'USD' : 'Bs';

  const actualizarLinea = (idx: number, patch: Partial<FacturaCanalForm['items'][0]>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  };

  const guardar = async () => {
    if (!form.supplier_name.trim()) {
      setError('Indique el nombre del proveedor.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const next = extractedDesdeForm(form, extracted);
      await onGuardar(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0c10] shadow-xl">
        <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-white/10 bg-[#0c0c10] px-4 py-3">
          <h2 className="text-sm font-bold text-white">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold text-zinc-500">Nº FACTURA</label>
              <input
                className={`${inputClass} mt-1`}
                value={form.invoice_number}
                onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500">FECHA</label>
              <input
                type="date"
                className={`${inputClass} mt-1`}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-zinc-500">PROVEEDOR</label>
              <input
                className={`${inputClass} mt-1`}
                value={form.supplier_name}
                onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500">RIF</label>
              <input
                className={`${inputClass} mt-1`}
                value={form.supplier_rif}
                onChange={(e) => setForm((f) => ({ ...f, supplier_rif: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500">TOTAL (Bs)</label>
              <input
                type="text"
                inputMode="decimal"
                className={`${inputClass} mt-1`}
                value={form.total_amount}
                onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
                placeholder="Vacío = suma de líneas"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Líneas / artículos</p>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, items: [...f.items, lineaVacia()] }))}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Añadir línea
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((linea, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2 sm:grid-cols-[1fr_72px_72px_72px_32px]"
                >
                  <input
                    className={inputClass}
                    placeholder="Descripción"
                    value={linea.description}
                    onChange={(e) => actualizarLinea(idx, { description: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Cant."
                    inputMode="decimal"
                    value={linea.quantity}
                    onChange={(e) => actualizarLinea(idx, { quantity: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder={`P.U. ${simboloMoneda}`}
                    inputMode="decimal"
                    value={linea.unit_price}
                    onChange={(e) => actualizarLinea(idx, { unit_price: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Código"
                    value={linea.item_code}
                    onChange={(e) => actualizarLinea(idx, { item_code: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : [lineaVacia()],
                      }))
                    }
                    className="flex items-center justify-center text-red-400 hover:text-red-300"
                    aria-label="Quitar línea"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-white/10 bg-[#0c0c10] p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/10 py-2.5 text-xs font-semibold text-zinc-400 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar()}
            className="flex-1 rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
