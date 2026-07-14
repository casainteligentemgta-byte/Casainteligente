import type { SupabaseClient } from '@supabase/supabase-js';
import {
  condicionPagoExtractedConfirmada,
  diasCreditoExtractedValido,
  monedaExtractedConfirmada,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  enviarConfirmacionFechaFacturaTelegram,
  fechaFacturaRequiereConfirmacion,
} from '@/lib/telegram/fechaFacturaPicker';
import {
  enviarPickerDestinoFacturaTelegram,
  enviarPickerEntidadesFacturaTelegram,
} from '@/lib/telegram/facturaEntidadDestinoPicker';
import { enviarPickerMonedaFacturaTelegram } from '@/lib/telegram/monedaFacturaPicker';
import {
  enviarPickerCondicionPagoTelegram,
  enviarPreguntaDiasCreditoFacturaTelegram,
} from '@/lib/telegram/condicionPagoPicker';

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
  ubicacion_destino_id?: string | null;
};

export function siguientePasoFlujoFacturaComprador(
  extracted: ExtractedCanalHeader,
  row?: Pick<FilaPendienteFlujo, 'proyecto_id' | 'entidad_id' | 'ubicacion_destino_id'> | null,
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
  const ubicacionId = row?.ubicacion_destino_id?.trim() || '';
  if (!proyectoId || !ubicacionId) return 'destino';

  return 'completo';
}

export function flujoFacturaCompradorIncompleto(
  extracted: ExtractedCanalHeader,
  row?: Pick<FilaPendienteFlujo, 'proyecto_id' | 'entidad_id' | 'ubicacion_destino_id'> | null,
): boolean {
  return siguientePasoFlujoFacturaComprador(extracted, row) !== 'completo';
}

async function enviarPasoDestinoFacturaComprador(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  row: Pick<FilaPendienteFlujo, 'proyecto_id' | 'entidad_id'>,
): Promise<void> {
  const proyectoId = String(row.proyecto_id ?? '').trim();
  const entidadId = String(row.entidad_id ?? '').trim();

  if (proyectoId) {
    const { data: pr } = await supabase
      .from('ci_proyectos')
      .select('nombre')
      .eq('id', proyectoId)
      .maybeSingle();
    const { enviarPickerUbicacionesTelegram } = await import('@/lib/telegram/ubicacionPicker');
    await enviarPickerUbicacionesTelegram(supabase, chatId, {
      pendingId,
      proyectoId,
      nombreObra: String(pr?.nombre ?? 'Obra').trim() || 'Obra',
    });
    return;
  }

  if (entidadId) {
    const { data: ent } = await supabase
      .from('ci_entidades')
      .select('nombre')
      .eq('id', entidadId)
      .maybeSingle();
    await enviarPickerDestinoFacturaTelegram(
      supabase,
      chatId,
      entidadId,
      String(ent?.nombre ?? 'Entidad').trim() || 'Entidad',
    );
    return;
  }

  await enviarPickerEntidadesFacturaTelegram(supabase, chatId);
}

/** Avanza al siguiente paso obligatorio del comprador (moneda, pago, entidad, obra, almacén…). */
export async function avanzarFlujoFacturaCompradorTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
): Promise<PasoFlujoFacturaComprador> {
  const { data: row, error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted, proyecto_id, entidad_id, ubicacion_destino_id, estado')
    .eq('id', pendingId.trim())
    .maybeSingle();

  if (error) {
    console.error('[avanzarFlujoFacturaComprador] lectura pendiente:', error.message);
    await sendTelegramMessage(
      chatId,
      `⚠️ No pude continuar el flujo de la factura.\n<i>${error.message.slice(0, 200)}</i>\n\nReenvíe la foto con <code>/facturas</code>.`,
      { parse_mode: 'HTML' },
    );
    return 'completo';
  }

  if (!row?.extracted) return 'completo';

  const estado = String(row.estado ?? '').toLowerCase();
  if (estado !== 'extraido' && estado !== 'error' && estado !== 'aprobado_sistema') {
    return 'completo';
  }

  const extracted = row.extracted as ExtractedCanalHeader;
  const paso = siguientePasoFlujoFacturaComprador(extracted, row);

  try {
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
        await enviarPasoDestinoFacturaComprador(supabase, chatId, pendingId, row);
        break;
      case 'completo':
        break;
    }
  } catch (e) {
    const det = e instanceof Error ? e.message : 'Error al mostrar el siguiente paso';
    console.error('[avanzarFlujoFacturaComprador]', det);
    await sendTelegramMessage(
      chatId,
      `⚠️ ${det.slice(0, 280)}\n\nReenvíe la foto con <code>/facturas</code> si no ve los botones.`,
      { parse_mode: 'HTML' },
    );
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
