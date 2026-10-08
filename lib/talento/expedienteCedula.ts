import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarCedula } from '@/lib/rrhh/cargaMasivaObreros';
import { normCedulaToken } from '@/lib/talento/cedulaAuth';

/**
 * El expediente laboral es la cédula (V-12345678 / E-12345678).
 * Vive en la obra (`ci_empleados`) y se indexa también en la entidad.
 */
export function expedienteDesdeCedula(raw: string | null | undefined): string {
  const n = normalizarCedula(String(raw ?? ''));
  if (n) return n;
  return String(raw ?? '').replace(/\s+/g, '').toUpperCase();
}

/** Clave estable para índices: V12345678. */
export function cedulaNormExpediente(raw: string | null | undefined): string {
  const exp = expedienteDesdeCedula(raw);
  return normCedulaToken(exp);
}

export type RegistrarExpedienteArgs = {
  empleadoId?: string | null;
  proyectoId?: string | null;
  entidadId?: string | null;
  cedula: string | null | undefined;
  nombreCompleto?: string | null;
};

/**
 * Escribe el expediente (cédula) en la obra y deja/actualiza el registro en la entidad.
 * No falla el flujo si falta migración 337: solo registra aviso.
 */
export async function registrarExpedienteObraYEntidad(
  db: SupabaseClient,
  args: RegistrarExpedienteArgs,
): Promise<{ expediente: string; entidadId: string | null; ok: boolean; error?: string }> {
  const expediente = expedienteDesdeCedula(args.cedula);
  const cedulaNorm = cedulaNormExpediente(args.cedula);
  const empleadoId = String(args.empleadoId ?? '').trim() || null;
  let proyectoId = String(args.proyectoId ?? '').trim() || null;
  let entidadId = String(args.entidadId ?? '').trim() || null;
  const nombre = String(args.nombreCompleto ?? '').trim() || null;

  if (!expediente || cedulaNorm.replace(/\D/g, '').length < 6) {
    return { expediente, entidadId, ok: false, error: 'Cédula insuficiente para expediente.' };
  }

  if (empleadoId && !proyectoId) {
    const { data: emp } = await db
      .from('ci_empleados')
      .select('proyecto_modulo_id')
      .eq('id', empleadoId)
      .maybeSingle();
    proyectoId = String((emp as { proyecto_modulo_id?: string | null } | null)?.proyecto_modulo_id ?? '').trim() || null;
  }

  if (!entidadId && proyectoId) {
    const { data: pr } = await db.from('ci_proyectos').select('entidad_id').eq('id', proyectoId).maybeSingle();
    entidadId = String((pr as { entidad_id?: string | null } | null)?.entidad_id ?? '').trim() || null;
  }

  if (empleadoId) {
    const patchEmp: Record<string, unknown> = { expediente_cedula: expediente };
    if (entidadId) patchEmp.entidad_id = entidadId;
    const { error: eEmp } = await db.from('ci_empleados').update(patchEmp as never).eq('id', empleadoId);
    if (eEmp && !/expediente_cedula|entidad_id|42703|schema cache|column/i.test(eEmp.message)) {
      console.warn('[registrarExpedienteObraYEntidad] empleado', eEmp.message);
    }
  }

  if (entidadId) {
    const { error: eEnt } = await db.from('ci_entidad_expedientes').upsert(
      {
        entidad_id: entidadId,
        cedula_norm: cedulaNorm,
        expediente_cedula: expediente,
        empleado_id: empleadoId,
        proyecto_modulo_id: proyectoId,
        nombre_completo: nombre,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'entidad_id,cedula_norm' },
    );
    if (eEnt) {
      if (/ci_entidad_expedientes|42703|schema cache|does not exist/i.test(eEnt.message)) {
        return { expediente, entidadId, ok: true, error: 'Migración 337 pendiente (registro en entidad).' };
      }
      console.warn('[registrarExpedienteObraYEntidad] entidad', eEnt.message);
      return { expediente, entidadId, ok: false, error: eEnt.message };
    }
  }

  return { expediente, entidadId, ok: true };
}
