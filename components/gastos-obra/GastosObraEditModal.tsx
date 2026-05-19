'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { GastoObraEditableField } from '@/types/gastos-obra';

const LABELS: Record<GastoObraEditableField, string> = {
  fecha: 'Fecha',
  tipo: 'Tipo de gasto',
  disciplina: 'Área / disciplina',
  proveedor: 'Proveedor',
  costo: 'Monto (USD)',
};

type Props = {
  open: boolean;
  onClose: () => void;
  field: GastoObraEditableField;
  valorActual: string;
  transactionId?: string;
  proveedorAnterior?: string;
  bulkProveedor?: boolean;
  onSave: (nuevoValor: string) => Promise<boolean>;
};

export default function GastosObraEditModal({
  open,
  onClose,
  field,
  valorActual,
  transactionId,
  proveedorAnterior,
  bulkProveedor,
  onSave,
}: Props) {
  const [valor, setValor] = useState(valorActual);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) setValor(valorActual);
  }, [open, valorActual]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const ok = await onSave(valor);
    setGuardando(false);
    if (ok) onClose();
  }

  const inputType = field === 'fecha' ? 'date' : field === 'costo' ? 'number' : 'text';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-gasto-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="edit-gasto-title" className="text-lg font-bold tracking-tight text-slate-900">
              Editar {LABELS[field]}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {bulkProveedor && field === 'proveedor'
                ? `Se actualizarán todas las filas de «${proveedorAnterior}».`
                : 'El cambio se guarda en Supabase y actualiza el dashboard al instante.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="edit-gasto-valor" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {LABELS[field]}
            </label>
            <input
              id="edit-gasto-valor"
              type={inputType}
              step={field === 'costo' ? '0.01' : undefined}
              min={field === 'costo' ? '0' : undefined}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
