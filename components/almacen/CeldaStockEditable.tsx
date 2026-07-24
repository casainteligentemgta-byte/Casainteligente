'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

type CeldaStockEditableProps = {
  cantidad: number;
  reorderPoint: number;
  unidad?: string;
  saving?: boolean;
  onSave: (cantidad: number) => Promise<void>;
};

export default function CeldaStockEditable({
  cantidad,
  reorderPoint,
  unidad,
  saving = false,
  onSave,
}: CeldaStockEditableProps) {
  const [draft, setDraft] = useState(String(cantidad));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(String(cantidad));
    setError(null);
  }, [cantidad]);

  const commit = async () => {
    const parsed = Number.parseFloat(draft.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Cantidad inválida');
      setDraft(String(cantidad));
      return;
    }
    if (Math.abs(parsed - cantidad) < 0.0001) return;

    setError(null);
    try {
      await onSave(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
      setDraft(String(cantidad));
    }
  };

  const bajo = cantidad <= reorderPoint;

  return (
    <div
      className="flex flex-col items-end md:items-start gap-0.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        {saving ? (
          <Loader2 size={14} className="animate-spin text-sky-400 shrink-0" />
        ) : null}
        <input
          type="number"
          min={0}
          step="any"
          value={draft}
          disabled={saving}
          title="Editar stock (Enter o salir del campo para guardar)"
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(String(cantidad));
              setError(null);
            }
          }}
          className={`w-[4.5rem] rounded-md border bg-black/40 px-1.5 py-0.5 text-right text-sm font-black tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500/50 disabled:opacity-60 ${
            bajo
              ? 'border-red-500/40 text-red-400'
              : 'border-zinc-700 text-zinc-100'
          }`}
        />
        {unidad ? (
          <span className="text-[9px] font-bold uppercase text-zinc-500 truncate max-w-[2.5rem]">
            {unidad}
          </span>
        ) : null}
      </div>
      {error ? (
        <span className="text-[9px] font-bold text-red-400 max-w-[120px] leading-tight">{error}</span>
      ) : null}
    </div>
  );
}
