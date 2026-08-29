'use client';

import { Button } from '@/components/ui/button';
import type { FlotaAlerta } from '@/lib/flota/alertas';
import { formatoFechaVe } from '@/lib/flota/utils';

const SEV: Record<FlotaAlerta['severidad'], string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  critica: 'border-red-500/40 bg-red-500/10 text-red-100',
};

export default function AlertasPanel({
  alertas,
  generando,
  onGenerar,
  onResolver,
  onLeida,
}: {
  alertas: FlotaAlerta[];
  generando?: boolean;
  onGenerar: () => void;
  onResolver: (id: string) => void;
  onLeida: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          {alertas.filter((a) => !a.resuelta).length} alerta(s) abierta(s)
        </p>
        <Button type="button" variant="elite" disabled={generando} onClick={onGenerar}>
          {generando ? 'Revisando…' : 'Generar alertas'}
        </Button>
      </div>
      {alertas.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay alertas abiertas. Genere el barrido o registre vencimientos.</p>
      ) : (
        <ul className="space-y-2">
          {alertas.map((a) => (
            <li key={a.id} className={`rounded-xl border p-3 ${SEV[a.severidad]}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{a.severidad}</p>
                  <p className="font-semibold">{a.titulo}</p>
                  <p className="mt-1 text-sm opacity-90">{a.mensaje}</p>
                  {a.vence_el ? (
                    <p className="mt-1 text-xs opacity-70">Vence {formatoFechaVe(a.vence_el)}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {!a.leida ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => onLeida(a.id)}>
                      Marcar leída
                    </Button>
                  ) : null}
                  {!a.resuelta ? (
                    <Button type="button" size="sm" variant="elite" onClick={() => onResolver(a.id)}>
                      Resolver
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
