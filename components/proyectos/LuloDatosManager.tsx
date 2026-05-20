'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Database,
  FileSpreadsheet,
  Settings,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import ImportarPresupuestoLulo from '@/components/proyectos/ImportarPresupuestoLulo';
import LuloTablaFiltrable, { type LuloColumnaDef } from '@/components/proyectos/LuloTablaFiltrable';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

const COLUMNAS_PARTIDAS: LuloColumnaDef[] = [
  { key: 'codigo_partida', label: 'Código', mono: true },
  { key: 'descripcion', label: 'Descripción', maxWidth: 280 },
  { key: 'unidad', label: 'Und', align: 'center' },
  { key: 'cantidad_presupuestada', label: 'Cant.', align: 'right' },
  { key: 'precio_unitario_estimado', label: 'P.U.', align: 'right' },
  { key: 'monto_total_estimado', label: 'Monto', align: 'right' },
];

const COLUMNAS_GASTOS: LuloColumnaDef[] = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'proveedor', label: 'Proveedor', maxWidth: 160 },
  { key: 'descripcion', label: 'Descripción', maxWidth: 220 },
  { key: 'tipo', label: 'Tipo' },
  { key: 'disciplina', label: 'Disciplina' },
  { key: 'costo', label: 'Costo', align: 'right' },
];

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
  const [tablaMdbSeleccionada, setTablaMdbSeleccionada] = useState<string>('');
  const [editingPartida, setEditingPartida] = useState<string | null>(null);
  const [editPartidaForm, setEditPartidaForm] = useState<Partial<Partida>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/lulo`);
      const data = await parseFetchJson<{
        error?: string;
        partidas?: Partida[];
        gastos?: Gasto[];
        snapshots?: SnapshotMeta[];
      }>(res);
      if (!res.ok) throw new Error(data.error || 'Error al cargar');
      setPartidas(data.partidas ?? []);
      setGastos(data.gastos ?? []);
      const snaps = data.snapshots ?? [];
      setSnapshots(snaps);
      if (snaps[0]?.id) {
        const snapRes = await fetch(`/api/proyectos/lulo/snapshots/${snaps[0].id}`);
        const snapData = await parseFetchJson<{
          error?: string;
          id: string;
          nombre_archivo: string;
          payload: LuloPayload;
        }>(snapRes);
        if (snapRes.ok) {
          setSnapshotDetail({
            id: snapData.id,
            payload: snapData.payload,
            nombre_archivo: snapData.nombre_archivo,
          });
          const tables = snapData.payload?.tables ?? [];
          if (tables[0]?.name) setTablaMdbSeleccionada(tables[0].name);
        }
      }
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
      const data = await parseFetchJson<{
        error?: string;
        id: string;
        nombre_archivo: string;
        payload: LuloPayload;
      }>(res);
      if (!res.ok) throw new Error(data.error);
      const payload = data.payload as LuloPayload;
      setSnapshotDetail({
        id: data.id,
        payload,
        nombre_archivo: data.nombre_archivo,
      });
      const tables = payload.tables ?? [];
      if (tables[0]?.name) setTablaMdbSeleccionada(tables[0].name);
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

  const tablaMdbActiva = useMemo(
    () => mdbTables.find((t) => t.name === tablaMdbSeleccionada) ?? mdbTables[0] ?? null,
    [mdbTables, tablaMdbSeleccionada],
  );

  const columnasMdb: LuloColumnaDef[] = useMemo(
    () => (tablaMdbActiva?.columns ?? []).map((c) => ({ key: c, label: c, maxWidth: 200 })),
    [tablaMdbActiva],
  );

  const filasPartidas = useMemo(
    () => partidas.map((p) => ({ ...p } as Record<string, unknown>)),
    [partidas],
  );

  const filasGastos = useMemo(
    () =>
      gastos.map((g) => ({
        ...g,
        descripcion: g.descripcion ?? '',
      })) as Record<string, unknown>[],
    [gastos],
  );

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
            {t === 'tablas' ? `MDB / volcado (${mdbTables.length || csvRows.length ? 'con datos' : '—'})` : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          className="flex flex-col items-center gap-2 py-8 text-zinc-500 text-sm"
          role="status"
          aria-live="polite"
        >
          <Settings className="h-8 w-8 animate-spin text-sky-400" aria-hidden />
          <span>Cargando datos de Lulo…</span>
        </div>
      ) : null}

      {!loading && tab === 'partidas' ? (
        <LuloTablaFiltrable
          titulo="Partidas importadas"
          columnas={COLUMNAS_PARTIDAS}
          filas={filasPartidas}
          vacio="Sin partidas Lulo. Importa un archivo MDB o CSV arriba."
          renderFila={(row) => {
            const p = row as unknown as Partida;
            const id = String(p.id);
            return (
              <tr key={id} className="border-t border-white/5 hover:bg-white/[0.02]">
                {editingPartida === id ? (
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
                        onClick={() => void savePartida(id)}
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
                          setEditingPartida(id);
                          setEditPartidaForm({});
                        }}
                        className="text-zinc-500 hover:text-white mr-2"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePartida(id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            );
          }}
        />
      ) : null}

      {!loading && tab === 'gastos' ? (
        <LuloTablaFiltrable
          titulo="Gastos de obra importados"
          columnas={COLUMNAS_GASTOS}
          filas={filasGastos}
          vacio="Sin gastos importados desde Lulo."
          renderFila={(row) => {
            const g = row as unknown as Gasto;
            const id = String(g.id);
            return (
              <tr key={id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2">{g.fecha}</td>
                <td className="px-3 py-2 max-w-[160px] truncate" title={g.proveedor}>
                  {g.proveedor}
                </td>
                <td className="px-3 py-2 max-w-[220px] truncate" title={g.descripcion ?? ''}>
                  {g.descripcion}
                </td>
                <td className="px-3 py-2 text-zinc-500">{g.tipo}</td>
                <td className="px-3 py-2 text-zinc-500">{g.disciplina}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {Number(g.costo).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void deleteGasto(id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          }}
        />
      ) : null}

      {!loading && tab === 'tablas' ? (
        <div className="space-y-4">
          {!snapshotDetail ? (
            <p className="text-sm text-zinc-500">
              Importa un MDB o CSV arriba, o selecciona una importación guardada para ver el volcado en tabla
              filtrable.
            </p>
          ) : mdbTables.length > 0 && tablaMdbActiva ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs text-zinc-500">
                  Archivo:{' '}
                  <span className="text-zinc-300 font-medium">{snapshotDetail.nombre_archivo}</span>
                </p>
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  Tabla Access:
                  <select
                    value={tablaMdbActiva.name}
                    onChange={(e) => setTablaMdbSeleccionada(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-zinc-200 focus:border-sky-500/40 focus:outline-none"
                  >
                    {mdbTables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.rowCount} filas)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <LuloTablaFiltrable
                titulo={`Tabla: ${tablaMdbActiva.name}`}
                columnas={columnasMdb}
                filas={tablaMdbActiva.rows}
                vacio="Esta tabla no tiene filas en el volcado."
                maxFilasVisibles={2000}
              />
            </>
          ) : csvRows.length > 0 ? (
            <LuloTablaFiltrable
              titulo={`CSV: ${snapshotDetail.nombre_archivo}`}
              columnas={(snapshotDetail.payload.headers ?? Object.keys(csvRows[0] ?? {})).map((h) => ({
                key: h,
                label: h,
                maxWidth: 200,
              }))}
              filas={csvRows as unknown as Record<string, unknown>[]}
              vacio="CSV sin filas."
              maxFilasVisibles={2000}
            />
          ) : (
            <p className="text-sm text-zinc-500">Volcado vacío.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
