'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Package, RefreshCw, Search } from 'lucide-react';
import type { FilaLoComprado, ResumenLoComprado } from '@/lib/almacen/cargarLoComprado';
import {
  rangoFechasPeriodo,
  todayIso,
  type PeriodoCompras,
} from '@/lib/contabilidad/comprasFiltros';

const PERIODO_LABEL: Record<PeriodoCompras, string> = {
  todas: 'Todas',
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
  rango: 'Rango',
};

type EntidadOpt = { id: string; nombre: string };
type ProyectoOpt = { id: string; nombre: string; entidad_id?: string | null };

function fmtCantidad(n: number): string {
  return n.toLocaleString('es-VE', { maximumFractionDigits: 2 });
}

function hrefComprasArticulo(fila: FilaLoComprado): string {
  const qs = new URLSearchParams();
  if (fila.proyecto_id) qs.set('proyecto', fila.proyecto_id);
  if (fila.entidad_id) qs.set('entidad', fila.entidad_id);
  qs.set('articulo', fila.descripcion);
  qs.set('vista', 'lineas');
  return `/contabilidad/compras?${qs.toString()}`;
}

export default function LoCompradoCuadro() {
  const [entidades, setEntidades] = useState<EntidadOpt[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoOpt[]>([]);
  const [entidadId, setEntidadId] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoCompras>('todas');
  const [refDate, setRefDate] = useState(todayIso);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenLoComprado | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [entRes, proyRes] = await Promise.all([
          fetch('/api/almacen/entidades', { cache: 'no-store' }),
          fetch('/api/almacen/proyectos', { cache: 'no-store' }),
        ]);
        const entJson = (await entRes.json()) as { entidades?: EntidadOpt[] };
        const proyJson = (await proyRes.json()) as { proyectos?: ProyectoOpt[] };
        if (cancelled) return;
        setEntidades(entJson.entidades ?? []);
        setProyectos(proyJson.proyectos ?? []);
      } catch {
        /* catálogo opcional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const proyectosFiltrados = useMemo(() => {
    if (!entidadId) return proyectos;
    return proyectos.filter((p) => !p.entidad_id || p.entidad_id === entidadId);
  }, [proyectos, entidadId]);

  useEffect(() => {
    if (proyectoId && !proyectosFiltrados.some((p) => p.id === proyectoId)) {
      setProyectoId('');
    }
  }, [proyectoId, proyectosFiltrados]);

  const rango = useMemo(
    () => rangoFechasPeriodo(periodo, refDate),
    [periodo, refDate],
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (proyectoId) qs.set('proyecto_id', proyectoId);
      if (entidadId) qs.set('entidad_id', entidadId);
      if (rango) {
        qs.set('desde', rango.desde);
        qs.set('hasta', rango.hasta);
      }
      if (qDebounced) qs.set('q', qDebounced);

      const res = await fetch(`/api/almacen/lo-comprado?${qs.toString()}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filas?: FilaLoComprado[];
        total_articulos?: number;
        total_lineas?: number;
        total_compras?: number;
        compras_escaneadas?: number;
        compras_omitidas_auditoria?: number;
      };
      if (!res.ok || json.ok === false || !Array.isArray(json.filas)) {
        throw new Error(json.error ?? 'No se pudo cargar lo comprado');
      }
      setResumen({
        ok: true,
        filas: json.filas,
        total_articulos: json.total_articulos ?? json.filas.length,
        total_lineas: json.total_lineas ?? 0,
        total_compras: json.total_compras ?? 0,
        compras_escaneadas: json.compras_escaneadas ?? 0,
        compras_omitidas_auditoria: json.compras_omitidas_auditoria ?? 0,
      });
    } catch (e) {
      setResumen(null);
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [proyectoId, entidadId, rango, qDebounced]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const periodos: PeriodoCompras[] = ['todas', 'dia', 'semana', 'mes'];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Package className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Filtros · lo comprado
          </span>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1.5 block">
              Entidad
            </span>
            <select
              value={entidadId}
              onChange={(e) => setEntidadId(e.target.value)}
              className="w-full rounded-xl border border-violet-500/30 bg-black/50 px-3 py-2.5 text-sm font-bold text-white"
            >
              <option value="">Todas</option>
              {entidades.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-1.5 block">
              Obra
            </span>
            <select
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              className="w-full rounded-xl border border-sky-500/30 bg-black/50 px-3 py-2.5 text-sm font-bold text-white"
            >
              <option value="">Todas</option>
              {proyectosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1.5 block">
              Periodo
            </span>
            <div className="flex flex-wrap gap-1.5">
              {periodos.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  className={`rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-wide ${
                    periodo === p
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                      : 'border border-white/10 text-zinc-500 hover:text-white'
                  }`}
                >
                  {PERIODO_LABEL[p]}
                </button>
              ))}
            </div>
            {periodo !== 'todas' ? (
              <input
                type="date"
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
              />
            ) : null}
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1.5 block">
              Buscar artículo
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="cabilla, cemento…"
                className="w-full rounded-xl border border-emerald-500/30 bg-black/50 pl-9 pr-3 py-2.5 text-sm font-bold text-white placeholder:text-zinc-600"
              />
            </div>
          </label>
        </div>
      </div>

      {resumen ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Artículos', value: resumen.total_articulos },
            { label: 'Líneas', value: resumen.total_lineas },
            { label: 'Compras', value: resumen.total_compras },
            { label: 'Omitidas (CCO)', value: resumen.compras_omitidas_auditoria },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {k.label}
              </p>
              <p className="text-lg font-black text-white tabular-nums">{k.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
          <Loader2 className="animate-spin text-emerald-400" size={22} />
          Calculando lo comprado…
        </div>
      ) : null}

      {!loading && resumen && resumen.filas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-zinc-500">
          No hay cantidades compradas con estos filtros.
          <div className="mt-3">
            <Link
              href="/contabilidad/compras"
              className="text-emerald-400 font-bold hover:underline"
            >
              Ir al cuadro de compras →
            </Link>
          </div>
        </div>
      ) : null}

      {!loading && resumen && resumen.filas.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="px-3 py-3">Artículo</th>
                <th className="px-3 py-3">Obra</th>
                <th className="px-3 py-3 text-right">Cantidad</th>
                <th className="px-3 py-3">Und</th>
                <th className="px-3 py-3 text-right">Facturas</th>
                <th className="px-3 py-3 text-right">Líneas</th>
              </tr>
            </thead>
            <tbody>
              {resumen.filas.map((fila) => (
                <tr
                  key={fila.clave}
                  className="border-t border-white/[0.04] hover:bg-white/[0.03]"
                >
                  <td className="px-3 py-3 align-top">
                    <Link
                      href={hrefComprasArticulo(fila)}
                      className="font-bold text-white hover:text-emerald-300"
                    >
                      {fila.descripcion}
                    </Link>
                    {fila.item_code ? (
                      <p className="text-[11px] text-zinc-500 mt-0.5">{fila.item_code}</p>
                    ) : null}
                    {fila.descripciones_variantes.length > 0 ? (
                      <p className="text-[10px] text-amber-500/80 mt-1">
                        También: {fila.descripciones_variantes.slice(0, 3).join(' · ')}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top text-zinc-300">
                    <div>{fila.proyecto_nombre ?? 'Sin obra'}</div>
                    {fila.entidad_nombre ? (
                      <p className="text-[10px] text-zinc-500 mt-0.5">{fila.entidad_nombre}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top text-right font-black text-emerald-300 tabular-nums">
                    {fmtCantidad(fila.cantidad_comprada)}
                  </td>
                  <td className="px-3 py-3 align-top text-zinc-400">{fila.unidad}</td>
                  <td className="px-3 py-3 align-top text-right text-zinc-300 tabular-nums">
                    {fila.compras_count}
                  </td>
                  <td className="px-3 py-3 align-top text-right text-zinc-300 tabular-nums">
                    {fila.lineas_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
