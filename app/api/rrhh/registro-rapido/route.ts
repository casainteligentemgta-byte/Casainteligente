import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { celularParaInserto } from '@/lib/registro/ciEmpleadosCelular';
import { nombresLegadoDesdeTextoLibre } from '@/lib/registro/ciEmpleadosNombresLegado';
import { CEDULA_VE_NORMALIZADA_REGEX, normCedulaToken } from '@/lib/talento/cedulaAuth';
import { ESTADO_EVALUACION_EXPRESS_INICIAL } from '@/lib/talento/estadoEvaluacionExpress';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST — Alta rápida de obrero (RRHH / campo).
 * Evita el INSERT directo desde el cliente con `estatus: pendiente` (viola el check de cuadrilla).
 */
export async function POST(req: Request) {
  let supabaseAuth;
  try {
    supabaseAuth = await createClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Configuración de Supabase incompleta' },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const nombres = String(body.nombres ?? '').trim();
  const apellidos = String(body.apellidos ?? '').trim();
  const nombreCompleto =
    String(body.nombre_completo ?? '').trim() || `${nombres} ${apellidos}`.trim();
  const cedulaRaw = String(body.cedula ?? '').trim();
  const oficio = String(body.oficio ?? '').trim();
  const celularRaw = String(body.celular ?? '').trim();

  if (!nombreCompleto || !cedulaRaw) {
    return NextResponse.json({ error: 'Nombre y cédula son obligatorios.' }, { status: 400 });
  }

  const cedulaNorm = normCedulaToken(cedulaRaw);
  if (!CEDULA_VE_NORMALIZADA_REGEX.test(cedulaNorm)) {
    return NextResponse.json(
      {
        error:
          'Cédula inválida. Use formato venezolano (V o E + 6 a 9 dígitos), ej. V-12345678.',
      },
      { status: 400 },
    );
  }

  const adminGate = supabaseAdminForRoute();
  if (!adminGate.ok) return adminGate.response;
  const admin = adminGate.client;

  const cargo = oficio || 'Por definir';
  const celular = celularParaInserto(celularRaw);
  const token = randomUUID();
  const nombresLegado = nombres
    ? nombresLegadoDesdeTextoLibre(nombres)
    : nombresLegadoDesdeTextoLibre(nombreCompleto);

  const baseRow: Record<string, unknown> = {
    nombre_completo: nombreCompleto,
    nombres: nombresLegado,
    documento: cedulaNorm,
    cedula: cedulaNorm,
    celular,
    telefono: celular,
    cargo,
    rol_buscado: cargo,
    cargo_nombre: cargo,
    oficio: oficio || null,
    rol_examen: ESTADO_EVALUACION_EXPRESS_INICIAL.rol_examen,
    estado: 'evaluacion_pendiente',
    estado_proceso: 'pendiente_cv',
    // Cuadrilla: solo disponible | asignado | no_disponible (migración 087)
    estatus: 'disponible',
    // Pipeline reclutamiento (vista ci_postulantes_reclutamiento; columna libre)
    status: 'pendiente',
    respuestas_personalidad: ESTADO_EVALUACION_EXPRESS_INICIAL.respuestas_personalidad,
    respuestas_logica: ESTADO_EVALUACION_EXPRESS_INICIAL.respuestas_logica,
    token,
    token_registro: token,
    semaforo: ESTADO_EVALUACION_EXPRESS_INICIAL.semaforo,
    status_evaluacion: ESTADO_EVALUACION_EXPRESS_INICIAL.status_evaluacion,
    estatus_evaluacion: 'iniciado',
  };

  async function insertCon(row: Record<string, unknown>) {
    return admin.from('ci_empleados').insert(row as never).select('id').single();
  }

  let { data, error } = await insertCon(baseRow);

  // Reintentos si faltan columnas opcionales en el schema del entorno.
  if (error && /oficio|column.*status\b|schema cache/i.test(error.message ?? '')) {
    const retry = { ...baseRow };
    if (/oficio/i.test(error.message ?? '')) delete retry.oficio;
    if (/\bstatus\b/i.test(error.message ?? '') && !/status_evaluacion|estatus/i.test(error.message ?? '')) {
      delete retry.status;
    }
    const second = await insertCon(retry);
    data = second.data;
    error = second.error;
  }

  if (error && /oficio|column.*status\b|schema cache/i.test(error.message ?? '')) {
    const retry = { ...baseRow };
    delete retry.oficio;
    delete retry.status;
    const third = await insertCon(retry);
    data = third.data;
    error = third.error;
  }

  if (error || !data) {
    const msg = error?.message ?? 'No se pudo guardar el obrero.';
    const hint = /check|estatus/i.test(msg)
      ? 'estatus debe ser disponible, asignado o no_disponible (no «pendiente»).'
      : /rol_examen/i.test(msg)
        ? 'Ejecute migración 084 (rol_examen obrero) en Supabase.'
        : /column|schema cache/i.test(msg)
          ? 'Ejecute la migración 297 (oficio/status en ci_empleados) en Supabase SQL Editor.'
          : undefined;
    return NextResponse.json({ error: msg, hint }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: (data as { id: string }).id,
    cedula: cedulaNorm,
  });
}
