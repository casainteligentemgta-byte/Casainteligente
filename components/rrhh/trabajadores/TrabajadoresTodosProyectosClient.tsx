'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  etiquetaEstadoArchivo,
  fetchTrabajadoresTodosProyectos,
  filtrarTrabajadoresPorProyecto,
  type ProyectoTrabajadorOpcion,
  type TrabajadorPorProyectoRow,
} from '@/lib/rrhh/trabajadoresPorProyecto';
import { createClient } from '@/lib/supabase/client';

const SIN_PROYECTO = '__sin_proyecto__';

function docMostrado(row: TrabajadorPorProyectoRow): string {
  return (row.cedula ?? row.documento ?? '').trim() || '—';
}

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-VE', { dateStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function TrabajadoresTodosProyectosClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [proyectos, setProyectos] = useState<ProyectoTrabajadorOpcion[]>([]);
  const [trabajadores, setTrabajadores] = useState<TrabajadorPorProyectoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const proyectoFiltro = (searchParams.get('proyecto') ?? '').trim() || null;

  const setProyectoFiltro = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!id) params.delete('proyecto');
      else params.set('proyecto', id);
      const q = params.toString();
      router.replace(q ? `/rrhh/trabajadores?${q}` : '/rrhh/trabajadores', { scroll: false });
    },
    [router, searchParams],
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchTrabajadoresTodosProyectos(supabase);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      setProyectos([]);
      setTrabajadores([]);
      return;
    }
    setProyectos(res.proyectos);
    setTrabajadores(res.trabajadores);
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtrados = useMemo(
    () => filtrarTrabajadoresPorProyecto(trabajadores, proyectoFiltro, busqueda),
    [trabajadores, proyectoFiltro, busqueda],
  );

  const conteoPorProyecto = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trabajadores) {
      for (const pid of t.proyectoIds) {
        m.set(pid, (m.get(pid) ?? 0) + 1);
      }
    }
    return m;
  }, [trabajadores]);

  const sinProyectoCount = useMemo(
    () => trabajadores.filter((t) => t.proyectoIds.length === 0).length,
    [trabajadores],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Casa Inteligente · RRHH</p>

      <header className="mb-6 mt-4">
        <Link
          href="/rrhh/hojas-vida"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          SMART RRHH
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
              <Users className="h-7 w-7 text-fuchsia-300" aria-hidden />
              Trabajadores por proyecto
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Todos los trabajadores registrados, vinculados por módulo, vacante, asignación en obra o solicitud de
              personal. Filtra por proyecto u obra.
            </p>
            {!loading ? (
              <p className="mt-1 text-xs text-zinc-500">
                {filtrados.length} de {trabajadores.length} trabajador(es)
                {proyectoFiltro && proyectoFiltro !== SIN_PROYECTO
                  ? ` · ${proyectos.find((p) => p.id === proyectoFiltro)?.nombre ?? 'Proyecto'}`
                  : proyectoFiltro === SIN_PROYECTO
                    ? ' · sin proyecto'
                    : ''}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Actualizar
          </button>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-white/10 bg-zinc-900/40 p-4 backdrop-blur-xl sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Proyecto / obra</span>
            <select
              value={proyectoFiltro ?? ''}
              onChange={(e) => setProyectoFiltro(e.target.value || null)}
              style={{ colorScheme: 'dark' }}
              className="ci-select-tabulador mt-1.5 w-full min-h-[44px] cursor-pointer rounded-xl border-2 border-fuchsia-500/40 bg-zinc-950 px-3 py-2.5 text-sm font-medium text-zinc-50 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/35"
            >
              <option value="">Todos los proyectos ({trabajadores.length})</option>
              <option value={SIN_PROYECTO}>Sin proyecto asignado ({sinProyectoCount})</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({conteoPorProyecto.get(p.id) ?? 0})
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Buscar</span>
            <div className="relative mt-1.5">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                aria-hidden
              />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, cédula, cargo o proyecto…"
                className="w-full min-h-[44px] rounded-xl border-2 border-zinc-600/80 bg-zinc-950 py-2.5 pl-10 pr-3 text-sm text-zinc-50 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/35"
              />
            </div>
          </label>
        </div>
      </section>

      {loading && trabajadores.length === 0 ? (
        <p className="text-sm text-zinc-500">Cargando trabajadores…</p>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {!loading && !error && filtrados.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-zinc-500">
          No hay trabajadores con los filtros actuales.
        </p>
      ) : null}

      {filtrados.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/30 backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-zinc-950/80 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Proyecto(s)</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => {
                  const nombre = (r.nombre_completo ?? '').trim() || 'Sin nombre';
                  const estadoEtiqueta = etiquetaEstadoArchivo(r);
                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">
                        <Link
                          href={`/empleados/${encodeURIComponent(r.id)}`}
                          className="text-sky-300 underline decoration-sky-500/30 hover:text-sky-200"
                        >
                          {nombre}
                        </Link>
                        <p className="mt-0.5 text-[10px] text-zinc-600">{fechaCorta(r.created_at)}</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-300">{docMostrado(r)}</td>
                      <td className="px-4 py-3 text-zinc-300">{(r.cargo_nombre ?? '').trim() || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                          {estadoEtiqueta}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.proyectoIds.length === 0 ? (
                          <span className="text-xs text-zinc-600">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.proyectoIds.map((pid, i) => (
                              <button
                                key={pid}
                                type="button"
                                onClick={() => setProyectoFiltro(pid)}
                                className="max-w-[12rem] truncate rounded-md border border-violet-500/30 bg-violet-950/40 px-2 py-0.5 text-[10px] font-semibold text-violet-100 hover:bg-violet-900/50"
                                title={`Filtrar por ${r.proyectoNombres[i] ?? pid}`}
                              >
                                {r.proyectoNombres[i] ?? pid.slice(0, 8)}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href="/rrhh/hojas-vida/archivo"
                          className="text-xs font-semibold text-zinc-400 underline underline-offset-2 hover:text-white"
                        >
                          Archivo HV
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
