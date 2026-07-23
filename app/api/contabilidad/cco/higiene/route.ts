import { NextResponse } from 'next/server';
import { limpiarDescuadreCco } from '@/lib/contabilidad/cco/limpiarDescuadreCco';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { requireCcoAcceso } from '@/lib/auth/requireCcoRoute';

export const dynamic = 'force-dynamic';

/**
 * POST { proyecto_id, dry_run? }
 * Quita auditoría mal importada, deduplica gastos gemelos, limpia ingresos gemelos
 * (operador LUIS + ABONO) y corrige devaluación brecha→V4.
 */
export async function POST(req: Request) {
  try {
    const accesoCco = await requireCcoAcceso('editar');
    if (!accesoCco.ok) return accesoCco.response;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as {
      proyecto_id?: string;
      dry_run?: boolean;
    };
    const proyectoId = String(body.proyecto_id ?? '').trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'proyecto_id requerido.' }, { status: 400 });
    }

    const result = await limpiarDescuadreCco(admin.client, {
      proyectoId,
      dryRun: Boolean(body.dry_run),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo reparar el descuadre CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
