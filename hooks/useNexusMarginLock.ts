'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

export type NexusQuotePayload = {
  cliente_id?: string;
  monto_base_usd: number;
  descuento_solicitado: number;
};

type EficienciaAdResponse = {
  ratio_eficiencia?: number;
  bloquear_descuentos_nexus?: boolean;
  error?: string;
};

export function useNexusMarginLock() {
  const [bloquearDescuentos, setBloquearDescuentos] = useState(false);
  const [porcentajeEficienciaAD, setPorcentajeEficienciaAD] = useState(0);
  const [isLoadingValidacion, setIsLoadingValidacion] = useState(true);

  const refrescar = useCallback(async () => {
    setIsLoadingValidacion(true);
    try {
      const res = await fetch('/api/admin/config/nomina/eficiencia-ad', { cache: 'no-store' });
      const data = await parseFetchJson<EficienciaAdResponse>(res);
      if (!res.ok) throw new Error(data.error ?? 'No se pudo auditar la eficiencia AD');

      const ratio = Number(data.ratio_eficiencia ?? 0);
      setPorcentajeEficienciaAD(ratio);
      setBloquearDescuentos(Boolean(data.bloquear_descuentos_nexus ?? ratio >= 90));
    } catch (err) {
      console.error('Error evaluando candado de margen Nexus:', err);
      setBloquearDescuentos(false);
    } finally {
      setIsLoadingValidacion(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const validarYProcesarCotizacionNexus = useCallback(
    async (
      payload: NexusQuotePayload,
      submitCallback: () => Promise<void>,
    ): Promise<{ valid: true } | { valid: false; motivo?: string; error?: unknown }> => {
      if (bloquearDescuentos && payload.descuento_solicitado > 0) {
        toast.error(
          `Acción denegada. Los descuentos comerciales en Nexus están congelados temporalmente debido a variaciones en los índices de eficiencia de nómina administrativa (${porcentajeEficienciaAD.toFixed(1)}% de uso del fondo).`,
          { duration: 6000 },
        );
        return { valid: false, motivo: 'MARGEN_HOLDING_COMPROMETIDO' };
      }

      try {
        await submitCallback();
        return { valid: true };
      } catch (error) {
        toast.error('Error al procesar la cotización en Nexus.');
        return { valid: false, error };
      }
    },
    [bloquearDescuentos, porcentajeEficienciaAD],
  );

  return {
    validarYProcesarCotizacionNexus,
    bloquearDescuentos,
    porcentajeEficienciaAD,
    isLoadingValidacion,
    refrescar,
  };
}
