'use client';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  esGastoEntidadImputacion,
  etiquetaImputacionCompra,
  type ImputacionCompra,
} from '@/lib/contabilidad/imputacionCompra';

type Props = {
  compraId: string;
  imputacion?: ImputacionCompra | string | null;
  disabled?: boolean;
  onChanged?: () => void;
};

export default function ImputacionCompraToggle({
  compraId,
  imputacion,
  disabled,
  onChanged,
}: Props) {
  const esEntidad = esGastoEntidadImputacion(imputacion);

  const toggle = async () => {
    if (compraId.startsWith('canal-')) {
      toast.error('Confirme la factura en contabilidad antes de cambiar la imputación.');
      return;
    }
    const next: ImputacionCompra = esEntidad ? 'obra' : 'entidad';
    if (
      next === 'entidad' &&
      !window.confirm(
        '¿Marcar como gasto de la entidad? No entrará en la valuación de administración delegada.',
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/contabilidad/compras/${encodeURIComponent(compraId)}/imputacion`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imputacion: next }),
        },
      );
      const data = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) throw new Error([data.error, data.hint].filter(Boolean).join(' — '));
      toast.success(
        next === 'entidad'
          ? 'Gasto imputado a la entidad (fuera de AD)'
          : 'Gasto imputado a obra',
      );
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void toggle()}
      title={
        esEntidad
          ? 'Gasto de entidad — clic para imputar a obra'
          : 'Clic para marcar como gasto de entidad (excluir de AD)'
      }
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition ${
        esEntidad
          ? 'border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
      } disabled:opacity-50`}
    >
      {disabled ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {etiquetaImputacionCompra(imputacion)}
    </button>
  );
}
