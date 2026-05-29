'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { UbicacionInventario } from '@/types/inventario-obra';
import { labelUbicacionOpcion } from '@/lib/almacen/ubicacionesInventario';

const selectClass =
  'w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors hover:bg-white/[0.04] focus:border-white/20 disabled:opacity-50';

type Props = {
  proyectoId: string;
  value: string;
  onChange: (ubicacionId: string) => void;
  /** Si true, lista almacenes centrales/móviles aunque no haya proyecto (útil para origen). */
  permitirSinProyecto?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
};

export default function UbicacionInventarioSelect({
  proyectoId,
  value,
  onChange,
  permitirSinProyecto = false,
  disabled,
  id = 'ubicacion-inventario',
  className = selectClass,
  placeholder = 'Seleccione almacén de ingreso…',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [ubicaciones, setUbicaciones] = useState<UbicacionInventario[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!proyectoId.trim() && !permitirSinProyecto) {
      setUbicaciones([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ flat: '1' });
      if (proyectoId.trim()) q.set('proyecto_id', proyectoId);
      const res = await fetch(`/api/almacen/ubicaciones?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as {
        ubicaciones?: UbicacionInventario[];
        error?: string;
        migracionPendiente?: boolean;
      };
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar almacenes');
      setUbicaciones(data.ubicaciones ?? []);
      if (data.migracionPendiente) {
        setError('Módulo de inventario no configurado (migraciones 180–181).');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar almacenes');
      setUbicaciones([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, permitirSinProyecto]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!value || ubicaciones.some((u) => u.id === value)) return;
    onChange('');
  }, [ubicaciones, value, onChange]);

  const valorSelect = useMemo(() => {
    if (loading) return '';
    if (!value) return '';
    return ubicaciones.some((u) => u.id === value) ? value : '';
  }, [loading, value, ubicaciones]);

  if (!proyectoId.trim() && !permitirSinProyecto) {
    return (
      <select id={id} disabled className={className}>
        <option value="" className="bg-[#0A0A0F] text-zinc-100">
          Primero seleccione la obra…
        </option>
      </select>
    );
  }

  return (
    <div className="space-y-1">
      <select
        id={id}
        value={valorSelect}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        <option value="" className="bg-[#0A0A0F] text-zinc-100">
          {loading ? 'Cargando almacenes…' : placeholder}
        </option>
        {ubicaciones.map((u) => (
          <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
            {labelUbicacionOpcion(u)}
          </option>
        ))}
      </select>
      {loading ? (
        <p className="text-[10px] text-zinc-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Cargando ubicaciones…
        </p>
      ) : null}
      {error ? <p className="text-[10px] text-amber-500">{error}</p> : null}
      {!loading && !error && ubicaciones.length === 0 && proyectoId ? (
        <p className="text-[10px] text-amber-500">
          Sin almacenes para esta obra. Se creará la ubicación de obra al guardar.
        </p>
      ) : null}
    </div>
  );
}
