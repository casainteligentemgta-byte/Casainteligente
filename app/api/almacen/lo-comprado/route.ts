import { NextResponse } from 'next/server';
import { cargarLoComprado } from '@/lib/almacen/cargarLoComprado';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/almacen/lo-comprado
 * Inventario de cantidades compradas (agregado desde contabilidad_compra_lineas).
 * No escribe stock ni altera CCO.
 *
 * Query: proyecto_id, entidad_id, desde, hasta, q
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

    const resumen = await cargarLoComprado(supabase, {
      proyectoId: url.searchParams.get('proyecto_id'),
      entidadId: url.searchParams.get('entidad_id'),
      desde: url.searchParams.get('desde'),
      hasta: url.searchParams.get('hasta'),
      q: url.searchParams.get('q'),
    });

    return NextResponse.json(resumen);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar lo comprado';
    console.error('[GET /api/almacen/lo-comprado]', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
