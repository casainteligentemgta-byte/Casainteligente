import { NextResponse } from 'next/server';
import { cargarResumenBalanceContabilidad } from '@/lib/contabilidad/resumenBalanceContabilidad';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** GET balance mensual: ingresos (inyecciones de capital) por entidad y egresos (compras obra) por proyecto. */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const desde = searchParams.get('desde')?.trim() || undefined;
    const hasta = searchParams.get('hasta')?.trim() || undefined;

    const resumen = await cargarResumenBalanceContabilidad(admin.client, {
      fechaDesde: desde,
      fechaHasta: hasta,
    });

    return NextResponse.json({ ok: true, ...resumen });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo cargar el balance.';
    const hint = /ci_inyecciones_capital|does not exist|schema cache/i.test(message)
      ? 'Ejecute las migraciones 251/252 (inyecciones de capital) en Supabase.'
      : undefined;
    return NextResponse.json({ ok: false, error: message, hint }, { status: 500 });
  }
}
