'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { normalizarMonedaExtracted } from '@/lib/contabilidad/extractedCanal';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-sky-500/50';

export type LineaCompraEditable = {
  compraId: string;
  lineaId: string;
  descripcion: string;
  item_code: string | null;
  cantidad: number;
  precio_unitario: number;
  moneda?: MonedaOrigen | string | null;
};

type Props = {
  open: boolean;
  linea: LineaCompraEditable | null;
  onClose: () => void;
  onGuardar: (payload: Omit<LineaCompraEditable, 'compraId' | 'lineaId' | 'moneda'>) => Promise<void>;
};

export default function EditarLineaCompraModal({ open, linea, onClose, onGuardar }: Props) {
  const [descripcion, setDescripcion] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precioUnitario, setPrecioUnitario] = useState('0');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !linea) return;
    setDescripcion(linea.descripcion);
    setItemCode(linea.item_code ?? '');
    setCantidad(String(linea.cantidad));
    setPrecioUnitario(String(linea.precio_unitario));
    setError(null);
  }, [open, linea]);

  if (!open || !linea) return null;

  const moneda = normalizarMonedaExtracted(linea.moneda);
  const simbolo = moneda === 'USD' ? 'USD' : 'Bs';

  const guardar = async () => {
    if (!descripcion.trim()) {
      setError('Indique la descripción.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({
        descripcion: descripcion.trim(),
        item_code: itemCode.trim() || null,
        cantidad: Number(cantidad),
        precio_unitario: Number(precioUnitario),
      });
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
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0c10] shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-bold text-white">Modificar línea</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-zinc-500">DESCRIPCIÓN</label>
            <input
              className={`${inputClass} mt-1`}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">CÓDIGO / REF.</label>
            <input
              className={`${inputClass} mt-1`}
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-zinc-500">CANTIDAD</label>
              <input
                className={`${inputClass} mt-1`}
                inputMode="decimal"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500">P. UNIT. ({simbolo})</label>
              <input
                className={`${inputClass} mt-1`}
                inputMode="decimal"
                value={precioUnitario}
                onChange={(e) => setPrecioUnitario(e.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar()}
            className="w-full rounded-xl bg-[#5856D6] disabled:opacity-50 text-white text-sm font-bold py-3 flex items-center justify-center gap-2"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar línea
          </button>
        </div>
      </div>
    </div>
  );
}
