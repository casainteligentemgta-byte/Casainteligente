'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Database,
  FileSpreadsheet,
  FileText,
  Layers,
  Printer,
  Settings,
  Table2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import ApuPartidaDetalleModal from '@/components/proyectos/ApuPartidaDetalleModal';
import ImportarPresupuestoLulo from '@/components/proyectos/ImportarPresupuestoLulo';
import LuloTablaFiltrable, { type LuloColumnaDef } from '@/components/proyectos/LuloTablaFiltrable';
import LuloVolcadoPorCapitulos from '@/components/proyectos/LuloVolcadoPorCapitulos';
import PresupuestoPorCapitulos from '@/components/proyectos/PresupuestoPorCapitulos';
import ResumenPresupuestoCapitulos from '@/components/proyectos/ResumenPresupuestoCapitulos';
import LuloCatalogoTablasMdb from '@/components/proyectos/lulo/LuloCatalogoTablasMdb';
import { buildResumenPresupuestoCapitulos } from '@/lib/proyectos/buildResumenPresupuestoCapitulos';
import { buildObraDataPresupuesto } from '@/lib/proyectos/mapObraDataPresupuesto';
import { getCapituloKeyPartida, ordenarPartidasPorCapitulos } from '@/lib/proyectos/luloCapitulos';
import {
  filtrarPartidasObra,
  type FiltrosPartidasObra,
} from '@/lib/proyectos/controlObraFiltros';
import {
  agruparPartidasPorCapitulo,
  agruparPartidasPorRubro,
  type VistaAgrupacionLulo,
} from '@/lib/proyectos/luloVistaAgrupada';
import {
  esTablaPartidasMdb,
  payloadComoMdbDump,
  tabLuloDesdeQuery,
  type LuloPartida,
  type TabLuloId,
} from '@/lib/proyectos/lulo/luloProyectoTypes';
import { useLuloProyectoData } from '@/lib/proyectos/lulo/useLuloProyectoData';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
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

const FILTROS_INICIAL: FiltrosPartidasObra = {
  busqueda: '',
  codigo: '',
  capitulo: '',
  montoMin: '',
  montoMax: '',
};

const VISTAS: { id: VistaAgrupacionLulo; label: string }[] = [
  { id: 'capitulos', label: 'Capítulos (estilo Lulo)' },
  { id: 'partidas', label: 'Listado plano' },
  { id: 'disciplinas', label: 'Rubros' },
];

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function inputCls(w = 'w-full') {
  return `${w} rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none`;
}

type Props = {
  proyectoId: string;
  proyectoNombre?: string;
};

export default function LuloProyectoClient({ proyectoId, proyectoNombre }: Props) {
  const searchParams = useSearchParams();
  const pid = proyectoId;
  const {
    loading,
    partidas,
    gastos,
    snapshots,
    snapshotDetail,
    resumenNativo,
    proyectoMeta,
    load,
    loadSnapshot,
    deleteSnapshot,
  } = useLuloProyectoData(pid);

  const [tab, setTab] = useState<TabLuloId>('presupuesto');
  const [tablaMdbSeleccionada, setTablaMdbSeleccionada] = useState('');
  const [filtrosPartidas, setFiltrosPartidas] = useState<FiltrosPartidasObra>(FILTROS_INICIAL);
  const [vistaAgrupacion, setVistaAgrupacion] = useState<VistaAgrupacionLulo>('capitulos');
  const [reporteVariant, setReporteVariant] = useState<'app' | 'report' | 'representante'>('report');
  const [mostrarDetalleReporte, setMostrarDetalleReporte] = useState(false);
  const [analisisGemini, setAnalisisGemini] = useState<string | null>(null);
  const [analisisGeminiMeta, setAnalisisGeminiMeta] = useState<string | null>(null);
  const [analisisGeminiLoading, setAnalisisGeminiLoading] = useState(false);
  const [apuPartidaId, setApuPartidaId] = useState<string | null>(null);

  useEffect(() => {
    const t = tabLuloDesdeQuery(searchParams.get('tab'));
    if (t) setTab(t);
  }, [searchParams]);

  const mdbTables = useMemo(() => snapshotDetail?.payload?.tables ?? [], [snapshotDetail]);
  const csvRows = useMemo(() => snapshotDetail?.payload?.rows ?? [], [snapshotDetail]);

  const tablaMdbActiva = useMemo(
    () => mdbTables.find((t) => t.name === tablaMdbSeleccionada) ?? mdbTables[0] ?? null,
    [mdbTables, tablaMdbSeleccionada],
  );

  useEffect(() => {
    if (tablaMdbActiva?.name && !tablaMdbSeleccionada) {
      setTablaMdbSeleccionada(tablaMdbActiva.name);
    }
  }, [tablaMdbActiva?.name, tablaMdbSeleccionada]);

  const columnasMdb: LuloColumnaDef[] = useMemo(
    () => (tablaMdbActiva?.columns ?? []).map((c) => ({ key: c, label: c, maxWidth: 200 })),
    [tablaMdbActiva],
  );

  const keysPartidas = useMemo(() => COLUMNAS_PARTIDAS.map((c) => c.key), []);

  const capitulosDisponibles = useMemo(() => {
    const set = new Set(partidas.map((p) => getCapituloKeyPartida(p)));
    return Array.from(set).filter((c) => c !== '—').sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [partidas]);

  const mdbDumpCompleto = useMemo(
    () => payloadComoMdbDump(snapshotDetail?.payload),
    [snapshotDetail],
  );

  const partidasFiltradas = useMemo(() => {
    const base = partidas.map((p) => ({ ...p } as Record<string, unknown>));
    return filtrarPartidasObra(base, keysPartidas, filtrosPartidas) as LuloPartida[];
  }, [partidas, keysPartidas, filtrosPartidas]);

  const gruposPartidas = useMemo(() => {
    if (tab !== 'partidas' || vistaAgrupacion === 'partidas') return null;
    if (vistaAgrupacion === 'capitulos') return agruparPartidasPorCapitulo(partidasFiltradas);
    return agruparPartidasPorRubro(partidasFiltradas);
  }, [tab, vistaAgrupacion, partidasFiltradas]);

  const filasPartidasPlanas = useMemo(() => {
    if (tab !== 'partidas' || vistaAgrupacion !== 'partidas') return [];
    return ordenarPartidasPorCapitulos(partidasFiltradas);
  }, [tab, vistaAgrupacion, partidasFiltradas]);

  const totalPartidas = partidas.reduce((s, p) => s + Number(p.monto_total_estimado), 0);
  const totalPartidasFiltradas = partidasFiltradas.reduce(
    (s, p) => s + Number(p.monto_total_estimado ?? 0),
    0,
  );

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

  const abrirSnapshot = useCallback(
    async (id: string, irATablas = false) => {
      await loadSnapshot(id);
      if (irATablas) setTab('tablas');
    },
    [loadSnapshot],
  );

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
        data.desdeGemini ? 'Análisis con Gemini.' : 'Modo local (sin API o fallback).',
      );
    } catch (e) {
      setAnalisisGemini(formatErrorMessage(e));
    } finally {
      setAnalisisGeminiLoading(false);
    }
  }

  const renderFilaPartida = (row: Record<string, unknown>) => {
    const p = row as unknown as LuloPartida;
    const id = String(p.id);
    return (
      <tr key={id} className="border-t border-white/5 hover:bg-white/[0.02]">
        <td className="px-3 py-2 font-mono text-zinc-500 text-center">{p.capitulo_codigo ?? '—'}</td>
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
            className="text-violet-400 hover:text-violet-300"
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
    );
  };

  const columnasConApu: LuloColumnaDef[] = [
    ...COLUMNAS_PARTIDAS,
    { key: '_apu', label: 'APU', align: 'center' },
  ];

  const tabs: { id: TabLuloId; label: string }[] = [
    { id: 'importar', label: 'Importar MDB' },
    { id: 'presupuesto', label: `Presupuesto Lulo (${partidas.length})` },
    { id: 'partidas', label: `Partidas (${partidas.length})` },
    { id: 'volcado', label: 'Volcado por capítulos' },
    { id: 'tablas', label: `Explorar tablas (${mdbTables.length || '—'})` },
  ];

  return (
    <div className="space-y-6 text-white max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start gap-4">
        <Link
          href={`/proyectos/modulo/${pid}`}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:bg-white/5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al módulo
        </Link>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-sky-400" />
            <h1 className="text-xl font-bold tracking-tight">MÓDULO LULO</h1>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            {proyectoNombre ?? proyectoMeta?.nombre ?? 'Proyecto'} · importación y visualización del
            presupuesto Access (.mdb)
            {proyectoMeta?.codigo_lulo ? (
              <span className="text-sky-400/90"> · Obra {proyectoMeta.codigo_lulo}</span>
            ) : null}
          </p>
        </div>
        <Link
          href={`/proyectos/modulo/${pid}/control-obra`}
          className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
        >
          Control de obra →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Partidas</p>
          <p className="text-lg font-bold text-emerald-400">{partidas.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Gastos importados</p>
          <p className="text-lg font-bold text-sky-400">{gastos.length}</p>
        </div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Líneas APU</p>
          <p className="text-lg font-bold text-violet-300">{resumenNativo.apuLineas}</p>
        </div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Insumos en obra</p>
          <p className="text-lg font-bold text-violet-300">{resumenNativo.insumosEnApu}</p>
        </div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Volcados MDB</p>
          <p className="text-lg font-bold text-sky-300">{snapshots.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Total presupuesto</p>
          <p className="text-sm font-bold text-amber-200 mt-0.5">{fmtUsd(totalPartidas)}</p>
        </div>
      </div>

      {hayVolcadoSinPartidas ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-4 text-sm text-amber-100/90">
          <p className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0" />
            Hay volcado guardado, pero el cuadro de partidas está vacío
          </p>
          <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-amber-200/80">
            <li>
              Ve a{' '}
              <button type="button" className="underline hover:text-white" onClick={() => setTab('importar')}>
                Importar MDB
              </button>{' '}
              y confirma la tabla <strong>PARTIDAS</strong> (o el mapeo sugerido).
            </li>
            <li>
              Revisa{' '}
              <button type="button" className="underline hover:text-white" onClick={() => setTab('volcado')}>
                Volcado por capítulos
              </button>{' '}
              o{' '}
              <button type="button" className="underline hover:text-white" onClick={() => setTab('tablas')}>
                Explorar tablas
              </button>{' '}
              para ver el archivo crudo.
            </li>
          </ol>
        </div>
      ) : null}

      {snapshots.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Archivos Lulo guardados</p>
          <div className="flex flex-wrap gap-2">
            {snapshots.map((s) => (
              <div key={s.id} className="inline-flex items-center gap-0.5 rounded-lg border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => void abrirSnapshot(s.id, s.formato === 'mdb')}
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

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-sky-500/15 text-sky-100 border border-sky-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-8 text-zinc-500 text-sm" role="status">
          <Settings className="h-8 w-8 animate-spin text-sky-400" />
          <span>Cargando módulo Lulo…</span>
        </div>
      ) : null}

      {!loading && tab === 'importar' ? (
        <div className="space-y-4">
          <ImportarPresupuestoLulo proyectoId={pid} onSuccess={() => void load()} />
          <p className="text-xs text-zinc-500">
            La extracción completa guarda un volcado de todas las tablas Access. Después de importar,
            usa las pestañas Presupuesto, Partidas o Explorar tablas.
          </p>
        </div>
      ) : null}

      {!loading && tab === 'partidas' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/50 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase text-zinc-500 shrink-0">Ver por</span>
            {VISTAS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setVistaAgrupacion(o.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  vistaAgrupacion === o.id
                    ? 'bg-sky-500/20 text-sky-100 border border-sky-500/35'
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                className={inputCls('min-w-[120px] flex-1 max-w-[160px]')}
                placeholder="Código contiene…"
                value={filtrosPartidas.codigo ?? ''}
                onChange={(e) => setFiltrosPartidas({ ...filtrosPartidas, codigo: e.target.value })}
              />
              {capitulosDisponibles.length > 0 ? (
                <select
                  value={filtrosPartidas.capitulo ?? ''}
                  onChange={(e) => setFiltrosPartidas({ ...filtrosPartidas, capitulo: e.target.value })}
                  className={inputCls('min-w-[120px]')}
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
                placeholder="Búsqueda global…"
                value={filtrosPartidas.busqueda}
                onChange={(e) => setFiltrosPartidas({ ...filtrosPartidas, busqueda: e.target.value })}
              />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">
            Mostrando {partidasFiltradas.length} de {partidas.length} · subtotal:{' '}
            {fmtUsd(totalPartidasFiltradas)}
          </p>
          {vistaAgrupacion === 'partidas' ? (
            <LuloTablaFiltrable
              titulo="Partidas de presupuesto"
              columnas={columnasConApu}
              filas={filasPartidasPlanas as unknown as Record<string, unknown>[]}
              vacio="Sin partidas. Importa un MDB en la pestaña Importar."
              renderFila={renderFilaPartida}
            />
          ) : gruposPartidas && gruposPartidas.length > 0 ? (
            <div className="space-y-5">
              {gruposPartidas.map((grupo) => (
                <div key={grupo.clave} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/25 bg-sky-950/25 px-3 py-2">
                    <h4 className="text-xs font-semibold text-sky-100">{grupo.etiqueta}</h4>
                    <span className="text-[11px] font-mono text-sky-200/90">
                      {grupo.items.length} filas · {fmtUsd(grupo.subtotal)}
                    </span>
                  </div>
                  <LuloTablaFiltrable
                    columnas={columnasConApu}
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
            <p className="text-[11px] text-zinc-500">Reporte estilo impresión Lulo · {partidas.length} partidas</p>
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
                    ? 'border-sky-500/40 bg-sky-950/40 text-sky-100'
                    : 'border-white/10 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {mostrarDetalleReporte ? 'Ocultar detalle' : 'Ver detalle partidas'}
              </button>
              <button
                type="button"
                onClick={() => void consultarAnalisisGemini()}
                disabled={analisisGeminiLoading || partidas.length === 0}
                className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-1.5 text-[11px] font-semibold text-sky-100 hover:bg-sky-900/50 disabled:opacity-50"
              >
                {analisisGeminiLoading ? 'Analizando…' : 'Interpretar con Gemini'}
              </button>
              <div className="flex gap-1 rounded-lg border border-white/10 p-0.5 text-[11px]">
                {(['report', 'app', 'representante'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setReporteVariant(v)}
                    className={`rounded-md px-2.5 py-1 ${
                      reporteVariant === v ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {v === 'report' ? 'Impresión Lulo' : v === 'app' ? 'Tema app' : 'Representante'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {analisisGemini ? (
            <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 px-4 py-3 text-sm text-sky-50/90 whitespace-pre-wrap">
              {analisisGeminiMeta ? (
                <p className="text-[10px] text-sky-200/60 mb-2">{analisisGeminiMeta}</p>
              ) : null}
              {analisisGemini}
            </div>
          ) : null}
          {partidas.length === 0 ? (
            <p className="text-sm text-zinc-500 rounded-xl border border-dashed border-white/10 py-12 text-center">
              Sin partidas. Importa un MDB en la pestaña Importar.
            </p>
          ) : reporteVariant === 'representante' ? (
            <ResumenPresupuestoCapitulos {...resumenRepresentante} className="print:shadow-none" />
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

      {!loading && tab === 'volcado' ? (
        <div className="space-y-4">
          {!snapshotDetail ? (
            <p className="text-sm text-zinc-500">
              Importa un MDB o selecciona un archivo guardado arriba para ver el volcado agrupado por
              capítulos como en Lulo.
            </p>
          ) : mdbTables.length > 0 ? (
            <>
              <p className="text-xs text-zinc-500">
                Archivo:{' '}
                <span className="text-zinc-300 font-medium">{snapshotDetail.nombre_archivo}</span>
              </p>
              {mdbDumpCompleto && tablaMdbActiva && esTablaPartidasMdb(tablaMdbActiva.name) ? (
                <LuloVolcadoPorCapitulos
                  dump={mdbDumpCompleto}
                  tablaPartidas={tablaMdbActiva}
                  columnas={columnasMdb}
                />
              ) : (
                <p className="text-sm text-amber-200/80 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2">
                  Este volcado no tiene tabla PARTIDAS identificada. Usa{' '}
                  <button type="button" className="underline" onClick={() => setTab('tablas')}>
                    Explorar tablas
                  </button>{' '}
                  o reimporta seleccionando PARTIDAS.
                </p>
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

      {!loading && tab === 'tablas' ? (
        <div className="space-y-4">
          {!snapshotDetail ? (
            <p className="text-sm text-zinc-500 flex items-center gap-2">
              <Table2 className="h-4 w-4" />
              Importa un MDB o selecciona un volcado guardado para explorar todas las tablas Access.
            </p>
          ) : mdbTables.length > 0 && tablaMdbActiva ? (
            <>
              <LuloCatalogoTablasMdb
                tablas={mdbTables}
                tablaActiva={tablaMdbActiva.name}
                onSeleccionar={setTablaMdbSeleccionada}
              />
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

      <ApuPartidaDetalleModal partidaId={apuPartidaId} onClose={() => setApuPartidaId(null)} />
    </div>
  );
}
