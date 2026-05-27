'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Database,
  FileSpreadsheet,
  Pencil,
  Save,
  Settings,
  Trash2,
  X,
  Layers,
  Printer,
  FileText,
} from 'lucide-react';
import ApuPartidaDetalleModal from '@/components/proyectos/ApuPartidaDetalleModal';
import PresupuestoPorCapitulos from '@/components/proyectos/PresupuestoPorCapitulos';
import ResumenPresupuestoCapitulos from '@/components/proyectos/ResumenPresupuestoCapitulos';
import { toast } from 'sonner';
import { buildResumenPresupuestoCapitulos } from '@/lib/proyectos/buildResumenPresupuestoCapitulos';
import { buildObraDataPresupuesto } from '@/lib/proyectos/mapObraDataPresupuesto';
import LuloVolcadoPorCapitulos from '@/components/proyectos/LuloVolcadoPorCapitulos';
import LuloTablaFiltrable, { type LuloColumnaDef } from '@/components/proyectos/LuloTablaFiltrable';
import { getCapituloKeyPartida, ordenarPartidasPorCapitulos } from '@/lib/proyectos/luloCapitulos';
import type { LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';
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
  ordenarGastosPlanos,
  type VistaAgrupacionLulo,
} from '@/lib/proyectos/luloVistaAgrupada';
import { isValidProyectoUuid, resolveProyectoId } from '@/lib/proyectos/validarProyectoUuid';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

const COLUMNAS_PARTIDAS: LuloColumnaDef[] = [
  { key: 'capitulo_codigo', label: 'Cap.', mono: true, align: 'center' },
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
  capitulo_codigo?: string | null;
  capitulo_descripcion?: string | null;
  capitulo_orden?: number | null;
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

type TabObraId = 'partidas' | 'presupuesto' | 'gastos' | 'tablas';

function tabDesdeQuery(raw: string | null): TabObraId | null {
  if (!raw) return null;
  if (raw === 'presupuesto' || raw === 'reporte') return 'presupuesto';
  if (raw === 'partidas' || raw === 'cuadro') return 'partidas';
  if (raw === 'gastos') return 'gastos';
  if (raw === 'tablas' || raw === 'volcado') return 'tablas';
  return null;
}

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
  const params = useParams();
  const searchParams = useSearchParams();
  const pid = useMemo(() => {
    if (proyectoId && isValidProyectoUuid(proyectoId)) {
      return resolveProyectoId(proyectoId, undefined);
    }
    return resolveProyectoId(proyectoId, params?.id as string | string[]);
  }, [proyectoId, params]);

  const [loading, setLoading] = useState(true);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [tab, setTab] = useState<'partidas' | 'presupuesto' | 'gastos' | 'tablas'>('partidas');
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
  const [reporteVariant, setReporteVariant] = useState<'app' | 'report' | 'representante'>('report');
  const [mostrarDetalleReporte, setMostrarDetalleReporte] = useState(false);
  const [analisisGemini, setAnalisisGemini] = useState<string | null>(null);
  const [analisisGeminiMeta, setAnalisisGeminiMeta] = useState<string | null>(null);
  const [analisisGeminiLoading, setAnalisisGeminiLoading] = useState(false);
  const [resumenNativo, setResumenNativo] = useState({
    apuLineas: 0,
    insumosEnApu: 0,
    insumosMaestroTotal: 0,
  });
  const [proyectoMeta, setProyectoMeta] = useState<{
    nombre?: string | null;
    ubicacion_texto?: string | null;
    obra_ubicacion?: string | null;
    obra_cliente?: string | null;
    codigo_lulo?: string | null;
    porcentaje_admin?: number | null;
    porcentaje_utilidad?: number | null;
    porcentaje_fcm?: number | null;
  } | null>(null);
  const [apuPartidaId, setApuPartidaId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!isValidProyectoUuid(pid)) return;
      const res = await fetch(`/api/proyectos/${encodeURIComponent(pid)}/lulo`);
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
          nombre?: string | null;
          ubicacion_texto?: string | null;
          obra_ubicacion?: string | null;
          obra_cliente?: string | null;
          codigo_lulo?: string | null;
          porcentaje_admin?: number | null;
          porcentaje_utilidad?: number | null;
          porcentaje_fcm?: number | null;
        };
      }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(data, 'Error al cargar datos Lulo'));
      setPartidas(data.partidas ?? []);
      setGastos(data.gastos ?? []);
      setResumenNativo({
        apuLineas: data.resumenNativo?.apuLineas ?? 0,
        insumosEnApu: data.resumenNativo?.insumosEnApu ?? 0,
        insumosMaestroTotal: data.resumenNativo?.insumosMaestroTotal ?? 0,
      });
      setProyectoMeta(data.proyecto ?? null);
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
      toast.error(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = tabDesdeQuery(searchParams.get('tab'));
    if (t) setTab(t);
  }, [searchParams]);

  const setTabActivo = (t: TabObraId) => {
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
    const set = new Set(partidas.map((p) => getCapituloKeyPartida(p)));
    return Array.from(set).filter((c) => c !== '—').sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [partidas]);

  const esTablaPartidasMdb = useMemo(() => {
    const n = tablaMdbActiva?.name?.trim().toUpperCase() ?? '';
    return n === 'PARTIDAS' || n === 'PARTIDA';
  }, [tablaMdbActiva]);

  const mdbDumpCompleto = useMemo((): LuloMdbFullDump | null => {
    if (snapshotDetail?.payload?.formato !== 'mdb') return null;
    const p = snapshotDetail.payload;
    if (!p?.tables) return null;
    return p as LuloMdbFullDump;
  }, [snapshotDetail]);

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
    return ordenarPartidasPorCapitulos(partidasFiltradas);
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

  const obraPresupuesto = useMemo(
    () =>
      buildObraDataPresupuesto(
        ordenarPartidasPorCapitulos(partidas),
        proyectoMeta,
        proyectoNombre,
        pid,
      ),
    [partidas, proyectoMeta, proyectoNombre, pid],
  );

  const resumenRepresentante = useMemo(
    () => buildResumenPresupuestoCapitulos(obraPresupuesto),
    [obraPresupuesto],
  );

  const hayVolcadoSinPartidas =
    !loading && partidas.length === 0 && (snapshots.length > 0 || snapshotDetail != null);

  async function consultarAnalisisGemini() {
    setAnalisisGeminiLoading(true);
    setAnalisisGemini(null);
    setAnalisisGeminiMeta(null);
    try {
      const res = await fetch(`/api/proyectos/${pid}/lulo/analisis-gemini`, { method: 'POST' });
      const data = await parseFetchJson<{
        texto?: string;
        desdeGemini?: boolean;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error);
      setAnalisisGemini(data.texto ?? '');
      setAnalisisGeminiMeta(
        data.desdeGemini ? 'Análisis con Gemini (@google/genai).' : 'Modo local (sin API o fallback).',
      );
    } catch (e) {
      setAnalisisGemini(formatErrorMessage(e));
    } finally {
      setAnalisisGeminiLoading(false);
    }
  }

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
              <button
                type="button"
                title="Ver composición APU"
                onClick={() => setApuPartidaId(id)}
                className="text-violet-400 hover:text-violet-300 mr-2"
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {proyectoNombre ?? 'Proyecto'} · datos extraídos de Lulo Software
          {proyectoMeta?.codigo_lulo ? (
            <span className="text-amber-400/90"> · Obra Lulo {proyectoMeta.codigo_lulo}</span>
          ) : null}
        </p>
        <span className="rounded-full border border-amber-500/30 bg-amber-950/30 px-3 py-1 text-[11px] font-semibold text-amber-200">
          Lulo MDB / CSV
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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

      {hayVolcadoSinPartidas ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-4 text-sm text-amber-100/90">
          <p className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0" />
            Hay volcado Lulo guardado, pero el cuadro de partidas está vacío
          </p>
          <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-amber-200/80">
            <li>Reimporta el MDB marcando la tabla <strong>PARTIDAS</strong> (o el mapeo de columnas sugerido).</li>
            <li>Revisa la pestaña <button type="button" className="underline hover:text-white" onClick={() => setTabActivo('tablas')}>Volcado Lulo</button> para ver tablas crudas del archivo.</li>
            <li>Abre <button type="button" className="underline hover:text-white" onClick={() => setTabActivo('presupuesto')}>Reporte Lulo</button> cuando ya existan partidas importadas.</li>
          </ol>
        </div>
      ) : null}

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
        {(['partidas', 'presupuesto', 'gastos', 'tablas'] as const).map((t) => (
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
            {t === 'partidas' ? `Cuadro (${partidas.length})` : null}
            {t === 'presupuesto' ? `Reporte Lulo` : null}
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

      {!loading && tab === 'presupuesto' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-zinc-500">
              Reporte completo · {partidas.length} partidas
              {partidasFiltradas.length !== partidas.length
                ? ` (en Cuadro ves ${partidasFiltradas.length} por filtros activos)`
                : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/5"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={() => setMostrarDetalleReporte((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${
                mostrarDetalleReporte
                  ? 'border-amber-500/40 bg-amber-950/40 text-amber-100'
                  : 'border-white/10 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {mostrarDetalleReporte ? 'Ocultar detalle' : 'Ver detalle partidas'}
            </button>
            <button
              type="button"
              onClick={() => void consultarAnalisisGemini()}
              disabled={analisisGeminiLoading || partidas.length === 0}
              className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/50 disabled:opacity-50"
            >
              {analisisGeminiLoading ? 'Analizando…' : 'Interpretar con Gemini'}
            </button>
            <div className="flex gap-1 rounded-lg border border-white/10 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setReporteVariant('report')}
                className={`rounded-md px-2.5 py-1 ${
                  reporteVariant === 'report'
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Impresión Lulo
              </button>
              <button
                type="button"
                onClick={() => setReporteVariant('app')}
                className={`rounded-md px-2.5 py-1 ${
                  reporteVariant === 'app'
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Tema app
              </button>
              <button
                type="button"
                onClick={() => setReporteVariant('representante')}
                className={`rounded-md px-2.5 py-1 ${
                  reporteVariant === 'representante'
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Representante
              </button>
            </div>
            </div>
          </div>
          {analisisGemini ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-50/90 whitespace-pre-wrap">
              {analisisGeminiMeta ? (
                <p className="text-[10px] text-amber-200/60 mb-2">{analisisGeminiMeta}</p>
              ) : null}
              {analisisGemini}
            </div>
          ) : null}
          {partidas.length === 0 ? (
            <p className="text-sm text-zinc-500 rounded-xl border border-dashed border-white/10 py-12 text-center">
              Sin partidas para el reporte. Importa un MDB/CSV arriba o revisa el volcado en la pestaña Volcado Lulo.
            </p>
          ) : reporteVariant === 'representante' ? (
            <ResumenPresupuestoCapitulos
              {...resumenRepresentante}
              className="print:shadow-none"
            />
          ) : (
            <PresupuestoPorCapitulos
              obra={obraPresupuesto}
              variant={reporteVariant}
              moneda="USD"
              titulo="PRESUPUESTO POR CAPITULOS"
              mostrarDetalle={mostrarDetalleReporte}
              className="print:shadow-none print:border-0"
            />
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
              {esTablaPartidasMdb && mdbDumpCompleto ? (
                <LuloVolcadoPorCapitulos
                  dump={mdbDumpCompleto}
                  tablaPartidas={tablaMdbActiva}
                  columnas={columnasMdb}
                />
              ) : (
                <LuloTablaFiltrable
                  titulo={`Volcado: ${tablaMdbActiva.name}`}
                  columnas={columnasMdb}
                  filas={tablaMdbActiva.rows}
                  vacio="Esta tabla no tiene filas en el volcado."
                  maxFilasVisibles={2000}
                />
              )}
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

      <ApuPartidaDetalleModal partidaId={apuPartidaId} onClose={() => setApuPartidaId(null)} />
    </div>
  );
}
