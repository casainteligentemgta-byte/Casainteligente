'use client';

import Link from 'next/link';
import { Filter, Loader2 } from 'lucide-react';
import { useAlmacenFiltros } from '@/components/almacen/AlmacenFiltrosProvider';

type Props = {
  /** Texto auxiliar bajo los selectores (p. ej. cuadro movimientos). */
  hint?: string;
};

export default function AlmacenFiltrosUbicacionBar({ hint }: Props) {
  const {
    entidades,
    proyectosFiltro,
    depositsFiltrados,
    filterEntidadId,
    filterProyectoId,
    filterDepositId,
    setFilterEntidadId,
    setFilterProyectoId,
    setFilterDepositId,
    depositoSinInterseccion,
    cargandoUbicaciones,
    filtroStockEntidadActivo,
    ubicacionIdsFiltro,
    filtroSinUbicaciones,
  } = useAlmacenFiltros();

  const almacenLabel = filterDepositId
    ? depositsFiltrados.find((d) => d.id === filterDepositId)?.name ?? 'Almacén'
    : null;

  return (
    <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-sky-400 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          Entidad · Obra · Almacén
        </span>
        {cargandoUbicaciones && filtroStockEntidadActivo ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Resolviendo ubicaciones…
          </span>
        ) : null}
        {almacenLabel ? (
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide ml-auto">
            {almacenLabel}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1.5 block">
            Entidad
          </span>
          <select
            value={filterEntidadId}
            onChange={(e) => setFilterEntidadId(e.target.value)}
            className="w-full rounded-xl border border-violet-500/30 bg-black/50 px-3 py-2.5 text-sm font-bold text-white"
          >
            <option value="">Todas las entidades</option>
            {entidades.map((en) => (
              <option key={en.id} value={en.id}>
                {en.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-1.5 block">
            Obra (construcción)
          </span>
          <select
            value={filterProyectoId}
            onChange={(e) => setFilterProyectoId(e.target.value)}
            className="w-full rounded-xl border border-sky-500/30 bg-black/50 px-3 py-2.5 text-sm font-bold text-white"
          >
            <option value="">
              {filterEntidadId ? 'Todas las obras de la entidad' : 'Todas las obras'}
            </option>
            {proyectosFiltro.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1.5 block">
            Almacén / depósito
          </span>
          <select
            value={filterDepositId}
            onChange={(e) => setFilterDepositId(e.target.value)}
            className="w-full rounded-xl border border-emerald-500/30 bg-black/50 px-3 py-2.5 text-sm font-bold text-white"
          >
            <option value="">
              {filterEntidadId || filterProyectoId
                ? 'Todos los almacenes de la selección'
                : 'Todos los almacenes'}
            </option>
            {depositsFiltrados.map((d) => (
              <option key={d.id} value={d.id}>
                {d.locality ? `${d.name} (${d.locality})` : d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {depositoSinInterseccion && filterDepositId && ubicacionIdsFiltro.length > 0 ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
          El almacén elegido no coincide con la obra en catálogo de ubicaciones; se muestra stock del
          almacén seleccionado.
        </div>
      ) : null}

      {filtroSinUbicaciones && filtroStockEntidadActivo && !cargandoUbicaciones ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
          Sin ubicaciones físicas para este filtro.
          {' '}
          <Link href="/almacen/maestros" className="underline hover:text-amber-100">
            Abrir maestros de almacén
          </Link>
          {' '}
          para sincronizar depósitos con inventario, o elija otra entidad/obra/almacén.
        </div>
      ) : null}

      {hint ? (
        <p className="text-[11px] text-zinc-500 leading-relaxed">{hint}</p>
      ) : filtroStockEntidadActivo && ubicacionIdsFiltro.length > 0 ? (
        <p className="text-[11px] text-zinc-500">
          {ubicacionIdsFiltro.length} ubicación(es) física(s) en alcance del filtro.
        </p>
      ) : null}
    </div>
  );
}
