'use client';

import { useEffect, useState } from 'react';
import { resolverTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';

export function useTasaBcvHoy(fecha?: string) {
  const [tasa, setTasa] = useState<number | null>(null);
  const [fuente, setFuente] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const f =
      fecha?.trim() ||
      (typeof window !== 'undefined' ? new Date().toISOString().slice(0, 10) : '');
    if (!f) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void resolverTasaBcvVesPorUsd(f)
      .then((r) => {
        if (cancelled) return;
        setTasa(r.tasa_bcv_ves_por_usd);
        setFuente(r.fuente);
      })
      .catch(() => {
        if (!cancelled) setTasa(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fecha]);

  return { tasa, fuente, loading };
}
