import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { nombresLegadoDesdeTextoLibre } from '@/lib/registro/ciEmpleadosNombresLegado';
import { normCedulaToken } from '@/lib/talento/cedulaAuth';
import { ESTADO_EVALUACION_EXPRESS_INICIAL } from '@/lib/talento/estadoEvaluacionExpress';

type ExpressRow = {
  id: string;
  proyecto_id: string;
  config_nomina_id: string | null;
  obrero_nombre: string;
  obrero_cedula: string;
  obrero_direccion: string | null;
  cargo_nombre_snapshot: string | null;
  /** Migración 121. */
  formalizado?: boolean | null;
  /** Migración 119. */
  formalizado_empleado_id?: string | null;
};

type NominaSnap = {
  cargo_nombre: string | null;
  cargo_codigo: string | null;
  nivel_salarial: number | null;
};

export type FormalizarContratoExpressResult =
  | { ok: true; empleado_id: string }
  | { ok: false; status: 404 | 409 | 500; error: string; empleado_id?: string };

/**
 * Crea expediente en `ci_empleados` desde `ci_contratos_express` y marca formalización (migración 119).
 * Usa cliente con permisos de servicio (RLS / inserts fiables en servidor).
 */
export async function formalizarContratoExpressPorId(
  admin: SupabaseClient,
  expressId: string,
): Promise<FormalizarContratoExpressResult> {
  const id = expressId.trim();
  if (!id) {
    return { ok: false, status: 404, error: 'id requerido' };
  }

  const selectFull =
    'id,proyecto_id,config_nomina_id,obrero_nombre,obrero_cedula,obrero_direccion,cargo_nombre_snapshot,formalizado,formalizado_empleado_id';
  const selectLite =
    'id,proyecto_id,config_nomina_id,obrero_nombre,obrero_cedula,obrero_direccion,cargo_nombre_snapshot,formalizado_empleado_id';

  let raw: unknown = null;
  let selErr: { message: string } | null = null;
  const first = await admin.from('ci_contratos_express').select(selectFull).eq('id', id).maybeSingle();
  if (first.error && /formalizado_empleado_id|formalizado\b|does not exist|schema cache/i.test(first.error.message)) {
    const second = await admin.from('ci_contratos_express').select(selectLite).eq('id', id).maybeSingle();
    raw = second.data;
    selErr = second.error;
  } else {
    raw = first.data;
    selErr = first.error;
  }

  if (selErr || !raw) {
    return { ok: false, status: 404, error: selErr?.message ?? 'Contrato express no encontrado' };
  }

  const ex = raw as ExpressRow;
  if (ex.formalizado === true || ex.formalizado_empleado_id) {
    return {
      ok: false,
      status: 409,
      error: 'Este contrato ya fue formalizado.',
      empleado_id: ex.formalizado_empleado_id ?? undefined,
    };
  }

  const cedulaNorm = normCedulaToken(ex.obrero_cedula);
  const { data: candidatos, error: dupErr } = await admin
    .from('ci_empleados')
    .select('id,cedula,documento')
    .eq('proyecto_modulo_id', ex.proyecto_id);

  if (!dupErr && candidatos?.length) {
    const hit = (candidatos as { id: string; cedula: string | null; documento: string | null }[]).find(
      (r) =>
        normCedulaToken(r.cedula ?? '') === cedulaNorm || normCedulaToken(r.documento ?? '') === cedulaNorm,
    );
    if (hit) {
      return {
        ok: false,
        status: 409,
        error: 'Ya existe un expediente con la misma cédula en este proyecto.',
        empleado_id: hit.id,
      };
    }
  }

  let nomina: NominaSnap | null = null;
  if (ex.config_nomina_id) {
    const { data: n } = await admin
      .from('ci_config_nomina')
      .select('cargo_nombre,cargo_codigo,nivel_salarial')
      .eq('id', ex.config_nomina_id)
      .maybeSingle();
    nomina = (n ?? null) as NominaSnap | null;
  }

  const cargoNombre =
    ex.cargo_nombre_snapshot?.trim() || nomina?.cargo_nombre?.trim() || 'Por definir';

  const token = randomUUID();
  /** Express no pide móvil; si `celular` es NOT NULL en BD, placeholder hasta que RRHH lo complete. */
  const celularExpress = 'Pendiente RRHH';
  const insertRow: Record<string, unknown> = {
    nombre_completo: ex.obrero_nombre.trim(),
    nombres: nombresLegadoDesdeTextoLibre(ex.obrero_nombre.trim()),
    documento: cedulaNorm,
    cedula: cedulaNorm,
    celular: celularExpress,
    telefono: celularExpress,
    cargo: cargoNombre,
    rol_buscado: cargoNombre,
    cargo_nombre: nomina?.cargo_nombre?.trim() || cargoNombre,
    cargo_codigo: nomina?.cargo_codigo?.trim() || null,
    cargo_nivel: nomina?.nivel_salarial ?? null,
    proyecto_modulo_id: ex.proyecto_id,
    direccion_habitacion: ex.obrero_direccion?.trim() || null,
    domicilio_declarado: ex.obrero_direccion?.trim() || null,
    rol_examen: ESTADO_EVALUACION_EXPRESS_INICIAL.rol_examen,
    estado: 'aprobado',
    estado_proceso: 'cv_completado',
    respuestas_personalidad: ESTADO_EVALUACION_EXPRESS_INICIAL.respuestas_personalidad,
    respuestas_logica: ESTADO_EVALUACION_EXPRESS_INICIAL.respuestas_logica,
    token,
    token_registro: token,
    semaforo: ESTADO_EVALUACION_EXPRESS_INICIAL.semaforo,
    status_evaluacion: ESTADO_EVALUACION_EXPRESS_INICIAL.status_evaluacion,
    estatus_evaluacion: 'completado',
  };

  const { data: emp, error: insErr } = await admin
    .from('ci_empleados')
    .insert(insertRow as never)
    .select('id')
    .single();

  if (insErr || !emp) {
    console.error('[formalizarContratoExpressPorId]', insErr);
    return { ok: false, status: 500, error: insErr?.message ?? 'No se pudo crear el expediente' };
  }

  const empleadoId = (emp as { id: string }).id;
  const ahora = new Date().toISOString();

  const { error: upErr } = await admin
    .from('ci_contratos_express')
    .update({ formalizado_empleado_id: empleadoId, formalizado_at: ahora, formalizado: true } as never)
    .eq('id', id);

  if (upErr) {
    console.warn('[formalizarContratoExpressPorId] no se pudo marcar formalizado:', upErr.message);
  }

  return { ok: true, empleado_id: empleadoId };
}
