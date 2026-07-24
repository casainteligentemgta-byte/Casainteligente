import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  guardarConfigCco,
  obtenerConfigCco,
} from '@/lib/contabilidad/cco/proyectoConfig';
import { TIPO_CONTRATO_AD, ESTADO_CONTRATO_EXITOSO } from '@/lib/proyectos/contratoAdministracionDelegada';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

async function honorariosAd(
  client: SupabaseClient,
  proyectoId: string,
): Promise<number | null> {
  const { data } = await client
    .from('ci_contratos_express')
    .select('honorarios_admin_pct')
    .eq('proyecto_id', proyectoId)
    .eq('tipo_contrato', TIPO_CONTRATO_AD)
    .eq('estado', ESTADO_CONTRATO_EXITOSO)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const n = Number((data as { honorarios_admin_pct?: number } | null)?.honorarios_admin_pct);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** GET ?proyecto= — config CCO de la obra. */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const proyectoId = new URL(req.url).searchParams.get('proyecto')?.trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const ad = await honorariosAd(admin.client, proyectoId);
    const config = await obtenerConfigCco(admin.client, proyectoId, {
      honorariosAdFallback: ad,
    });
    return NextResponse.json({ ok: true, config, honorarios_ad: ad });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar ajustes CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** PUT body — guarda % admin, devaluación, alias. */
export async function PUT(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as {
      proyecto_id?: string;
      honorarios_admin_pct?: number;
      devaluacion_pct?: number;
      empresa_nombre?: string | null;
      obra_alias?: string | null;
      area_m2?: number | null;
    };

    const proyectoId = String(body.proyecto_id ?? '').trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'proyecto_id requerido.' }, { status: 400 });
    }

    const config = await guardarConfigCco(admin.client as SupabaseClient, {
      proyecto_id: proyectoId,
      honorarios_admin_pct: Number(body.honorarios_admin_pct),
      devaluacion_pct: Number(body.devaluacion_pct),
      empresa_nombre: body.empresa_nombre,
      obra_alias: body.obra_alias,
      area_m2: body.area_m2 != null ? Number(body.area_m2) : null,
    });

    return NextResponse.json({ ok: true, config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar ajustes CCO.';
    const hint = /cco_proyecto_config|schema cache/i.test(message)
      ? 'Ejecuta la migración 269_cco_obra_fusion_v4.sql.'
      : undefined;
    return NextResponse.json({ ok: false, error: message, hint }, { status: 500 });
  }
}
