'use client';

import { useRef, useState } from 'react';
import { Camera, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FLOTA_INPUT, FLOTA_LABEL } from '@/components/flota/FlotaShell';
import { aplicarExtraccionAFormulario } from '@/lib/flota/extractFacturaGasolina';
import { leerFacturaGasolina, registrarGasolina } from '@/lib/flota/gasolinaCliente';
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
  factura_url: string;
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
  factura_url: '',
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
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrOk, setOcrOk] = useState<string | null>(null);
  const [ocrAvisos, setOcrAvisos] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState<GasolinaFormValues>({
    ...VACIO,
    maquinaria_id,
    fecha: hoyIso(),
  });
  const busy = Boolean(saving || loading || ocrBusy);
  const set = (k: keyof GasolinaFormValues, v: string) => setFormData((s) => ({ ...s, [k]: v }));

  const litros = Number(String(formData.cantidad_litros).replace(',', '.'));
  const costo = Number(String(formData.costo_total).replace(',', '.'));
  const precio_litro =
    Number.isFinite(litros) && litros > 0 && Number.isFinite(costo) ? (costo / litros).toFixed(2) : '0';

  async function handleFoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setOcrOk(null);
    setOcrAvisos([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    setOcrBusy(true);
    try {
      const lectura = await leerFacturaGasolina(file);
      const aplicado = aplicarExtraccionAFormulario(formData, lectura, vehiculos);
      setFormData((prev) => ({
        ...prev,
        ...aplicado.form,
        km_actual: prev.km_actual,
        conductor_id: prev.conductor_id,
        maquinaria_id: aplicado.form.maquinaria_id || prev.maquinaria_id,
        factura_url: lectura.factura_url ?? aplicado.form.factura_url ?? '',
      }));
      setOcrAvisos(aplicado.avisos);
      setOcrOk(
        aplicado.campos.length
          ? `Datos leídos: ${aplicado.campos.join(', ')}. Revise y pulse Guardar.`
          : 'Foto leída. Complete los datos que falten y pulse Guardar.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOcrBusy(false);
    }
  }

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
        fecha: formData.fecha,
        notas: formData.notas,
        factura_url: formData.factura_url || undefined,
      });
      setFormData({ ...VACIO, maquinaria_id: unidad, fecha: hoyIso() });
      setOcrOk(null);
      setOcrAvisos([]);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
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

      <div className="sm:col-span-2 space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
        <p className="text-xs font-medium text-amber-100/90">
          Foto de la factura: se cargan fecha, litros, monto y estación. Revise antes de guardar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="elite"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="h-4 w-4" aria-hidden />
            {ocrBusy ? 'Leyendo factura…' : 'Tomar foto'}
          </Button>
          <Button
            type="button"
            variant="elite"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
          >
            <Images className="h-4 w-4" aria-hidden />
            Galería / archivo
          </Button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          className="hidden"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void handleFoto(file);
          }}
          aria-label="Tomar foto de la factura de gasolina"
        />
        <input
          ref={galleryRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*,application/pdf"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void handleFoto(file);
          }}
          aria-label="Elegir foto o PDF de la factura de gasolina"
        />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Vista previa de la factura"
            className="mt-1 max-h-40 w-full rounded-md border border-white/10 object-contain bg-black/40"
          />
        ) : null}
        {ocrOk ? <p className="text-sm text-emerald-300">{ocrOk}</p> : null}
        {ocrAvisos.length ? (
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-100/80">
            {ocrAvisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : null}
      </div>

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
        <label className={FLOTA_LABEL}>Estación de servicio</label>
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
          {busy ? (ocrBusy ? 'Leyendo factura…' : 'Guardando…') : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}

export default RegistroGasolina;
