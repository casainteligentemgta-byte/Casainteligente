import { NextResponse } from 'next/server';
import { listarTrayectoriaMaterial } from '@/lib/almacen/trazabilidadMaterial';
import { supabaseAdminMovimientos } from '@/lib/almacen/supabaseAdminMovimientos';

export const dynamic = 'force-dynamic';

/** GET /api/almacen/trazabilidad?materialId=... — ruta cronológica del material en inv_movimientos. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const materialId =
      url.searchParams.get('materialId')?.trim() ||
      url.searchParams.get('productoId')?.trim() ||
      '';

    if (!materialId) {
      return NextResponse.json(
        { error: 'Falta el parámetro materialId (o productoId).' },
        { status: 400 },
      );
    }

    const admin = supabaseAdminMovimientos();
    if (!admin.ok) return admin.response;

    const { trayectoria, material } = await listarTrayectoriaMaterial(admin.client, materialId);

    return NextResponse.json({
      ok: true,
      materialId,
      material: material ?? null,
      trayectoria,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al cargar trazabilidad';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
