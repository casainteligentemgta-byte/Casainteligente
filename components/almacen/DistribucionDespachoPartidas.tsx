'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, PackageOpen } from 'lucide-react';
import { FilaDespachoPartida } from '@/components/almacen/FilaDespachoPartida';
import {
  DESPACHO_ALERTAS_DEFAULT,
  nivelAlertaExceso,
  nivelAlertaSaldo,
  type DespachoAlertasConfig,
  type NivelAlertaDespacho,
} from '@/lib/almacen/despachoAlertasConfig';
import { validarDistribucionLinea } from '@/lib/almacen/crearTransferenciaInventario';
import type { ImputacionPartidaInput, PartidaDespachoFila } from '@/types/inventario-obra';

export type DistribucionDespachoState = {
  imputaciones: ImputacionPartidaInput[];
  totalImputado: number;
  saldo: number;
  valido: boolean;
  error?: string;
  nivelAlerta?: NivelAlertaDespacho;
};

type DistribRowState = {
  rowId: string;
  fila: PartidaDespachoFila;
  seleccionada: boolean;
  cantidad: number;
  justificacion: string;
  autorizado: boolean;
};

type Props = {
  proyectoId: string;
  destinoId?: string;
  materialId: string;
  productoNombre: string;
  /** Cantidad máxima a despachar (techo de la línea). */
  cantidadLinea: number;
  alertasConfig?: DespachoAlertasConfig;
  onChange?: (state: DistribucionDespachoState) => void;
  disabled?: boolean;
};

function nuevaFilaId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function rowsToImputaciones(rows: DistribRowState[]): ImputacionPartidaInput[] {
  return rows
    .filter((r) => r.seleccionada && r.cantidad > 0)
    .map((r) => ({
      partida_id: r.fila.partida_id ?? null,
      ci_presupuesto_partida_id: r.fila.ci_presupuesto_partida_id ?? null,
      cantidad_imputada: r.cantidad,
      justificacion_exceso: r.justificacion.trim() || null,
    }));
}

function alertaClass(nivel: NivelAlertaDespacho): string {
  if (nivel === 'critico') return 'border-red-500/40 bg-red-950/30 text-red-200';
  if (nivel === 'advertencia') return 'border-amber-500/40 bg-amber-950/25 text-amber-200';
  if (nivel === 'info') return 'border-sky-500/30 bg-sky-950/20 text-sky-200';
  return 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200';
}

export function DistribucionDespachoPartidas({
  proyectoId,
  destinoId,
  materialId,
  productoNombre,
  cantidadLinea,
  alertasConfig = DESPACHO_ALERTAS_DEFAULT,
  onChange,
  disabled,
}: Props) {
  const [opciones, setOpciones] = useState<PartidaDespachoFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<DistribRowState[]>([]);

  const cargarOpciones = useCallback(async () => {
    if (!proyectoId || !materialId) {
      setOpciones([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const q = new URLSearchParams({ proyecto_id: proyectoId, material_id: materialId });
      const res = await fetch(`/api/almacen/partidas-despacho?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as { partidas?: PartidaDespachoFila[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar partidas');
      const partidas = data.partidas ?? [];
      setOpciones(partidas);
      setRows(
        partidas.map((fila) => ({
          rowId: nuevaFilaId(),
          fila,
          seleccionada: false,
          cantidad: 0,
          justificacion: '',
          autorizado: true,
        })),
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Error');
      setOpciones([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, materialId]);

  useEffect(() => {
    void cargarOpciones();
  }, [cargarOpciones]);

  const totalImputado = useMemo(
    () =>
      rows.reduce((s, r) => (r.seleccionada && r.cantidad > 0 ? s + r.cantidad : s), 0),
    [rows],
  );

  const saldo = Math.max(0, cantidadLinea - totalImputado);

  const todasAutorizadas = useMemo(
    () =>
      rows.every((r) => !r.seleccionada || r.cantidad === 0 || r.autorizado),
    [rows],
  );

  const maxExcesoPct = useMemo(() => {
    let max = 0;
    for (const r of rows) {
      if (!r.seleccionada || r.cantidad <= 0) continue;
      const techo = r.fila.cantidad_presupuestada;
      const disp = Math.max(0, techo - r.fila.cantidad_asignada_real);
      if (r.cantidad > disp && techo > 0) {
        const pct = Math.round(((r.cantidad - disp) / techo) * 100);
        if (pct > max) max = pct;
      } else if (r.cantidad > disp && techo <= 0 && r.cantidad > 0) {
        max = 100;
      }
    }
    return max;
  }, [rows]);

  const distribucion = useMemo(() => {
    const imputaciones = rowsToImputaciones(rows);
    const base = validarDistribucionLinea(cantidadLinea, imputaciones);
    if (!base.ok) {
      return { ...base, nivelAlerta: 'ok' as NivelAlertaDespacho };
    }
    if (!todasAutorizadas) {
      return {
        ok: false,
        error: 'Complete la justificación en partidas con faltante presupuestario.',
        totalImputado,
        saldo: base.saldo,
        nivelAlerta: 'advertencia' as NivelAlertaDespacho,
      };
    }
    const nivelExceso = nivelAlertaExceso(maxExcesoPct, alertasConfig);
    const nivelSaldo = nivelAlertaSaldo(saldo, cantidadLinea, alertasConfig);
    const nivelAlerta: NivelAlertaDespacho =
      nivelExceso === 'critico' || nivelExceso === 'advertencia'
        ? nivelExceso
        : nivelSaldo;
    return { ...base, nivelAlerta };
  }, [rows, cantidadLinea, todasAutorizadas, totalImputado, saldo, maxExcesoPct, alertasConfig]);

  useEffect(() => {
    onChange?.({
      imputaciones: rowsToImputaciones(rows),
      totalImputado,
      saldo: distribucion.saldo ?? saldo,
      valido: distribucion.ok,
      error: distribucion.ok ? undefined : distribucion.error,
      nivelAlerta: distribucion.nivelAlerta,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notificar solo cuando cambia el reparto
  }, [rows, totalImputado, saldo, distribucion.ok, distribucion.error, distribucion.nivelAlerta, cantidadLinea]);

  if (!proyectoId || !materialId) {
    return (
      <p className="text-xs text-zinc-500">Seleccione proyecto y material para ver partidas en destino.</p>
    );
  }

  if (!destinoId) {
    return (
      <p className="text-xs text-amber-400/90">
        Seleccione el destino (obra / bodega) para listar las partidas que llevan este material.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-400/90">
            Destino — partidas con {productoNombre}
          </p>
          <p className="text-[11px] text-zinc-500">
            Marque partidas y cantidades a descargar. Lo no asignado queda como saldo en origen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-lg px-3 py-1 text-xs font-bold ${
              totalImputado > 0 && totalImputado <= cantidadLinea
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-amber-500/15 text-amber-200'
            }`}
          >
            Descargado: {totalImputado} / {cantidadLinea}
          </span>
          {saldo > 0.0001 ? (
            <span className="rounded-lg bg-zinc-500/15 px-3 py-1 text-xs font-bold text-zinc-300">
              Saldo origen: {saldo}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Buscando partidas del presupuesto con este material…
        </p>
      ) : null}
      {loadError ? <p className="text-xs text-red-400">{loadError}</p> : null}

      {!loading && opciones.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
          <PackageOpen className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            No hay partidas en el presupuesto que incluyan este material en su APU. Verifique que el
            código SAP del producto coincida con el insumo Lulo o registre techos en obra.
          </p>
        </div>
      ) : null}

      {rows.map((row) => (
        <div
          key={row.rowId}
          className={`rounded-xl border transition-opacity ${
            row.seleccionada ? 'border-white/15 opacity-100' : 'border-white/5 opacity-60'
          }`}
        >
          <label className="flex cursor-pointer items-center gap-2 border-b border-white/5 px-3 py-2">
            <input
              type="checkbox"
              disabled={disabled}
              checked={row.seleccionada}
              onChange={(e) => {
                const on = e.target.checked;
                setRows((prev) => {
                  const otros = prev
                    .filter((r) => r.rowId !== row.rowId && r.seleccionada)
                    .reduce((s, r) => s + r.cantidad, 0);
                  const restante = Math.max(0, cantidadLinea - otros);
                  const disp = Math.max(
                    0,
                    row.fila.cantidad_presupuestada - row.fila.cantidad_asignada_real,
                  );
                  return prev.map((r) =>
                    r.rowId === row.rowId
                      ? {
                          ...r,
                          seleccionada: on,
                          cantidad: on
                            ? r.cantidad > 0
                              ? r.cantidad
                              : Math.min(disp > 0 ? disp : restante, restante) || 0
                            : 0,
                        }
                      : r,
                  );
                });
              }}
              className="rounded border-white/20"
            />
            <span className="text-[10px] font-bold uppercase text-zinc-500">
              Descargar en esta partida
            </span>
          </label>
          {row.seleccionada ? (
            <FilaDespachoPartida
              fila={row.fila}
              productoNombre={productoNombre}
              cantidad={row.cantidad}
              justificacion={row.justificacion}
              disabled={disabled}
              onChange={(v) => {
                setRows((prev) =>
                  prev.map((r) =>
                    r.rowId === row.rowId
                      ? {
                          ...r,
                          cantidad: v.cantidad,
                          justificacion: v.justificacion,
                          autorizado: v.autorizado,
                        }
                      : r,
                  ),
                );
              }}
            />
          ) : (
            <p className="px-4 py-2 text-[11px] text-zinc-600">{row.fila.nombre_partida}</p>
          )}
        </div>
      ))}

      {distribucion.nivelAlerta && distribucion.nivelAlerta !== 'ok' ? (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${alertaClass(distribucion.nivelAlerta)}`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {maxExcesoPct > 0 ? (
              <p>
                <strong>Faltante presupuestario:</strong> una o más partidas superan el techo (
                {maxExcesoPct}% de exceso). Justifique o reduzca cantidades.
              </p>
            ) : null}
            {saldo > 0.0001 && totalImputado > 0 ? (
              <p className={maxExcesoPct > 0 ? 'mt-1' : ''}>
                <strong>Saldo en origen:</strong> {saldo} unidades no se moverán en este despacho.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {distribucion.error && cantidadLinea > 0 ? (
        <p className="text-xs text-amber-400">{distribucion.error}</p>
      ) : null}
    </div>
  );
}

export default DistribucionDespachoPartidas;
