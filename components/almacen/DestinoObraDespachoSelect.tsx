'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, HardHat, Layers, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { PartidaDespachoFila, UbicacionInventario } from '@/types/inventario-obra';
import { labelUbicacionOpcion } from '@/lib/almacen/ubicacionesInventario';

const selectClass =
  'w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors hover:bg-white/[0.04] focus:border-white/20 disabled:opacity-50';

/** Dónde va físicamente el material. */
export type DestinoFisicoDespacho = 'obra_actual' | 'otro_almacen' | 'otra_obra';

/** Cómo se imputa en presupuesto / cronograma. */
export type ImputacionDespacho = 'partida_lulo' | 'actividad';

/** @deprecated Use DestinoFisicoDespacho */
export type ModoDestinoDespacho = DestinoFisicoDespacho | 'partida_lulo';

export type PartidaProyectoOption = {
  key: string;
  id: string;
  nombre: string;
  codigo_partida?: string;
  fuente?: 'presupuesto' | 'cascada';
};

export type TareaCronogramaOption = {
  id: string;
  nombre_tarea: string;
  codigo_partida: string | null;
  partida_id: string | null;
};

type ProyectoOption = { id: string; nombre: string };

type Props = {
  proyectoId: string;
  proyectoNombre?: string;
  origenUbicacionId?: string;
  proyectos: ProyectoOption[];
  materialId?: string;
  materialNombre?: string;
  destinoFisico: DestinoFisicoDespacho;
  imputacionTipo: ImputacionDespacho;
  destinoProyectoId: string;
  ubicacionId: string;
  partidaKey: string;
  cronogramaTareaId: string;
  onDestinoFisicoChange: (modo: DestinoFisicoDespacho) => void;
  onImputacionTipoChange: (tipo: ImputacionDespacho) => void;
  onDestinoProyectoChange: (proyectoId: string) => void;
  onUbicacionChange: (ubicacionId: string) => void;
  onPartidaChange: (partidaKey: string) => void;
  onTareaChange: (tareaId: string, meta?: TareaCronogramaOption) => void;
  onDestinoEtiquetaChange?: (etiqueta: string) => void;
  /** Solo paso 1 (obra/almacén destino), sin partida ni actividad. */
  soloDestinoFisico?: boolean;
  disabled?: boolean;
  className?: string;
};

function partidasDespachoToOptions(filas: PartidaDespachoFila[]): PartidaProyectoOption[] {
  return filas.map((f) => {
    if (f.ci_presupuesto_partida_id) {
      return {
        key: `pp:${f.ci_presupuesto_partida_id}`,
        id: f.ci_presupuesto_partida_id,
        nombre: f.nombre_partida,
        fuente: 'presupuesto' as const,
      };
    }
    if (f.partida_id) {
      return {
        key: `pd:${f.partida_id}`,
        id: f.partida_id,
        nombre: f.nombre_partida,
        fuente: 'cascada' as const,
      };
    }
    return {
      key: `pp:${f.obra_partida_material_id}`,
      id: f.obra_partida_material_id,
      nombre: f.nombre_partida,
      fuente: 'presupuesto' as const,
    };
  });
}

const FISICO_OPTS: Array<{
  id: DestinoFisicoDespacho;
  label: string;
  hint: string;
  icon: typeof MapPin;
}> = [
  {
    id: 'obra_actual',
    label: 'Bodega de esta obra',
    hint: 'Material va al frente / obra actual',
    icon: HardHat,
  },
  {
    id: 'otro_almacen',
    label: 'Otro almacén',
    hint: 'Depósito central o móvil',
    icon: MapPin,
  },
  {
    id: 'otra_obra',
    label: 'Otra obra',
    hint: 'Bodega de otro proyecto',
    icon: HardHat,
  },
];

export default function DestinoObraDespachoSelect({
  proyectoId,
  proyectoNombre,
  origenUbicacionId,
  proyectos,
  materialId,
  materialNombre,
  destinoFisico,
  imputacionTipo,
  destinoProyectoId,
  ubicacionId,
  partidaKey,
  cronogramaTareaId,
  onDestinoFisicoChange,
  onImputacionTipoChange,
  onDestinoProyectoChange,
  onUbicacionChange,
  onPartidaChange,
  onTareaChange,
  onDestinoEtiquetaChange,
  soloDestinoFisico = false,
  disabled,
  className = selectClass,
}: Props) {
  const [loadingUb, setLoadingUb] = useState(false);
  const [loadingPar, setLoadingPar] = useState(false);
  const [loadingTareas, setLoadingTareas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ubicaciones, setUbicaciones] = useState<UbicacionInventario[]>([]);
  const [ubicacionesObra, setUbicacionesObra] = useState<UbicacionInventario[]>([]);
  const [partidas, setPartidas] = useState<PartidaProyectoOption[]>([]);
  const [tareas, setTareas] = useState<TareaCronogramaOption[]>([]);
  const [scope, setScope] = useState<'related' | 'all'>('related');
  const [scopeForzado, setScopeForzado] = useState(false);

  const otrosProyectos = useMemo(
    () => proyectos.filter((p) => p.id !== proyectoId),
    [proyectos, proyectoId],
  );

  const partidaPresupuestoId = partidaKey.startsWith('pp:') ? partidaKey.slice(3) : '';

  const cargarUbicacionesObra = useCallback(async () => {
    if (!proyectoId.trim()) {
      setUbicacionesObra([]);
      return;
    }
    try {
      const qUb = new URLSearchParams({ flat: '1', proyecto_id: proyectoId });
      const resUb = await fetch(`/api/almacen/ubicaciones?${qUb}`, { cache: 'no-store' });
      const dataUb = (await resUb.json()) as { ubicaciones?: UbicacionInventario[] };
      setUbicacionesObra(dataUb.ubicaciones ?? []);
    } catch {
      setUbicacionesObra([]);
    }
  }, [proyectoId]);

  const cargarUbicaciones = useCallback(async () => {
    if (destinoFisico === 'obra_actual') {
      setUbicaciones([]);
      return;
    }
    if (destinoFisico === 'otra_obra' && !destinoProyectoId.trim()) {
      setUbicaciones([]);
      return;
    }
    setLoadingUb(true);
    setError(null);
    try {
      const qUb = new URLSearchParams({ flat: '1' });
      if (destinoFisico === 'otro_almacen') {
        qUb.set('solo_almacenes', '1');
      } else if (destinoFisico === 'otra_obra') {
        qUb.set('proyecto_id', destinoProyectoId);
      }
      const resUb = await fetch(`/api/almacen/ubicaciones?${qUb}`, { cache: 'no-store' });
      const dataUb = (await resUb.json()) as {
        ubicaciones?: UbicacionInventario[];
        error?: string;
      };
      if (!resUb.ok) throw new Error(dataUb.error || 'No se pudieron cargar almacenes');
      setUbicaciones(dataUb.ubicaciones ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar destino');
      setUbicaciones([]);
    } finally {
      setLoadingUb(false);
    }
  }, [destinoFisico, destinoProyectoId]);

  const cargarPartidas = useCallback(async () => {
    if (!proyectoId.trim() || !materialId?.trim() || imputacionTipo !== 'partida_lulo') {
      setPartidas([]);
      return;
    }
    setLoadingPar(true);
    setError(null);
    try {
      if (scope === 'all') {
        const qPar = new URLSearchParams({ proyecto_id: proyectoId });
        const resPar = await fetch(`/api/almacen/partidas-proyecto?${qPar}`, {
          cache: 'no-store',
        });
        const dataPar = (await resPar.json()) as {
          partidas?: PartidaProyectoOption[];
          error?: string;
        };
        if (!resPar.ok) throw new Error(dataPar.error || 'No se pudieron cargar partidas Lulo');
        setPartidas(dataPar.partidas ?? []);
        return;
      }

      const q = new URLSearchParams({
        proyecto_id: proyectoId,
        material_id: materialId,
        scope: 'related',
      });
      const res = await fetch(`/api/almacen/partidas-despacho?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as {
        partidas?: PartidaDespachoFila[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar partidas');
      const filas = data.partidas ?? [];
      if (filas.length === 0 && !scopeForzado) {
        setScope('all');
        setScopeForzado(true);
        toast.info('Sin partidas con este material en APU. Mostrando todas las partidas del presupuesto.');
        return;
      }
      setPartidas(partidasDespachoToOptions(filas));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar partidas');
      setPartidas([]);
    } finally {
      setLoadingPar(false);
    }
  }, [proyectoId, materialId, imputacionTipo, scope, scopeForzado]);

  const cargarTareas = useCallback(async () => {
    if (!proyectoId.trim() || imputacionTipo !== 'actividad') {
      setTareas([]);
      return;
    }
    setLoadingTareas(true);
    setError(null);
    try {
      const q = new URLSearchParams({ proyecto_id: proyectoId });
      if (partidaPresupuestoId) q.set('partida_id', partidaPresupuestoId);
      const res = await fetch(`/api/almacen/tareas-cronograma?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as { tareas?: TareaCronogramaOption[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar actividades');
      setTareas(data.tareas ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar actividades');
      setTareas([]);
    } finally {
      setLoadingTareas(false);
    }
  }, [proyectoId, imputacionTipo, partidaPresupuestoId]);

  useEffect(() => {
    void cargarUbicacionesObra();
  }, [cargarUbicacionesObra]);

  useEffect(() => {
    void cargarUbicaciones();
  }, [cargarUbicaciones]);

  useEffect(() => {
    setScope('related');
    setScopeForzado(false);
  }, [proyectoId, materialId, imputacionTipo]);

  useEffect(() => {
    void cargarPartidas();
  }, [cargarPartidas]);

  useEffect(() => {
    void cargarTareas();
  }, [cargarTareas]);

  useEffect(() => {
    if (destinoFisico !== 'obra_actual' || ubicacionId) return;
    const candidatas = ubicacionesObra.filter((u) => u.id !== origenUbicacionId);
    const preferida =
      candidatas.find((u) => u.tipo === 'obra')?.id ??
      candidatas.find((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil')?.id ??
      candidatas[0]?.id ??
      '';
    if (preferida) onUbicacionChange(preferida);
  }, [destinoFisico, ubicacionId, ubicacionesObra, origenUbicacionId, onUbicacionChange]);

  const nombreObraDestino = useMemo(() => {
    if (destinoFisico === 'obra_actual') {
      return proyectoNombre ?? proyectos.find((p) => p.id === proyectoId)?.nombre ?? 'Esta obra';
    }
    if (destinoFisico === 'otra_obra') {
      return proyectos.find((p) => p.id === destinoProyectoId)?.nombre ?? '';
    }
    return '';
  }, [destinoFisico, destinoProyectoId, proyectoId, proyectoNombre, proyectos]);

  const ubicacionesObraActual = useMemo(
    () => ubicacionesObra.filter((u) => u.id !== origenUbicacionId),
    [ubicacionesObra, origenUbicacionId],
  );

  const loading = loadingUb || loadingPar || loadingTareas;

  const resumenDestino = useMemo(() => {
    const partes: string[] = [];

    if (nombreObraDestino) partes.push(`Obra: ${nombreObraDestino}`);
    else if (destinoFisico === 'otro_almacen') partes.push('Obra/almacén: depósito externo');

    const ubLista =
      destinoFisico === 'obra_actual'
        ? ubicacionesObra
        : destinoFisico === 'otro_almacen' || destinoFisico === 'otra_obra'
          ? ubicaciones
          : [];
    const ub = ubLista.find((u) => u.id === ubicacionId);
    if (ub) partes.push(`Almacén/bodega: ${labelUbicacionOpcion(ub)}`);

    if (!soloDestinoFisico) {
      if (imputacionTipo === 'partida_lulo') {
        const partida = partidas.find((p) => (p.key ?? `pp:${p.id}`) === partidaKey);
        if (partida) partes.push(`Partida destino: ${partida.nombre}`);
      } else {
        const tarea = tareas.find((t) => t.id === cronogramaTareaId);
        if (tarea) partes.push(`Actividad destino: ${tarea.nombre_tarea}`);
      }
    }

    return partes.join(' · ');
  }, [
    destinoFisico,
    imputacionTipo,
    ubicacionId,
    destinoProyectoId,
    partidaKey,
    cronogramaTareaId,
    partidas,
    tareas,
    ubicaciones,
    ubicacionesObra,
    nombreObraDestino,
    soloDestinoFisico,
  ]);

  useEffect(() => {
    onDestinoEtiquetaChange?.(resumenDestino);
  }, [resumenDestino, onDestinoEtiquetaChange]);

  if (!proyectoId.trim()) {
    return (
      <select disabled className={className}>
        <option value="" className="bg-[#0A0A0F] text-zinc-100">
          Primero seleccione la obra…
        </option>
      </select>
    );
  }

  if (!materialId?.trim() && !soloDestinoFisico) {
    return (
      <select disabled className={className}>
        <option value="" className="bg-[#0A0A0F] text-zinc-100">
          Agregue el material primero…
        </option>
      </select>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase text-zinc-500">
          Paso 1 · ¿A qué obra o almacén va?
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {FISICO_OPTS.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={disabled || loading}
              onClick={() => {
                onDestinoFisicoChange(id);
                onDestinoProyectoChange('');
                if (id !== 'obra_actual') onUbicacionChange('');
              }}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                destinoFisico === id
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-100'
                  : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug opacity-80">{hint}</span>
            </button>
          ))}
        </div>
      </div>

      {destinoFisico === 'obra_actual' ? (
        <div className="space-y-3 rounded-lg border border-sky-500/20 bg-black/20 p-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-sky-400/90">Obra destino</label>
            <p className="text-sm font-semibold text-zinc-100">{nombreObraDestino}</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500">
              Almacén o bodega destino en la obra
            </label>
            <select
              value={ubicacionId}
              disabled={disabled || ubicacionesObraActual.length === 0}
              onChange={(e) => onUbicacionChange(e.target.value)}
              className={className}
            >
              <option value="" className="bg-[#0A0A0F] text-zinc-100">
                {ubicacionesObraActual.length === 0
                  ? 'Sin ubicaciones distintas al origen'
                  : 'Seleccione bodega o almacén de la obra…'}
              </option>
              {ubicacionesObraActual.filter((u) => u.tipo === 'obra').length > 0 ? (
                <optgroup label="Bodega en obra" className="bg-[#0A0A0F] text-zinc-100">
                  {ubicacionesObraActual
                    .filter((u) => u.tipo === 'obra')
                    .map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
                        {labelUbicacionOpcion(u)}
                      </option>
                    ))}
                </optgroup>
              ) : null}
              {ubicacionesObraActual.filter(
                (u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil',
              ).length > 0 ? (
                <optgroup label="Almacenes de la obra" className="bg-[#0A0A0F] text-zinc-100">
                  {ubicacionesObraActual
                    .filter((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil')
                    .map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
                        {labelUbicacionOpcion(u)}
                      </option>
                    ))}
                </optgroup>
              ) : null}
            </select>
          </div>
        </div>
      ) : null}

      {destinoFisico === 'otro_almacen' ? (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-500">Almacén destino</label>
          <select
            value={ubicacionId}
            disabled={disabled || loadingUb}
            onChange={(e) => onUbicacionChange(e.target.value)}
            className={className}
          >
            <option value="" className="bg-[#0A0A0F] text-zinc-100">
              {loadingUb ? 'Cargando…' : 'Seleccione depósito central o móvil…'}
            </option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
                {labelUbicacionOpcion(u)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {destinoFisico === 'otra_obra' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Obra destino</label>
            <select
              value={destinoProyectoId}
              disabled={disabled || otrosProyectos.length === 0}
              onChange={(e) => {
                onDestinoProyectoChange(e.target.value);
                onUbicacionChange('');
              }}
              className={className}
            >
              <option value="" className="bg-[#0A0A0F] text-zinc-100">
                {otrosProyectos.length === 0
                  ? 'No hay otras obras'
                  : 'Seleccione proyecto / obra…'}
              </option>
              {otrosProyectos.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0A0A0F] text-zinc-100">
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          {destinoProyectoId ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-500">
                Almacén o bodega destino en la obra
              </label>
              <select
                value={ubicacionId}
                disabled={disabled || loadingUb}
                onChange={(e) => onUbicacionChange(e.target.value)}
                className={className}
              >
                <option value="" className="bg-[#0A0A0F] text-zinc-100">
                  {loadingUb ? 'Cargando…' : 'Bodega o almacén de la obra…'}
                </option>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
                    {labelUbicacionOpcion(u)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      {resumenDestino && soloDestinoFisico ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase text-emerald-400/90">Destino físico</p>
          <p className="mt-1 text-sm font-medium leading-snug text-emerald-100">{resumenDestino}</p>
        </div>
      ) : null}

      {!soloDestinoFisico && resumenDestino ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase text-emerald-400/90">Destino confirmado</p>
          <p className="mt-1 text-sm font-medium leading-snug text-emerald-100">{resumenDestino}</p>
        </div>
      ) : null}

      {!soloDestinoFisico ? (
      <>
      <div className="space-y-2 border-t border-white/10 pt-3">
        <p className="text-[10px] font-bold uppercase text-zinc-500">
          Paso 2 · ¿A qué partida Lulo o actividad va?
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onImputacionTipoChange('partida_lulo');
              onTareaChange('');
            }}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              imputacionTipo === 'partida_lulo'
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'
                : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20'
            }`}
          >
            <span className="flex items-center gap-1.5 text-xs font-bold">
              <Layers className="h-3.5 w-3.5" />
              Partida Lulo
            </span>
            <span className="mt-0.5 block text-[10px] opacity-80">Presupuesto de la obra</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onImputacionTipoChange('actividad');
              onPartidaChange('');
            }}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              imputacionTipo === 'actividad'
                ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
                : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20'
            }`}
          >
            <span className="flex items-center gap-1.5 text-xs font-bold">
              <CalendarDays className="h-3.5 w-3.5" />
              Actividad (cronograma)
            </span>
            <span className="mt-0.5 block text-[10px] opacity-80">Tarea Gantt del proyecto</span>
          </button>
        </div>
      </div>

      {imputacionTipo === 'partida_lulo' ? (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-500">
            Partida destino (presupuesto Lulo)
          </label>
          <select
            value={partidaKey}
            disabled={disabled || loadingPar}
            onChange={(e) => onPartidaChange(e.target.value)}
            className={className}
          >
            <option value="" className="bg-[#0A0A0F] text-zinc-100">
              {loadingPar ? 'Cargando partidas…' : 'Seleccione partida a imputar…'}
            </option>
            {partidas.map((p) => (
              <option
                key={p.key ?? p.id}
                value={p.key ?? `pp:${p.id}`}
                className="bg-[#0A0A0F] text-zinc-100"
              >
                {p.nombre}
                {p.fuente === 'cascada' ? ' (MDB)' : ''}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-white/10">
              <button
                type="button"
                disabled={disabled || loadingPar}
                onClick={() => {
                  setScopeForzado(true);
                  setScope('related');
                }}
                className={`px-2.5 py-1 text-[10px] font-bold ${
                  scope === 'related' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-black/30 text-zinc-400'
                }`}
              >
                Con este material
              </button>
              <button
                type="button"
                disabled={disabled || loadingPar}
                onClick={() => {
                  setScopeForzado(true);
                  setScope('all');
                }}
                className={`px-2.5 py-1 text-[10px] font-bold ${
                  scope === 'all' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-black/30 text-zinc-400'
                }`}
              >
                Todas las partidas
              </button>
            </div>
            {loadingPar ? (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Partidas…
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-500">
            Actividad destino (cronograma)
          </label>
          <select
            value={cronogramaTareaId}
            disabled={disabled || loadingTareas}
            onChange={(e) => {
              const id = e.target.value;
              const t = tareas.find((x) => x.id === id);
              onTareaChange(id, t);
            }}
            className={className}
          >
            <option value="" className="bg-[#0A0A0F] text-zinc-100">
              {loadingTareas ? 'Cargando actividades…' : 'Seleccione actividad / tarea…'}
            </option>
            {tareas.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#0A0A0F] text-zinc-100">
                {t.nombre_tarea}
                {t.codigo_partida ? ` · ${t.codigo_partida}` : ''}
              </option>
            ))}
          </select>
          {tareas.length === 0 && !loadingTareas ? (
            <p className="text-[10px] text-amber-400">
              Sin actividades en el cronograma. Importe el Gantt o use partida Lulo.
            </p>
          ) : null}
        </div>
      )}
      </>
      ) : null}

      {error ? <p className="text-[10px] font-bold text-amber-400">{error}</p> : null}
      {!soloDestinoFisico &&
      !loading &&
      imputacionTipo === 'partida_lulo' &&
      materialId &&
      partidas.length === 0 &&
      scope === 'related' ? (
        <p className="text-[10px] font-bold text-amber-400">
          Sin partidas relacionadas en APU para {materialNombre ?? 'este material'}. Use «Todas las
          partidas» o importe el presupuesto Lulo.
        </p>
      ) : null}
    </div>
  );
}
