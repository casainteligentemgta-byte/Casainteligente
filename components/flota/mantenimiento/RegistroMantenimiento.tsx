'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FLOTA_INPUT, FLOTA_LABEL } from '@/components/flota/FlotaShell';
import { ETIQUETA_TIPO_MANTENIMIENTO } from '@/lib/flota/mantenimiento';
import { TIPOS_MANTENIMIENTO, hoyIso, type FlotaVehiculo } from '@/lib/flota/utils';

export type MantenimientoFormValues = {
  vehiculo_id: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  odometro_km: string;
  costo_usd: string;
  costo_bs: string;
  taller: string;
  proximo_odometro_km: string;
  proximo_fecha: string;
};

export default function RegistroMantenimiento({
  vehiculos,
  saving,
  onSubmit,
}: {
  vehiculos: FlotaVehiculo[];
  saving?: boolean;
  onSubmit: (values: MantenimientoFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<MantenimientoFormValues>({
    vehiculo_id: '',
    fecha: hoyIso(),
    tipo: 'preventivo',
    descripcion: '',
    odometro_km: '',
    costo_usd: '',
    costo_bs: '',
    taller: '',
    proximo_odometro_km: '',
    proximo_fecha: '',
  });
  const set = (k: keyof MantenimientoFormValues, v: string) => setValues((s) => ({ ...s, [k]: v }));

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
        <label className={FLOTA_LABEL}>Tipo</label>
        <select className={FLOTA_INPUT} value={values.tipo} onChange={(e) => set('tipo', e.target.value)}>
          {TIPOS_MANTENIMIENTO.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO_MANTENIMIENTO[t]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={FLOTA_LABEL}>Fecha</label>
        <input className={FLOTA_INPUT} type="date" required value={values.fecha} onChange={(e) => set('fecha', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Odómetro (km)</label>
        <input className={FLOTA_INPUT} inputMode="decimal" value={values.odometro_km} onChange={(e) => set('odometro_km', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={FLOTA_LABEL}>Descripción</label>
        <input className={FLOTA_INPUT} value={values.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Cambio de aceite y filtros" />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Taller</label>
        <input className={FLOTA_INPUT} value={values.taller} onChange={(e) => set('taller', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Costo USD</label>
        <input className={FLOTA_INPUT} inputMode="decimal" value={values.costo_usd} onChange={(e) => set('costo_usd', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Costo Bs</label>
        <input className={FLOTA_INPUT} inputMode="decimal" value={values.costo_bs} onChange={(e) => set('costo_bs', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Próximo servicio (km)</label>
        <input className={FLOTA_INPUT} inputMode="decimal" value={values.proximo_odometro_km} onChange={(e) => set('proximo_odometro_km', e.target.value)} />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Próximo servicio (fecha)</label>
        <input className={FLOTA_INPUT} type="date" value={values.proximo_fecha} onChange={(e) => set('proximo_fecha', e.target.value)} />
      </div>
      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" variant="elitePrimary" disabled={saving}>
          {saving ? 'Guardando…' : 'Registrar servicio'}
        </Button>
      </div>
    </form>
  );
}
