'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { UbicacionInventario } from '@/types/inventario-obra';

const selectClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50 disabled:opacity-50';

type Props = {
  proyectoId: string;
  value: string;
  onChange: (ubicacionId: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
};

export default function UbicacionInventarioSelect({
  proyectoId,
  value,
  onChange,
  disabled,
  id = 'ubicacion-inventario',
  className = selectClass,
  placeholder = 'Seleccione almacén de ingreso…',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [ubicaciones, setUbicaciones] = useState<UbicacionInventario[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!proyectoId.trim()) {
      setUbicaciones([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        proyecto_id: proyectoId,
        flat: '1',
      });
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
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!value || ubicaciones.some((u) => u.id === value)) return;
    onChange('');
  }, [ubicaciones, value, onChange]);

  if (!proyectoId.trim()) {
    return (
      <select id={id} disabled className={className}>
        <option value="">Primero seleccione la obra…</option>
      </select>
    );
  }

  return (
    <div className="space-y-1">
      <select
        id={id}
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        <option value="">{loading ? 'Cargando almacenes…' : placeholder}</option>
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
            <option key={u.id} value={u.id}>
              {u.nombre} ({tipo})
            </option>
          );
        })}
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
