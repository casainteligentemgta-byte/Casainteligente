'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ContratoAdResumen } from '@/lib/proyectos/contratoAdministracionDelegada';

export function useContratoAdProyecto(proyectoId: string | undefined) {
  const [loading, setLoading] = useState(Boolean(proyectoId));
  const [autorizado, setAutorizado] = useState(true);
  const [contrato, setContrato] = useState<ContratoAdResumen | null>(null);

  const refrescar = useCallback(async () => {
    if (!proyectoId) {
      setAutorizado(true);
      setContrato(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoId)}/contrato-ad`, {
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        autorizado?: boolean;
        contrato?: ContratoAdResumen | null;
      };
      if (res.ok) {
        setAutorizado(Boolean(data.autorizado));
        setContrato(data.contrato ?? null);
      }
    } catch {
      setAutorizado(true);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  return { loading, autorizado, contrato, refrescar };
}
