'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  CLASIFICACIONES_GASTO_ENTIDAD,
  ETIQUETA_SIN_CLASIFICAR_GASTO_ENTIDAD,
  etiquetaClasificacionGastoEntidad,
  type ClasificacionGastoEntidad,
} from '@/lib/contabilidad/clasificacionGastoEntidad';

type Props = {
  compraId: string;
  value?: ClasificacionGastoEntidad | string | null;
  compact?: boolean;
  disabled?: boolean;
  onChanged?: () => void;
};

const selectClass =
  'rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-100 outline-none focus:border-violet-400/50';

export default function ClasificacionGastoEntidadSelect({
  compraId,
  value,
  compact,
  disabled,
  onChanged,
}: Props) {
  const [guardando, setGuardando] = useState(false);

  const guardar = async (next: string) => {
    if (compraId.startsWith('canal-')) {
      toast.error('Confirme la factura antes de clasificar.');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(
        `/api/contabilidad/compras/${encodeURIComponent(compraId)}/clasificacion-gasto-entidad`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clasificacion_gasto_entidad: next || null,
          }),
        },
      );
      const data = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) throw new Error([data.error, data.hint].filter(Boolean).join(' — '));
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <label className={`inline-flex items-center gap-1.5 ${compact ? '' : 'flex-col items-start'}`}>
      {!compact ? (
        <span className="text-[10px] font-bold uppercase text-violet-300/80">Tipo OpEx</span>
      ) : null}
      <span className="inline-flex items-center gap-1">
        {guardando ? <Loader2 className="h-3 w-3 animate-spin text-violet-300" /> : null}
        <select
          className={selectClass}
          value={value ?? ''}
          disabled={disabled || guardando}
          onChange={(e) => void guardar(e.target.value)}
          title="Clasificación del gasto de entidad"
        >
          <option value="">{ETIQUETA_SIN_CLASIFICAR_GASTO_ENTIDAD}</option>
          {CLASIFICACIONES_GASTO_ENTIDAD.map((c) => (
            <option key={c} value={c}>
              {etiquetaClasificacionGastoEntidad(c)}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function ClasificacionGastoEntidadSelectForm({
  value,
  onChange,
  id,
  className,
}: {
  value: ClasificacionGastoEntidad | '';
  onChange: (v: ClasificacionGastoEntidad | '') => void;
  id?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange((e.target.value || '') as ClasificacionGastoEntidad | '')}
    >
      <option value="">Seleccione tipo de gasto…</option>
      {CLASIFICACIONES_GASTO_ENTIDAD.map((c) => (
        <option key={c} value={c}>
          {etiquetaClasificacionGastoEntidad(c)}
        </option>
      ))}
    </select>
  );
}
