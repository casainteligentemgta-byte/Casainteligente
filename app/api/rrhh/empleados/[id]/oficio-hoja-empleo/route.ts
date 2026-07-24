import { NextResponse } from 'next/server';
import { buildEmpleadoUpdateOficioHojaEmpleo } from '@/lib/rrhh/empleadoOficioHojaEmpleo';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { supabaseForRoute } from '@/lib/talento/supabase-route';

export const runtime = 'nodejs';

/**
 * PATCH — Actualiza «Cargo u oficio a desempeñar» en la hoja de empleo (jsonb + columnas de cargo).
 * Requiere sesión autenticada (RRHH / Admin en la app).
 */
export async function PATCH(req: Request, context: { params: { id: string } }) {
  const empleadoId = (context.params?.id ?? '').trim();
  if (!empleadoId) {
    return NextResponse.json({ error: 'id de empleado requerido' }, { status: 400 });
  }

  const sb = supabaseForRoute();
  if (!sb.ok) return sb.response;

  const {
    data: { user },
  } = await sb.client.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { cargoUOficio?: string };
  try {
    body = (await req.json()) as { cargoUOficio?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const cargoUOficio = String(body.cargoUOficio ?? '').trim();
  if (!cargoUOficio) {
    return NextResponse.json({ error: 'Indica el cargo u oficio a desempeñar' }, { status: 400 });
  }
  if (cargoUOficio.length > 240) {
    return NextResponse.json({ error: 'El oficio no puede superar 240 caracteres' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data: row, error: fetchErr } = await admin.client
    .from('ci_empleados')
    .select('id,hoja_vida_obrero')
    .eq('id', empleadoId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  const patch = buildEmpleadoUpdateOficioHojaEmpleo(
    (row as { hoja_vida_obrero?: unknown }).hoja_vida_obrero,
    cargoUOficio,
  );

  const { error: upErr } = await admin.client
    .from('ci_empleados')
    .update(patch as never)
    .eq('id', empleadoId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    cargoUOficio: patch.hoja_vida_obrero.contratacion.cargoUOficio,
    cargo_nombre: patch.cargo_nombre,
  });
}
