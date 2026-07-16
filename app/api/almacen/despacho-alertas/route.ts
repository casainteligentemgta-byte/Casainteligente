import { NextResponse } from 'next/server';
import { cargarAlertasConfig, despachoDefaultsDesdeConfig } from '@/lib/alertas/alertasConfig';
import {
  cargarDespachoAlertasProyecto,
  guardarDespachoAlertasProyecto,
  normalizarDespachoAlertasConfig,
} from '@/lib/almacen/despachoAlertasProyecto';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

function supabaseForApi() {
  return createSupabaseAdminOnlyClient() ?? null;
}

export async function GET(req: Request) {
  const proyectoId = new URL(req.url).searchParams.get('proyecto_id')?.trim();
  if (!proyectoId) {
    return NextResponse.json({ error: 'proyecto_id es obligatorio.' }, { status: 400 });
  }

  const admin = supabaseForApi();
  const supabase = admin ?? (await createClient());

  try {
    const { config: alertas } = await cargarAlertasConfig(supabase);
    const defaults = despachoDefaultsDesdeConfig(alertas);
    const result = await cargarDespachoAlertasProyecto(supabase, proyectoId);
    return NextResponse.json({
      ok: true,
      proyecto_id: proyectoId,
      config: result.config,
      personalizado: result.personalizado,
      defaults,
      updated_at: result.updatedAt ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar alertas';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    proyecto_id?: string;
    exceso_advertencia_pct?: number;
    exceso_critico_pct?: number;
    saldo_informativo_pct?: number;
    excesoAdvertenciaPct?: number;
    excesoCriticoPct?: number;
    saldoInformativoPct?: number;
  };

  const proyectoId = body.proyecto_id?.trim();
  if (!proyectoId) {
    return NextResponse.json({ error: 'proyecto_id es obligatorio.' }, { status: 400 });
  }

  const norm = normalizarDespachoAlertasConfig({
    excesoAdvertenciaPct: body.excesoAdvertenciaPct ?? body.exceso_advertencia_pct,
    excesoCriticoPct: body.excesoCriticoPct ?? body.exceso_critico_pct,
    saldoInformativoPct: body.saldoInformativoPct ?? body.saldo_informativo_pct,
  });

  if (norm.error) {
    return NextResponse.json({ error: norm.error }, { status: 400 });
  }

  const admin = supabaseForApi();
  const supabase = admin ?? (await createClient());

  try {
    const config = await guardarDespachoAlertasProyecto(supabase, proyectoId, norm.config);
    return NextResponse.json({
      ok: true,
      proyecto_id: proyectoId,
      config,
      personalizado: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al guardar alertas';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
