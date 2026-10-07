import { NextResponse } from 'next/server';
import { marcarExpedienteTokenUsado } from '@/lib/reclutamiento/validarExpedienteToken';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { avisarRegistroObreroTelegram } from '@/lib/rrhh/avisoRegistroObreroTelegram';
import { cerrarSolicitudSiCubierta } from '@/lib/rrhh/solicitudPersonalServer';

export const runtime = 'nodejs';

/** POST { token } — Marca el enlace de expediente como utilizado. */
export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  // Enlace personal: si el token aún no estaba usado, el obrero acaba de completar su hoja de vida.
  const { data: pendiente } = await admin.client
    .from('expediente_tokens')
    .select('hoja_vida_id')
    .eq('token', token)
    .eq('is_used', false)
    .maybeSingle();

  await marcarExpedienteTokenUsado(admin.client, token);

  const empleadoId = String((pendiente as { hoja_vida_id?: string } | null)?.hoja_vida_id ?? '').trim();
  if (empleadoId) {
    let base = '';
    try {
      base = (request.headers.get('origin') ?? new URL(request.url).origin).replace(/\/$/, '');
    } catch {
      base = '';
    }
    // Sin evaluación pedida, el trabajador entra a la banca al completar su hoja de vida.
    const { data: emp } = await admin.client
      .from('ci_empleados')
      .select('estado, recruitment_need_id')
      .eq('id', empleadoId)
      .maybeSingle();
    const e = (emp ?? {}) as { estado?: string | null; recruitment_need_id?: string | null };
    const { data: invitacion } = await admin.client
      .from('ci_examenes')
      .select('id')
      .eq('empleado_id', empleadoId)
      .is('usado_at', null)
      .limit(1)
      .maybeSingle();
    const estado = (e.estado ?? '').trim();
    if (!invitacion && (!estado || estado === 'evaluacion_pendiente')) {
      await admin.client
        .from('ci_empleados')
        .update({ estado: 'aprobado', estatus: 'disponible' } as never)
        .eq('id', empleadoId);
    }
    const solicitudId = String(e.recruitment_need_id ?? '').trim();
    if (solicitudId) await cerrarSolicitudSiCubierta(admin.client, solicitudId);

    await avisarRegistroObreroTelegram(admin.client, empleadoId, base);
  }
  return NextResponse.json({ ok: true });
}
