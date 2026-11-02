import { NextResponse } from 'next/server';
import { autorizarPasivoTrabajador } from '@/lib/legal/autorizarPasivoTrabajador';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { calculateWorkerPasivo } from '@/lib/legal/calculateWorkerPasivo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/legal/calculos/pasivo/[workerId]?fecha_fin=YYYY-MM-DD
 * Pasivo laboral: garantía trimestral vs retroactivo → monto a provisionar (Art. 142).
 * Requiere acceso Legal y el mismo alcance de salarios que la migración 374
 * (super_admin, o entidad_admin/director/rrhh de la entidad del trabajador).
 * El cálculo usa el cliente de la sesión para no saltarse el RLS.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ workerId: string }> | { workerId: string } },
) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const params = await Promise.resolve(ctx.params);
  const workerId = String(params.workerId ?? '').trim();
  if (!workerId) {
    return NextResponse.json({ error: 'workerId requerido' }, { status: 400 });
  }

  const authz = await autorizarPasivoTrabajador({
    userId: gate.userId,
    supabase: gate.supabase,
    admin: gate.admin,
    workerId,
  });
  if (!authz.ok) {
    return NextResponse.json(
      {
        error: authz.error,
        hint:
          authz.status === 403
            ? 'Solo super_admin, o entidad_admin / director / rrhh de la entidad del trabajador.'
            : undefined,
      },
      { status: authz.status },
    );
  }

  const url = new URL(req.url);
  const fechaFin = url.searchParams.get('fecha_fin');

  const result = await calculateWorkerPasivo(gate.supabase, workerId, {
    fechaFin,
  });

  if ('error' in result) {
    const hint = result.error.includes('historial salarial')
      ? 'Inserte fila en ci_labor_salary_history (vista salary_history). Ejecute migración 270.'
      : result.error.includes('join_date')
        ? 'Defina ci_empleados.join_date. Ejecute migración 270.'
        : result.error.includes('schema cache') || result.error.includes('does not exist')
          ? 'Ejecute supabase/migrations/270_ci_labor_pasivo_trabajador.sql en Supabase SQL Editor.'
          : undefined;
    return NextResponse.json({ error: result.error, hint }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result });
}
