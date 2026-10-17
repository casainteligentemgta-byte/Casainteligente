import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { composeCedulaHv, composeCelularVe, parseCedulaHv, parseCelularVe } from '@/lib/registro/catalogosHojaVidaVe';
import {
  apruebaParaHojaVida,
  cedulaComparable,
  nombreCompletoBasico,
  urlEvaluacionExamenPrimero,
  urlHojaVidaExamenPrimero,
  type SemaforoEvaluacion,
} from '@/lib/reclutamiento/examenPrimero';
import { datosBasicosExamenPrimeroSchema } from '@/lib/reclutamiento/examenPrimeroSchema';
import { ensureCiExamenInviteForEmpleado } from '@/lib/talento/ensureCiExamenInviteForEmpleado';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

function trimBase(u: string): string {
  return u.trim().replace(/\/$/, '');
}

function publicBaseFromReq(req: Request): string {
  const origin = trimBase(req.headers.get('origin') ?? '');
  if (origin && /^https?:\/\//i.test(origin)) return origin;
  const env = trimBase(process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
  if (env && /^https?:\/\//i.test(env)) return env;
  try {
    return trimBase(new URL(req.url).origin);
  } catch {
    return '';
  }
}

type NeedRow = {
  id: string;
  title: string | null;
  cargo_nombre: string | null;
  cargo_codigo: string | null;
  cargo_nivel: number | null;
  tipo_vacante: string | null;
  protocol_active: boolean | null;
  proyecto_modulo_id: string | null;
  examen_primero: boolean | null;
};

type EmpleadoPrevio = {
  id: string;
  cedula: string | null;
  token_registro: string | null;
  estatus_evaluacion: string | null;
  semaforo: SemaforoEvaluacion;
  estado_proceso: string | null;
};

/**
 * POST — Vacantes con «examen primero».
 * Body: { token, primerNombre, primerApellido, cedula, celular, correo? }
 * Crea el expediente con datos básicos y la invitación a la evaluación.
 * Si la misma cédula ya se postuló a esta vacante, retoma su expediente en vez de duplicarlo.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = datosBasicosExamenPrimeroSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Revisa los datos.';
    return NextResponse.json({ error: first }, { status: 400 });
  }
  const d = parsed.data;

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data: need, error: nErr } = await admin.client
    .from('recruitment_needs')
    .select(
      'id,title,cargo_nombre,cargo_codigo,cargo_nivel,tipo_vacante,protocol_active,proyecto_modulo_id,examen_primero',
    )
    .eq('captacion_token', d.token)
    .maybeSingle();

  if (nErr) return NextResponse.json({ error: nErr.message }, { status: 500 });
  if (!need) return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 });

  const n = need as NeedRow;
  if (n.protocol_active === false) {
    return NextResponse.json({ error: 'Esta vacante ya no acepta postulaciones.' }, { status: 410 });
  }
  if (!n.examen_primero) {
    return NextResponse.json({ error: 'Esta vacante pide primero la hoja de vida.' }, { status: 409 });
  }

  const ced = parseCedulaHv(d.cedula);
  const cedula = composeCedulaHv(ced.letra, ced.numero);
  const cel = parseCelularVe(d.celular);
  const celular = composeCelularVe(cel.prefijo, cel.numero);
  const base = publicBaseFromReq(req);

  // ¿Ya se postuló con esta cédula a esta vacante? Retomar en vez de duplicar.
  const { data: previos } = await admin.client
    .from('ci_empleados')
    .select('id,cedula,token_registro,estatus_evaluacion,semaforo,estado_proceso')
    .eq('recruitment_need_id', n.id)
    .ilike('cedula', `%${ced.numero}%`)
    .limit(5);

  const previo = ((previos ?? []) as EmpleadoPrevio[]).find(
    (r) => cedulaComparable(r.cedula ?? '') === cedulaComparable(cedula) && (r.token_registro ?? '').trim(),
  );

  if (previo) {
    const tok = (previo.token_registro ?? '').trim();
    if (previo.estatus_evaluacion !== 'completado') {
      await ensureCiExamenInviteForEmpleado(admin.client, { empleadoId: previo.id, token: tok });
      return NextResponse.json({
        ok: true,
        retomado: true,
        empleadoId: previo.id,
        siguiente: 'evaluacion',
        url: urlEvaluacionExamenPrimero(tok, base),
      });
    }
    if (apruebaParaHojaVida(previo.semaforo) && previo.estado_proceso !== 'cv_completado') {
      return NextResponse.json({
        ok: true,
        retomado: true,
        empleadoId: previo.id,
        siguiente: 'hoja_vida',
        url: urlHojaVidaExamenPrimero(tok, base),
      });
    }
    return NextResponse.json(
      {
        error:
          'Ya tenemos tu postulación para esta vacante. El equipo de Reclutamiento te contactará.',
      },
      { status: 409 },
    );
  }

  const cargoEtiqueta = (n.cargo_nombre ?? '').trim() || (n.title ?? '').trim() || 'Vacante';
  const nombreCompleto = nombreCompletoBasico(d);
  const tokenRegistro = randomUUID();

  const { data: ins, error: insErr } = await admin.client
    .from('ci_empleados')
    .insert({
      recruitment_need_id: n.id,
      proyecto_modulo_id: n.proyecto_modulo_id,
      cargo_codigo: n.cargo_codigo,
      cargo_nombre: n.cargo_nombre,
      cargo_nivel: n.cargo_nivel,
      // ci_empleados solo admite obrero_basico / obrero_especializado.
      tipo_vacante:
        n.tipo_vacante === 'obrero_basico' || n.tipo_vacante === 'obrero_especializado' ? n.tipo_vacante : null,
      nombre_completo: nombreCompleto,
      nombres: d.primerNombre.trim(),
      primer_nombre: d.primerNombre.trim(),
      primer_apellido: d.primerApellido.trim(),
      cargo: cargoEtiqueta,
      rol_buscado: cargoEtiqueta,
      // La evaluación unificada es la de campo; la familia (chofer, vigilancia…) sale del cargo.
      rol_examen: 'obrero',
      cedula,
      documento: cedula,
      celular,
      telefono: celular,
      email: d.correo || null,
      estado: 'evaluacion_pendiente',
      estado_proceso: 'pendiente_cv',
      token: tokenRegistro,
      token_registro: tokenRegistro,
    } as never)
    .select('id')
    .single();

  if (insErr || !ins) {
    return NextResponse.json({ error: insErr?.message ?? 'No se pudo registrar la postulación.' }, { status: 500 });
  }
  const empleadoId = (ins as { id: string }).id;

  const invite = await ensureCiExamenInviteForEmpleado(admin.client, { empleadoId, token: tokenRegistro });
  if (!invite.ok) {
    return NextResponse.json(
      { error: 'Se guardaron tus datos, pero no se pudo abrir la evaluación. Avisa a Reclutamiento.' },
      { status: 500 },
    );
  }

  const { data: cur } = await admin.client
    .from('recruitment_needs')
    .select('conteo_postulaciones')
    .eq('id', n.id)
    .maybeSingle();
  const prev = (cur as { conteo_postulaciones?: number } | null)?.conteo_postulaciones ?? 0;
  await admin.client
    .from('recruitment_needs')
    .update({ conteo_postulaciones: prev + 1 } as never)
    .eq('id', n.id);

  const pid = (n.proyecto_modulo_id ?? '').trim();
  if (pid) {
    await admin.client.from('ci_notificaciones').insert({
      proyecto_id: pid,
      mensaje: `Postulación (examen primero): ${nombreCompleto} — ${cargoEtiqueta}. Evaluación pendiente.`,
      tipo: 'captacion_examen_primero',
      empleado_id: empleadoId,
    } as never);
  }

  return NextResponse.json({
    ok: true,
    empleadoId,
    siguiente: 'evaluacion',
    url: urlEvaluacionExamenPrimero(tokenRegistro, base),
  });
}
