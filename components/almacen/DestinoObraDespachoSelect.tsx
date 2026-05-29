'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, MapPin, Layers } from 'lucide-react';
import { toast } from 'sonner';
import type { PartidaDespachoFila, UbicacionInventario } from '@/types/inventario-obra';
import { labelUbicacionOpcion } from '@/lib/almacen/ubicacionesInventario';

const selectClass =
  'w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors hover:bg-white/[0.04] focus:border-white/20 disabled:opacity-50';

export type ModoDestinoDespacho = 'partida_lulo' | 'otra_entidad' | 'obra_almacen';

export type PartidaProyectoOption = {
  key: string;
  id: string;
  nombre: string;
  codigo_partida?: string;
  fuente?: 'presupuesto' | 'cascada';
};

type EntidadRow = { id: string; nombre: string; rif: string | null };

type Props = {
  proyectoId: string;
  materialId?: string;
  materialNombre?: string;
  modo: ModoDestinoDespacho;
  entidadId: string;
  ubicacionId: string;
  partidaKey: string;
  onModoChange: (modo: ModoDestinoDespacho) => void;
  onEntidadChange: (entidadId: string) => void;
  onUbicacionChange: (ubicacionId: string) => void;
  onPartidaChange: (partidaKey: string) => void;
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
    hint: 'Imputa al presupuesto de la obra',
    icon: Layers,
  },
  {
    id: 'obra_almacen',
    label: 'Almacén en obra',
    hint: 'Bodega o ubicación del proyecto',
    icon: MapPin,
  },
  {
    id: 'otra_entidad',
    label: 'Otra entidad',
    hint: 'Almacén de otra empresa / filial',
    icon: Building2,
  },
];

export default function DestinoObraDespachoSelect({
  proyectoId,
  materialId,
  materialNombre,
  modo,
  entidadId,
  ubicacionId,
  partidaKey,
  onModoChange,
  onEntidadChange,
  onUbicacionChange,
  onPartidaChange,
  disabled,
  className = selectClass,
}: Props) {
  const [loadingUb, setLoadingUb] = useState(false);
  const [loadingPar, setLoadingPar] = useState(false);
  const [loadingEnt, setLoadingEnt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ubicaciones, setUbicaciones] = useState<UbicacionInventario[]>([]);
  const [partidas, setPartidas] = useState<PartidaProyectoOption[]>([]);
  const [entidades, setEntidades] = useState<EntidadRow[]>([]);
  const [scope, setScope] = useState<'related' | 'all'>('related');
  const [scopeForzado, setScopeForzado] = useState(false);

  const cargarEntidades = useCallback(async () => {
    setLoadingEnt(true);
    try {
      const res = await fetch('/api/almacen/entidades', { cache: 'no-store' });
      const data = (await res.json()) as { entidades?: EntidadRow[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar entidades');
      setEntidades(data.entidades ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar entidades');
      setEntidades([]);
    } finally {
      setLoadingEnt(false);
    }
  }, []);

  const cargarUbicaciones = useCallback(async () => {
    if (!proyectoId.trim()) {
      setUbicaciones([]);
      return;
    }
    if (modo === 'otra_entidad' && !entidadId.trim()) {
      setUbicaciones([]);
      return;
    }
    setLoadingUb(true);
    setError(null);
    try {
      const qUb = new URLSearchParams({ flat: '1' });
      if (modo === 'otra_entidad') {
        qUb.set('entidad_id', entidadId);
        qUb.set('excluir_proyecto_id', proyectoId);
      } else {
        qUb.set('proyecto_id', proyectoId);
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
  }, [proyectoId, modo, entidadId]);

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
    if (modo === 'otra_entidad') void cargarEntidades();
  }, [modo, cargarEntidades]);

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
    const deObra = ubicaciones.find((u) => u.tipo === 'obra' && u.obra_id === proyectoId);
    return deObra?.id ?? ubicaciones.find((u) => u.tipo === 'obra')?.id ?? '';
  }, [ubicaciones, proyectoId]);

  useEffect(() => {
    if (modo !== 'partida_lulo' || !partidaKey || !obraUbicacionId) return;
    if (ubicacionId !== obraUbicacionId) onUbicacionChange(obraUbicacionId);
  }, [modo, partidaKey, obraUbicacionId, ubicacionId, onUbicacionChange]);

  const loading = loadingUb || loadingPar || loadingEnt;

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
      <div className="grid gap-2 sm:grid-cols-3">
        {MODO_OPTS.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            type="button"
            disabled={disabled || loading}
            onClick={() => {
              onModoChange(id);
              onEntidadChange('');
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
            Partida del presupuesto Lulo
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
              El material se moverá a la ubicación de obra y se cargará a la partida seleccionada.
            </p>
          ) : null}
        </div>
      ) : null}

      {modo === 'obra_almacen' ? (
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
              {loadingUb ? 'Cargando…' : 'Almacén central, móvil o bodega en obra…'}
            </option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
                {labelUbicacionOpcion(u)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {modo === 'otra_entidad' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Entidad destino</label>
            <select
              value={entidadId}
              disabled={disabled || loadingEnt}
              onChange={(e) => {
                onEntidadChange(e.target.value);
                onUbicacionChange('');
              }}
              className={className}
            >
              <option value="" className="bg-[#0A0A0F] text-zinc-100">
                {loadingEnt ? 'Cargando entidades…' : 'Seleccione entidad…'}
              </option>
              {entidades.map((en) => (
                <option key={en.id} value={en.id} className="bg-[#0A0A0F] text-zinc-100">
                  {en.nombre}
                  {en.rif ? ` · ${en.rif}` : ''}
                </option>
              ))}
            </select>
          </div>
          {entidadId ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-500">
                Almacén de la entidad
              </label>
              <select
                value={ubicacionId}
                disabled={disabled || loadingUb}
                onChange={(e) => onUbicacionChange(e.target.value)}
                className={className}
              >
                <option value="" className="bg-[#0A0A0F] text-zinc-100">
                  {loadingUb ? 'Cargando almacenes…' : 'Almacén central, móvil u obra de la entidad…'}
                </option>
                {ubicaciones.filter((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil')
                  .length > 0 ? (
                  <optgroup label="Almacenes centrales / móviles" className="bg-[#0A0A0F] text-zinc-100">
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
                  <optgroup label="Obras de la entidad" className="bg-[#0A0A0F] text-zinc-100">
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
              <p className="text-[10px] text-zinc-500">
                Incluye almacenes corporativos y bodegas de obras vinculadas a la entidad.
              </p>
            </div>
          ) : null}
        </div>
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
