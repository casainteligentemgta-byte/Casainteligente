import { NextResponse } from 'next/server';
import {
  cargarAlertasConfig,
  umbralesFechaComprasPublicos,
} from '@/lib/alertas/alertasConfig';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

function supabaseForApi() {
  return createSupabaseAdminOnlyClient() ?? null;
}

/** Umbrales públicos para UI cliente (compras, etc.). */
export async function GET() {
  const admin = supabaseForApi();
  const supabase = admin ?? (await createClient());

  try {
    const { config } = await cargarAlertasConfig(supabase);
    return NextResponse.json({
      ok: true,
      compras: umbralesFechaComprasPublicos(config),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar umbrales';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
