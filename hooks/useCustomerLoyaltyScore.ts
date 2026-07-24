'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { calculateCustomerLoyaltyScore } from '@/lib/finanzas/customerScore';

export function useCustomerLoyaltyScore(customerId: string | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const id = (customerId ?? '').trim();

  return useQuery({
    queryKey: ['customer-loyalty-score', id],
    queryFn: () => calculateCustomerLoyaltyScore(supabase, id),
    enabled: id.length > 0,
    staleTime: 60_000,
  });
}
