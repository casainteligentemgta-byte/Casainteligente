'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Route,
  Search,
} from 'lucide-react';
import type { FilaTrazabilidadEstrategica } from '@/lib/almacen/listarTrazabilidadEstrategica';
import {
  buildTrazabilidadCuadroSearchParams,
  guardarTrazabilidadCuadroFiltros,
  hasTrazabilidadCuadroShareParams,
  leerTrazabilidadCuadroFiltrosGuardados,
  parseTrazabilidadCuadroShareParams,
  type TipoMovimientoTrazabilidadFiltro,
  type TrazabilidadCuadroShareState,
} from '@/lib/almacen/trazabilidadCuadroShare';
import { exportarTrazabilidadExcel } from '@/lib/almacen/trazabilidadExport';
import {
  badgeClasesTipoMovimientoTrazabilidad,
  OPCIONES_TIPO_TRAZABILIDAD,
} from '@/lib/almacen/trazabilidadTiposCuadro';
import {
  filtrarProyectosPorEntidad,
  loadEntidades,
  loadProyectos,
  type EntidadRow,
  type ProyectoRow,
} from '@/lib/almacen/inventoryClasificacion';
import { createClient } from '@/lib/supabase/client';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#FF9500]/50';

const DEFAULT_STATE: TrazabilidadCuadroShareState = {
  materialFiltro: '',
  proyectoFiltro: '',
  tipoMovimientoFiltro: '',
  fechaDesde: '',
  fechaHasta: '',
  pagina: 1,
  pageSize: 50,
};

function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-VE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TrazabilidadEstrategicaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const shareParamsAplicados = useRef(false);
  const filtrosPersistenciaLista = useRef(false);

  const [materialInput, setMaterialInput] = useState('');
  const [materialFiltro, setMaterialFiltro] = useState('');
  const [proyectoFiltro, setProyectoFiltro] = useState('');
  const [entidadFiltro, setEntidadFiltro] = useState('');
  const [tipoMovimientoFiltro, setTipoMovimientoFiltro] =
    useState<TipoMovimientoTrazabilidadFiltro>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [pageSize] = useState(50);

  const [filas, setFilas] = useState<FilaTrazabilidadEstrategica[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const [entidades, setEntidades] = useState<EntidadRow[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);

  const aplicarFiltrosCuadro = useCallback((parsed: Partial<TrazabilidadCuadroShareState>) => {
    if (parsed.materialFiltro != null) {
      setMaterialInput(parsed.materialFiltro);
      setMaterialFiltro(parsed.materialFiltro);
    }
    if (parsed.proyectoFiltro != null) setProyectoFiltro(parsed.proyectoFiltro);
    if (parsed.tipoMovimientoFiltro != null) setTipoMovimientoFiltro(parsed.tipoMovimientoFiltro);
    if (parsed.fechaDesde != null) setFechaDesde(parsed.fechaDesde);
    if (parsed.fechaHasta != null) setFechaHasta(parsed.fechaHasta);
    if (parsed.pagina != null) setPagina(parsed.pagina);
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || shareParamsAplicados.current) return;
    shareParamsAplicados.current = true;

    const fromUrl = hasTrazabilidadCuadroShareParams(searchParams)
      ? parseTrazabilidadCuadroShareParams(searchParams)
      : null;
    const fromStorage = !fromUrl ? leerTrazabilidadCuadroFiltrosGuardados() : null;
    aplicarFiltrosCuadro(fromUrl ?? fromStorage ?? {});
    filtrosPersistenciaLista.current = true;
  }, [hydrated, searchParams, aplicarFiltrosCuadro]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMaterialFiltro(materialInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [materialInput]);

  useEffect(() => {
    const supabase = createClient();
    void loadEntidades(supabase).then(setEntidades).catch(() => setEntidades([]));
    void loadProyectos(supabase).then(setProyectos).catch(() => setProyectos([]));
  }, []);

  const proyectosFiltrados = useMemo(
    () => filtrarProyectosPorEntidad(proyectos, entidadFiltro),
    [proyectos, entidadFiltro],
  );

  const estadoCompartir = useMemo<TrazabilidadCuadroShareState>(
    () => ({
      materialFiltro,
      proyectoFiltro,
      tipoMovimientoFiltro,
      fechaDesde,
      fechaHasta,
      pagina,
      pageSize,
    }),
    [
      materialFiltro,
      proyectoFiltro,
      tipoMovimientoFiltro,
      fechaDesde,
      fechaHasta,
      pagina,
      pageSize,
    ],
  );

  useEffect(() => {
    if (!hydrated || !filtrosPersistenciaLista.current) return;
    guardarTrazabilidadCuadroFiltros(estadoCompartir);
    const qs = buildTrazabilidadCuadroSearchParams(estadoCompartir).toString();
    const next = qs ? `/almacen/trazabilidad?${qs}` : '/almacen/trazabilidad';
    router.replace(next, { scroll: false });
  }, [hydrated, estadoCompartir, router]);

  const queryApi = useMemo(() => {
    const p = buildTrazabilidadCuadroSearchParams(estadoCompartir);
    return p.toString();
  }, [estadoCompartir]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/almacen/trazabilidad/cuadro?${queryApi}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar trazabilidad');
      setFilas(json.filas ?? []);
      setTotal(json.total ?? 0);
      setTotalPaginas(json.totalPaginas ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
      setTotal(0);
      setTotalPaginas(1);
    } finally {
      setLoading(false);
    }
  }, [queryApi]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const limpiarFiltros = useCallback(() => {
    setMaterialInput('');
    setMaterialFiltro('');
    setProyectoFiltro('');
    setEntidadFiltro('');
    setTipoMovimientoFiltro('');
    setFechaDesde('');
    setFechaHasta('');
    setPagina(1);
  }, []);

  const exportarFiltrado = useCallback(
    async (formato: 'csv' | 'excel') => {
      setExportando(true);
      setError(null);
      try {
        const p = buildTrazabilidadCuadroSearchParams({ ...estadoCompartir, pagina: 1 });
        p.set('pageSize', '5000');
        if (formato === 'csv') p.set('export', 'csv');

        if (formato === 'csv') {
          const res = await fetch(`/api/almacen/trazabilidad/cuadro?${p.toString()}`, {
            cache: 'no-store',
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error ?? 'Error al exportar CSV');
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `trazabilidad-${new Date().toISOString().slice(0, 10)}.csv`;
          anchor.click();
          URL.revokeObjectURL(url);
          return;
        }

        p.delete('export');
        const res = await fetch(`/api/almacen/trazabilidad/cuadro?${p.toString()}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Error al exportar');
        const exportFilas: FilaTrazabilidadEstrategica[] = json.filas ?? [];
        if (!exportarTrazabilidadExcel(exportFilas)) {
          setError('No hay movimientos para exportar con los filtros actuales.');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al exportar');
      } finally {
        setExportando(false);
      }
    },
    [estadoCompartir],
  );

  const filtrosActivos = useMemo(() => {
    const activos: string[] = [];
    if (materialFiltro) activos.push('material');
    if (proyectoFiltro) activos.push('obra');
    if (tipoMovimientoFiltro) activos.push('tipo');
    if (fechaDesde) activos.push('desde');
    if (fechaHasta) activos.push('hasta');
    return activos;
  }, [materialFiltro, proyectoFiltro, tipoMovimientoFiltro, fechaDesde, fechaHasta]);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6 pb-24">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/almacen">
              <button
                type="button"
                className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all"
                aria-label="Volver al almacén"
              >
                <ArrowLeft size={20} />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter flex items-center gap-2">
                <Route className="text-[#FF9500]" size={28} />
                Trazabilidad Estratégica
              </h1>
              <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest mt-1">
                Ciclo de vida completo · entradas, salidas y stock auditado
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void cargar()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => void exportarFiltrado('csv')}
              disabled={exportando || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {exportando ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              CSV
            </button>
            <button
              type="button"
              onClick={() => void exportarFiltrado('excel')}
              disabled={exportando || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
            >
              Excel
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFiltrosAbiertos((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/5"
            >
              <Filter size={16} className="text-[#FF9500]" />
              Filtros
              {filtrosActivos.length ? (
                <span className="rounded-full bg-[#FF9500]/20 px-2 py-0.5 text-xs text-[#FF9500]">
                  {filtrosActivos.length}
                </span>
              ) : null}
            </button>
            {filtrosActivos.length ? (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>

          {filtrosAbiertos ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Material
                </span>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    className={`${inputClass} pl-9`}
                    placeholder="Nombre o código SAP"
                    value={materialInput}
                    onChange={(e) => {
                      setMaterialInput(e.target.value);
                      setPagina(1);
                    }}
                  />
                </div>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Entidad
                </span>
                <select
                  className={inputClass}
                  value={entidadFiltro}
                  onChange={(e) => {
                    setEntidadFiltro(e.target.value);
                    setProyectoFiltro('');
                    setPagina(1);
                  }}
                >
                  <option value="">Todas</option>
                  {entidades.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Obra / Proyecto
                </span>
                <select
                  className={inputClass}
                  value={proyectoFiltro}
                  onChange={(e) => {
                    setProyectoFiltro(e.target.value);
                    setPagina(1);
                  }}
                >
                  <option value="">Todas las obras</option>
                  {proyectosFiltrados.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Tipo de movimiento
                </span>
                <select
                  className={inputClass}
                  value={tipoMovimientoFiltro}
                  onChange={(e) => {
                    setTipoMovimientoFiltro(e.target.value as TipoMovimientoTrazabilidadFiltro);
                    setPagina(1);
                  }}
                >
                  {OPCIONES_TIPO_TRAZABILIDAD.map((o) => (
                    <option key={o.value || 'todos'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Desde
                </span>
                <input
                  type="date"
                  className={inputClass}
                  value={fechaDesde}
                  onChange={(e) => {
                    setFechaDesde(e.target.value);
                    setPagina(1);
                  }}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Hasta
                </span>
                <input
                  type="date"
                  className={inputClass}
                  value={fechaHasta}
                  onChange={(e) => {
                    setFechaHasta(e.target.value);
                    setPagina(1);
                  }}
                />
              </label>
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/10 overflow-hidden bg-zinc-950/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-black/40 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 font-bold">Fecha / Hora</th>
                  <th className="px-4 py-3 font-bold">Material</th>
                  <th className="px-4 py-3 font-bold">Origen / Documento</th>
                  <th className="px-4 py-3 font-bold">Tipo</th>
                  <th className="px-4 py-3 font-bold text-right">Cantidad</th>
                  <th className="px-4 py-3 font-bold">Destino / Responsable</th>
                  <th className="px-4 py-3 font-bold text-right">Stock resultante</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-zinc-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin text-[#FF9500]" size={18} />
                        Cargando movimientos…
                      </span>
                    </td>
                  </tr>
                ) : filas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-zinc-500">
                      No hay movimientos con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filas.map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] align-top"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-300">
                        {formatearFechaHora(f.fechaHora)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{f.materialNombre}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {f.materialCodigo ? `SAP ${f.materialCodigo}` : 'Sin código'}
                          {' · '}
                          <Link
                            href={`/almacen/trazabilidad?materialId=${encodeURIComponent(f.materialId)}`}
                            className="text-[#FF9500] hover:underline"
                          >
                            Ver ruta
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 max-w-[220px]">
                        {f.origenEnlace ? (
                          <Link href={f.origenEnlace} className="text-sky-300 hover:underline">
                            {f.origenDocumento}
                          </Link>
                        ) : (
                          f.origenDocumento
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClasesTipoMovimientoTrazabilidad(f.tipoMovimiento)}`}
                        >
                          {f.tipoEtiqueta}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-semibold ${
                          f.cantidad >= 0 ? 'text-emerald-300' : 'text-red-300'
                        }`}
                      >
                        {f.cantidad >= 0 ? '+' : '−'}
                        {f.cantidadAbsoluta.toLocaleString('es-VE')} {f.unidad}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 max-w-[240px]">
                        {f.destinoResponsable}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sky-200">
                        {f.stockResultante.toLocaleString('es-VE')} {f.unidad}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 px-4 py-3 bg-black/30">
            <p className="text-xs text-zinc-500">
              {total.toLocaleString('es-VE')} movimiento(s) · Página {pagina} de {totalPaginas}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagina <= 1 || loading}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:bg-white/5"
              >
                <ChevronLeft size={14} />
                Anterior
              </button>
              <button
                type="button"
                disabled={pagina >= totalPaginas || loading}
                onClick={() => setPagina((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:bg-white/5"
              >
                Siguiente
                <ChevronRight size={14} />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
