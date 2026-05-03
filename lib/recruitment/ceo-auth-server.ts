import { createClient } from '@/lib/supabase/server';
import { recruitmentAllowSupabaseUser } from '@/lib/recruitment/ceo-auth';

/** Sesión Supabase válida (solo si RECRUITMENT_ALLOW_SUPABASE_USER=true). */
export async function hasSupabaseCeoSession(): Promise<boolean> {
  if (!recruitmentAllowSupabaseUser()) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user);
  } catch (e) {
    console.warn('[hasSupabaseCeoSession]', e);
    return false;
  }
}
