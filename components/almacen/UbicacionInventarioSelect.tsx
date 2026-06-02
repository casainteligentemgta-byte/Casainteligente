'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { UbicacionInventario } from '@/types/inventario-obra';
import { labelUbicacionOpcion } from '@/lib/almacen/ubicacionesInventario';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const selectClass =
  'w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors hover:bg-white/[0.04] focus:border-white/20 disabled:opacity-50 min-h-[46px]';

type Props = {
  proyectoId: string;
  value: string;
  onChange: (ubicacionId: string) => void;
  /** Si true, lista almacenes centrales/móviles aunque no haya proyecto (útil para origen). */
  permitirSinProyecto?: boolean;
  /** Excluye ubicaciones de obra (solo central y móvil). Por defecto true en ingreso de compra. */
  soloAlmacenes?: boolean;
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
  soloAlmacenes = true,
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
      if (soloAlmacenes) q.set('solo_almacenes', '1');
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
  }, [proyectoId, permitirSinProyecto, soloAlmacenes]);

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

  const placeholderActual = loading ? 'Cargando almacenes…' : placeholder;

  if (!proyectoId.trim() && !permitirSinProyecto) {
    return (
      <Select disabled value="">
        <SelectTrigger id={id} className={className}>
          Primero seleccione la obra…
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <div className="space-y-1">
      <Select
        value={valorSelect}
        onValueChange={onChange}
        disabled={disabled || loading}
      >
        <SelectValue placeholder={placeholderActual} />
        <SelectTrigger id={id} className={className} aria-busy={loading}>
          {loading ? (
            <span className="flex items-center gap-2 text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#FF9500]" />
              Cargando almacenes…
            </span>
          ) : undefined}
        </SelectTrigger>
        <SelectContent>
          {ubicaciones.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {labelUbicacionOpcion(u)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-[10px] text-amber-500">{error}</p> : null}
      {!loading && !error && ubicaciones.length === 0 && proyectoId ? (
        <p className="text-[10px] text-amber-500">
          Sin almacén central o móvil configurado. Revise Maestros → Depósitos o migraciones 180–181.
        </p>
      ) : null}
    </div>
  );
}
