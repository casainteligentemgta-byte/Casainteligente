/**
 * Despacho de una solicitud de material (procura) desde el almacén, con foto obligatoria.
 *
 * El depositario pulsa «Confirmar» en la orden de verificación: si hay material que sacar,
 * el despacho queda a su nombre y el stock solo se mueve cuando envía la foto de lo que sale.
 * Si no hay nada que sacar (todo se compra), se confirma de una vez: no hay movimiento que fotografiar.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarProcuraAbastecimiento,
  confirmarAbastecimientoProcura,
  etiquetaResultadoAbastecimiento,
  evaluarAbastecimientoProcura,
} from '@/lib/procuras/abastecimientoProcuraAprobada';
import { nombreMaterialProcuraVisible } from '@/lib/compras/procuraMaterialTexto';
import { resolverNombreMostrarTelegram } from '@/lib/procuras/resolverNombreTelegramObra';
import { actualizarTicketProcuraSolicitante } from '@/lib/procuras/ticketProcuraSolicitanteTelegram';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { getTelegramEstado } from '@/lib/telegram/estados';
import { fotoMovimientoObligatoria } from '@/lib/telegram/fotoObligatoria';

export const CB_PROCURA_DESPACHO_SOLTAR = 'cmp:prc_solt:';

const BUCKET_FOTOS = 'ci-proyectos-media';
/** Pasado este tiempo sin foto, otra persona del almacén puede tomar el despacho. */
const MINUTOS_RESERVA_DESPACHO = 30;

type ProcuraDespacho = NonNullable<Awaited<ReturnType<typeof cargarProcuraAbastecimiento>>> & {
  despacho_chat_id?: number | string | null;
  despacho_tomado_at?: string | null;
};

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function chatNumerico(chatId: string | number): number | null {
  const n = Number(chatId);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function cantidadTexto(n: number): string {
  return Number(n).toLocaleString('es-VE');
}

export function esCallbackSoltarDespachoProcura(data: string): boolean {
  return data.startsWith(CB_PROCURA_DESPACHO_SOLTAR);
}

export function tecladoSoltarDespachoProcura(procuraId: string) {
  return {
    inline_keyboard: [[{ text: '↩️ No lo despacho yo', callback_data: `${CB_PROCURA_DESPACHO_SOLTAR}${procuraId}` }]],
  };
}

/** Quién tiene tomado el despacho (si la reserva sigue vigente). */
export function despachoTomadoPor(
  procura: { despacho_chat_id?: number | string | null; despacho_tomado_at?: string | null },
  ahora: Date = new Date(),
): string | null {
  if (procura.despacho_chat_id == null || String(procura.despacho_chat_id).trim() === '') return null;
  const desde = procura.despacho_tomado_at ? new Date(procura.despacho_tomado_at).getTime() : NaN;
  if (!Number.isFinite(desde)) return null;
  if (ahora.getTime() - desde > MINUTOS_RESERVA_DESPACHO * 60_000) return null;
  return String(procura.despacho_chat_id);
}

async function reservaDespacho(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<{ despacho_chat_id?: number | string | null; despacho_tomado_at?: string | null }> {
  const { data } = await supabase
    .from('ci_procuras')
    .select('despacho_chat_id,despacho_tomado_at')
    .eq('id', procuraId)
    .maybeSingle();
  return (data ?? {}) as { despacho_chat_id?: number | string | null; despacho_tomado_at?: string | null };
}

async function soltarReserva(supabase: SupabaseClient, procuraId: string): Promise<void> {
  await supabase
    .from('ci_procuras')
    .update({ despacho_chat_id: null, despacho_tomado_at: null } as never)
    .eq('id', procuraId);
}

/** La procura cuyo despacho tomó este chat y que todavía espera la foto. */
export async function procuraEsperandoFotoDespacho(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<ProcuraDespacho | null> {
  const chat = chatNumerico(chatId);
  if (chat == null) return null;
  const { data, error } = await supabase
    .from('ci_procuras')
    .select('id,despacho_chat_id,despacho_tomado_at,abastecimiento_codigo_despacho')
    .eq('despacho_chat_id', chat)
    .is('abastecimiento_codigo_despacho', null)
    .order('despacho_tomado_at', { ascending: false })
    .limit(1);
  if (error) return null;
  const fila = ((data ?? []) as Array<{ id: string; despacho_chat_id?: number | null; despacho_tomado_at?: string | null }>)[0];
  if (!fila) return null;
  const procura = await cargarProcuraAbastecimiento(supabase, fila.id);
  if (!procura) return null;
  return { ...procura, despacho_chat_id: fila.despacho_chat_id, despacho_tomado_at: fila.despacho_tomado_at };
}

async function nombreDeQuienDespacha(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string | null | undefined,
): Promise<string> {
  const chat = chatNumerico(chatId);
  if (chat == null) return 'Depositario';
  try {
    return await resolverNombreMostrarTelegram(supabase, chat, 'Depositario', proyectoId ?? null);
  } catch {
    return 'Depositario';
  }
}

/** Avisa al solicitante en un mensaje nuevo (editar su ticket no le suena en el teléfono). */
async function avisarSolicitante(
  procura: { solicitante_telegram_chat_id?: number | string | null },
  texto: string,
): Promise<void> {
  const chat = procura.solicitante_telegram_chat_id;
  if (chat == null || String(chat).trim() === '') return;
  try {
    await sendTelegramMessage(String(chat), texto, {
      parse_mode: 'HTML',
      rolDestinatario: 'Solicitante',
      contextoLogEspejo: '[Procura · almacén]',
    });
  } catch (e) {
    console.warn('[despachoProcura] aviso solicitante', e);
  }
}

/** Ejecuta el abastecimiento y responde a quien lo confirmó. */
async function confirmarYResponder(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    procura: ProcuraDespacho;
    foto?: { storage_path: string; url: string };
  },
): Promise<boolean> {
  const { chatId, procura } = params;
  const nombre = await nombreDeQuienDespacha(supabase, chatId, procura.proyecto_id);
  const resultado = await confirmarAbastecimientoProcura(supabase, {
    procuraId: procura.id,
    autorNombre: nombre,
    // El botón viene de la orden que salió al aprobar: la compra ya se le pidió al comprador.
    compraOrdenadaAlAprobar: true,
    foto: params.foto,
  });

  if (!resultado.ok) {
    await sendTelegramMessage(
      chatId,
      `❌ ${escHtml(resultado.error ?? 'No se pudo abastecer')}\n\nEl stock no se movió.`,
      {
        parse_mode: 'HTML',
        ...(params.foto ? { reply_markup: tecladoSoltarDespachoProcura(procura.id) } : {}),
      },
    );
    return false;
  }

  await soltarReserva(supabase, procura.id);
  const conFoto = params.foto && resultado.despachoCodigo && !resultado.yaConfirmado ? ' (con foto)' : '';
  await sendTelegramMessage(
    chatId,
    `✅ <b>${escHtml(etiquetaResultadoAbastecimiento(resultado))}</b>${conFoto}`,
    { parse_mode: 'HTML' },
  );

  if (resultado.despachoCodigo && !resultado.yaConfirmado) {
    try {
      await actualizarTicketProcuraSolicitante(supabase, procura.id, {
        despachoCodigo: resultado.despachoCodigo,
        ordenCompraEmitida: Boolean(resultado.compraEmitida),
      });
    } catch (e) {
      console.warn('[despachoProcura] ticket solicitante', e);
    }
    const despachado = Number(resultado.cantidadDespachada ?? 0);
    const cantidad = despachado > 0 ? `${cantidadTexto(despachado)} ${procura.unidad}` : 'El material disponible';
    await avisarSolicitante(
      procura,
      `📦 <b>El almacén despachó material de su solicitud ${escHtml(procura.ticket)}</b>\n\n` +
        `${escHtml(cantidad)} · ${escHtml(nombreMaterialProcuraVisible(procura.material_txt))}\n` +
        `🏭 Entregó: <b>${escHtml(nombre)}</b>${conFoto}\n` +
        `🔖 Movimiento: <code>${escHtml(resultado.despachoCodigo)}</code>` +
        (resultado.compraEmitida ? '\n\n🛒 Lo que falta ya está pedido al comprador.' : ''),
    );
  }
  return true;
}

/**
 * El depositario pulsó «Confirmar verificación / despacho» en la orden de almacén.
 * Con material que sacar pide la foto; sin él, confirma de una vez.
 */
export async function manejarConfirmarAbastecimientoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; procuraId: string },
): Promise<void> {
  const base = await cargarProcuraAbastecimiento(supabase, params.procuraId);
  if (!base) {
    await answerCallbackQuery(params.callbackId, 'Procura no encontrada', true);
    return;
  }
  const procura: ProcuraDespacho = { ...base, ...(await reservaDespacho(supabase, base.id)) };

  const yaDespachado = String(procura.abastecimiento_codigo_despacho ?? '').trim();
  const evaluacion = yaDespachado ? null : await evaluarAbastecimientoProcura(supabase, procura);
  const hayQueSacar = Boolean(evaluacion && evaluacion.cantidadDespacho > 0 && evaluacion.origenUbicacionId);

  if (!hayQueSacar || !fotoMovimientoObligatoria()) {
    await answerCallbackQuery(params.callbackId, 'Verificando almacén…');
    await confirmarYResponder(supabase, { chatId: params.chatId, procura });
    return;
  }

  const tomadoPor = despachoTomadoPor(procura);
  if (tomadoPor && tomadoPor !== String(chatNumerico(params.chatId))) {
    await answerCallbackQuery(params.callbackId, 'Otra persona del almacén ya está despachando esta solicitud.', true);
    return;
  }

  const { error } = await supabase
    .from('ci_procuras')
    .update({
      despacho_chat_id: chatNumerico(params.chatId),
      despacho_tomado_at: new Date().toISOString(),
    } as never)
    .eq('id', procura.id);
  if (error) {
    await answerCallbackQuery(params.callbackId, 'No se pudo tomar el despacho. Intente de nuevo.', true);
    return;
  }

  await answerCallbackQuery(params.callbackId, 'Envíe la foto del material');
  const estado = await getTelegramEstado(supabase, params.chatId);
  // La foto solo se toma con el chat en el menú, para no confundirla con la de otro registro.
  const avisoOtroFlujo =
    estado.contexto === 'menu'
      ? ''
      : '\n\n⚠️ Tiene otro registro abierto en el bot. Termínelo o use <code>/cancelar</code> antes de enviar la foto.';
  const almacen = evaluacion?.origenUbicacionNombre?.trim() || 'Almacén de la obra';
  await sendTelegramMessage(
    params.chatId,
    '📷 <b>Foto del material que sale</b> (obligatoria)\n\n' +
      `🎫 <b>${escHtml(procura.ticket)}</b>\n` +
      `📦 <b>${escHtml(cantidadTexto(evaluacion!.cantidadDespacho))} ${escHtml(procura.unidad)}</b> · ` +
      `${escHtml(nombreMaterialProcuraVisible(procura.material_txt))}\n` +
      `🏪 Sale de: <b>${escHtml(almacen)}</b>\n\n` +
      'Envíe aquí la foto de lo que entrega. Al recibirla se registra la salida y se descuenta el stock.' +
      avisoOtroFlujo,
    { parse_mode: 'HTML', reply_markup: tecladoSoltarDespachoProcura(procura.id) },
  );
}

/** «No lo despacho yo»: libera el despacho para que lo tome otra persona del almacén. */
export async function manejarSoltarDespachoProcuraTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackSoltarDespachoProcura(params.data)) return false;
  const procuraId = params.data.slice(CB_PROCURA_DESPACHO_SOLTAR.length).trim();
  const reserva = await reservaDespacho(supabase, procuraId);
  if (String(reserva.despacho_chat_id ?? '') !== String(chatNumerico(params.chatId))) {
    await answerCallbackQuery(params.callbackId, 'Este despacho ya no está a su nombre.', true);
    return true;
  }
  await soltarReserva(supabase, procuraId);
  await answerCallbackQuery(params.callbackId, 'Despacho liberado');
  await sendTelegramMessage(
    params.chatId,
    '↩️ Despacho liberado. El stock no se movió.\n' +
      'Quien lo vaya a entregar puede pulsar de nuevo <b>Confirmar</b> en la orden de almacén.',
    { parse_mode: 'HTML' },
  );
  return true;
}

/**
 * Foto del material que sale por una procura. Solo la toma si este chat tiene un despacho
 * a su nombre esperando foto; si no, devuelve false y el webhook sigue con los demás flujos.
 */
export async function manejarFotoDespachoProcura(params: {
  supabase: SupabaseClient;
  chatId: string;
  buffer: Buffer;
  mimeType: string;
  ext: string;
}): Promise<boolean> {
  const { supabase, chatId } = params;
  const procura = await procuraEsperandoFotoDespacho(supabase, chatId);
  if (!procura) return false;

  const carpeta = procura.proyecto_id?.trim() || 'sin-obra';
  const storagePath = `telegram-movimientos/${carpeta}/procuras/${procura.id}-${Date.now()}.${params.ext}`;
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });
  if (error) {
    await sendTelegramMessage(chatId, '❌ No se pudo guardar la foto. Envíela de nuevo.', {
      parse_mode: 'HTML',
    });
    return true;
  }
  const { data: publica } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(storagePath);

  await confirmarYResponder(supabase, {
    chatId,
    procura,
    foto: { storage_path: storagePath, url: publica.publicUrl ?? '' },
  });
  return true;
}
