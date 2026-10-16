import { NextResponse } from 'next/server';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { calcularFichaProveedores } from '@/lib/compras/fichaProveedores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ficha de proveedores: compras, monto, diferencias, rechazos y demora (180 días). */
export async function GET(req: Request) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'compra.confirmar', 'cco.ver', 'admin.config']);
  if (!acceso.ok) return acceso.response;
  try {
    const dias = Number(new URL(req.url).searchParams.get('dias') ?? 180);
    const proveedores = await calcularFichaProveedores(createSupabaseAdminClient(), {
      dias: Number.isFinite(dias) && dias > 0 ? Math.min(dias, 730) : 180,
    });
    return NextResponse.json({ proveedores });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
