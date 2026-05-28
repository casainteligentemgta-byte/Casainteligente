'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { UbicacionInventario } from '@/types/inventario-obra';

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

export default function DestinoObraDespachoSelect({
  proyectoId,
  ubicacionId,
  partidaKey,
  onUbicacionChange,
  onPartidaChange,
  disabled,
  className = selectClass,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ubicaciones, setUbicaciones] = useState<UbicacionInventario[]>([]);
  const [partidas, setPartidas] = useState<PartidaProyectoOption[]>([]);

  const cargar = useCallback(async () => {
    if (!proyectoId.trim()) {
      setUbicaciones([]);
      setPartidas([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qUb = new URLSearchParams({ proyecto_id: proyectoId, flat: '1' });
      const qPar = new URLSearchParams({ proyecto_id: proyectoId });
      const [resUb, resPar] = await Promise.all([
        fetch(`/api/almacen/ubicaciones?${qUb}`, { cache: 'no-store' }),
        fetch(`/api/almacen/partidas-proyecto?${qPar}`, { cache: 'no-store' }),
      ]);

      const dataUb = (await resUb.json()) as {
        ubicaciones?: UbicacionInventario[];
        error?: string;
      };
      const dataPar = (await resPar.json()) as {
        partidas?: PartidaProyectoOption[];
        error?: string;
      };

      if (!resUb.ok) throw new Error(dataUb.error || 'No se pudieron cargar almacenes');
      if (!resPar.ok) throw new Error(dataPar.error || 'No se pudieron cargar partidas Lulo');

      setUbicaciones(dataUb.ubicaciones ?? []);
      setPartidas(dataPar.partidas ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar destino');
      setUbicaciones([]);
      setPartidas([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const valorRaw = valorCompuesto(ubicacionId, partidaKey);

  /** Evita mismatch de hidratación: no fijar value si la opción aún no existe. */
  const valorSelect = useMemo(() => {
    if (loading) return '';
    if (!valorRaw) return '';
    if (valorRaw.startsWith('ub:')) {
      const id = valorRaw.slice(3);
      return ubicaciones.some((u) => u.id === id) ? valorRaw : '';
    }
    if (valorRaw.startsWith('pp:') || valorRaw.startsWith('pd:')) {
      return partidas.some((p) => (p.key ?? `pp:${p.id}`) === valorRaw) ? valorRaw : '';
    }
    return '';
  }, [loading, valorRaw, ubicaciones, partidas]);

  const obraUbicacionId = useMemo(() => {
    const deObra = ubicaciones.find(
      (u) => u.tipo === 'obra' && u.obra_id === proyectoId,
    );
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

  return (
    <div className="space-y-1">
      <select
        value={valorSelect}
        disabled={disabled || loading}
        onChange={(e) => handleChange(e.target.value)}
        className={className}
      >
        <option value="" className="bg-[#0A0A0F] text-zinc-100">
          {loading ? 'Cargando destino y partidas…' : 'Almacén de obra o partida Lulo…'}
        </option>

        {ubicaciones.length > 0 ? (
          <optgroup label="Almacenes / ubicaciones" className="bg-[#0A0A0F] text-zinc-100">
            {ubicaciones.map((u) => {
              const tipo =
                u.tipo === 'almacen_central'
                  ? 'Central'
                  : u.tipo === 'almacen_movil'
                    ? 'Móvil'
                    : u.tipo === 'obra'
                      ? 'Obra'
                      : u.tipo;
              return (
                <option key={u.id} value={`ub:${u.id}`} className="bg-[#0A0A0F] text-zinc-100">
                  {u.nombre} ({tipo})
                </option>
              );
            })}
          </optgroup>
        ) : null}

        {partidas.length > 0 ? (
          <optgroup label="Partidas Lulo (presupuesto)" className="bg-[#0A0A0F] text-zinc-100">
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

      {loading ? (
        <p className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Cargando ubicaciones y partidas del presupuesto…
        </p>
      ) : null}
      {error ? <p className="text-[10px] font-bold text-amber-400">{error}</p> : null}
      {!loading && partidaKey && obraUbicacionId && ubicacionId === obraUbicacionId ? (
        <p className="text-[10px] text-sky-400/90">
          Partida Lulo seleccionada; ubicación de obra vinculada automáticamente.
        </p>
      ) : null}
      {!loading && !error && ubicaciones.length === 0 && partidas.length === 0 ? (
        <p className="text-[10px] font-bold text-amber-400">
          Sin almacenes ni partidas. Importe el presupuesto Lulo del proyecto.
        </p>
      ) : null}
    </div>
  );
}
