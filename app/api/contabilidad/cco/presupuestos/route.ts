import { NextResponse } from 'next/server';
import { cargarPresupuestosCco } from '@/lib/contabilidad/cco/cargarPresupuestos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const proyectoId = new URL(req.url).searchParams.get('proyecto')?.trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const data = await cargarPresupuestosCco(admin.client, proyectoId);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar presupuestos CCO.';
    const hint = /cco_presupuestos|schema cache/i.test(message)
      ? 'Ejecuta la migración 269_cco_obra_fusion_v4.sql.'
      : undefined;
    return NextResponse.json({ ok: false, error: message, hint }, { status: 500 });
  }
}
