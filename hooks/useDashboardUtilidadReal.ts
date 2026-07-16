'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchDashboardUtilidadRealData } from '@/lib/finanzas/fetchDashboardUtilidadRealData';

/**
 * React Query: métricas consolidadas de utilidad real para un `ci_proyectos.id`.
 */
export function useDashboardUtilidadReal(proyectoId: string | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const id = (proyectoId ?? '').trim();

  return useQuery({
    queryKey: ['dashboard-utilidad-real', id],
    queryFn: () => fetchDashboardUtilidadRealData(supabase, id),
    enabled: id.length > 0,
    staleTime: 60_000,
  });
}
