'use client';

import { useCallback, useEffect, useState } from 'react';
import { HardHat, Loader2, PenLine, UserCheck } from 'lucide-react';

export type ReceptorDespachoValue = {
  modo: 'nomina' | 'manual';
  empleadoId: string;
  nombre: string;
  oficio: string;
};

type EmpleadoOption = {
  id: string;
  nombre_completo: string;
  oficio: string | null;
};

type Props = {
  proyectoId: string;
  value: ReceptorDespachoValue;
  onChange: (value: ReceptorDespachoValue) => void;
  disabled?: boolean;
};

const emptyManual = (): ReceptorDespachoValue => ({
  modo: 'manual',
  empleadoId: '',
  nombre: '',
  oficio: '',
});

export function ReceptorDespachoSelect({ proyectoId, value, onChange, disabled }: Props) {
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!proyectoId.trim()) {
      setEmpleados([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ proyecto_id: proyectoId });
      const res = await fetch(`/api/almacen/empleados-egreso?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as { empleados?: EmpleadoOption[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar nómina');
      setEmpleados(data.empleados ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setEmpleados([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
      <div className="flex items-center gap-2">
        <HardHat className="h-4 w-4 text-violet-300" />
        <p className="text-xs font-bold uppercase tracking-wider text-violet-300/90">
          Obrero que recibe el material
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => onChange({ ...value, modo: 'nomina', empleadoId: '', nombre: '', oficio: '' })}
          className={`rounded-lg border px-3 py-2 text-left text-xs font-bold transition-colors ${
            value.modo === 'nomina'
              ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
              : 'border-white/10 bg-black/30 text-zinc-400'
          }`}
        >
          <UserCheck className="mb-1 h-3.5 w-3.5" />
          De la nómina del proyecto
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(emptyManual())}
          className={`rounded-lg border px-3 py-2 text-left text-xs font-bold transition-colors ${
            value.modo === 'manual'
              ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
              : 'border-white/10 bg-black/30 text-zinc-400'
          }`}
        >
          <PenLine className="mb-1 h-3.5 w-3.5" />
          Escribir nombre manualmente
        </button>
      </div>

      {value.modo === 'nomina' ? (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-500">Seleccionar obrero</label>
          <select
            disabled={disabled || loading}
            value={value.empleadoId}
            onChange={(e) => {
              const emp = empleados.find((x) => x.id === e.target.value);
              if (!emp) {
                onChange({ ...value, empleadoId: '', nombre: '', oficio: '' });
                return;
              }
              onChange({
                modo: 'nomina',
                empleadoId: emp.id,
                nombre: emp.nombre_completo,
                oficio: emp.oficio ?? '',
              });
            }}
            className="w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm"
          >
            <option value="" className="bg-[#0A0A0F]">
              {loading ? 'Cargando nómina…' : 'Seleccione obrero de la cuadrilla…'}
            </option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id} className="bg-[#0A0A0F]">
                {e.nombre_completo}
                {e.oficio ? ` · ${e.oficio}` : ''}
              </option>
            ))}
          </select>
          {loading ? (
            <p className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando obreros…
            </p>
          ) : null}
          {!loading && empleados.length === 0 ? (
            <p className="text-[10px] text-amber-400">
              Sin obreros en nómina para esta obra. Use «Escribir nombre manualmente».
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Nombre y apellido</label>
            <input
              type="text"
              disabled={disabled}
              value={value.nombre}
              onChange={(e) => onChange({ ...value, nombre: e.target.value, empleadoId: '' })}
              placeholder="Ej. Juan Pérez"
              className="w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Oficio / cargo</label>
            <input
              type="text"
              disabled={disabled}
              value={value.oficio}
              onChange={(e) => onChange({ ...value, oficio: e.target.value })}
              placeholder="Ej. Albañil, Electricista…"
              className="w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm"
            />
          </div>
        </div>
      )}

      {value.nombre.trim() ? (
        <p className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
          Recibe: <strong>{value.nombre.trim()}</strong>
          {value.oficio.trim() ? ` · ${value.oficio.trim()}` : ''}
        </p>
      ) : null}

      {error ? <p className="text-[10px] text-amber-400">{error}</p> : null}
    </div>
  );
}

export default ReceptorDespachoSelect;
