import type { SupabaseClient } from '@supabase/supabase-js';
import {
  condicionPagoExtractedConfirmada,
  diasCreditoExtractedValido,
  monedaExtractedConfirmada,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { normalizarNombreEmpresa, normalizarRif } from '@/lib/contabilidad/propietarioFactura';
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
  // OCR guarda moneda/pago en null → el comprador debe elegir con botones.
  if (!monedaExtractedConfirmada(extracted.moneda)) return 'moneda';
  if (!condicionPagoExtractedConfirmada(extracted.condicion_pago)) return 'condicion';
  if (!diasCreditoExtractedValido(extracted)) return 'dias_credito';

  const proyectoId = row?.proyecto_id?.trim() || '';
  const ubicacionId = row?.ubicacion_destino_id?.trim() || '';
  // Destino incompleto: falta obra o (si ya hay obra) almacén.
  if (!proyectoId || !ubicacionId) return 'destino';

  return 'completo';
}

export function flujoFacturaCompradorIncompleto(
  extracted: ExtractedCanalHeader,
  row?: Pick<FilaPendienteFlujo, 'proyecto_id' | 'entidad_id' | 'ubicacion_destino_id'> | null,
): boolean {
  return siguientePasoFlujoFacturaComprador(extracted, row) !== 'completo';
}

type ObraSugeridaCompra = {
  proyectoId: string;
  nombre: string;
  entidadId: string | null;
  propietario: string;
};

const PREFIX_OBRA_SUGERIDA = 'fd:';

const escHtmlFd = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Obra por defecto según el propietario que figura como receptor de la factura.
 * Solo sugiere cuando el propietario tiene exactamente una obra marcada compra_default.
 */
export async function obraSugeridaPorReceptor(
  supabase: SupabaseClient,
  extracted: unknown,
): Promise<ObraSugeridaCompra | null> {
  const ex = (extracted ?? {}) as Record<string, unknown>;
  const rifR = normalizarRif(String(ex.receptor_rif ?? ''));
  const nomR = normalizarNombreEmpresa(String(ex.receptor_nombre ?? ''));
  if (!rifR && !nomR) return null;

  const { data: clientes } = await supabase.from('customers').select('id, nombre, rif');
  const lista = (clientes ?? []) as Array<{ id: string; nombre: string | null; rif: string | null }>;
  const porRif = rifR ? lista.find((c) => normalizarRif(c.rif) === rifR) : undefined;
  const porNombre = !porRif && nomR ? lista.find((c) => normalizarNombreEmpresa(c.nombre) === nomR) : undefined;
  const cliente = porRif ?? porNombre;
  if (!cliente) return null;

  const { data: obras } = await supabase
    .from('ci_proyectos')
    .select('id, nombre, entidad_id')
    .eq('customer_id', cliente.id)
    .eq('compra_default', true);
  const lista2 = (obras ?? []) as Array<{ id: string; nombre: string; entidad_id: string | null }>;
  if (lista2.length !== 1) return null;

  return {
    proyectoId: lista2[0].id,
    nombre: lista2[0].nombre,
    entidadId: lista2[0].entidad_id ?? null,
    propietario: cliente.nombre ?? 'propietario',
  };
}

async function ofrecerObraSugeridaCompra(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  sug: ObraSugeridaCompra,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
    metadata: {},
    reemplazarMetadata: true,
  });
  await sendTelegramMessage(
    chatId,
    '🏗 <b>Obra sugerida</b>\n' +
      `La factura está a nombre de <b>${escHtmlFd(sug.propietario)}</b>. Esa compra suele ir a:\n` +
      `🏗 <b>${escHtmlFd(sug.nombre)}</b>\n\n¿Es esta la obra de la compra?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `✅ Sí, ${sug.nombre.slice(0, 30)}`, callback_data: `${PREFIX_OBRA_SUGERIDA}ok:${sug.proyectoId}` }],
          [{ text: '🔀 No, elegir otra obra', callback_data: `${PREFIX_OBRA_SUGERIDA}otra` }],
        ],
      },
    },
  );
}

/** Botones de la obra sugerida: confirmar o elegir otra obra. */
export async function manejarCallbackObraSugeridaCompra(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!params.data.startsWith(PREFIX_OBRA_SUGERIDA)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  const pendingId = estado.pending_factura_id;
  if (!pendingId) {
    await answerCallbackQuery(params.callbackId, 'Factura no encontrada', true);
    return true;
  }

  if (params.data === `${PREFIX_OBRA_SUGERIDA}otra`) {
    await answerCallbackQuery(params.callbackId, 'Elija la obra');
    await enviarPickerEntidadesFacturaTelegram(supabase, params.chatId);
    return true;
  }

  if (!params.data.startsWith(`${PREFIX_OBRA_SUGERIDA}ok:`)) return false;
  const proyectoId = params.data.slice(`${PREFIX_OBRA_SUGERIDA}ok:`.length).trim();
  const { data: obra } = await supabase
    .from('ci_proyectos')
    .select('id, nombre, entidad_id')
    .eq('id', proyectoId)
    .maybeSingle();
  if (!obra) {
    await answerCallbackQuery(params.callbackId, 'Obra no encontrada', true);
    return true;
  }

  const o = obra as { id: string; nombre: string; entidad_id: string | null };
  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({ proyecto_id: o.id, entidad_id: o.entidad_id ?? null })
    .eq('id', pendingId);
  await answerCallbackQuery(params.callbackId, `Obra: ${o.nombre}`.slice(0, 180));
  await avanzarFlujoFacturaCompradorTelegram(supabase, params.chatId, pendingId);
  return true;
}

async function enviarPasoDestinoFacturaComprador(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  row: { proyecto_id?: string | null; entidad_id?: string | null; extracted?: unknown },
): Promise<void> {
  const proyectoId = String(row.proyecto_id ?? '').trim();
  const entidadId = String(row.entidad_id ?? '').trim();

  if (!proyectoId && !entidadId) {
    const sugerida = await obraSugeridaPorReceptor(supabase, row.extracted);
    if (sugerida) {
      await ofrecerObraSugeridaCompra(supabase, chatId, pendingId, sugerida);
      return;
    }
  }

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

/**
 * Avanza al siguiente paso obligatorio del comprador (moneda, pago, entidad, obra, almacén…).
 * No consultar columnas inexistentes (p. ej. imputacion_entidad): PostgREST falla y se
 * omiten los InlineKeyboard de Bs/USD, contado/crédito y almacén.
 */
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
