'use client';

import { useEffect, useState } from 'react';
import { Filter, Loader2, Pencil } from 'lucide-react';
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
    nombreEntidadFiltro,
    nombreProyectoFiltro,
    depositoSinInterseccion,
    cargandoUbicaciones,
    filtroStockEntidadActivo,
    ubicacionIdsFiltro,
    filtroSinUbicaciones,
  } = useAlmacenFiltros();

  const seleccionCompleta = Boolean(filterEntidadId && filterProyectoId && filterDepositId);
  const [editando, setEditando] = useState(!seleccionCompleta);

  useEffect(() => {
    if (!seleccionCompleta) setEditando(true);
    else setEditando(false);
  }, [seleccionCompleta]);

  const almacenLabel = filterDepositId
    ? depositsFiltrados.find((d) => d.id === filterDepositId)?.name ?? 'Almacén'
    : null;

  const mostrarSelectores = editando || !seleccionCompleta;
  /** Sin ubicación física resuelta: guía a elegir almacén (evita el aviso técnico que saltaba el layout). */
  const pedirAlmacen =
    filtroSinUbicaciones && filtroStockEntidadActivo && !cargandoUbicaciones;

  return (
    <div className="mb-4 box-border w-full max-w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
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
        {seleccionCompleta && !mostrarSelectores ? (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <Pencil className="h-3 w-3" />
            Cambiar
          </button>
        ) : null}
      </div>

      {!mostrarSelectores && seleccionCompleta ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold leading-snug">
          <span className="text-violet-300 truncate max-w-full">{nombreEntidadFiltro || 'Entidad'}</span>
          <span className="text-zinc-600 shrink-0">·</span>
          <span className="text-sky-300 truncate max-w-full">{nombreProyectoFiltro || 'Obra'}</span>
          <span className="text-zinc-600 shrink-0">·</span>
          <span className="text-emerald-300 truncate max-w-full">{almacenLabel || 'Almacén'}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1.5 block">
              Entidad
            </span>
            <select
              value={filterEntidadId}
              onChange={(e) => setFilterEntidadId(e.target.value)}
              className="w-full max-w-full box-border rounded-xl border border-violet-500/30 bg-black/50 px-3 py-2.5 text-sm font-bold text-white"
            >
              <option value="">Todas las entidades</option>
              {entidades.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-1.5 block">
              Obra (construcción)
            </span>
            <select
              value={filterProyectoId}
              onChange={(e) => setFilterProyectoId(e.target.value)}
              className="w-full max-w-full box-border rounded-xl border border-sky-500/30 bg-black/50 px-3 py-2.5 text-sm font-bold text-white"
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
          <label className="block min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1.5 block">
              Almacén / depósito
            </span>
            <select
              value={filterDepositId}
              onChange={(e) => setFilterDepositId(e.target.value)}
              className={`w-full max-w-full box-border rounded-xl border bg-black/50 px-3 py-2.5 text-sm font-bold text-white ${
                pedirAlmacen && !cargandoUbicaciones
                  ? 'border-emerald-400/60 ring-1 ring-emerald-400/25'
                  : 'border-emerald-500/30'
              }`}
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
      )}

      {mostrarSelectores && seleccionCompleta ? (
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="text-[10px] font-bold uppercase tracking-wider text-sky-400 hover:text-sky-300"
        >
          Listo · mostrar solo nombres
        </button>
      ) : null}

      {depositoSinInterseccion && filterDepositId && ubicacionIdsFiltro.length > 0 ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
          El almacén elegido no coincide con la obra en catálogo de ubicaciones; se muestra stock del
          almacén seleccionado.
        </div>
      ) : null}

      {/* Altura reservada para no saltar el layout al resolver ubicaciones */}
      <p
        className={`min-h-[1.25rem] text-[11px] leading-relaxed ${
          pedirAlmacen && !cargandoUbicaciones
            ? 'font-semibold text-emerald-300/90'
            : 'text-zinc-500'
        }`}
        aria-live="polite"
      >
        {cargandoUbicaciones && filtroStockEntidadActivo
          ? '\u00a0'
          : pedirAlmacen
            ? 'Seleccione el almacén por favor.'
            : hint && mostrarSelectores
              ? hint
              : '\u00a0'}
      </p>
    </div>
  );
}
