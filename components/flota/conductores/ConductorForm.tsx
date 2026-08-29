'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FLOTA_INPUT, FLOTA_LABEL } from '@/components/flota/FlotaShell';
import type { FlotaConductor } from '@/lib/flota/conductores';
import { TIPOS_LICENCIA, type FlotaVehiculo } from '@/lib/flota/utils';

export type ConductorFormValues = {
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono: string;
  email: string;
  tipo_licencia: string;
  licencia_numero: string;
  licencia_vence: string;
  certificado_medico_vence: string;
  vehiculo_asignado_id: string;
  notas: string;
  activo: boolean;
};

export function conductorAValores(c?: FlotaConductor | null): ConductorFormValues {
  return {
    nombres: c?.nombres ?? '',
    apellidos: c?.apellidos ?? '',
    cedula: c?.cedula ?? '',
    telefono: c?.telefono ?? '',
    email: c?.email ?? '',
    tipo_licencia: c?.tipo_licencia ?? '',
    licencia_numero: c?.licencia_numero ?? '',
    licencia_vence: c?.licencia_vence ?? '',
    certificado_medico_vence: c?.certificado_medico_vence ?? '',
    vehiculo_asignado_id: c?.vehiculo_asignado_id ?? '',
    notas: c?.notas ?? '',
    activo: c?.activo !== false,
  };
}

export default function ConductorForm({
  initial,
  vehiculos,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: FlotaConductor | null;
  vehiculos: FlotaVehiculo[];
  saving?: boolean;
  onSubmit: (values: ConductorFormValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<ConductorFormValues>(() => conductorAValores(initial));
  const set = (k: keyof ConductorFormValues, v: string | boolean) =>
    setValues((s) => ({ ...s, [k]: v }));

  return (
    <form
      className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(values);
      }}
    >
      <div>
        <label className={FLOTA_LABEL}>Nombres</label>
        <input className={FLOTA_INPUT} required value={values.nombres} onChange={(e) => set('nombres', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Apellidos</label>
        <input className={FLOTA_INPUT} required value={values.apellidos} onChange={(e) => set('apellidos', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Cédula</label>
        <input className={FLOTA_INPUT} value={values.cedula} onChange={(e) => set('cedula', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Teléfono</label>
        <input className={FLOTA_INPUT} value={values.telefono} onChange={(e) => set('telefono', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Correo</label>
        <input className={FLOTA_INPUT} type="email" value={values.email} onChange={(e) => set('email', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Tipo de licencia</label>
        <select className={FLOTA_INPUT} value={values.tipo_licencia} onChange={(e) => set('tipo_licencia', e.target.value)}>
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
        <input className={FLOTA_INPUT} value={values.licencia_numero} onChange={(e) => set('licencia_numero', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Licencia vence</label>
        <input className={FLOTA_INPUT} type="date" value={values.licencia_vence} onChange={(e) => set('licencia_vence', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Certificado médico vence</label>
        <input
          className={FLOTA_INPUT}
          type="date"
          value={values.certificado_medico_vence}
          onChange={(e) => set('certificado_medico_vence', e.target.value)}
        />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Vehículo asignado</label>
        <select
          className={FLOTA_INPUT}
          value={values.vehiculo_asignado_id}
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
      <div className="sm:col-span-2">
        <label className={FLOTA_LABEL}>Notas</label>
        <input className={FLOTA_INPUT} value={values.notas} onChange={(e) => set('notas', e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={values.activo} onChange={(e) => set('activo', e.target.checked)} />
        Activo
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" variant="elitePrimary" disabled={saving}>
          {saving ? 'Guardando…' : initial ? 'Actualizar' : 'Registrar conductor'}
        </Button>
      </div>
    </form>
  );
}
