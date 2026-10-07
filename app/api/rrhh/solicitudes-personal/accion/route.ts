import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import {
  asegurarInvitacionEvaluacion,
  asegurarTokenExpediente,
  baseUrlPublica,
  cerrarSolicitudSiCubierta,
  nuevoToken,
} from '@/lib/rrhh/solicitudPersonalServer';

export const dynamic = 'force-dynamic';

/**
 * POST { empleado_id, accion } sobre un trabajador de la solicitud:
 *  - pedir_evaluacion: activa la evaluación para esa persona y devuelve su enlace.
 *  - reenviar_enlace: reactiva el enlace personal de hoja de vida.
 *  - descartar / reactivar.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const db = admin.client;

  let body: { empleado_id?: string; accion?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const empleadoId = String(body.empleado_id ?? '').trim();
  const accion = String(body.accion ?? '').trim();
  if (!empleadoId) return NextResponse.json({ error: 'Falta el trabajador.' }, { status: 400 });

  const { data: emp } = await db
    .from('ci_empleados')
    .select('id,token,token_registro,estado_proceso,hoja_vida_obrero,recruitment_need_id')
    .eq('id', empleadoId)
    .maybeSingle();
  if (!emp) return NextResponse.json({ error: 'No se encontró el trabajador.' }, { status: 404 });
  const e = emp as {
    token: string | null;
    token_registro: string | null;
    estado_proceso: string | null;
    hoja_vida_obrero: { datosPersonales?: { primerNombre?: string; cedulaIdentidad?: string } } | null;
    recruitment_need_id: string | null;
  };
  const base = baseUrlPublica(req);

  let token = String(e.token_registro ?? e.token ?? '').trim();
  if (!token) {
    token = nuevoToken();
    const { error } = await db.from('ci_empleados').update({ token, token_registro: token } as never).eq('id', empleadoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (accion === 'pedir_evaluacion') {
    const inv = await asegurarInvitacionEvaluacion(db, { empleadoId, token });
    if (!inv.ok) return NextResponse.json({ error: inv.error }, { status: 500 });
    if (inv.hecha) return NextResponse.json({ ok: true, ya_evaluado: true, enlace: null });
    return NextResponse.json({
      ok: true,
      ya_evaluado: false,
      enlace: base ? `${base}/talento/evaluacion?token=${encodeURIComponent(token)}` : null,
    });
  }

  if (accion === 'reenviar_enlace') {
    await asegurarTokenExpediente(db, { empleadoId, token });
    return NextResponse.json({ ok: true, enlace: base ? `${base}/reclutamiento/onboarding/${token}` : null });
  }

  if (accion === 'descartar' || accion === 'reactivar') {
    // Al reactivar vuelve a donde estaba: con hoja de vida lista o esperando llenarla.
    const dp = e.hoja_vida_obrero?.datosPersonales;
    const tieneHoja = Boolean((dp?.primerNombre ?? '').trim() && (dp?.cedulaIdentidad ?? '').trim());
    const estado_proceso = accion === 'descartar' ? 'descartado' : tieneHoja ? 'cv_completado' : 'pendiente_cv';
    const { error } = await db.from('ci_empleados').update({ estado_proceso } as never).eq('id', empleadoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const solicitudId = String(e.recruitment_need_id ?? '').trim();
    if (solicitudId) await cerrarSolicitudSiCubierta(db, solicitudId);
    return NextResponse.json({ ok: true, estado_proceso });
  }

  return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
}
