import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  resolverAccesoLegal,
  type AccesoLegal,
} from '@/lib/legal/accesoLegal';

export type RequireLegalOk = {
  ok: true;
  acceso: AccesoLegal;
  supabase: SupabaseClient;
  admin: SupabaseClient;
  userId: string;
  email: string | null;
};

export type RequireLegalFail = { ok: false; response: NextResponse };

export async function requireAccesoLegal(): Promise<RequireLegalOk | RequireLegalFail> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 }),
    };
  }

  const admin = createSupabaseAdminOnlyClient() ?? supabase;
  const acceso = await resolverAccesoLegal(admin, user.id, user.email);

  if (!acceso.ok || !acceso.orgId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sin acceso al Departamento Legal', code: 'legal_forbidden' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    acceso,
    supabase,
    admin,
    userId: user.id,
    email: user.email ?? null,
  };
}
