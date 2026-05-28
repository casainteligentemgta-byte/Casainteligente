'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { FilaDespachoPartida } from '@/components/almacen/FilaDespachoPartida';
import { validarDistribucionLinea } from '@/lib/almacen/crearTransferenciaInventario';
import type { ImputacionPartidaInput, PartidaDespachoFila } from '@/types/inventario-obra';

export type DistribucionDespachoState = {
  imputaciones: ImputacionPartidaInput[];
  totalImputado: number;
  valido: boolean;
  error?: string;
};

type DistribRowState = {
  rowId: string;
  fila: PartidaDespachoFila;
  cantidad: number;
  justificacion: string;
  autorizado: boolean;
};

type Props = {
  proyectoId: string;
  materialId: string;
  productoNombre: string;
  /** Cantidad total de la línea de despacho (suma de partidas debe igualar esto). */
  cantidadLinea: number;
  onChange?: (state: DistribucionDespachoState) => void;
  disabled?: boolean;
};

function nuevaFilaId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function filaKey(f: PartidaDespachoFila): string {
  return f.ci_presupuesto_partida_id
    ? `cpp:${f.ci_presupuesto_partida_id}`
    : f.partida_id
      ? `p:${f.partida_id}`
      : f.obra_partida_material_id;
}

function rowsToImputaciones(rows: DistribRowState[]): ImputacionPartidaInput[] {
  return rows
    .filter((r) => r.cantidad > 0)
    .map((r) => ({
      partida_id: r.fila.partida_id ?? null,
      ci_presupuesto_partida_id: r.fila.ci_presupuesto_partida_id ?? null,
      cantidad_imputada: r.cantidad,
      justificacion_exceso: r.justificacion.trim() || null,
    }));
}

export function DistribucionDespachoPartidas({
  proyectoId,
  materialId,
  productoNombre,
  cantidadLinea,
  onChange,
  disabled,
}: Props) {
  const [opciones, setOpciones] = useState<PartidaDespachoFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<DistribRowState[]>([]);
  const [partidaAgregar, setPartidaAgregar] = useState('');

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
      setOpciones(data.partidas ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Error');
      setOpciones([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, materialId]);

  useEffect(() => {
    setRows([]);
    setPartidaAgregar('');
    void cargarOpciones();
  }, [cargarOpciones]);

  const keysUsadas = useMemo(() => new Set(rows.map((r) => filaKey(r.fila))), [rows]);

  const opcionesDisponibles = useMemo(
    () => opciones.filter((o) => !keysUsadas.has(filaKey(o))),
    [opciones, keysUsadas],
  );

  const totalImputado = useMemo(
    () => rows.reduce((s, r) => s + (r.cantidad > 0 ? r.cantidad : 0), 0),
    [rows],
  );

  const todasAutorizadas = useMemo(
    () => rows.every((r) => r.cantidad === 0 || r.autorizado),
    [rows],
  );

  const distribucion = useMemo(() => {
    const imputaciones = rowsToImputaciones(rows);
    const base = validarDistribucionLinea(cantidadLinea, imputaciones);
    if (!base.ok) return base;
    if (!todasAutorizadas) {
      return {
        ok: false,
        error: 'Complete la justificación en las partidas con exceso presupuestario.',
        totalImputado,
      };
    }
    return base;
  }, [rows, cantidadLinea, todasAutorizadas, totalImputado]);

  useEffect(() => {
    onChange?.({
      imputaciones: rowsToImputaciones(rows),
      totalImputado,
      valido: distribucion.ok,
      error: distribucion.ok ? undefined : distribucion.error,
    });
    // onChange establecido por el padre; no incluir en deps para evitar bucles
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notificar solo cuando cambia el reparto
  }, [rows, totalImputado, distribucion.ok, distribucion.error, cantidadLinea]);

  const agregarPartida = () => {
    const hit = opciones.find((o) => filaKey(o) === partidaAgregar);
    if (!hit) return;
    setRows((prev) => [
      ...prev,
      {
        rowId: nuevaFilaId(),
        fila: hit,
        cantidad: 0,
        justificacion: '',
        autorizado: true,
      },
    ]);
    setPartidaAgregar('');
  };

  const quitarFila = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const restante = cantidadLinea - totalImputado;
  const sumaOk = Math.abs(restante) < 0.0001;

  if (!proyectoId || !materialId) {
    return (
      <p className="text-xs text-zinc-500">Seleccione proyecto y material para distribuir por partida.</p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Reparto por partidas
          </p>
          <p className="text-sm text-zinc-300">
            {productoNombre} · línea: <strong>{cantidadLinea}</strong> und
          </p>
        </div>
        <div
          className={`rounded-lg px-3 py-1 text-xs font-bold ${
            sumaOk && cantidadLinea > 0
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-amber-500/15 text-amber-200'
          }`}
        >
          Distribuido: {totalImputado} / {cantidadLinea}
          {!sumaOk && cantidadLinea > 0 ? ` (faltan ${restante > 0 ? restante : -restante})` : null}
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Cargando partidas del presupuesto…
        </p>
      ) : null}
      {loadError ? <p className="text-xs text-red-400">{loadError}</p> : null}
      {!loading && opciones.length === 0 ? (
        <p className="text-xs text-amber-400">
          No hay partidas de presupuesto para esta obra. Importe Lulo o cree partidas en el módulo de
          proyectos.
        </p>
      ) : null}

      {rows.map((row) => (
        <div key={row.rowId} className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => quitarFila(row.rowId)}
            className="absolute right-2 top-2 z-10 rounded-lg border border-white/10 bg-black/60 p-1.5 text-zinc-400 hover:text-red-300"
            title="Quitar partida"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
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
        </div>
      ))}

      {opcionesDisponibles.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Agregar partida
            </label>
            <select
              value={partidaAgregar}
              disabled={disabled || loading}
              onChange={(e) => setPartidaAgregar(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"
            >
              <option value="">Elija partida…</option>
              {opcionesDisponibles.map((o) => (
                <option key={filaKey(o)} value={filaKey(o)}>
                  {o.nombre_partida}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={disabled || !partidaAgregar}
            onClick={agregarPartida}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Añadir
          </button>
        </div>
      ) : rows.length > 0 ? (
        <p className="text-[11px] text-zinc-500">Todas las partidas del presupuesto ya están en la lista.</p>
      ) : null}

      {distribucion.error && cantidadLinea > 0 ? (
        <p className="text-xs text-amber-400">{distribucion.error}</p>
      ) : null}
    </div>
  );
}

export default DistribucionDespachoPartidas;
