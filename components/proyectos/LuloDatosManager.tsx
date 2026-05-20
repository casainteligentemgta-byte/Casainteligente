'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Database,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import ImportarPresupuestoLulo from '@/components/proyectos/ImportarPresupuestoLulo';

type Partida = {
  id: string;
  codigo_partida: string;
  descripcion: string;
  unidad: string;
  cantidad_presupuestada: number;
  precio_unitario_estimado: number;
  monto_total_estimado: number;
  origen: string;
};

type Gasto = {
  id: string;
  fecha: string;
  tipo: string;
  disciplina: string;
  proveedor: string;
  descripcion: string | null;
  costo: number;
  origen: string;
};

type SnapshotMeta = {
  id: string;
  nombre_archivo: string;
  formato: string;
  resumen: Record<string, unknown>;
  created_at: string;
};

type MdbTable = {
  name: string;
  columns: string[];
  rowCount: number;
  rows: Record<string, unknown>[];
};

type LuloPayload = {
  formato?: string;
  tables?: MdbTable[];
  headers?: string[];
  rows?: Record<string, string>[];
};

type Props = {
  proyectoId: string;
  proyectoNombre?: string;
};

export default function LuloDatosManager({ proyectoId, proyectoNombre }: Props) {
  const [loading, setLoading] = useState(true);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [tab, setTab] = useState<'partidas' | 'gastos' | 'tablas'>('partidas');
  const [snapshotDetail, setSnapshotDetail] = useState<{
    id: string;
    payload: LuloPayload;
    nombre_archivo: string;
  } | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [editingPartida, setEditingPartida] = useState<string | null>(null);
  const [editPartidaForm, setEditPartidaForm] = useState<Partial<Partida>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/lulo`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar');
      setPartidas(data.partidas ?? []);
      setGastos(data.gastos ?? []);
      setSnapshots(data.snapshots ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de carga');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSnapshot = async (id: string) => {
    try {
      const res = await fetch(`/api/proyectos/lulo/snapshots/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSnapshotDetail({
        id: data.id,
        payload: data.payload as LuloPayload,
        nombre_archivo: data.nombre_archivo,
      });
      setTab('tablas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir el volcado');
    }
  };

  const deletePartida = async (id: string) => {
    if (!window.confirm('¿Borrar esta partida?')) return;
    const res = await fetch(`/api/proyectos/lulo/partidas/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('No se pudo borrar');
      return;
    }
    setPartidas((p) => p.filter((x) => x.id !== id));
    toast.success('Partida eliminada');
  };

  const deleteGasto = async (id: string) => {
    if (!window.confirm('¿Borrar este gasto?')) return;
    const res = await fetch(`/api/proyectos/lulo/gastos/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('No se pudo borrar');
      return;
    }
    setGastos((g) => g.filter((x) => x.id !== id));
    toast.success('Gasto eliminado');
  };

  const savePartida = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/proyectos/lulo/partidas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPartidaForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPartidas((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...editPartidaForm } as Partida : p)),
      );
      setEditingPartida(null);
      toast.success('Partida guardada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const mdbTables = useMemo(() => snapshotDetail?.payload?.tables ?? [], [snapshotDetail]);
  const csvRows = useMemo(() => snapshotDetail?.payload?.rows ?? [], [snapshotDetail]);

  const totalPartidas = partidas.reduce((s, p) => s + Number(p.monto_total_estimado), 0);
  const totalGastos = gastos.reduce((s, g) => s + Number(g.costo), 0);

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/proyectos/modulo/${proyectoId}?tab=finanzas`}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:bg-white/5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al módulo
        </Link>
        <h1 className="text-lg font-bold">
          Datos Lulo — {proyectoNombre ?? 'Proyecto'}
        </h1>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <ImportarPresupuestoLulo proyectoId={proyectoId} onSuccess={() => void load()} />
        <div className="rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-xs text-zinc-400">
          <p>
            <span className="text-emerald-400 font-semibold">{partidas.length}</span> partidas ·{' '}
            <span className="text-sky-400 font-semibold">{gastos.length}</span> gastos
          </p>
          <p className="mt-1">
            Total partidas ~{' '}
            {totalPartidas.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · Gastos{' '}
            {totalGastos.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </p>
        </div>
      </div>

      {snapshots.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Importaciones guardadas</p>
          <div className="flex flex-wrap gap-2">
            {snapshots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void loadSnapshot(s.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  snapshotDetail?.id === s.id
                    ? 'border-sky-500/50 bg-sky-950/40 text-sky-200'
                    : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {s.formato === 'mdb' ? (
                  <Database className="inline h-3 w-3 mr-1 text-sky-400" />
                ) : (
                  <FileSpreadsheet className="inline h-3 w-3 mr-1 text-emerald-400" />
                )}
                {s.nombre_archivo}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(['partidas', 'gastos', 'tablas'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              tab === t ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'partidas' ? `Partidas (${partidas.length})` : null}
            {t === 'gastos' ? `Gastos (${gastos.length})` : null}
            {t === 'tablas' ? 'Tablas del archivo' : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </div>
      ) : null}

      {!loading && tab === 'partidas' ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Descripción</th>
                <th className="px-3 py-2">Und</th>
                <th className="px-3 py-2 text-right">Cant.</th>
                <th className="px-3 py-2 text-right">P.U.</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {partidas.map((p) => (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  {editingPartida === p.id ? (
                    <>
                      <td className="px-2 py-1">
                        <input
                          className="w-full rounded bg-black/40 border border-white/10 px-2 py-1"
                          value={editPartidaForm.codigo_partida ?? p.codigo_partida}
                          onChange={(e) =>
                            setEditPartidaForm((f) => ({ ...f, codigo_partida: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-full min-w-[140px] rounded bg-black/40 border border-white/10 px-2 py-1"
                          value={editPartidaForm.descripcion ?? p.descripcion}
                          onChange={(e) =>
                            setEditPartidaForm((f) => ({ ...f, descripcion: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-14 rounded bg-black/40 border border-white/10 px-2 py-1"
                          value={editPartidaForm.unidad ?? p.unidad}
                          onChange={(e) =>
                            setEditPartidaForm((f) => ({ ...f, unidad: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="w-20 rounded bg-black/40 border border-white/10 px-2 py-1 text-right"
                          value={editPartidaForm.cantidad_presupuestada ?? p.cantidad_presupuestada}
                          onChange={(e) =>
                            setEditPartidaForm((f) => ({
                              ...f,
                              cantidad_presupuestada: Number(e.target.value),
                            }))
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="w-24 rounded bg-black/40 border border-white/10 px-2 py-1 text-right"
                          value={
                            editPartidaForm.precio_unitario_estimado ?? p.precio_unitario_estimado
                          }
                          onChange={(e) =>
                            setEditPartidaForm((f) => ({
                              ...f,
                              precio_unitario_estimado: Number(e.target.value),
                            }))
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="w-24 rounded bg-black/40 border border-white/10 px-2 py-1 text-right"
                          value={editPartidaForm.monto_total_estimado ?? p.monto_total_estimado}
                          onChange={(e) =>
                            setEditPartidaForm((f) => ({
                              ...f,
                              monto_total_estimado: Number(e.target.value),
                            }))
                          }
                        />
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void savePartida(p.id)}
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-mono text-zinc-400">{p.codigo_partida}</td>
                      <td className="px-3 py-2">{p.descripcion}</td>
                      <td className="px-3 py-2 text-center">{p.unidad}</td>
                      <td className="px-3 py-2 text-right">{p.cantidad_presupuestada}</td>
                      <td className="px-3 py-2 text-right">{p.precio_unitario_estimado}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {Number(p.monto_total_estimado).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPartida(p.id);
                            setEditPartidaForm({});
                          }}
                          className="text-zinc-500 hover:text-white mr-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePartida(p.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {partidas.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">Sin partidas Lulo. Importa un archivo arriba.</p>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === 'gastos' ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Proveedor</th>
                <th className="px-3 py-2 text-left">Descripción</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Costo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id} className="border-t border-white/5">
                  <td className="px-3 py-2">{g.fecha}</td>
                  <td className="px-3 py-2">{g.proveedor}</td>
                  <td className="px-3 py-2">{g.descripcion}</td>
                  <td className="px-3 py-2 text-zinc-500">{g.tipo}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {Number(g.costo).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void deleteGasto(g.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {gastos.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">Sin gastos importados.</p>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === 'tablas' ? (
        <div className="space-y-3">
          {!snapshotDetail ? (
            <p className="text-sm text-zinc-500">
              Selecciona una importación guardada arriba para ver todas las tablas del MDB o filas del CSV.
            </p>
          ) : mdbTables.length > 0 ? (
            mdbTables.map((t) => (
              <div key={t.name} className="rounded-xl border border-white/10 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-4 py-3 bg-white/5 text-left text-sm font-semibold"
                  onClick={() =>
                    setExpandedTable(expandedTable === t.name ? null : t.name)
                  }
                >
                  {expandedTable === t.name ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {t.name}{' '}
                  <span className="text-zinc-500 font-normal">
                    ({t.rowCount} filas · {t.columns.length} columnas)
                  </span>
                </button>
                {expandedTable === t.name ? (
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 bg-zinc-900">
                        <tr>
                          {t.columns.map((c) => (
                            <th key={c} className="px-2 py-1 text-left text-zinc-500 border-b border-white/10">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {t.rows.slice(0, 500).map((row, i) => (
                          <tr key={i} className="border-t border-white/5">
                            {t.columns.map((c) => (
                              <td key={c} className="px-2 py-1 max-w-[200px] truncate">
                                {String(row[c] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {t.rows.length > 500 ? (
                      <p className="p-2 text-zinc-600 text-xs">Mostrando 500 de {t.rows.length} filas</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          ) : csvRows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-white/10 max-h-[500px]">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-zinc-900">
                  <tr>
                    {(snapshotDetail.payload.headers ?? Object.keys(csvRows[0] ?? {})).map((h) => (
                      <th key={h} className="px-2 py-1 text-left text-zinc-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 500).map((row, i) => (
                    <tr key={i} className="border-t border-white/5">
                      {(snapshotDetail.payload.headers ?? Object.keys(row)).map((h) => (
                        <td key={h} className="px-2 py-1 max-w-[180px] truncate">
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Volcado vacío.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
