import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { avisarRegistroObreroTelegram } from '@/lib/rrhh/avisoRegistroObreroTelegram';
import {
  asegurarInvitacionEvaluacion,
  baseUrlPublica,
  cerrarSolicitudSiCubierta,
  digitosCedula,
  esCodigoSinEvaluacionValido,
  unificarExpedientePorCedula,
} from '@/lib/rrhh/solicitudPersonalServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST { empleadoId, cedula, sin? } — cierre del registro público de hoja de vida.
 *  1. Un expediente por cédula: si ya existía, se actualiza ese y se borra el duplicado.
 *  2. Decide si toca evaluación: obligatoria salvo que el enlace traiga el código «sin evaluación» de la solicitud.
 *  3. Sin evaluación, el trabajador entra directo a la banca (aprobado · disponible).
 *  4. Cierra la solicitud cuando cubre sus plazas y avisa a RRHH por Telegram.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const db = admin.client;

  let body: { empleadoId?: string; cedula?: string; sin?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const empleadoIdIn = String(body.empleadoId ?? '').trim();
  const cedulaIn = digitosCedula(body.cedula);
  if (!UUID_RE.test(empleadoIdIn)) return NextResponse.json({ error: 'empleadoId inválido' }, { status: 400 });
  if (cedulaIn.length < 6) return NextResponse.json({ error: 'Cédula requerida' }, { status: 400 });

  const { data: recien, error: e0 } = await db
    .from('ci_empleados')
    .select('id, cedula, documento')
    .eq('id', empleadoIdIn)
    .maybeSingle();
  if (e0) return NextResponse.json({ error: e0.message }, { status: 500 });
  if (!recien) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });
  const r0 = recien as { cedula: string | null; documento: string | null };
  if (digitosCedula(r0.cedula ?? r0.documento) !== cedulaIn) {
    return NextResponse.json({ error: 'La cédula no coincide con este expediente' }, { status: 403 });
  }

  const { empleadoId, unificado } = await unificarExpedientePorCedula(db, empleadoIdIn);

  const { data: emp, error: e1 } = await db
    .from('ci_empleados')
    .select('id, cedula, documento, token, token_registro, recruitment_need_id, estado, estatus_evaluacion')
    .eq('id', empleadoId)
    .maybeSingle();
  if (e1 || !emp) return NextResponse.json({ error: e1?.message ?? 'Expediente no encontrado' }, { status: 500 });
  const e = emp as {
    id: string;
    cedula: string | null;
    documento: string | null;
    token: string | null;
    token_registro: string | null;
    recruitment_need_id: string | null;
    estado: string | null;
    estatus_evaluacion: string | null;
  };

  const solicitudId = String(e.recruitment_need_id ?? '').trim();
  const sinEvaluacion = Boolean(solicitudId) && esCodigoSinEvaluacionValido(solicitudId, body.sin);
  const yaEvaluado = (e.estatus_evaluacion ?? '').trim() === 'completado';
  const token = String(e.token_registro ?? e.token ?? '').trim();
  const base = baseUrlPublica(req);

  let evaluacionUrl: string | null = null;
  /** La evaluación se exige y no consta hecha: el trabajador NO entra a la banca todavía. */
  let evaluacionPendiente = !sinEvaluacion && !yaEvaluado;
  if (evaluacionPendiente && token) {
    const inv = await asegurarInvitacionEvaluacion(db, { empleadoId, token });
    if (!inv.ok) {
      console.warn('[registro finalizar] invitación evaluación:', inv.error);
    } else if (inv.hecha) {
      evaluacionPendiente = false;
    } else if (base) {
      evaluacionUrl = `${base}/talento/evaluacion?token=${encodeURIComponent(token)}`;
    }
  }

  // Entra a la banca al completar la hoja de vida, salvo que deba (y aún no haya hecho) la evaluación.
  if (!evaluacionPendiente) {
    const estado = (e.estado ?? '').trim();
    if (!estado || estado === 'evaluacion_pendiente') {
      const { error: upErr } = await db
        .from('ci_empleados')
        .update({ estado: 'aprobado', estatus: 'disponible' } as never)
        .eq('id', empleadoId);
      if (upErr) console.warn('[registro finalizar] entrada a banca:', upErr.message);
    }
  }

  if (solicitudId) await cerrarSolicitudSiCubierta(db, solicitudId);
  await avisarRegistroObreroTelegram(db, empleadoId, base);

  return NextResponse.json({
    ok: true,
    empleado_id: empleadoId,
    cedula: String(e.cedula ?? e.documento ?? ''),
    expediente_unificado: unificado,
    evaluacion_requerida: Boolean(evaluacionUrl),
    post_hv_url: evaluacionUrl,
  });
}
