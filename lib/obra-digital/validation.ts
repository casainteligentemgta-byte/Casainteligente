import type { SupabaseClient } from '@supabase/supabase-js';

/** Nómina / tabulador central (`ci_config_nomina`, etc.): integración en fase posterior al expediente digital. */

export const OBRA_DIGITAL_CONTRACT_STATUS = [
  'PENDIENTE_DOCUMENTOS',
  'ACTIVO',
  'LIQUIDACION',
  'CERRADO_HISTORICO',
] as const;

export type ObraDigitalContractStatus = (typeof OBRA_DIGITAL_CONTRACT_STATUS)[number];

export const OBRA_DIGITAL_DOC_TYPES = [
  'CEDULA',
  'INVENTARIO_ENTREGA',
  'ANTICIPO_MENSUAL',
  'LIBRO_OBRA_SEMANAL',
  'FINIQUITO',
] as const;

export type ObraDigitalDocType = (typeof OBRA_DIGITAL_DOC_TYPES)[number];

/** Regla API: no generar PDF laboral sin cédula digitalizada en el expediente. */
export async function assertCedulaRegistradaParaPdfLaboral(
  supabase: SupabaseClient,
  contractId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('obra_digital_documents')
    .select('id')
    .eq('contract_id', contractId)
    .eq('doc_type', 'CEDULA')
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data) {
    return { ok: false, message: 'Falta Cédula del Obrero' };
  }
  return { ok: true };
}
