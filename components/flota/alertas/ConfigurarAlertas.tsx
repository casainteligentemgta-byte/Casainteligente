'use client';

import { Button } from '@/components/ui/button';
import { FLOTA_INPUT, FLOTA_LABEL } from '@/components/flota/FlotaShell';
import type { FlotaAlertaConfig } from '@/lib/flota/alertas';
import { ETIQUETA_TIPO_ALERTA } from '@/lib/flota/utils';

export default function ConfigurarAlertas({
  configs,
  savingId,
  onSave,
}: {
  configs: FlotaAlertaConfig[];
  savingId?: string | null;
  onSave: (id: string, patch: { dias_anticipacion: number; umbral_consumo_km_l: number | null; activa: boolean }) => void;
}) {
  if (!configs.length) {
    return <p className="text-sm text-zinc-500">Sin configuración. Aplique la migración 313.</p>;
  }

  return (
    <div className="space-y-3">
      {configs.map((c) => (
        <form
          key={c.id}
          className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-4 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSave(c.id, {
              dias_anticipacion: Number(fd.get('dias') ?? c.dias_anticipacion),
              umbral_consumo_km_l: fd.get('umbral') ? Number(fd.get('umbral')) : null,
              activa: fd.get('activa') === 'on',
            });
          }}
        >
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-white">
              {ETIQUETA_TIPO_ALERTA[c.tipo] ?? c.tipo_alerta ?? c.tipo}
            </p>
            <p className="text-xs text-zinc-500">{c.tipo}</p>
          </div>
          <div>
            <label className={FLOTA_LABEL}>Días de anticipación</label>
            <input className={FLOTA_INPUT} name="dias" type="number" min={0} defaultValue={c.dias_anticipacion} />
          </div>
          {c.tipo === 'consumo_alto' ? (
            <div>
              <label className={FLOTA_LABEL}>Umbral km/l (mínimo)</label>
              <input
                className={FLOTA_INPUT}
                name="umbral"
                type="number"
                step="0.1"
                min={0}
                defaultValue={c.umbral_consumo_km_l ?? ''}
              />
            </div>
          ) : (
            <input type="hidden" name="umbral" value={c.umbral_consumo_km_l ?? ''} />
          )}
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="activa" defaultChecked={c.activa} />
            Activa
          </label>
          <div className="sm:col-span-4 flex justify-end">
            <Button type="submit" variant="elite" disabled={savingId === c.id}>
              {savingId === c.id ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      ))}
    </div>
  );
}
