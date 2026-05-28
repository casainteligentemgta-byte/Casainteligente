'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  puedeAutorizarDespachoPartida,
  validarFilaDespachoPartida,
} from '@/lib/almacen/validarTechoPresupuestario';
import type { PartidaDespachoFila, ValidacionPartida } from '@/types/inventario-obra';

export type FilaDespachoPartidaValue = {
  cantidad: number;
  justificacion: string;
  validacion: ValidacionPartida;
  autorizado: boolean;
};

type Props = {
  fila: PartidaDespachoFila;
  productoNombre: string;
  cantidad?: number;
  justificacion?: string;
  onChange?: (value: FilaDespachoPartidaValue) => void;
  disabled?: boolean;
};

function buildValue(
  cantidad: number,
  justificacion: string,
  fila: PartidaDespachoFila,
): FilaDespachoPartidaValue {
  const validacion = validarFilaDespachoPartida(cantidad, fila);
  return {
    cantidad,
    justificacion,
    validacion,
    autorizado: puedeAutorizarDespachoPartida(validacion, justificacion),
  };
}

export function FilaDespachoPartida({
  fila,
  productoNombre,
  cantidad: cantidadProp,
  justificacion: justificacionProp,
  onChange,
  disabled,
}: Props) {
  const [cantidadLocal, setCantidadLocal] = useState(0);
  const [justificacionLocal, setJustificacionLocal] = useState('');

  const cantidad = cantidadProp ?? cantidadLocal;
  const justificacion = justificacionProp ?? justificacionLocal;

  const validacion = useMemo(
    () => validarFilaDespachoPartida(cantidad, fila),
    [cantidad, fila],
  );

  const autorizado = useMemo(
    () => puedeAutorizarDespachoPartida(validacion, justificacion),
    [validacion, justificacion],
  );

  const unidad = fila.unidad?.trim() || 'und';

  const emit = useCallback(
    (nextCantidad: number, nextJustificacion: string) => {
      const value = buildValue(nextCantidad, nextJustificacion, fila);
      if (cantidadProp === undefined) setCantidadLocal(nextCantidad);
      if (justificacionProp === undefined) setJustificacionLocal(nextJustificacion);
      onChange?.(value);
    },
    [fila, cantidadProp, justificacionProp, onChange],
  );

  const disponible = Math.max(
    0,
    fila.cantidad_presupuestada - fila.cantidad_asignada_real,
  );

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-zinc-100">{productoNombre}</h4>
          <p className="text-xs text-zinc-500">Partida: {fila.nombre_partida}</p>
          <span className="mt-1 inline-block rounded bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
            Presupuesto: {fila.cantidad_asignada_real} / {fila.cantidad_presupuestada}{' '}
            {unidad} usados · disponible {disponible}
          </span>
        </div>

        <div className="w-full shrink-0 md:w-32">
          <label
            htmlFor={`cantidad-${fila.obra_partida_material_id}`}
            className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500"
          >
            Cantidad
          </label>
          <input
            id={`cantidad-${fila.obra_partida_material_id}`}
            type="number"
            min={0}
            step="any"
            disabled={disabled}
            value={cantidad || ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              emit(Number.isFinite(n) && n >= 0 ? n : 0, justificacion);
            }}
            className={`w-full rounded-lg border bg-black/40 p-2.5 text-sm text-white outline-none focus:ring-2 ${
              validacion.permitido || cantidad === 0
                ? 'border-white/10 focus:ring-sky-500/40'
                : 'border-red-500/60 bg-red-950/30 text-red-100 focus:ring-red-500/40'
            }`}
          />
        </div>
      </div>

      {!validacion.permitido && cantidad > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/25 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="w-full min-w-0">
              <p className="text-xs font-medium text-amber-100/95">
                <strong>Faltante presupuestario:</strong> esta descarga supera el techo en{' '}
                {validacion.diferencia} {unidad} ({validacion.porcentajeExceso}% de exceso). Se
                registrará alerta de sobrecosto.
              </p>
              <div className="mt-2">
                <label
                  htmlFor={`just-${fila.obra_partida_material_id}`}
                  className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-amber-200/90"
                >
                  Justificación para autorizar la salida
                </label>
                <textarea
                  id={`just-${fila.obra_partida_material_id}`}
                  required
                  disabled={disabled}
                  value={justificacion}
                  onChange={(e) => emit(cantidad, e.target.value)}
                  placeholder="Ej.: material dañado en obra; ajuste por replanteo del ducto…"
                  className="w-full rounded-lg border border-amber-500/40 bg-black/30 p-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  rows={2}
                />
                {justificacion.trim().length > 0 && !autorizado ? (
                  <p className="mt-1 text-[10px] text-amber-400/80">
                    Mínimo 8 caracteres en la justificación.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default FilaDespachoPartida;
