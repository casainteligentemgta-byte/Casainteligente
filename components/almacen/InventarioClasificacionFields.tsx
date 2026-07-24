'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, FolderKanban, ListTree } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  filtrarProyectosPorEntidad,
  labelPartida,
  loadEntidades,
  loadPartidasPorProyecto,
  loadProyectos,
  type EntidadRow,
  type InventarioClasificacionValue,
  type PartidaRow,
  type ProyectoRow,
} from '@/lib/almacen/inventoryClasificacion';

type Props = {
  value: InventarioClasificacionValue;
  onChange: (next: InventarioClasificacionValue) => void;
  compact?: boolean;
};

export default function InventarioClasificacionFields({ value, onChange, compact = false }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [entidades, setEntidades] = useState<EntidadRow[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
  const [partidas, setPartidas] = useState<PartidaRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadingPartidas, setLoadingPartidas] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [e, p] = await Promise.all([loadEntidades(supabase), loadProyectos(supabase)]);
        setEntidades(e);
        setProyectos(p);
        setLoadErr(null);
      } catch (err: unknown) {
        setLoadErr(err instanceof Error ? err.message : 'No se cargaron entidades/proyectos');
      }
    })();
  }, [supabase]);

  const proyectosFiltrados = useMemo(
    () => filtrarProyectosPorEntidad(proyectos, value.entidad_id),
    [proyectos, value.entidad_id],
  );

  useEffect(() => {
    if (!value.proyecto_id) {
      setPartidas([]);
      return;
    }
    let cancelled = false;
    setLoadingPartidas(true);
    void loadPartidasPorProyecto(supabase, value.proyecto_id)
      .then((rows) => {
        if (cancelled) return;
        setPartidas(rows);
        if (
          value.presupuesto_partida_id &&
          !rows.some((r) => r.id === value.presupuesto_partida_id)
        ) {
          onChange({ ...value, presupuesto_partida_id: null });
        }
      })
      .catch(() => {
        if (!cancelled) setPartidas([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPartidas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value.proyecto_id, value.presupuesto_partida_id, supabase, onChange, value]);

  const selectClass = compact
    ? 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none'
    : 'w-full rounded-xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm font-bold text-white focus:border-violet-500/50 focus:outline-none';

  const labelClass = compact
    ? 'text-[10px] font-bold text-zinc-500 uppercase tracking-wider'
    : 'text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1';

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4 rounded-xl border border-violet-500/20 bg-violet-950/10 p-5'}>
      {!compact ? (
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-violet-300">
            Clasificación obra (Lulo)
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Entidad → proyecto → partida de presupuesto importada desde MDB/CSV Lulo.
          </p>
        </div>
      ) : null}

      {loadErr ? (
        <p className="text-xs text-amber-400">
          {loadErr}. Aplica la migración 153 en Supabase si faltan columnas en inventario.
        </p>
      ) : null}

      <div className={compact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-4'}>
        <div className="space-y-1.5">
          <label className={`flex items-center gap-1.5 ${labelClass}`}>
            <Building2 className="h-3 w-3" />
            Entidad
          </label>
          <select
            className={selectClass}
            value={value.entidad_id ?? ''}
            onChange={(e) => {
              const entidad_id = e.target.value || null;
              const proyOk = value.proyecto_id
                ? proyectos.find((p) => p.id === value.proyecto_id)?.entidad_id === entidad_id ||
                  !entidad_id
                : true;
              onChange({
                entidad_id,
                proyecto_id: proyOk ? value.proyecto_id : null,
                presupuesto_partida_id: proyOk ? value.presupuesto_partida_id : null,
              });
            }}
          >
            <option value="">— Sin entidad —</option>
            {entidades.map((en) => (
              <option key={en.id} value={en.id}>
                {en.nombre}
                {en.rif ? ` (${en.rif})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={`flex items-center gap-1.5 ${labelClass}`}>
            <FolderKanban className="h-3 w-3" />
            Proyecto asignado
          </label>
          <select
            className={selectClass}
            value={value.proyecto_id ?? ''}
            onChange={(e) => {
              const proyecto_id = e.target.value || null;
              const proy = proyectos.find((p) => p.id === proyecto_id);
              onChange({
                entidad_id: proy?.entidad_id ?? value.entidad_id,
                proyecto_id,
                presupuesto_partida_id: null,
              });
            }}
          >
            <option value="">— Sin proyecto —</option>
            {proyectosFiltrados.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          {value.entidad_id && proyectosFiltrados.length === 0 ? (
            <p className="text-[10px] text-zinc-600">No hay proyectos para esta entidad.</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label className={`flex items-center gap-1.5 ${labelClass}`}>
            <ListTree className="h-3 w-3" />
            Partida Lulo
          </label>
          <select
            className={selectClass}
            value={value.presupuesto_partida_id ?? ''}
            disabled={!value.proyecto_id || loadingPartidas}
            onChange={(e) =>
              onChange({
                ...value,
                presupuesto_partida_id: e.target.value || null,
              })
            }
          >
            <option value="">
              {!value.proyecto_id
                ? 'Selecciona un proyecto primero'
                : loadingPartidas
                  ? 'Cargando partidas…'
                  : partidas.length === 0
                    ? 'Sin partidas Lulo (importa MDB en el proyecto)'
                    : '— Sin partida —'}
            </option>
            {partidas.map((pt) => (
              <option key={pt.id} value={pt.id}>
                {labelPartida(pt)}
              </option>
            ))}
          </select>
          {value.proyecto_id && !loadingPartidas && partidas.length > 0 ? (
            <p className="text-[10px] text-zinc-600">
              {partidas.length} partida(s) importadas en este proyecto.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
