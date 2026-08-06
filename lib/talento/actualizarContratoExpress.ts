/**
 * Actualiza los datos recaudados de un contrato express y regenera el PDF.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { CEDULA_VE_NORMALIZADA_REGEX, estadoCivilContratoObrero, normCedulaToken } from '@/lib/talento/cedulaAuth';
import { regenerarYPersistirPdfContratoExpress } from '@/lib/rrhh/expressContratoPdfBuffer';

export type ActualizarContratoExpressInput = {
  obrero_nombre?: string | null;
  obrero_nombres?: string | null;
  obrero_apellidos?: string | null;
  obrero_cedula?: string | null;
  obrero_direccion?: string | null;
  estado_civil?: string | null;
  nacionalidad?: string | null;
  fecha_ingreso?: string | null;
  horario_semanal_texto?: string | null;
  bono_manual_usd?: number | null;
  config_nomina_id?: string | null;
  objeto_contrato?: string | null;
  jornada_trabajo?: string | null;
  obrero_municipio_residencia?: string | null;
  obrero_estado_residencia?: string | null;
  /** Si false, solo actualiza fila (no regenera PDF). Default true. */
  regenerar_pdf?: boolean;
};

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

function nombreCompleto(input: ActualizarContratoExpressInput, prevNombre: string): string {
  const nom = trimOrNull(input.obrero_nombres);
  const ape = trimOrNull(input.obrero_apellidos);
  if (nom && ape) return `${nom} ${ape}`;
  return trimOrNull(input.obrero_nombre) || prevNombre;
}

export async function actualizarContratoExpress(
  admin: SupabaseClient,
  expressId: string,
  input: ActualizarContratoExpressInput,
): Promise<
  | { ok: true; id: string; pdf_storage_path?: string | null; signed_url?: string | null }
  | { ok: false; error: string; status: number }
> {
  const id = expressId.trim();
  if (!id) return { ok: false, error: 'id requerido', status: 400 };

  const { data: existing, error: selErr } = await admin
    .from('ci_contratos_express')
    .select('id,obrero_nombre,config_nomina_id,cargo_nombre_snapshot')
    .eq('id', id)
    .maybeSingle();
  if (selErr) return { ok: false, error: selErr.message, status: 500 };
  if (!existing) return { ok: false, error: 'Contrato express no encontrado', status: 404 };

  const prev = existing as {
    obrero_nombre?: string | null;
    config_nomina_id?: string | null;
  };

  const patch: Record<string, unknown> = {};

  if (input.obrero_nombres !== undefined) patch.obrero_nombres = trimOrNull(input.obrero_nombres);
  if (input.obrero_apellidos !== undefined) patch.obrero_apellidos = trimOrNull(input.obrero_apellidos);
  if (
    input.obrero_nombre !== undefined ||
    input.obrero_nombres !== undefined ||
    input.obrero_apellidos !== undefined
  ) {
    patch.obrero_nombre = nombreCompleto(input, String(prev.obrero_nombre ?? '').trim());
  }

  if (input.obrero_cedula !== undefined) {
    const ced = normCedulaToken(String(input.obrero_cedula ?? ''));
    if (!CEDULA_VE_NORMALIZADA_REGEX.test(ced)) {
      return { ok: false, error: 'Cédula inválida (Ej: V-12345678)', status: 400 };
    }
    patch.obrero_cedula = ced;
  }

  if (input.obrero_direccion !== undefined) {
    patch.obrero_direccion = trimOrNull(input.obrero_direccion) || 'de este domicilio';
  }
  if (input.estado_civil !== undefined) {
    patch.estado_civil = estadoCivilContratoObrero(input.estado_civil);
  }
  if (input.nacionalidad !== undefined) patch.nacionalidad = trimOrNull(input.nacionalidad);
  if (input.fecha_ingreso !== undefined) {
    const f = trimOrNull(input.fecha_ingreso);
    if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) {
      return { ok: false, error: 'fecha_ingreso debe ser YYYY-MM-DD', status: 400 };
    }
    patch.fecha_ingreso = f;
  }
  if (input.horario_semanal_texto !== undefined) {
    patch.horario_semanal_texto = trimOrNull(input.horario_semanal_texto);
  }
  if (input.bono_manual_usd !== undefined) {
    const n = Number(input.bono_manual_usd);
    patch.bono_manual_usd = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  if (input.objeto_contrato !== undefined) patch.objeto_contrato = trimOrNull(input.objeto_contrato);
  if (input.jornada_trabajo !== undefined) patch.jornada_trabajo = trimOrNull(input.jornada_trabajo);
  if (input.obrero_municipio_residencia !== undefined) {
    patch.obrero_municipio_residencia = trimOrNull(input.obrero_municipio_residencia);
  }
  if (input.obrero_estado_residencia !== undefined) {
    patch.obrero_estado_residencia = trimOrNull(input.obrero_estado_residencia);
  }

  if (input.config_nomina_id !== undefined) {
    const cfgId = trimOrNull(input.config_nomina_id);
    if (cfgId) {
      const { data: nom, error: nomErr } = await admin
        .from('ci_config_nomina')
        .select('id,cargo_nombre,salario_base_mensual')
        .eq('id', cfgId)
        .maybeSingle();
      if (nomErr) return { ok: false, error: nomErr.message, status: 500 };
      if (!nom) return { ok: false, error: 'Oficio / tabulador no encontrado', status: 400 };
      const n = nom as {
        id: string;
        cargo_nombre?: string | null;
        salario_base_mensual?: unknown;
      };
      patch.config_nomina_id = n.id;
      patch.cargo_nombre_snapshot = (n.cargo_nombre ?? '').trim() || null;
      const sal = n.salario_base_mensual != null ? Number(n.salario_base_mensual) : null;
      patch.salario_base_mensual_snapshot = sal != null && Number.isFinite(sal) ? sal : null;
    }
  }

  if (Object.keys(patch).length === 0 && input.regenerar_pdf === false) {
    return { ok: true, id };
  }

  if (Object.keys(patch).length > 0) {
    let { error: updErr } = await admin.from('ci_contratos_express').update(patch as never).eq('id', id);

    // Si faltan columnas nuevas, reintentar solo con las ya existentes.
    if (updErr && /column|42703|schema cache|Could not find/i.test(updErr.message)) {
      const safe: Record<string, unknown> = {};
      for (const k of [
        'obrero_nombre',
        'obrero_cedula',
        'obrero_direccion',
        'horario_semanal_texto',
        'bono_manual_usd',
        'config_nomina_id',
        'cargo_nombre_snapshot',
        'salario_base_mensual_snapshot',
      ]) {
        if (k in patch) safe[k] = patch[k];
      }
      if (Object.keys(safe).length === 0) {
        return {
          ok: false,
          error:
            'Faltan columnas editables en BD. Ejecute supabase/sql_editor_312_ci_contratos_express_campos_editables.sql',
          status: 400,
        };
      }
      const retry = await admin.from('ci_contratos_express').update(safe as never).eq('id', id);
      updErr = retry.error;
    }

    if (updErr) return { ok: false, error: updErr.message, status: 500 };
  }

  if (input.regenerar_pdf === false) {
    return { ok: true, id };
  }

  const regen = await regenerarYPersistirPdfContratoExpress(admin, id);
  if (!regen.ok) return { ok: false, error: regen.error, status: regen.status };

  return {
    ok: true,
    id,
    pdf_storage_path: regen.pdf_storage_path,
    signed_url: regen.signed_url,
  };
}
