import { NextResponse } from 'next/server';
import { cargarLibroMaestro } from '@/lib/contabilidad/cco/cargarLibroMaestro';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** GET libro maestro unificado (gastos + ingresos + contratos + presupuestos). */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyecto')?.trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const clase = searchParams.get('clase')?.trim() || null;
    const proveedor = searchParams.get('proveedor')?.trim() || null;
    const capitulo = searchParams.get('capitulo')?.trim() || null;
    const limitRaw = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 10_000) : 5000;

    const data = await cargarLibroMaestro(admin.client, {
      proyectoId,
      clase,
      limit,
      proveedor,
      capitulo,
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar libro CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
