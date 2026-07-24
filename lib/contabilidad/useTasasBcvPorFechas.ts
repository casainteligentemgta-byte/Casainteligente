'use client';

import { useEffect, useMemo, useState } from 'react';
import { tasaBcvCompra } from '@/lib/contabilidad/comprasMontos';

type CompraConFecha = {
  fecha?: string | null;
  tasa_bcv_ves_por_usd?: number | null;
};

/** Tasas BCV (Bs/USD) solo para fechas sin tasa guardada en la compra. */
export function useTasasBcvPorFechas(compras: CompraConFecha[]) {
  const claves = useMemo(() => {
    const set = new Set<string>();
    for (const c of compras) {
      if (tasaBcvCompra(c) != null) continue;
      const iso = c.fecha?.trim().slice(0, 10);
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) set.add(iso);
    }
    return Array.from(set).sort();
  }, [compras]);

  const [tasas, setTasas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!claves.length) {
      setTasas({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch(
          `/api/finanzas/bcv-tasas?fechas=${encodeURIComponent(claves.join(','))}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('BCV batch');
        const json = (await res.json()) as { tasas?: Record<string, number> };
        if (!cancelled) setTasas(json.tasas ?? {});
      } catch {
        if (!cancelled) setTasas({});
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [claves.join('|')]);

  const getTasa = (fecha: string | null | undefined): number | null => {
    const iso = fecha?.trim().slice(0, 10);
    if (!iso) return null;
    const t = tasas[iso];
    return t != null && t > 0 ? t : null;
  };

  return { tasas, getTasa, loading };
}
