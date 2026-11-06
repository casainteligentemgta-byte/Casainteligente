'use client';

import { useEffect, useState } from 'react';
import { resolverTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';

export function useTasaBcvHoy(fecha?: string) {
  const [tasa, setTasa] = useState<number | null>(null);
  const [fuente, setFuente] = useState<string | null>(null);
  const [estado, setEstado] = useState<'actualizada' | 'desactualizada' | null>(null);
  const [fechaValor, setFechaValor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const f =
      fecha?.trim() ||
      (typeof window !== 'undefined'
        ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())
        : '');
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
        setEstado(r.estado === 'desactualizada' ? 'desactualizada' : 'actualizada');
        setFechaValor(r.fecha_valor ?? r.fecha ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setTasa(null);
          setFuente(null);
          setEstado(null);
          setFechaValor(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fecha]);

  return { tasa, fuente, estado, fechaValor, loading };
}
