import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { recruitmentAllowSupabaseUser } from '@/lib/recruitment/ceo-auth';

/** Sesión Supabase válida (solo si RECRUITMENT_ALLOW_SUPABASE_USER=true). */
export async function hasSupabaseCeoSession(): Promise<boolean> {
  if (!recruitmentAllowSupabaseUser()) return false;
  const supabase = createClient(cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}
