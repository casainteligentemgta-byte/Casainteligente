import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export function supabaseAdminMovimientos():
  | { ok: true; client: SupabaseClient }
  | { ok: false; response: NextResponse } {
  const adminOnly = createSupabaseAdminOnlyClient();
  if (adminOnly) return { ok: true, client: adminOnly };

  const routed = supabaseAdminForRoute();
  if (routed.ok) return { ok: true, client: routed.client };

  return { ok: false, response: routed.response };
}
