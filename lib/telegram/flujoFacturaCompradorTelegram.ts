import type { SupabaseClient } from '@supabase/supabase-js';
import {
  condicionPagoExtractedConfirmada,
  diasCreditoExtractedValido,
  monedaExtractedConfirmada,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import {
  enviarConfirmacionFechaFacturaTelegram,
  fechaFacturaRequiereConfirmacion,
} from '@/lib/telegram/fechaFacturaPicker';
import { enviarPickerMonedaFacturaTelegram } from '@/lib/telegram/monedaFacturaPicker';
import { enviarPickerCondicionPagoTelegram, enviarPreguntaDiasCreditoFacturaTelegram } from '@/lib/telegram/condicionPagoPicker';
import { enviarPickerEntidadesFacturaTelegram } from '@/lib/telegram/facturaEntidadDestinoPicker';

export type PasoFlujoFacturaComprador =
  | 'fecha'
  | 'moneda'
  | 'condicion'
  | 'dias_credito'
  | 'destino'
  | 'completo';

type FilaPendienteFlujo = {
  extracted?: ExtractedCanalHeader | null;
  proyecto_id?: string | null;
  entidad_id?: string | null;
  imputacion_entidad?: boolean | null;
};

export function siguientePasoFlujoFacturaComprador(
  extracted: ExtractedCanalHeader,
  row?: Pick<FilaPendienteFlujo, 'proyecto_id' | 'entidad_id' | 'imputacion_entidad'> | null,
): PasoFlujoFacturaComprador {
  const fecha = String(extracted.date ?? '').slice(0, 10);
  if (
    fecha &&
    fechaFacturaRequiereConfirmacion(fecha) &&
    !extracted.fecha_auditoria_confirmada
  ) {
    return 'fecha';
  }
  if (!monedaExtractedConfirmada(extracted.moneda)) return 'moneda';
  if (!condicionPagoExtractedConfirmada(extracted.condicion_pago)) return 'condicion';
  if (!diasCreditoExtractedValido(extracted)) return 'dias_credito';

  const proyectoId = row?.proyecto_id?.trim() || '';
  const entidadId = row?.entidad_id?.trim() || '';
  const gastoEntidad = row?.imputacion_entidad === true;
  if (gastoEntidad) {
    if (!entidadId) return 'destino';
  } else if (!proyectoId) {
    return 'destino';
  }

  return 'completo';
}

export function flujoFacturaCompradorIncompleto(
  extracted: ExtractedCanalHeader,
  row?: Pick<FilaPendienteFlujo, 'proyecto_id' | 'entidad_id' | 'imputacion_entidad'> | null,
): boolean {
  return siguientePasoFlujoFacturaComprador(extracted, row) !== 'completo';
}

/** Avanza al siguiente paso obligatorio del comprador (moneda, pago, destino…). */
export async function avanzarFlujoFacturaCompradorTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
): Promise<PasoFlujoFacturaComprador> {
  const { data: row, error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted, proyecto_id, entidad_id, imputacion_entidad, estado')
    .eq('id', pendingId.trim())
    .maybeSingle();

  if (error || !row?.extracted) return 'completo';

  const estado = String(row.estado ?? '').toLowerCase();
  if (estado !== 'extraido' && estado !== 'error' && estado !== 'aprobado_sistema') {
    return 'completo';
  }

  const extracted = row.extracted as ExtractedCanalHeader;
  const paso = siguientePasoFlujoFacturaComprador(extracted, row);

  switch (paso) {
    case 'fecha':
      await enviarConfirmacionFechaFacturaTelegram(supabase, chatId, pendingId);
      break;
    case 'moneda':
      await enviarPickerMonedaFacturaTelegram(supabase, chatId, pendingId);
      break;
    case 'condicion':
      await enviarPickerCondicionPagoTelegram(supabase, chatId, pendingId);
      break;
    case 'dias_credito':
      await enviarPreguntaDiasCreditoFacturaTelegram(supabase, chatId, pendingId);
      break;
    case 'destino':
      await enviarPickerEntidadesFacturaTelegram(supabase, chatId);
      break;
    case 'completo':
      break;
  }

  return paso;
}

/** @deprecated usar avanzarFlujoFacturaCompradorTelegram */
export async function continuarPostOcrFacturaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  _extracted?: ExtractedCanalHeader,
): Promise<void> {
  await avanzarFlujoFacturaCompradorTelegram(supabase, chatId, pendingId);
}
