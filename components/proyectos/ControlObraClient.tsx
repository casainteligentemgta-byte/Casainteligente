'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Database,
  FileSpreadsheet,
  Construction,
  Pencil,
  Save,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import ImportarPresupuestoLulo from '@/components/proyectos/ImportarPresupuestoLulo';
import LuloTablaFiltrable, { type LuloColumnaDef } from '@/components/proyectos/LuloTablaFiltrable';
import {
  filtrarGastosObra,
  filtrarPartidasObra,
  type FiltrosGastosObra,
  type FiltrosPartidasObra,
} from '@/lib/proyectos/controlObraFiltros';
import {
  agruparGastosPorDisciplina,
  agruparPartidasPorCapitulo,
  agruparPartidasPorRubro,
  getCapituloKey,
  ordenarGastosPlanos,
  ordenarPartidasPlanas,
  type VistaAgrupacionLulo,
} from '@/lib/proyectos/luloVistaAgrupada';
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

const FILTROS_PARTIDAS_INICIAL: FiltrosPartidasObra = {
  busqueda: '',
  codigo: '',
  capitulo: '',
  montoMin: '',
  montoMax: '',
};

const VISTAS_PRESUPUESTO: { id: VistaAgrupacionLulo; label: string }[] = [
  { id: 'capitulos', label: 'Capítulos' },
  { id: 'partidas', label: 'Partidas' },
  { id: 'disciplinas', label: 'Rubros' },
];

const VISTAS_GASTOS: { id: VistaAgrupacionLulo; label: string }[] = [
  { id: 'disciplinas', label: 'Disciplinas' },
  { id: 'partidas', label: 'Listado' },
];

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const FILTROS_GASTOS_INICIAL: FiltrosGastosObra = {
  busqueda: '',
  fechaDesde: '',
  fechaHasta: '',
  tipo: '',
  disciplina: '',
  proveedor: '',
  costoMin: '',
  costoMax: '',
};

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

function inputCls(w = 'w-full') {
  return `${w} rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none`;
}

function VistaAgrupacionSelector({
  vista,
  onChange,
  opciones,
}: {
  vista: VistaAgrupacionLulo;
  onChange: (v: VistaAgrupacionLulo) => void;
  opciones: { id: VistaAgrupacionLulo; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/50 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase text-zinc-500 shrink-0">Ver por</span>
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            vista === o.id
              ? 'bg-amber-500/20 text-amber-100 border border-amber-500/35'
              : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FiltrosPartidasPanel({
  filtros,
  onChange,
  onLimpiar,
  capitulosDisponibles,
}: {
  filtros: FiltrosPartidasObra;
  onChange: (f: FiltrosPartidasObra) => void;
  onLimpiar: () => void;
  capitulosDisponibles: string[];
}) {
  const activo =
    filtros.codigo || filtros.montoMin || filtros.montoMax || filtros.busqueda;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase text-zinc-500">Filtros avanzados</p>
        {activo ? (
          <button type="button" onClick={onLimpiar} className="text-[11px] text-amber-400 hover:text-amber-300">
            Limpiar
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className={inputCls('min-w-[120px] flex-1 max-w-[160px]')}
          placeholder="Código contiene…"
          value={filtros.codigo ?? ''}
          onChange={(e) => onChange({ ...filtros, codigo: e.target.value })}
        />
        <input
          type="number"
          className={inputCls('w-28')}
          placeholder="Monto mín."
          value={filtros.montoMin ?? ''}
          onChange={(e) => onChange({ ...filtros, montoMin: e.target.value })}
        />
        <input
          type="number"
          className={inputCls('w-28')}
          placeholder="Monto máx."
          value={filtros.montoMax ?? ''}
          onChange={(e) => onChange({ ...filtros, montoMax: e.target.value })}
        />
        {capitulosDisponibles.length > 0 ? (
          <select
            value={filtros.capitulo ?? ''}
            onChange={(e) => onChange({ ...filtros, capitulo: e.target.value })}
            className={inputCls('min-w-[120px]')}
            title="Filtrar capítulo"
          >
            <option value="">Todos los capítulos</option>
            {capitulosDisponibles.map((c) => (
              <option key={c} value={c}>
                Cap. {c}
              </option>
            ))}
          </select>
        ) : null}
        <input
          className={inputCls('min-w-[180px] flex-1')}
          placeholder="Búsqueda global en filas…"
          value={filtros.busqueda}
          onChange={(e) => onChange({ ...filtros, busqueda: e.target.value })}
        />
      </div>
    </div>
  );
}

function FiltrosGastosPanel({
  filtros,
  onChange,
  onLimpiar,
}: {
  filtros: FiltrosGastosObra;
  onChange: (f: FiltrosGastosObra) => void;
  onLimpiar: () => void;
}) {
  const activo = Object.entries(filtros).some(([, v]) => String(v ?? '').trim() !== '');
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase text-zinc-500">Filtros avanzados</p>
        {activo ? (
          <button type="button" onClick={onLimpiar} className="text-[11px] text-amber-400 hover:text-amber-300">
            Limpiar
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <input type="date" className={inputCls('w-36')} value={filtros.fechaDesde ?? ''} onChange={(e) => onChange({ ...filtros, fechaDesde: e.target.value })} title="Desde" />
        <input type="date" className={inputCls('w-36')} value={filtros.fechaHasta ?? ''} onChange={(e) => onChange({ ...filtros, fechaHasta: e.target.value })} title="Hasta" />
        <input className={inputCls('min-w-[100px]')} placeholder="Tipo" value={filtros.tipo ?? ''} onChange={(e) => onChange({ ...filtros, tipo: e.target.value })} />
        <input className={inputCls('min-w-[100px]')} placeholder="Disciplina" value={filtros.disciplina ?? ''} onChange={(e) => onChange({ ...filtros, disciplina: e.target.value })} />
        <input className={inputCls('min-w-[120px] flex-1')} placeholder="Proveedor" value={filtros.proveedor ?? ''} onChange={(e) => onChange({ ...filtros, proveedor: e.target.value })} />
        <input type="number" className={inputCls('w-24')} placeholder="Costo mín." value={filtros.costoMin ?? ''} onChange={(e) => onChange({ ...filtros, costoMin: e.target.value })} />
        <input type="number" className={inputCls('w-24')} placeholder="Costo máx." value={filtros.costoMax ?? ''} onChange={(e) => onChange({ ...filtros, costoMax: e.target.value })} />
        <input className={inputCls('min-w-[160px] flex-1')} placeholder="Búsqueda global…" value={filtros.busqueda} onChange={(e) => onChange({ ...filtros, busqueda: e.target.value })} />
      </div>
    </div>
  );
}

export default function ControlObraClient({ proyectoId, proyectoNombre }: Props) {
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
  const [editingGasto, setEditingGasto] = useState<string | null>(null);
  const [editGastoForm, setEditGastoForm] = useState<Partial<Gasto>>({});
  const [saving, setSaving] = useState(false);
  const [filtrosPartidas, setFiltrosPartidas] = useState<FiltrosPartidasObra>(FILTROS_PARTIDAS_INICIAL);
  const [filtrosGastos, setFiltrosGastos] = useState<FiltrosGastosObra>(FILTROS_GASTOS_INICIAL);
  const [vistaAgrupacion, setVistaAgrupacion] = useState<VistaAgrupacionLulo>('capitulos');
  const [resumenNativo, setResumenNativo] = useState({
    apuLineas: 0,
    insumosEnApu: 0,
    insumosMaestroTotal: 0,
  });
  const [proyectoLulo, setProyectoLulo] = useState<{
    codigo_lulo?: string | null;
    porcentaje_admin?: number | null;
    porcentaje_utilidad?: number | null;
    porcentaje_fcm?: number | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/lulo`);
      const data = await parseFetchJson<{
        error?: string;
        partidas?: Partida[];
        gastos?: Gasto[];
        snapshots?: SnapshotMeta[];
        resumenNativo?: {
          apuLineas?: number;
          insumosEnApu?: number;
          insumosMaestroTotal?: number;
        };
        proyecto?: {
          codigo_lulo?: string | null;
          porcentaje_admin?: number | null;
          porcentaje_utilidad?: number | null;
          porcentaje_fcm?: number | null;
        };
      }>(res);
      if (!res.ok) throw new Error(data.error || 'Error al cargar');
      setPartidas(data.partidas ?? []);
      setGastos(data.gastos ?? []);
      setResumenNativo({
        apuLineas: data.resumenNativo?.apuLineas ?? 0,
        insumosEnApu: data.resumenNativo?.insumosEnApu ?? 0,
        insumosMaestroTotal: data.resumenNativo?.insumosMaestroTotal ?? 0,
      });
      setProyectoLulo(data.proyecto ?? null);
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

  const setTabActivo = (t: 'partidas' | 'gastos' | 'tablas') => {
    setTab(t);
    if (t === 'gastos' && vistaAgrupacion === 'capitulos') {
      setVistaAgrupacion('disciplinas');
    }
  };

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
      setSnapshotDetail({ id: data.id, payload, nombre_archivo: data.nombre_archivo });
      const tables = payload.tables ?? [];
      if (tables[0]?.name) setTablaMdbSeleccionada(tables[0].name);
      setTab('tablas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir el volcado');
    }
  };

  const deleteSnapshot = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Borrar el volcado "${nombre}"? No borra partidas ni gastos ya importados.`)) return;
    const res = await fetch(`/api/proyectos/lulo/snapshots/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('No se pudo borrar el volcado');
      return;
    }
    setSnapshots((s) => s.filter((x) => x.id !== id));
    if (snapshotDetail?.id === id) setSnapshotDetail(null);
    toast.success('Volcado eliminado');
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

  const saveGasto = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/proyectos/lulo/gastos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editGastoForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGastos((prev) => prev.map((g) => (g.id === id ? { ...g, ...editGastoForm } as Gasto : g)));
      setEditingGasto(null);
      toast.success('Gasto guardado');
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

  const keysPartidas = useMemo(() => COLUMNAS_PARTIDAS.map((c) => c.key), []);
  const keysGastos = useMemo(() => COLUMNAS_GASTOS.map((c) => c.key), []);

  const capitulosDisponibles = useMemo(() => {
    const set = new Set(partidas.map((p) => getCapituloKey(p.codigo_partida)));
    return Array.from(set).filter((c) => c !== '—').sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [partidas]);

  const partidasFiltradas = useMemo(() => {
    const base = partidas.map((p) => ({ ...p } as Record<string, unknown>));
    return filtrarPartidasObra(base, keysPartidas, filtrosPartidas) as Partida[];
  }, [partidas, keysPartidas, filtrosPartidas]);

  const gastosFiltrados = useMemo(() => {
    const base = gastos.map((g) => ({
      ...g,
      descripcion: g.descripcion ?? '',
    })) as Record<string, unknown>[];
    return filtrarGastosObra(base, keysGastos, filtrosGastos) as Gasto[];
  }, [gastos, keysGastos, filtrosGastos]);

  const gruposPartidas = useMemo(() => {
    if (tab !== 'partidas' || vistaAgrupacion === 'partidas') return null;
    if (vistaAgrupacion === 'capitulos') return agruparPartidasPorCapitulo(partidasFiltradas);
    return agruparPartidasPorRubro(partidasFiltradas);
  }, [tab, vistaAgrupacion, partidasFiltradas]);

  const filasPartidasPlanas = useMemo(() => {
    if (tab !== 'partidas' || vistaAgrupacion !== 'partidas') return [];
    return ordenarPartidasPlanas(partidasFiltradas);
  }, [tab, vistaAgrupacion, partidasFiltradas]);

  const gruposGastos = useMemo(() => {
    if (tab !== 'gastos' || vistaAgrupacion !== 'disciplinas') return null;
    return agruparGastosPorDisciplina(gastosFiltrados);
  }, [tab, vistaAgrupacion, gastosFiltrados]);

  const filasGastosPlanas = useMemo(() => {
    if (tab !== 'gastos' || vistaAgrupacion === 'disciplinas') return [];
    return ordenarGastosPlanos(gastosFiltrados);
  }, [tab, vistaAgrupacion, gastosFiltrados]);

  const totalPartidas = partidas.reduce((s, p) => s + Number(p.monto_total_estimado), 0);
  const totalGastos = gastos.reduce((s, g) => s + Number(g.costo), 0);
  const totalPartidasFiltradas = partidasFiltradas.reduce(
    (s, p) => s + Number(p.monto_total_estimado ?? 0),
    0,
  );
  const totalGastosFiltrados = gastosFiltrados.reduce((s, g) => s + Number(g.costo ?? 0), 0);

  const renderFilaPartida = (row: Record<string, unknown>) => {
    const p = row as unknown as Partida;
    const id = String(p.id);
    return (
      <tr key={id} className="border-t border-white/5 hover:bg-white/[0.02]">
        {editingPartida === id ? (
          <>
            <td className="px-2 py-1">
              <input className={inputCls()} value={editPartidaForm.codigo_partida ?? p.codigo_partida} onChange={(e) => setEditPartidaForm((f) => ({ ...f, codigo_partida: e.target.value }))} />
            </td>
            <td className="px-2 py-1">
              <input className={inputCls('w-full min-w-[140px]')} value={editPartidaForm.descripcion ?? p.descripcion} onChange={(e) => setEditPartidaForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </td>
            <td className="px-2 py-1">
              <input className={inputCls('w-14')} value={editPartidaForm.unidad ?? p.unidad} onChange={(e) => setEditPartidaForm((f) => ({ ...f, unidad: e.target.value }))} />
            </td>
            <td className="px-2 py-1">
              <input type="number" className={inputCls('w-20 text-right')} value={editPartidaForm.cantidad_presupuestada ?? p.cantidad_presupuestada} onChange={(e) => setEditPartidaForm((f) => ({ ...f, cantidad_presupuestada: Number(e.target.value) }))} />
            </td>
            <td className="px-2 py-1">
              <input type="number" className={inputCls('w-24 text-right')} value={editPartidaForm.precio_unitario_estimado ?? p.precio_unitario_estimado} onChange={(e) => setEditPartidaForm((f) => ({ ...f, precio_unitario_estimado: Number(e.target.value) }))} />
            </td>
            <td className="px-2 py-1">
              <input type="number" className={inputCls('w-24 text-right')} value={editPartidaForm.monto_total_estimado ?? p.monto_total_estimado} onChange={(e) => setEditPartidaForm((f) => ({ ...f, monto_total_estimado: Number(e.target.value) }))} />
            </td>
            <td className="px-2 py-1 whitespace-nowrap">
              <button type="button" disabled={saving} onClick={() => void savePartida(id)} className="text-emerald-400 hover:text-emerald-300 mr-1">
                <Save className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setEditingPartida(null)} className="text-zinc-500 hover:text-white">
                <X className="h-4 w-4" />
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
            <td className="px-3 py-2 text-right font-semibold">{Number(p.monto_total_estimado).toLocaleString()}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              <button type="button" onClick={() => { setEditingPartida(id); setEditPartidaForm({}); }} className="text-zinc-500 hover:text-white mr-2">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => void deletePartida(id)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </td>
          </>
        )}
      </tr>
    );
  };

  const renderFilaGasto = (row: Record<string, unknown>) => {
    const g = row as unknown as Gasto;
    const id = String(g.id);
    return (
      <tr key={id} className="border-t border-white/5 hover:bg-white/[0.02]">
        {editingGasto === id ? (
          <>
            <td className="px-2 py-1">
              <input type="date" className={inputCls()} value={editGastoForm.fecha ?? g.fecha} onChange={(e) => setEditGastoForm((f) => ({ ...f, fecha: e.target.value }))} />
            </td>
            <td className="px-2 py-1">
              <input className={inputCls()} value={editGastoForm.proveedor ?? g.proveedor} onChange={(e) => setEditGastoForm((f) => ({ ...f, proveedor: e.target.value }))} />
            </td>
            <td className="px-2 py-1">
              <input className={inputCls('min-w-[120px]')} value={editGastoForm.descripcion ?? g.descripcion ?? ''} onChange={(e) => setEditGastoForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </td>
            <td className="px-2 py-1">
              <input className={inputCls('w-20')} value={editGastoForm.tipo ?? g.tipo} onChange={(e) => setEditGastoForm((f) => ({ ...f, tipo: e.target.value }))} />
            </td>
            <td className="px-2 py-1">
              <input className={inputCls('w-20')} value={editGastoForm.disciplina ?? g.disciplina} onChange={(e) => setEditGastoForm((f) => ({ ...f, disciplina: e.target.value }))} />
            </td>
            <td className="px-2 py-1">
              <input type="number" className={inputCls('w-24 text-right')} value={editGastoForm.costo ?? g.costo} onChange={(e) => setEditGastoForm((f) => ({ ...f, costo: Number(e.target.value) }))} />
            </td>
            <td className="px-2 py-1 whitespace-nowrap">
              <button type="button" disabled={saving} onClick={() => void saveGasto(id)} className="text-emerald-400 hover:text-emerald-300 mr-1">
                <Save className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setEditingGasto(null)} className="text-zinc-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </td>
          </>
        ) : (
          <>
            <td className="px-3 py-2">{g.fecha}</td>
            <td className="px-3 py-2 max-w-[160px] truncate" title={g.proveedor}>{g.proveedor}</td>
            <td className="px-3 py-2 max-w-[220px] truncate" title={g.descripcion ?? ''}>{g.descripcion}</td>
            <td className="px-3 py-2 text-zinc-500">{g.tipo}</td>
            <td className="px-3 py-2 text-zinc-500">{g.disciplina}</td>
            <td className="px-3 py-2 text-right font-semibold">{Number(g.costo).toLocaleString()}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              <button type="button" onClick={() => { setEditingGasto(id); setEditGastoForm({}); }} className="text-zinc-500 hover:text-white mr-2">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => void deleteGasto(id)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </td>
          </>
        )}
      </tr>
    );
  };

  return (
    <div className="space-y-6 text-white max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start gap-4">
        <Link
          href={`/proyectos/modulo/${proyectoId}?tab=finanzas`}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:bg-white/5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al módulo
        </Link>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2">
            <Construction className="h-6 w-6 text-amber-400" />
            <h1 className="text-xl font-bold tracking-tight">CONTROL DE OBRA</h1>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            {proyectoNombre ?? 'Proyecto'} · datos extraídos de Lulo Software
            {proyectoLulo?.codigo_lulo ? (
              <span className="text-amber-400/90"> · Obra Lulo {proyectoLulo.codigo_lulo}</span>
            ) : null}
          </p>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-950/30 px-3 py-1 text-[11px] font-semibold text-amber-200">
          Lulo MDB / CSV
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <ImportarPresupuestoLulo proyectoId={proyectoId} onSuccess={() => void load()} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 flex-1 min-w-[240px]">
          <div className="rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Partidas</p>
            <p className="text-lg font-bold text-emerald-400">{partidas.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Gastos</p>
            <p className="text-lg font-bold text-sky-400">{gastos.length}</p>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-3 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Líneas APU</p>
            <p className="text-lg font-bold text-violet-300">{resumenNativo.apuLineas}</p>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-3 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Insumos (obra)</p>
            <p className="text-lg font-bold text-violet-300">{resumenNativo.insumosEnApu}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 col-span-2">
            <p className="text-[10px] uppercase text-zinc-500">Totales presupuesto / gastos</p>
            <p className="text-xs text-zinc-300 mt-0.5">
              {totalPartidas.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} ·{' '}
              {totalGastos.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
            {resumenNativo.insumosMaestroTotal > 0 ? (
              <p className="text-[10px] text-zinc-500 mt-1">
                Catálogo global: {resumenNativo.insumosMaestroTotal} insumos
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {snapshots.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Importaciones guardadas</p>
          <div className="flex flex-wrap gap-2">
            {snapshots.map((s) => (
              <div key={s.id} className="inline-flex items-center gap-0.5 rounded-lg border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => void loadSnapshot(s.id)}
                  className={`px-3 py-1.5 text-xs ${
                    snapshotDetail?.id === s.id
                      ? 'bg-sky-950/40 text-sky-200'
                      : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {s.formato === 'mdb' ? (
                    <Database className="inline h-3 w-3 mr-1 text-sky-400" />
                  ) : (
                    <FileSpreadsheet className="inline h-3 w-3 mr-1 text-emerald-400" />
                  )}
                  {s.nombre_archivo}
                </button>
                <button
                  type="button"
                  title="Borrar volcado"
                  onClick={() => void deleteSnapshot(s.id, s.nombre_archivo)}
                  className="px-2 py-1.5 text-red-400/80 hover:bg-red-950/40 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(['partidas', 'gastos', 'tablas'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTabActivo(t)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              tab === t
                ? 'bg-amber-500/15 text-amber-100 border border-amber-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'partidas' ? `Presupuesto (${partidas.length})` : null}
            {t === 'gastos' ? `Gastos (${gastos.length})` : null}
            {t === 'tablas' ? `Volcado Lulo (${mdbTables.length || csvRows.length ? 'con datos' : '—'})` : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-8 text-zinc-500 text-sm" role="status">
          <Settings className="h-8 w-8 animate-spin text-amber-400" />
          <span>Cargando control de obra…</span>
        </div>
      ) : null}

      {!loading && tab === 'partidas' ? (
        <div className="space-y-3">
          <VistaAgrupacionSelector
            vista={vistaAgrupacion}
            onChange={setVistaAgrupacion}
            opciones={VISTAS_PRESUPUESTO}
          />
          <FiltrosPartidasPanel
            filtros={filtrosPartidas}
            onChange={setFiltrosPartidas}
            onLimpiar={() => setFiltrosPartidas(FILTROS_PARTIDAS_INICIAL)}
            capitulosDisponibles={capitulosDisponibles}
          />
          <p className="text-[11px] text-zinc-500">
            Mostrando {partidasFiltradas.length} de {partidas.length} · subtotal filtrado:{' '}
            {fmtUsd(totalPartidasFiltradas)}
            {vistaAgrupacion === 'capitulos' && gruposPartidas
              ? ` · ${gruposPartidas.length} capítulos`
              : vistaAgrupacion === 'disciplinas' && gruposPartidas
                ? ` · ${gruposPartidas.length} rubros`
                : ''}
          </p>
          {vistaAgrupacion === 'partidas' ? (
            <LuloTablaFiltrable
              titulo="Partidas de presupuesto (orden por código)"
              columnas={COLUMNAS_PARTIDAS}
              filas={filasPartidasPlanas as unknown as Record<string, unknown>[]}
              vacio="Sin partidas. Importa un archivo Lulo arriba."
              renderFila={renderFilaPartida}
            />
          ) : gruposPartidas && gruposPartidas.length > 0 ? (
            <div className="space-y-5">
              {gruposPartidas.map((grupo) => (
                <div key={grupo.clave} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2">
                    <h4 className="text-xs font-semibold text-amber-100">{grupo.etiqueta}</h4>
                    <span className="text-[11px] font-mono text-amber-200/90">
                      {grupo.items.length} filas · {fmtUsd(grupo.subtotal)}
                    </span>
                  </div>
                  <LuloTablaFiltrable
                    columnas={COLUMNAS_PARTIDAS}
                    filas={grupo.items as unknown as Record<string, unknown>[]}
                    vacio="Sin filas en este grupo."
                    mostrarFiltros={false}
                    renderFila={renderFilaPartida}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sin partidas que coincidan con los filtros.</p>
          )}
        </div>
      ) : null}

      {!loading && tab === 'gastos' ? (
        <div className="space-y-3">
          <VistaAgrupacionSelector
            vista={vistaAgrupacion}
            onChange={setVistaAgrupacion}
            opciones={VISTAS_GASTOS}
          />
          <FiltrosGastosPanel
            filtros={filtrosGastos}
            onChange={setFiltrosGastos}
            onLimpiar={() => setFiltrosGastos(FILTROS_GASTOS_INICIAL)}
          />
          <p className="text-[11px] text-zinc-500">
            Mostrando {gastosFiltrados.length} de {gastos.length} · subtotal filtrado:{' '}
            {fmtUsd(totalGastosFiltrados)}
            {vistaAgrupacion === 'disciplinas' && gruposGastos
              ? ` · ${gruposGastos.length} disciplinas`
              : ''}
          </p>
          {vistaAgrupacion === 'partidas' ? (
            <LuloTablaFiltrable
              titulo="Gastos de obra (por fecha)"
              columnas={COLUMNAS_GASTOS}
              filas={filasGastosPlanas as unknown as Record<string, unknown>[]}
              vacio="Sin gastos importados desde Lulo."
              renderFila={renderFilaGasto}
            />
          ) : gruposGastos && gruposGastos.length > 0 ? (
            <div className="space-y-5">
              {gruposGastos.map((grupo) => (
                <div key={grupo.clave} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/25 bg-sky-950/25 px-3 py-2">
                    <h4 className="text-xs font-semibold text-sky-100">{grupo.etiqueta}</h4>
                    <span className="text-[11px] font-mono text-sky-200/90">
                      {grupo.items.length} filas · {fmtUsd(grupo.subtotal)}
                    </span>
                  </div>
                  <LuloTablaFiltrable
                    columnas={COLUMNAS_GASTOS}
                    filas={grupo.items as unknown as Record<string, unknown>[]}
                    vacio="Sin gastos en esta disciplina."
                    mostrarFiltros={false}
                    renderFila={renderFilaGasto}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sin gastos que coincidan con los filtros.</p>
          )}
        </div>
      ) : null}

      {!loading && tab === 'tablas' ? (
        <div className="space-y-4">
          {!snapshotDetail ? (
            <p className="text-sm text-zinc-500">
              Importa un MDB o CSV arriba, o selecciona una importación guardada para consultar el volcado original con filtros.
            </p>
          ) : mdbTables.length > 0 && tablaMdbActiva ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs text-zinc-500">
                  Archivo: <span className="text-zinc-300 font-medium">{snapshotDetail.nombre_archivo}</span>
                </p>
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  Tabla Access:
                  <select
                    value={tablaMdbActiva.name}
                    onChange={(e) => setTablaMdbSeleccionada(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-zinc-200 focus:border-amber-500/40 focus:outline-none"
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
                titulo={`Volcado: ${tablaMdbActiva.name}`}
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
