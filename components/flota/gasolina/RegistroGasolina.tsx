'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FLOTA_INPUT, FLOTA_LABEL } from '@/components/flota/FlotaShell';
import type { FlotaConductor } from '@/lib/flota/conductores';
import { hoyIso, type FlotaVehiculo } from '@/lib/flota/utils';

export type GasolinaFormValues = {
  vehiculo_id: string;
  conductor_id: string;
  fecha: string;
  litros: string;
  odometro_km: string;
  precio_litro_usd: string;
  precio_litro_bs: string;
  estacion: string;
  notas: string;
};

export default function RegistroGasolina({
  vehiculos,
  conductores,
  saving,
  onSubmit,
}: {
  vehiculos: FlotaVehiculo[];
  conductores: FlotaConductor[];
  saving?: boolean;
  onSubmit: (values: GasolinaFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<GasolinaFormValues>({
    vehiculo_id: '',
    conductor_id: '',
    fecha: hoyIso(),
    litros: '',
    odometro_km: '',
    precio_litro_usd: '',
    precio_litro_bs: '',
    estacion: '',
    notas: '',
  });
  const set = (k: keyof GasolinaFormValues, v: string) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <form
      className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(values);
      }}
    >
      <div>
        <label className={FLOTA_LABEL}>Unidad</label>
        <select className={FLOTA_INPUT} required value={values.vehiculo_id} onChange={(e) => set('vehiculo_id', e.target.value)}>
          <option value="">Seleccionar placa…</option>
          {vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.placa}
              {v.marca ? ` · ${v.marca}` : ''} {v.modelo ?? ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={FLOTA_LABEL}>Conductor</label>
        <select className={FLOTA_INPUT} value={values.conductor_id} onChange={(e) => set('conductor_id', e.target.value)}>
          <option value="">Opcional</option>
          {conductores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombres} {c.apellidos}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={FLOTA_LABEL}>Fecha</label>
        <input className={FLOTA_INPUT} type="date" required value={values.fecha} onChange={(e) => set('fecha', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Litros</label>
        <input className={FLOTA_INPUT} required inputMode="decimal" value={values.litros} onChange={(e) => set('litros', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Odómetro (km)</label>
        <input className={FLOTA_INPUT} inputMode="decimal" value={values.odometro_km} onChange={(e) => set('odometro_km', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Estación</label>
        <input className={FLOTA_INPUT} value={values.estacion} onChange={(e) => set('estacion', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Precio USD / litro</label>
        <input className={FLOTA_INPUT} inputMode="decimal" value={values.precio_litro_usd} onChange={(e) => set('precio_litro_usd', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Precio Bs / litro</label>
        <input className={FLOTA_INPUT} inputMode="decimal" value={values.precio_litro_bs} onChange={(e) => set('precio_litro_bs', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={FLOTA_LABEL}>Notas</label>
        <input className={FLOTA_INPUT} value={values.notas} onChange={(e) => set('notas', e.target.value)} />
      </div>
      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" variant="elitePrimary" disabled={saving}>
          {saving ? 'Guardando…' : 'Registrar carga'}
        </Button>
      </div>
    </form>
  );
}
