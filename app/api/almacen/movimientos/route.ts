import { NextResponse } from 'next/server';
import { listarMovimientosInventario } from '@/lib/almacen/listarMovimientosInventario';
import type { VistaMovimientoInventario } from '@/lib/almacen/listarMovimientosInventario';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

function parseVista(v: string | null): VistaMovimientoInventario {
  if (v === 'ingresado' || v === 'despachado' || v === 'almacenado' || v === 'todos') return v;
  return 'todos';
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

    const result = await listarMovimientosInventario(supabase, {
      vista: parseVista(url.searchParams.get('vista')),
      proveedor: url.searchParams.get('proveedor') ?? undefined,
      destino: url.searchParams.get('destino') ?? undefined,
      proyectoId: url.searchParams.get('proyecto_id') ?? undefined,
      fechaDesde: url.searchParams.get('fecha_desde') ?? undefined,
      fechaHasta: url.searchParams.get('fecha_hasta') ?? undefined,
      material: url.searchParams.get('material') ?? undefined,
      limite: Number(url.searchParams.get('limite') ?? 200),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al listar movimientos';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
