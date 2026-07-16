import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { resolverAccesoLegal } from '@/lib/legal/accesoLegal';

export const dynamic = 'force-dynamic';

/** GET — ¿puede usar Departamento Legal? (icono + gate). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ ok: false, acceso: false }, { status: 401 });
  }

  const admin = createSupabaseAdminOnlyClient() ?? supabase;
  const acceso = await resolverAccesoLegal(admin, user.id, user.email);

  return NextResponse.json({
    ok: acceso.ok,
    acceso: acceso.ok,
    motivo: acceso.motivo,
    org_id: acceso.orgId,
    rol_legal: acceso.rolLegal,
  });
}
