'use client';

import { useEffect, useState } from 'react';
import {
  UMBRALES_FECHA_COMPRA_DEFAULT,
  type UmbralesFechaCompra,
} from '@/lib/contabilidad/auditoriaFechaCompra';

export function useUmbralesFechaCompras(): UmbralesFechaCompra {
  const [umbrales, setUmbrales] = useState<UmbralesFechaCompra>(UMBRALES_FECHA_COMPRA_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/alertas-config', { cache: 'no-store' });
        const data = (await res.json()) as {
          compras?: Partial<UmbralesFechaCompra> & {
            umbralAdvertenciaDias?: number;
            umbralCriticoDias?: number;
            umbralFuturoCriticoDias?: number;
          };
        };
        if (!res.ok || cancelled) return;
        const c = data.compras;
        if (!c) return;
        setUmbrales({
          advertenciaDias: Number(c.advertenciaDias ?? c.umbralAdvertenciaDias) || UMBRALES_FECHA_COMPRA_DEFAULT.advertenciaDias,
          criticoDias: Number(c.criticoDias ?? c.umbralCriticoDias) || UMBRALES_FECHA_COMPRA_DEFAULT.criticoDias,
          futuroCriticoDias:
            Number(c.futuroCriticoDias ?? c.umbralFuturoCriticoDias) ||
            UMBRALES_FECHA_COMPRA_DEFAULT.futuroCriticoDias,
        });
      } catch {
        /* defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return umbrales;
}
