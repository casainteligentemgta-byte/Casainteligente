'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CcoModulosPayload } from '@/lib/contabilidad/cargarCcoModulos';

export function useCcoModulos(proyectoId: string) {
  const [data, setData] = useState<CcoModulosPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (proyectoId) qs.set('proyecto', proyectoId);
      const res = await fetch(`/api/contabilidad/cco-modulos?${qs}`, { cache: 'no-store' });
      const json = (await res.json()) as CcoModulosPayload & { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al cargar módulos');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { data, loading, error, reload: cargar };
}
