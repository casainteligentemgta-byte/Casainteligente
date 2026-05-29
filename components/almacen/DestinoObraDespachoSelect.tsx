'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PartidaDespachoFila, UbicacionInventario } from '@/types/inventario-obra';
import { labelUbicacionOpcion } from '@/lib/almacen/ubicacionesInventario';

const selectClass =
  'w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors hover:bg-white/[0.04] focus:border-white/20 disabled:opacity-50';

export type PartidaProyectoOption = {
  key: string;
  id: string;
  nombre: string;
  codigo_partida?: string;
  fuente?: 'presupuesto' | 'cascada';
};

type Props = {
  proyectoId: string;
  /** Material ya agregado a la línea; filtra partidas del presupuesto que lo incluyen en APU. */
  materialId?: string;
  materialNombre?: string;
  ubicacionId: string;
  /** Clave compuesta del selector: `pp:…` (presupuesto) o `pd:…` (cascada MDB). */
  partidaKey: string;
  onUbicacionChange: (ubicacionId: string) => void;
  onPartidaChange: (partidaKey: string) => void;
  disabled?: boolean;
  className?: string;
};

function valorCompuesto(ubicacionId: string, partidaKey: string): string {
  if (partidaKey) return partidaKey;
  if (ubicacionId) return `ub:${ubicacionId}`;
  return '';
}

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

export default function DestinoObraDespachoSelect({
  proyectoId,
  materialId,
  materialNombre,
  ubicacionId,
  partidaKey,
  onUbicacionChange,
  onPartidaChange,
  disabled,
  className = selectClass,
}: Props) {
  const [loadingUb, setLoadingUb] = useState(false);
  const [loadingPar, setLoadingPar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ubicaciones, setUbicaciones] = useState<UbicacionInventario[]>([]);
  const [partidas, setPartidas] = useState<PartidaProyectoOption[]>([]);
  const [scope, setScope] = useState<'related' | 'all'>('related');
  const [scopeForzado, setScopeForzado] = useState(false);

  const cargarUbicaciones = useCallback(async () => {
    if (!proyectoId.trim()) {
      setUbicaciones([]);
      return;
    }
    setLoadingUb(true);
    try {
      const qUb = new URLSearchParams({ proyecto_id: proyectoId, flat: '1' });
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
  }, [proyectoId]);

  const cargarPartidas = useCallback(async () => {
    if (!proyectoId.trim() || !materialId?.trim()) {
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
  }, [proyectoId, materialId, scope, scopeForzado]);

  useEffect(() => {
    void cargarUbicaciones();
  }, [cargarUbicaciones]);

  useEffect(() => {
    setScope('related');
    setScopeForzado(false);
    onPartidaChange('');
  }, [proyectoId, materialId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset partida al cambiar material

  useEffect(() => {
    void cargarPartidas();
  }, [cargarPartidas]);

  const loading = loadingUb || loadingPar;

  const valorRaw = valorCompuesto(ubicacionId, partidaKey);

  const valorSelect = useMemo(() => {
    if (loadingUb && !ubicaciones.length) return '';
    if (!valorRaw) return '';
    if (valorRaw.startsWith('ub:')) {
      const id = valorRaw.slice(3);
      return ubicaciones.some((u) => u.id === id) ? valorRaw : '';
    }
    if (valorRaw.startsWith('pp:') || valorRaw.startsWith('pd:')) {
      return partidas.some((p) => (p.key ?? `pp:${p.id}`) === valorRaw) ? valorRaw : '';
    }
    return '';
  }, [loadingUb, valorRaw, ubicaciones, partidas]);

  const obraUbicacionId = useMemo(() => {
    const deObra = ubicaciones.find((u) => u.tipo === 'obra' && u.obra_id === proyectoId);
    return deObra?.id ?? ubicaciones.find((u) => u.tipo === 'obra')?.id ?? '';
  }, [ubicaciones, proyectoId]);

  const handleChange = (raw: string) => {
    if (!raw) {
      onUbicacionChange('');
      onPartidaChange('');
      return;
    }
    if (raw.startsWith('pp:') || raw.startsWith('pd:')) {
      onPartidaChange(raw);
      if (obraUbicacionId) onUbicacionChange(obraUbicacionId);
      return;
    }
    if (raw.startsWith('ub:')) {
      onUbicacionChange(raw.slice(3));
      onPartidaChange('');
    }
  };

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
          Agregue el material primero para elegir destino y partidas…
        </option>
      </select>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={valorSelect}
        disabled={disabled || loadingUb}
        onChange={(e) => handleChange(e.target.value)}
        className={className}
      >
        <option value="" className="bg-[#0A0A0F] text-zinc-100">
          {loadingUb ? 'Cargando almacenes…' : 'Almacén de obra o partida Lulo…'}
        </option>

        {ubicaciones.length > 0 ? (
          <optgroup label="Almacenes / ubicaciones" className="bg-[#0A0A0F] text-zinc-100">
            {ubicaciones.map((u) => (
              <option key={u.id} value={`ub:${u.id}`} className="bg-[#0A0A0F] text-zinc-100">
                {labelUbicacionOpcion(u)}
              </option>
            ))}
          </optgroup>
        ) : null}

        {partidas.length > 0 ? (
          <optgroup
            label={
              scope === 'related'
                ? `Partidas con ${materialNombre ?? 'este material'}`
                : 'Todas las partidas del presupuesto'
            }
            className="bg-[#0A0A0F] text-zinc-100"
          >
            {partidas.map((p) => (
              <option
                key={p.key ?? p.id}
                value={p.key ?? `pp:${p.id}`}
                className="bg-[#0A0A0F] text-zinc-100"
              >
                {p.nombre}
              </option>
            ))}
          </optgroup>
        ) : null}
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
            Sugeridas
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
            Ver todas las partidas
          </button>
        </div>
        {loadingPar ? (
          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Partidas…
          </span>
        ) : null}
      </div>

      <p className="text-[10px] text-zinc-500">
        {scope === 'related'
          ? `Partidas del presupuesto cuyo APU incluye ${materialNombre ?? 'el material seleccionado'}.`
          : 'Todas las partidas del proyecto (modo anti-embudo).'}
      </p>

      {error ? <p className="text-[10px] font-bold text-amber-400">{error}</p> : null}
      {!loading && partidaKey && obraUbicacionId && ubicacionId === obraUbicacionId ? (
        <p className="text-[10px] text-sky-400/90">
          Partida Lulo seleccionada; ubicación de obra vinculada automáticamente.
        </p>
      ) : null}
      {!loading && !error && materialId && partidas.length === 0 && scope === 'related' ? (
        <p className="text-[10px] font-bold text-amber-400">
          Sin partidas relacionadas en APU. Use «Ver todas las partidas» o verifique el código SAP.
        </p>
      ) : null}
      {!loadingUb && !error && ubicaciones.length === 0 && partidas.length === 0 ? (
        <p className="text-[10px] font-bold text-amber-400">
          Sin almacenes ni partidas. Importe el presupuesto Lulo del proyecto.
        </p>
      ) : null}
    </div>
  );
}
