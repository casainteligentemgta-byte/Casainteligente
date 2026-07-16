import { NextResponse } from 'next/server';
import { cargarAuditoriaCco } from '@/lib/contabilidad/cco/cargarAuditoria';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** GET ?proyecto=&q=&limit= — eventos de auditoría CCO. */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyecto')?.trim() || null;
    const q = searchParams.get('q')?.trim() || null;
    const limitRaw = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 300;

    const data = await cargarAuditoriaCco(admin.client, { proyectoId, q, limit });
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar auditoría CCO.';
    const hint = /cco_auditoria|schema cache/i.test(message)
      ? 'Ejecuta la migración 269_cco_obra_fusion_v4.sql.'
      : undefined;
    return NextResponse.json({ ok: false, error: message, hint }, { status: 500 });
  }
}
