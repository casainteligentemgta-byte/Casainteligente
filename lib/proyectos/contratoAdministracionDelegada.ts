import type { SupabaseClient } from '@supabase/supabase-js';

export const TIPO_CONTRATO_AD = 'administracion_delegada';
export const ESTADO_CONTRATO_EXITOSO = 'exitoso';

export type ContratoAdResumen = {
  id: string;
  entidad_ejecutora_id: string | null;
  honorarios_admin_pct: number | null;
  estado: string;
  created_at: string;
  entidad?: { nombre: string } | null;
};

/** ¿Proyecto con contrato AD en estado exitoso? (habilita compras/despacho). */
export async function proyectoTieneContratoAdExitoso(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('ci_contratos_express')
    .select('id')
    .eq('proyecto_id', proyectoId)
    .eq('tipo_contrato', TIPO_CONTRATO_AD)
    .eq('estado', ESTADO_CONTRATO_EXITOSO)
    .limit(1)
    .maybeSingle();

  if (error?.code === '42703' || /tipo_contrato|estado/i.test(error?.message ?? '')) {
    return true;
  }
  if (error?.code === '42P01') return true;
  return Boolean(data?.id);
}

export async function obtenerContratoAdProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<ContratoAdResumen | null> {
  const { data, error } = await supabase
    .from('ci_contratos_express')
    .select(
      `
      id,
      entidad_ejecutora_id,
      honorarios_admin_pct,
      estado,
      created_at,
      entidad:ci_entidades ( nombre )
    `,
    )
    .eq('proyecto_id', proyectoId)
    .eq('tipo_contrato', TIPO_CONTRATO_AD)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const entRaw = data.entidad as { nombre: string } | { nombre: string }[] | null;
  const ent = Array.isArray(entRaw) ? entRaw[0] : entRaw;

  return {
    id: String(data.id),
    entidad_ejecutora_id: data.entidad_ejecutora_id ?? null,
    honorarios_admin_pct:
      data.honorarios_admin_pct != null ? Number(data.honorarios_admin_pct) : null,
    estado: String(data.estado ?? ''),
    created_at: String(data.created_at),
    entidad: ent ?? null,
  };
}

export async function registrarContratoAdministracionDelegada(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    entidadEjecutoraId: string;
    honorariosAdminPct: number;
    createdBy?: string | null;
  },
): Promise<{ id: string }> {
  const pct = Math.min(100, Math.max(0, Number(params.honorariosAdminPct) || 0));

  const ya = await proyectoTieneContratoAdExitoso(supabase, params.proyectoId);
  if (ya) {
    throw new Error('Este proyecto ya tiene un contrato AD registrado.');
  }

  const payload: Record<string, unknown> = {
    proyecto_id: params.proyectoId,
    tipo_contrato: TIPO_CONTRATO_AD,
    entidad_ejecutora_id: params.entidadEjecutoraId,
    honorarios_admin_pct: pct,
    estado: ESTADO_CONTRATO_EXITOSO,
    obrero_nombre: 'Administración Delegada',
    obrero_cedula: 'AD',
    pdf_storage_path: null,
    created_by: params.createdBy ?? null,
  };

  const { data, error } = await supabase
    .from('ci_contratos_express')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    if (error.code === '42703' || /tipo_contrato/i.test(error.message ?? '')) {
      throw new Error(
        'Esquema desactualizado. Aplique la migración 188_ci_contrato_ad_abonos_fondos en Supabase.',
      );
    }
    throw new Error(error.message);
  }

  return { id: String(data.id) };
}
