'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FLOTA_INPUT, FLOTA_LABEL } from '@/components/flota/FlotaShell';
import { crearConductor } from '@/lib/flota/conductoresCliente';
import type { FlotaConductor } from '@/lib/flota/conductores';
import { TIPOS_LICENCIA, unirNombreCompleto, type FlotaVehiculo } from '@/lib/flota/utils';

export type ConductorFormValues = {
  nombre_completo: string;
  cedula: string;
  numero_cedula: string;
  fecha_vencimiento_licencia: string;
  fecha_vencimiento_salud: string;
  telefono: string;
  email: string;
  tipo_licencia: string;
  licencia_numero: string;
  vehiculo_asignado_id: string;
  notas: string;
  activo: boolean;
};

export function conductorAValores(c?: FlotaConductor | null): ConductorFormValues {
  return {
    nombre_completo: c?.nombre_completo?.trim() || unirNombreCompleto(c?.nombres, c?.apellidos),
    cedula: c?.cedula ?? c?.numero_cedula ?? '',
    numero_cedula: c?.numero_cedula ?? c?.cedula ?? '',
    fecha_vencimiento_licencia: c?.fecha_vencimiento_licencia ?? c?.licencia_vence ?? '',
    fecha_vencimiento_salud: c?.fecha_vencimiento_salud ?? c?.certificado_medico_vence ?? '',
    telefono: c?.telefono ?? '',
    email: c?.email ?? '',
    tipo_licencia: c?.tipo_licencia ?? '',
    licencia_numero: c?.licencia_numero ?? '',
    vehiculo_asignado_id: c?.vehiculo_asignado_id ?? '',
    notas: c?.notas ?? '',
    activo: c?.activo !== false,
  };
}

export function ConductorForm({
  entidad_id = '',
  initial,
  vehiculos = [],
  saving,
  onSubmit,
  onCreated,
  onCancel,
}: {
  entidad_id?: string;
  initial?: FlotaConductor | null;
  vehiculos?: FlotaVehiculo[];
  saving?: boolean;
  onSubmit?: (values: ConductorFormValues) => Promise<void> | void;
  onCreated?: () => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ConductorFormValues>(() => conductorAValores(initial));
  const busy = Boolean(saving || loading);
  const set = (k: keyof ConductorFormValues, v: string | boolean) =>
    setFormData((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (onSubmit) {
      await onSubmit(formData);
      return;
    }

    setLoading(true);
    try {
      await crearConductor({
        entidad_id,
        ...formData,
      });
      setFormData(conductorAValores(null));
      await onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2"
    >
      <h3 className="text-lg font-semibold text-white sm:col-span-2">Registrar conductor</h3>

      <div className="sm:col-span-2">
        <label className={FLOTA_LABEL}>Nombre completo</label>
        <input
          className={FLOTA_INPUT}
          type="text"
          placeholder="Nombre y apellido"
          value={formData.nombre_completo}
          onChange={(e) => set('nombre_completo', e.target.value)}
          required
        />
      </div>

      <div>
        <label className={FLOTA_LABEL}>Cédula</label>
        <input
          className={FLOTA_INPUT}
          type="text"
          placeholder="V-12.345.678"
          value={formData.cedula}
          onChange={(e) => {
            set('cedula', e.target.value);
            set('numero_cedula', e.target.value);
          }}
          required
        />
      </div>
      <div>
        <label className={FLOTA_LABEL}>N.º cédula (opcional)</label>
        <input
          className={FLOTA_INPUT}
          type="text"
          value={formData.numero_cedula}
          onChange={(e) => set('numero_cedula', e.target.value)}
        />
      </div>

      <div>
        <label className={FLOTA_LABEL}>Vencimiento licencia</label>
        <input
          className={FLOTA_INPUT}
          type="date"
          value={formData.fecha_vencimiento_licencia}
          onChange={(e) => set('fecha_vencimiento_licencia', e.target.value)}
        />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Vencimiento certificado de salud</label>
        <input
          className={FLOTA_INPUT}
          type="date"
          value={formData.fecha_vencimiento_salud}
          onChange={(e) => set('fecha_vencimiento_salud', e.target.value)}
        />
      </div>

      <div>
        <label className={FLOTA_LABEL}>Teléfono</label>
        <input className={FLOTA_INPUT} value={formData.telefono} onChange={(e) => set('telefono', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Correo</label>
        <input
          className={FLOTA_INPUT}
          type="email"
          value={formData.email}
          onChange={(e) => set('email', e.target.value)}
        />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Tipo de licencia</label>
        <select className={FLOTA_INPUT} value={formData.tipo_licencia} onChange={(e) => set('tipo_licencia', e.target.value)}>
          <option value="">Seleccionar…</option>
          {TIPOS_LICENCIA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={FLOTA_LABEL}>N.º licencia</label>
        <input
          className={FLOTA_INPUT}
          value={formData.licencia_numero}
          onChange={(e) => set('licencia_numero', e.target.value)}
        />
      </div>
      {vehiculos.length ? (
        <div className="sm:col-span-2">
          <label className={FLOTA_LABEL}>Vehículo asignado</label>
          <select
            className={FLOTA_INPUT}
            value={formData.vehiculo_asignado_id}
            onChange={(e) => set('vehiculo_asignado_id', e.target.value)}
          >
            <option value="">Sin asignar</option>
            {vehiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa}
                {v.marca ? ` · ${v.marca}` : ''}
                {v.modelo ? ` ${v.modelo}` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <label className={FLOTA_LABEL}>Notas</label>
        <input className={FLOTA_INPUT} value={formData.notas} onChange={(e) => set('notas', e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={formData.activo}
          onChange={(e) => set('activo', e.target.checked)}
        />
        Activo
      </label>

      {error ? <p className="text-sm text-red-300 sm:col-span-2">{error}</p> : null}

      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" variant="elitePrimary" disabled={busy}>
          {busy ? 'Guardando…' : initial ? 'Actualizar' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}

export default ConductorForm;
