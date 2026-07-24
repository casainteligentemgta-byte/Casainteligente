'use client';

import { useMemo } from 'react';
import { useTasaBcvHoy } from '@/lib/contabilidad/useTasaBcvHoy';
import { calcularAuditoriaFluctuacionCambiaria } from '@/lib/finanzas/calcularSaldoFlotanteBimonetario';
import { cn } from '@/lib/utils';

export type TarjetaBalanceBimonetarioFlotanteProps = {
  saldoVesFondo: number;
  saldoUsdFondo: number;
  tasaOriginalAbono: number;
};

export function TarjetaBalanceBimonetarioFlotante({
  saldoVesFondo,
  saldoUsdFondo,
  tasaOriginalAbono,
}: TarjetaBalanceBimonetarioFlotanteProps) {
  const { tasa: tasaBcvHoy, loading: isLoadingTasa } = useTasaBcvHoy();

  const audit = useMemo(
    () => calcularAuditoriaFluctuacionCambiaria(saldoVesFondo, tasaOriginalAbono, tasaBcvHoy),
    [saldoVesFondo, tasaOriginalAbono, tasaBcvHoy],
  );

  const tasaOrig = tasaOriginalAbono > 0 ? tasaOriginalAbono : 1;

  return (
    <div className="select-none rounded-xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Caja fuerte de custodia (Fondo Obra)
          </p>
          <h3 className="mt-1 font-mono text-2xl font-bold text-zinc-100">
            $
            {saldoUsdFondo.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            <span className="text-xs text-zinc-500">USD</span>
          </h3>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Saldo auxiliar retenido
          </p>
          <p className="mt-1 font-mono text-base font-semibold text-zinc-300">
            Bs.{' '}
            {saldoVesFondo.toLocaleString('es-VE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      <div className="flex flex-col space-y-2 border-t border-white/5 pt-4">
        <div className="flex justify-between font-mono text-[11px]">
          <span className="uppercase text-zinc-500">Tasa de congelación:</span>
          <span className="text-zinc-400">Bs. {tasaOrig.toFixed(4)}</span>
        </div>

        <div className="flex justify-between font-mono text-[11px]">
          <span className="uppercase text-zinc-500">Tasa de referencia oficial hoy:</span>
          <span
            className={cn(
              isLoadingTasa ? 'animate-pulse text-zinc-600' : 'text-orange-400',
            )}
          >
            Bs. {audit.tasaActualEfectiva.toFixed(4)}
          </span>
        </div>

        {audit.esPerdidaCritica ? (
          <div className="fade-in mt-2 flex items-center justify-between rounded border border-rose-500/20 bg-rose-500/10 p-2">
            <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-rose-400">
              ⚠️ Pérdida por fluctuación cambiaria flotante:
            </span>
            <span className="animate-pulse font-mono text-xs font-bold text-rose-500">
              -$
              {audit.perdidaPorFluctuacion.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USD
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
