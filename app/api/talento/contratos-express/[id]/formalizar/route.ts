import { NextResponse } from 'next/server';
import { formalizarContratoExpressPorId } from '@/lib/talento/formalizarContratoExpress';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * POST — Crea fila en `ci_empleados` con datos del contrato express (flujo regular / expediente).
 */
export async function POST(_req: Request, context: { params: { id: string } }) {
  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const out = await formalizarContratoExpressPorId(admin.client, id);
  if (!out.ok) {
    return NextResponse.json(
      { error: out.error, empleado_id: out.empleado_id ?? null },
      { status: out.status },
    );
  }

  return NextResponse.json({
    success: true,
    empleado_id: out.empleado_id,
    empleadoId: out.empleado_id,
  });
}
