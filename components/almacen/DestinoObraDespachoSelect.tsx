'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HardHat, Loader2, MapPin, Layers } from 'lucide-react';
import { toast } from 'sonner';
import type { PartidaDespachoFila, UbicacionInventario } from '@/types/inventario-obra';
import { labelUbicacionOpcion } from '@/lib/almacen/ubicacionesInventario';

const selectClass =
  'w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors hover:bg-white/[0.04] focus:border-white/20 disabled:opacity-50';

/** Destino del material en salida de almacén. */
export type ModoDestinoDespacho = 'partida_lulo' | 'otro_almacen' | 'otra_obra';

export type PartidaProyectoOption = {
  key: string;
  id: string;
  nombre: string;
  codigo_partida?: string;
  fuente?: 'presupuesto' | 'cascada';
};

type ProyectoOption = { id: string; nombre: string };

type Props = {
  proyectoId: string;
  proyectos: ProyectoOption[];
  materialId?: string;
  materialNombre?: string;
  modo: ModoDestinoDespacho;
  destinoProyectoId: string;
  ubicacionId: string;
  partidaKey: string;
  onModoChange: (modo: ModoDestinoDespacho) => void;
  onDestinoProyectoChange: (proyectoId: string) => void;
  onUbicacionChange: (ubicacionId: string) => void;
  onPartidaChange: (partidaKey: string) => void;
  onDestinoEtiquetaChange?: (etiqueta: string) => void;
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

const MODO_OPTS: Array<{ id: ModoDestinoDespacho; label: string; hint: string; icon: typeof Layers }> = [
  {
    id: 'partida_lulo',
    label: 'Partida Lulo',
    hint: 'Presupuesto de esta obra',
    icon: Layers,
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
  proyectos,
  materialId,
  materialNombre,
  modo,
  destinoProyectoId,
  ubicacionId,
  partidaKey,
  onModoChange,
  onDestinoProyectoChange,
  onUbicacionChange,
  onPartidaChange,
  onDestinoEtiquetaChange,
  disabled,
  className = selectClass,
}: Props) {
  const [loadingUb, setLoadingUb] = useState(false);
  const [loadingPar, setLoadingPar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ubicaciones, setUbicaciones] = useState<UbicacionInventario[]>([]);
  const [ubicacionesObra, setUbicacionesObra] = useState<UbicacionInventario[]>([]);
  const [partidas, setPartidas] = useState<PartidaProyectoOption[]>([]);
  const [scope, setScope] = useState<'related' | 'all'>('related');
  const [scopeForzado, setScopeForzado] = useState(false);

  const otrosProyectos = useMemo(
    () => proyectos.filter((p) => p.id !== proyectoId),
    [proyectos, proyectoId],
  );

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
    if (modo === 'partida_lulo') {
      setUbicaciones([]);
      return;
    }
    if (modo === 'otra_obra' && !destinoProyectoId.trim()) {
      setUbicaciones([]);
      return;
    }
    setLoadingUb(true);
    setError(null);
    try {
      const qUb = new URLSearchParams({ flat: '1' });
      if (modo === 'otro_almacen') {
        qUb.set('solo_almacenes', '1');
      } else if (modo === 'otra_obra') {
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
  }, [modo, destinoProyectoId]);

  const cargarPartidas = useCallback(async () => {
    if (!proyectoId.trim() || !materialId?.trim() || modo !== 'partida_lulo') {
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
  }, [proyectoId, materialId, modo, scope, scopeForzado]);

  useEffect(() => {
    void cargarUbicacionesObra();
  }, [cargarUbicacionesObra]);

  useEffect(() => {
    void cargarUbicaciones();
  }, [cargarUbicaciones]);

  useEffect(() => {
    setScope('related');
    setScopeForzado(false);
    if (modo === 'partida_lulo') onPartidaChange('');
  }, [proyectoId, materialId, modo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void cargarPartidas();
  }, [cargarPartidas]);

  const obraUbicacionId = useMemo(() => {
    const deObra = ubicacionesObra.find((u) => u.tipo === 'obra' && u.obra_id === proyectoId);
    return deObra?.id ?? ubicacionesObra.find((u) => u.tipo === 'obra')?.id ?? '';
  }, [ubicacionesObra, proyectoId]);

  useEffect(() => {
    if (modo !== 'partida_lulo' || !partidaKey || !obraUbicacionId) return;
    if (ubicacionId !== obraUbicacionId) onUbicacionChange(obraUbicacionId);
  }, [modo, partidaKey, obraUbicacionId, ubicacionId, onUbicacionChange]);

  const loading = loadingUb || loadingPar;

  const resumenDestino = useMemo(() => {
    if (modo === 'partida_lulo') {
      const partida = partidas.find((p) => (p.key ?? `pp:${p.id}`) === partidaKey);
      const ub = ubicacionesObra.find((u) => u.id === ubicacionId);
      if (partida && ub) {
        return `Partida: ${partida.nombre} → ${labelUbicacionOpcion(ub)}`;
      }
      if (partida) return `Partida: ${partida.nombre}`;
      return '';
    }
    if (modo === 'otro_almacen') {
      const ub = ubicaciones.find((u) => u.id === ubicacionId);
      return ub ? `Almacén: ${labelUbicacionOpcion(ub)}` : '';
    }
    if (modo === 'otra_obra') {
      const pr = proyectos.find((p) => p.id === destinoProyectoId);
      const ub = ubicaciones.find((u) => u.id === ubicacionId);
      if (pr && ub) return `Obra: ${pr.nombre} · ${labelUbicacionOpcion(ub)}`;
      if (pr) return `Obra: ${pr.nombre}`;
      return '';
    }
    return '';
  }, [
    modo,
    partidaKey,
    ubicacionId,
    destinoProyectoId,
    partidas,
    ubicaciones,
    ubicacionesObra,
    proyectos,
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

  if (!materialId?.trim()) {
    return (
      <select disabled className={className}>
        <option value="" className="bg-[#0A0A0F] text-zinc-100">
          Agregue el material primero…
        </option>
      </select>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500">
        Elija si el material va a una partida Lulo de esta obra, a otro almacén o a otra obra.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {MODO_OPTS.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            type="button"
            disabled={disabled || loading}
            onClick={() => {
              onModoChange(id);
              onDestinoProyectoChange('');
              onUbicacionChange('');
              onPartidaChange('');
            }}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              modo === id
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

      {modo === 'partida_lulo' ? (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-500">
            Partida del presupuesto Lulo (obra actual)
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
                className={`px-2.5 py-1 text-[10px] font-bold transition-colors ${
                  scope === 'related'
                    ? 'bg-sky-500/20 text-sky-200'
                    : 'bg-black/30 text-zinc-400 hover:bg-white/[0.04]'
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
                className={`px-2.5 py-1 text-[10px] font-bold transition-colors ${
                  scope === 'all'
                    ? 'bg-sky-500/20 text-sky-200'
                    : 'bg-black/30 text-zinc-400 hover:bg-white/[0.04]'
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
          {partidaKey && obraUbicacionId ? (
            <p className="text-[10px] text-sky-400/90">
              El material ingresa a la bodega de esta obra y se carga a la partida seleccionada.
            </p>
          ) : null}
        </div>
      ) : null}

      {modo === 'otro_almacen' ? (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-500">
            Almacén destino
          </label>
          <select
            value={ubicacionId}
            disabled={disabled || loadingUb}
            onChange={(e) => onUbicacionChange(e.target.value)}
            className={className}
          >
            <option value="" className="bg-[#0A0A0F] text-zinc-100">
              {loadingUb ? 'Cargando almacenes…' : 'Seleccione depósito central o móvil…'}
            </option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
                {labelUbicacionOpcion(u)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-zinc-500">
            Transferencia a otro depósito físico (puede ser de la misma u otra entidad).
          </p>
        </div>
      ) : null}

      {modo === 'otra_obra' ? (
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
                  ? 'No hay otras obras registradas'
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
                Ubicación en la obra
              </label>
              <select
                value={ubicacionId}
                disabled={disabled || loadingUb}
                onChange={(e) => onUbicacionChange(e.target.value)}
                className={className}
              >
                <option value="" className="bg-[#0A0A0F] text-zinc-100">
                  {loadingUb ? 'Cargando…' : 'Almacén o bodega de la obra…'}
                </option>
                {ubicaciones.filter((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil')
                  .length > 0 ? (
                  <optgroup label="Almacenes" className="bg-[#0A0A0F] text-zinc-100">
                    {ubicaciones
                      .filter((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil')
                      .map((u) => (
                        <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
                          {labelUbicacionOpcion(u)}
                        </option>
                      ))}
                  </optgroup>
                ) : null}
                {ubicaciones.filter((u) => u.tipo === 'obra').length > 0 ? (
                  <optgroup label="Bodega en obra" className="bg-[#0A0A0F] text-zinc-100">
                    {ubicaciones
                      .filter((u) => u.tipo === 'obra')
                      .map((u) => (
                        <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
                          {labelUbicacionOpcion(u)}
                        </option>
                      ))}
                  </optgroup>
                ) : null}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      {resumenDestino ? (
        <p className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-200">
          Destino: {resumenDestino}
        </p>
      ) : null}

      {error ? <p className="text-[10px] font-bold text-amber-400">{error}</p> : null}
      {!loading && modo === 'partida_lulo' && materialId && partidas.length === 0 && scope === 'related' ? (
        <p className="text-[10px] font-bold text-amber-400">
          Sin partidas relacionadas en APU para {materialNombre ?? 'este material'}. Use «Todas las
          partidas» o importe el presupuesto Lulo.
        </p>
      ) : null}
    </div>
  );
}
