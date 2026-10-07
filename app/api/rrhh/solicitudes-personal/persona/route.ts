import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { tipoVacantePorNivel } from '@/lib/constants/cargosObreros';
import { celularParaInserto } from '@/lib/registro/ciEmpleadosCelular';
import { nombresLegadoDesdeTextoLibre } from '@/lib/registro/ciEmpleadosNombresLegado';
import { normalizarCedula, whatsappInternacional } from '@/lib/rrhh/cargaMasivaObreros';
import {
  asegurarInvitacionEvaluacion,
  asegurarTokenExpediente,
  baseUrlPublica,
  cerrarSolicitudSiCubierta,
  digitosCedula,
  nuevoToken,
} from '@/lib/rrhh/solicitudPersonalServer';

export const dynamic = 'force-dynamic';

/**
 * POST { solicitud_id, nombre, whatsapp, cedula?, evaluacion } — enlace personal para un trabajador concreto.
 * El oficio y la obra los fija la solicitud. Si la cédula ya tiene expediente, se reutiliza.
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

  let body: { solicitud_id?: string; nombre?: string; whatsapp?: string; cedula?: string; evaluacion?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const solicitudId = String(body.solicitud_id ?? '').trim();
  const nombre = String(body.nombre ?? '').trim();
  const wa = whatsappInternacional(String(body.whatsapp ?? ''));
  const cedulaTxt = String(body.cedula ?? '').trim();
  const cedula = cedulaTxt ? normalizarCedula(cedulaTxt) : '';
  const conEvaluacion = body.evaluacion === true;

  if (!solicitudId) return NextResponse.json({ error: 'Falta la solicitud.' }, { status: 400 });
  if (nombre.length < 3) return NextResponse.json({ error: 'Escribe el nombre del trabajador.' }, { status: 400 });
  if (!wa) return NextResponse.json({ error: 'WhatsApp inválido.' }, { status: 400 });
  if (cedulaTxt && !cedula) return NextResponse.json({ error: 'Cédula inválida.' }, { status: 400 });

  const base = baseUrlPublica(req);
  if (!base) return NextResponse.json({ error: 'No se pudo determinar la dirección pública del sistema.' }, { status: 503 });

  const { data: need } = await db
    .from('recruitment_needs')
    .select('id,cargo_codigo,cargo_nombre,cargo_nivel,proyecto_modulo_id')
    .eq('id', solicitudId)
    .maybeSingle();
  const n = need as {
    cargo_codigo: string | null;
    cargo_nombre: string | null;
    cargo_nivel: number | null;
    proyecto_modulo_id: string | null;
  } | null;
  if (!n) return NextResponse.json({ error: 'La solicitud no existe.' }, { status: 404 });
  if (!n.cargo_codigo || !n.cargo_nombre || !n.cargo_nivel) {
    return NextResponse.json({ error: 'Esta solicitud no tiene oficio definido.' }, { status: 400 });
  }

  const asignacion = {
    recruitment_need_id: solicitudId,
    proyecto_modulo_id: n.proyecto_modulo_id,
    cargo_codigo: n.cargo_codigo,
    cargo_nombre: n.cargo_nombre,
    cargo_nivel: n.cargo_nivel,
    tipo_vacante: tipoVacantePorNivel(n.cargo_nivel),
    cargo: n.cargo_nombre,
    rol_buscado: n.cargo_nombre,
    rol_examen: 'obrero',
  };

  // ¿Ya tiene expediente? (misma cédula)
  let previo: { id: string; token_registro: string | null; token: string | null; estado_proceso: string | null } | null = null;
  if (cedula) {
    const dig = digitosCedula(cedula);
    const { data: todos } = await db
      .from('ci_empleados')
      .select('id,cedula,documento,token_registro,token,estado_proceso')
      .order('created_at', { ascending: true })
      .limit(5000);
    previo =
      ((todos ?? []) as Array<{
        id: string;
        cedula: string | null;
        documento: string | null;
        token_registro: string | null;
        token: string | null;
        estado_proceso: string | null;
      }>).find((r) => digitosCedula(r.cedula ?? r.documento) === dig) ?? null;
  }

  let empleadoId = '';
  let token = '';
  let hojaLista = false;

  if (previo) {
    empleadoId = previo.id;
    token = String(previo.token_registro ?? previo.token ?? '').trim() || nuevoToken();
    hojaLista = previo.estado_proceso === 'cv_completado';
    const patch: Record<string, unknown> = {
      ...asignacion,
      telefono: wa,
      celular: celularParaInserto(null, wa),
      token,
      token_registro: token,
    };
    if (previo.estado_proceso === 'descartado') patch.estado_proceso = 'pendiente_cv';
    const { error } = await db.from('ci_empleados').update(patch as never).eq('id', empleadoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    token = nuevoToken();
    const { data: emp, error } = await db
      .from('ci_empleados')
      .insert({
        ...asignacion,
        nombre_completo: nombre,
        nombres: nombresLegadoDesdeTextoLibre(nombre),
        cedula: cedula || null,
        documento: cedula || null,
        telefono: wa,
        celular: celularParaInserto(null, wa),
        estado_proceso: 'pendiente_cv',
        token,
        token_registro: token,
        respuestas_personalidad: {},
        respuestas_logica: {},
      } as never)
      .select('id')
      .single();
    if (error || !emp) return NextResponse.json({ error: error?.message ?? 'No se pudo crear el expediente.' }, { status: 500 });
    empleadoId = String((emp as { id: string }).id);
  }

  if (!hojaLista) await asegurarTokenExpediente(db, { empleadoId, token });

  let evaluacionPendiente = false;
  if (conEvaluacion) {
    const inv = await asegurarInvitacionEvaluacion(db, { empleadoId, token });
    if (!inv.ok) return NextResponse.json({ error: inv.error }, { status: 500 });
    evaluacionPendiente = !inv.hecha;
  }
  if (hojaLista) await cerrarSolicitudSiCubierta(db, solicitudId);

  // Con hoja de vida lista solo hace falta enlace si se pidió evaluación.
  const enlace = hojaLista
    ? evaluacionPendiente
      ? `${base}/talento/evaluacion?token=${encodeURIComponent(token)}`
      : null
    : `${base}/reclutamiento/onboarding/${token}`;

  return NextResponse.json({
    ok: true,
    empleado_id: empleadoId,
    ya_tenia_expediente: Boolean(previo),
    hoja_vida_lista: hojaLista,
    evaluacion_pendiente: evaluacionPendiente,
    whatsapp: wa,
    enlace,
  });
}
