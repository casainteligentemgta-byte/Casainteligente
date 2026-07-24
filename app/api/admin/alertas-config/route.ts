import { NextResponse } from 'next/server';
import {
  cargarAlertasConfig,
  guardarAlertasConfig,
  validarAlertasConfig,
  type AlertasConfig,
} from '@/lib/alertas/alertasConfig';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

function supabaseForApi() {
  return createSupabaseAdminOnlyClient() ?? null;
}

type PatchBody = {
  telegram?: Partial<AlertasConfig['telegram']>;
  procuras?: Partial<AlertasConfig['procuras']>;
  compras?: Partial<AlertasConfig['compras']>;
  fastTrack?: Partial<AlertasConfig['fastTrack']>;
  despacho?: Partial<AlertasConfig['despacho']>;
};

export async function GET() {
  const admin = supabaseForApi();
  const supabase = admin ?? (await createClient());

  try {
    const meta = await cargarAlertasConfig(supabase);
    return NextResponse.json({ ok: true, ...meta });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar configuración';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as PatchBody;
  const admin = supabaseForApi();
  const supabase = admin ?? (await createClient());

  try {
    const actual = await cargarAlertasConfig(supabase);
    const merged: AlertasConfig = {
      telegram: { ...actual.config.telegram, ...body.telegram },
      procuras: { ...actual.config.procuras, ...body.procuras },
      compras: { ...actual.config.compras, ...body.compras },
      fastTrack: { ...actual.config.fastTrack, ...body.fastTrack },
      despacho: { ...actual.config.despacho, ...body.despacho },
    };

    const errVal = validarAlertasConfig(merged);
    if (errVal) {
      return NextResponse.json({ error: errVal }, { status: 400 });
    }

    const meta = await guardarAlertasConfig(supabase, merged);
    return NextResponse.json({ ok: true, ...meta });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al guardar configuración';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
