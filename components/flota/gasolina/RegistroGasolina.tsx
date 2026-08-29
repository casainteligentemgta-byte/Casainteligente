'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FLOTA_INPUT, FLOTA_LABEL } from '@/components/flota/FlotaShell';
import { registrarGasolina } from '@/lib/flota/gasolinaCliente';
import type { FlotaConductor } from '@/lib/flota/conductores';
import { hoyIso, type FlotaVehiculo } from '@/lib/flota/utils';

export type GasolinaFormValues = {
  maquinaria_id: string;
  cantidad_litros: string;
  costo_total: string;
  km_actual: string;
  tipo_gasolina: string;
  estacion_gasolina: string;
  conductor_id: string;
  fecha: string;
  notas: string;
};

const VACIO: GasolinaFormValues = {
  maquinaria_id: '',
  cantidad_litros: '',
  costo_total: '',
  km_actual: '',
  tipo_gasolina: 'diesel',
  estacion_gasolina: '',
  conductor_id: '',
  fecha: hoyIso(),
  notas: '',
};

export function RegistroGasolina({
  maquinaria_id = '',
  vehiculos = [],
  conductores = [],
  saving,
  onSubmit,
  onCreated,
}: {
  maquinaria_id?: string;
  vehiculos?: FlotaVehiculo[];
  conductores?: FlotaConductor[];
  saving?: boolean;
  onSubmit?: (values: GasolinaFormValues) => Promise<void> | void;
  onCreated?: () => Promise<void> | void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<GasolinaFormValues>({
    ...VACIO,
    maquinaria_id,
    fecha: hoyIso(),
  });
  const busy = Boolean(saving || loading);
  const set = (k: keyof GasolinaFormValues, v: string) => setFormData((s) => ({ ...s, [k]: v }));

  const litros = Number(String(formData.cantidad_litros).replace(',', '.'));
  const costo = Number(String(formData.costo_total).replace(',', '.'));
  const precio_litro =
    Number.isFinite(litros) && litros > 0 && Number.isFinite(costo) ? (costo / litros).toFixed(2) : '0';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (onSubmit) {
      await onSubmit(formData);
      return;
    }

    const unidad = formData.maquinaria_id || maquinaria_id;
    setLoading(true);
    try {
      await registrarGasolina({
        maquinaria_id: unidad,
        cantidad_litros: parseFloat(formData.cantidad_litros),
        costo_total: parseFloat(formData.costo_total),
        km_actual: formData.km_actual ? parseInt(formData.km_actual, 10) : undefined,
        tipo_gasolina: formData.tipo_gasolina,
        estacion_gasolina: formData.estacion_gasolina,
        conductor_id: formData.conductor_id || undefined,
      });
      setFormData({ ...VACIO, maquinaria_id: unidad, fecha: hoyIso() });
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
      <h3 className="text-lg font-semibold text-white sm:col-span-2">Registrar gasolina</h3>

      {!maquinaria_id ? (
        <div>
          <label className={FLOTA_LABEL}>Unidad</label>
          <select
            className={FLOTA_INPUT}
            required
            value={formData.maquinaria_id}
            onChange={(e) => set('maquinaria_id', e.target.value)}
          >
            <option value="">Seleccionar placa…</option>
            {vehiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa}
                {v.marca ? ` · ${v.marca}` : ''} {v.modelo ?? ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {conductores.length ? (
        <div>
          <label className={FLOTA_LABEL}>Conductor</label>
          <select
            className={FLOTA_INPUT}
            value={formData.conductor_id}
            onChange={(e) => set('conductor_id', e.target.value)}
          >
            <option value="">Opcional</option>
            {conductores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_completo || `${c.nombres} ${c.apellidos}`.trim()}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className={FLOTA_LABEL}>Fecha</label>
        <input
          className={FLOTA_INPUT}
          type="date"
          required
          value={formData.fecha}
          onChange={(e) => set('fecha', e.target.value)}
        />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Litros</label>
        <input
          className={FLOTA_INPUT}
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="Litros"
          value={formData.cantidad_litros}
          onChange={(e) => set('cantidad_litros', e.target.value)}
        />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Costo total (USD)</label>
        <input
          className={FLOTA_INPUT}
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="Costo total"
          value={formData.costo_total}
          onChange={(e) => set('costo_total', e.target.value)}
        />
      </div>
      <p className="text-sm text-zinc-400 sm:col-span-2">Precio / litro: ${precio_litro}</p>
      <div>
        <label className={FLOTA_LABEL}>Km actual</label>
        <input
          className={FLOTA_INPUT}
          type="number"
          placeholder="KM actual"
          value={formData.km_actual}
          onChange={(e) => set('km_actual', e.target.value)}
        />
      </div>
      <div>
        <label className={FLOTA_LABEL}>Tipo</label>
        <select
          className={FLOTA_INPUT}
          value={formData.tipo_gasolina}
          onChange={(e) => set('tipo_gasolina', e.target.value)}
        >
          <option value="regular">Regular</option>
          <option value="premium">Premium</option>
          <option value="diesel">Diésel</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={FLOTA_LABEL}>Estación</label>
        <input
          className={FLOTA_INPUT}
          type="text"
          placeholder="Estación"
          value={formData.estacion_gasolina}
          onChange={(e) => set('estacion_gasolina', e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={FLOTA_LABEL}>Notas</label>
        <input className={FLOTA_INPUT} value={formData.notas} onChange={(e) => set('notas', e.target.value)} />
      </div>

      {error ? <p className="text-sm text-red-300 sm:col-span-2">{error}</p> : null}

      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" variant="elitePrimary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}

export default RegistroGasolina;
