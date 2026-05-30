import { NextResponse } from 'next/server';
import { eliminarMovimientoInventario } from '@/lib/almacen/eliminarMovimientoInventario';
import { listarMovimientosInventario } from '@/lib/almacen/listarMovimientosInventario';
import type { VistaMovimientoInventario } from '@/lib/almacen/listarMovimientosInventario';
import { supabaseAdminMovimientos } from '@/lib/almacen/supabaseAdminMovimientos';

export const dynamic = 'force-dynamic';

function parseVista(v: string | null): VistaMovimientoInventario {
  if (v === 'ingresado' || v === 'despachado' || v === 'almacenado' || v === 'todos') return v;
  return 'todos';
}

async function resolveMovimientoId(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('id')?.trim();
  if (fromQuery) return decodeURIComponent(fromQuery);

  try {
    const body = (await req.json()) as { id?: string };
    const fromBody = body?.id?.trim();
    if (fromBody) return fromBody;
  } catch {
    /* sin body JSON */
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const admin = supabaseAdminMovimientos();
    if (!admin.ok) return admin.response;

    const result = await listarMovimientosInventario(admin.client, {
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

/** Borrado con ID en body o query (evita truncar UUIDs en la ruta dinámica). */
export async function DELETE(req: Request) {
  try {
    const id = await resolveMovimientoId(req);
    if (!id) {
      return NextResponse.json({ error: 'ID de movimiento inválido.' }, { status: 400 });
    }

    const admin = supabaseAdminMovimientos();
    if (!admin.ok) return admin.response;

    const result = await eliminarMovimientoInventario(admin.client, id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo eliminar el movimiento';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
