import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getTelegramBotToken,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { isChatAllowedAsync } from '@/lib/telegram/chatWhitelist';
import { procesarComandoTelegram } from '@/lib/telegram/commands';
import {
  etiquetaContexto,
  getTelegramEstado,
  setTelegramContexto,
  type TelegramContexto,
} from '@/lib/telegram/estados';
import { interpretarTextoTelegramGemini } from '@/lib/telegram/geminiIntent';
import {
  manejarFacturaTelegram,
  manejarFotoObraTelegram,
  manejarGastoObraTelegram,
} from '@/lib/telegram/mediaHandlers';
import { manejarVozBitacoraTelegram } from '@/lib/telegram/bitacoraVoice';
import {
  esCallbackMemoriaObra,
  manejarCallbackMemoriaObra,
  manejarFotoMemoriaObraTelegram,
} from '@/lib/telegram/memoriaObra';
import {
  esCallbackFacturaOk,
  manejarCallbackFacturaOkTelegram,
  mensajeModoFacturasActivado,
} from '@/lib/telegram/mensajesFactura';
import {
  esCallbackCondicionPagoFactura,
  manejarCallbackCondicionPagoFacturaTelegram,
} from '@/lib/telegram/condicionPagoPicker';
import {
  esCallbackMonedaFactura,
  manejarCallbackMonedaFacturaTelegram,
} from '@/lib/telegram/monedaFacturaPicker';
import {
  enviarPickerAsignarObraTelegram,
  manejarCallbackAsignarObraTelegram,
  type TipoArchivoTelegram,
} from '@/lib/telegram/asignarObraArchivo';
import {
  enviarPickerProyectosTelegram,
  hintElegirProyecto,
  manejarCallbackProyectoTelegram,
  nombreProyectoTelegram,
} from '@/lib/telegram/proyectoPicker';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';
import {
  eliminarBotEstadoAgua,
  manejarCallbackAguaTelegram,
  manejarComandoAguaTelegram,
  manejarFotoRegistroAguaTelegram,
  manejarTextoLitrosAguaTelegram,
} from '@/lib/telegram/aguaRegistro';
import {
  manejarFotoEntradaSalidaTelegram,
  manejarOrigenSalidaTelegram,
  manejarTextoObservacionEntradaSalida,
} from '@/lib/telegram/entradaSalidaRegistro';
import {
  esCallbackIngresoManual,
  esFlujoIngresoManual,
  manejarCallbackIngresoManual,
  manejarComandoIngresoManualTelegram,
  manejarComandoNotaEntregaTelegram,
  manejarComandoEmergenciaTelegram,
  manejarComandoRecepcionTelegram,
  manejarFotoIngresoManual,
  manejarTextoIngresoManual,
} from '@/lib/telegram/ingresoManualTelegram';
import {
  esCallbackIngresoFactura,
  esComandoIngresoFactura,
  manejarCallbackIngresoFacturaTelegram,
  manejarComandoIngresoFacturaTelegram,
  esFlujoIngresoFactura,
  manejarFotoIngresoFactura,
  manejarTextoIngresoFactura,
} from '@/lib/telegram/ingresoFacturaTelegram';
import {
  esCallbackComprasObra,
  manejarCallbackComprasObraTelegram,
  manejarComandoComprasObraTelegram,
} from '@/lib/telegram/comprasObraTelegram';
import {
  esCallbackComprasPeriodo,
  manejarCallbackComprasPeriodoTelegram,
  manejarComandoComprasPeriodoTelegram,
} from '@/lib/telegram/comprasPeriodoTelegram';
import {
  esCallbackLiberarCuarentena,
  manejarCallbackLiberarCuarentenaTelegram,
  manejarComandoLiberarCuarentenaTelegram,
} from '@/lib/telegram/liberarCuarentenaPicker';
import { esComandoAgua } from '@/lib/telegram/parseComandoTelegram';
import {
  esCallbackAvanceCampo,
  manejarCallbackAvanceCampo,
  manejarTextoAvanceCampo,
} from '@/lib/telegram/avanceCampo';
import {
  manejarComandoAvanceCampo,
  manejarStartVinculoTelegram,
} from '@/lib/telegram/telegramVinculo';
import {
  esCallbackUbicacion,
  manejarCallbackUbicacionTelegram,
} from '@/lib/telegram/ubicacionPicker';
import {
  esCallbackSalidaCapitulo,
  manejarCallbackSalidaCapituloTelegram,
  manejarTextoNuevoCapituloSalida,
} from '@/lib/telegram/salidaCapituloPicker';
import {
  esCallbackSalidaEgreso,
  esFlujoEgresoV2,
  manejarCallbackSalidaEgreso,
  manejarComandoSalidaEgresoTelegram,
  manejarFotoSalidaEgreso,
  manejarOrigenSalidaEgreso,
  manejarTextoSalidaEgreso,
} from '@/lib/telegram/salidaEgresoFlujo';
import {
  esCallbackSalidaOrigen,
  manejarCallbackSalidaOrigenTelegram,
} from '@/lib/telegram/salidaOrigenPicker';
import {
  esCallbackSalidaObraTelegram,
  manejarCallbackSalidaObraTelegram,
  esFlujoSalidaObraTelegram,
  manejarComandoSalidaObraTelegram,
  manejarFotoSalidaAlmacenTelegram,
  manejarTextoSalidaObraTelegram,
} from '@/lib/telegram/salidaObraTelegram';
import {
  esCallbackDepositarioRecepcion,
  manejarCallbackDepositarioRecepcion,
  manejarTextoDepositarioRecepcion,
} from '@/lib/telegram/depositarioRecepcion';
import {
  esCallbackTraspasoTelegram,
  manejarCallbackTraspasoTelegram,
  manejarComandoTraspasoTelegram,
  manejarTextoTraspasoTelegram,
} from '@/lib/telegram/traspasoFlujoTelegram';
import {
  enviarMenuSalidaTelegram,
  esCallbackMenuIngresoTelegram,
  esCallbackMenuSalidaTelegram,
  manejarCallbackMenuIngresoTelegram,
  manejarCallbackMenuSalidaTelegram,
  manejarComandoIngresoTelegram,
} from '@/lib/telegram/menuIngresoSalidaTelegram';
import {
  esCallbackStockConsultaTelegram,
  manejarCallbackStockConsultaTelegram,
  manejarComandoStockConsultaTelegram,
} from '@/lib/telegram/stockConsultaTelegram';
import {
  esCallbackStockObra,
  manejarCallbackStockObraTelegram,
} from '@/lib/telegram/stockCommand';

const CMD_FACTURAS = /^\/facturas?(@\S+)?\s*$/i;
const CMD_AVANCE = /^\/avance(@\S+)?\s*$/i;

export type TelegramUpdate = {
  message?: {
    message_id: number;
    text?: string;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string; username?: string; first_name?: string };
    photo?: Array<{ file_id: string; file_size?: number; width?: number; height?: number }>;
    voice?: {
      file_id: string;
      duration?: number;
      mime_type?: string;
    };
    document?: {
      file_id: string;
      mime_type?: string;
      file_name?: string;
    };
    video?: {
      file_id: string;
      mime_type?: string;
      file_name?: string;
    };
    caption?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number; username?: string; first_name?: string };
    message?: {
      message_id: number;
      chat: { id: number; type: string };
    };
  };
};

function chatLabel(msg: NonNullable<TelegramUpdate['message']>): string {
  return msg.chat.username ?? msg.chat.first_name ?? `chat_${msg.chat.id}`;
}

type ArchivoTelegramEntrada = {
  fileId: string;
  tipo: TipoArchivoTelegram;
};

function resolveArchivoTelegram(
  msg: NonNullable<TelegramUpdate['message']>,
): ArchivoTelegramEntrada | null {
  if (msg.photo?.length) {
    return {
      fileId: msg.photo[msg.photo.length - 1].file_id,
      tipo: 'photo',
    };
  }
  if (msg.video?.file_id) {
    return { fileId: msg.video.file_id, tipo: 'video' };
  }
  if (msg.document?.file_id) {
    return { fileId: msg.document.file_id, tipo: 'document' };
  }
  return null;
}

async function mensajeEstado(
  supabase: SupabaseClient,
  chatId: string,
  contexto: TelegramContexto,
  proyectoId: string | null,
) {
  const nombre = await nombreProyectoTelegram(supabase, proyectoId);
  const proy = nombre
    ? `\nObra: <b>${nombre}</b>`
    : proyectoId
      ? `\nProyecto: <code>${proyectoId}</code>`
      : '';
  await sendTelegramMessage(
    chatId,
    `📌 Contexto: <b>${etiquetaContexto(contexto)}</b>${proy}`,
    { parse_mode: 'HTML' },
  );
}

async function aplicarComando(
  supabase: SupabaseClient,
  chatId: string,
  cmd: ReturnType<typeof procesarComandoTelegram>,
  userId?: string,
): Promise<void> {
  if (cmd.mensaje === '__ESTADO__') {
    const est = await getTelegramEstado(supabase, chatId);
    await mensajeEstado(supabase, chatId, est.contexto, est.proyecto_id);
    return;
  }

  if (cmd.comandoAgua) {
    await manejarComandoAguaTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoNotaEntrega) {
    await manejarComandoNotaEntregaTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoEmergencia) {
    await manejarComandoEmergenciaTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoRecepcion) {
    await manejarComandoRecepcionTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoIngresoManual) {
    await manejarComandoIngresoManualTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoMenuIngreso) {
    await manejarComandoIngresoTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoIngresoFactura) {
    await manejarComandoIngresoFacturaTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoComprasPeriodo) {
    try {
      await manejarComandoComprasPeriodoTelegram(supabase, chatId, cmd.comandoComprasPeriodo);
    } catch (err) {
      console.error('[telegram compras periodo]', err);
      await avisoErrorTelegram(chatId, err);
    }
    return;
  }

  if (cmd.comandoComprasObra !== undefined) {
    try {
      await manejarComandoComprasObraTelegram(supabase, chatId, cmd.comandoComprasObra);
    } catch (err) {
      console.error('[telegram compras obra]', err);
      await avisoErrorTelegram(chatId, err);
    }
    return;
  }

  if (cmd.comandoLiberarCuarentena) {
    await manejarComandoLiberarCuarentenaTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoMenuSalida) {
    await enviarMenuSalidaTelegram(chatId);
    return;
  }

  if (cmd.comandoSalidaObra) {
    await manejarComandoSalidaObraTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoSalida) {
    await manejarComandoSalidaEgresoTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoTraspaso) {
    await manejarComandoTraspasoTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoStockConsulta) {
    await manejarComandoStockConsultaTelegram(supabase, chatId);
    return;
  }

  if (userId && (cmd.resetProyecto || cmd.contexto === 'factura')) {
    await eliminarBotEstadoAgua(supabase, userId).catch(() => undefined);
  }

  if (cmd.contexto || cmd.resetProyecto) {
    await setTelegramContexto(supabase, chatId, {
      ...(cmd.contexto ? { contexto: cmd.contexto } : {}),
      ...(cmd.resetProyecto
        ? { proyecto_id: null, pending_factura_id: null, metadata: {} }
        : {}),
      ...(cmd.proyectoId !== undefined ? { proyecto_id: cmd.proyectoId } : {}),
    });
  }

  if (cmd.mensaje) {
    await sendTelegramMessage(chatId, cmd.mensaje, { parse_mode: 'HTML' });
  }

  if (cmd.mostrarPickerProyecto) {
    const est = await getTelegramEstado(supabase, chatId);
    const needsPicker =
      cmd.mostrarPickerProyecto === 'obra' ||
      cmd.mostrarPickerProyecto === 'memoria_obra' ||
      !est.proyecto_id;
    if (needsPicker) {
      await enviarPickerProyectosTelegram(supabase, chatId, cmd.mostrarPickerProyecto);
    } else if (cmd.mostrarPickerProyecto !== 'obra') {
      const nombre = await nombreProyectoTelegram(supabase, est.proyecto_id);
      if (nombre) {
        await sendTelegramMessage(
          chatId,
          `📌 Obra activa: <b>${nombre}</b>. Continúa con el comprobante o la nota de voz.`,
          { parse_mode: 'HTML' },
        );
      }
    }
  }
}

async function avisoErrorTelegram(chatId: string, err: unknown): Promise<void> {
  const detalle =
    err instanceof Error ? err.message.slice(0, 300) : 'Error interno del servidor';
  try {
    await sendTelegramMessage(
      chatId,
      `❌ <b>Error del bot</b>\n<code>${detalle.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>`,
      { parse_mode: 'HTML' },
    );
  } catch {
    /* sin token o red */
  }
}

/** /facturas (alias /factura): responde siempre por Telegram aunque falle Supabase. */
async function manejarComandoFacturasDirecto(chatId: string): Promise<{
  ok: boolean;
  warn?: string;
}> {
  await sendTelegramMessage(chatId, mensajeModoFacturasActivado(), { parse_mode: 'HTML' });

  const admin = telegramSupabaseAdmin();
  if (!admin.ok) {
    console.warn('[telegram /facturas] sin SUPABASE_SERVICE_ROLE_KEY');
    return { ok: true, warn: 'supabase_config' };
  }

  try {
    await setTelegramContexto(admin.client, chatId, { contexto: 'factura' });
  } catch (err) {
    console.error('[telegram /facturas estado]', err);
    return { ok: true, warn: 'estado_db' };
  }

  return { ok: true };
}

export async function handleTelegramCallbackQuery(
  update: TelegramUpdate,
): Promise<NextResponse> {
  const cq = update.callback_query;
  if (!cq?.data || !cq.message?.chat?.id) {
    return NextResponse.json({ ok: true, skipped: 'no_callback' });
  }

  const chatId = String(cq.message.chat.id);
  if (!(await isChatAllowedAsync(chatId))) {
    return NextResponse.json({ ok: true, denied: true });
  }

  const admin = telegramSupabaseAdmin();
  if (!admin.ok) {
    return NextResponse.json({ ok: true, error: 'supabase_admin' });
  }

  try {
    const userId = String(cq.from.id);

    if (esCallbackMenuIngresoTelegram(cq.data)) {
      const handled = await manejarCallbackMenuIngresoTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handled) {
        return NextResponse.json({ ok: true, callback: 'menu_ingreso' });
      }
    }

    if (esCallbackMenuSalidaTelegram(cq.data)) {
      const handled = await manejarCallbackMenuSalidaTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handled) {
        return NextResponse.json({ ok: true, callback: 'menu_salida' });
      }
    }

    if (esCallbackStockConsultaTelegram(cq.data)) {
      const handledStock = await manejarCallbackStockConsultaTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledStock) {
        return NextResponse.json({ ok: true, callback: 'stock_consulta' });
      }
    }

    if (esCallbackStockObra(cq.data)) {
      const handledStockObra = await manejarCallbackStockObraTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledStockObra) {
        return NextResponse.json({ ok: true, callback: 'stock_obra' });
      }
    }

    if (esCallbackTraspasoTelegram(cq.data)) {
      const handledTraspaso = await manejarCallbackTraspasoTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledTraspaso) {
        return NextResponse.json({ ok: true, callback: 'traspaso' });
      }
    }

    if (esCallbackSalidaObraTelegram(cq.data)) {
      const handledSalidaObra = await manejarCallbackSalidaObraTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledSalidaObra) {
        return NextResponse.json({ ok: true, callback: 'salida_obra_despacho' });
      }
    }

    if (esCallbackSalidaEgreso(cq.data)) {
      const handledEgreso = await manejarCallbackSalidaEgreso(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledEgreso) {
        return NextResponse.json({ ok: true, callback: 'salida_egreso' });
      }
    }

    if (esCallbackSalidaCapitulo(cq.data)) {
      const handledSalidaCap = await manejarCallbackSalidaCapituloTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledSalidaCap) {
        return NextResponse.json({ ok: true, callback: 'salida_capitulo' });
      }
    }

    if (esCallbackSalidaOrigen(cq.data)) {
      const handledSalidaOrigen = await manejarCallbackSalidaOrigenTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
        onOrigenSeleccionado: async (supabase, p) => {
          const estadoOrigen = await getTelegramEstado(supabase, p.chatId);
          if (esFlujoEgresoV2(estadoOrigen)) {
            const { data: ubi } = await supabase
              .from('inv_ubicaciones')
              .select('nombre')
              .eq('id', p.origenUbicacionId)
              .maybeSingle();
            await manejarOrigenSalidaEgreso(
              supabase,
              p.chatId,
              p.origenUbicacionId,
              String(ubi?.nombre ?? 'Almacén'),
            );
            return;
          }
          await manejarOrigenSalidaTelegram({
            supabase,
            chatId: p.chatId,
            origenUbicacionId: p.origenUbicacionId,
          });
        },
      });
      if (handledSalidaOrigen) {
        return NextResponse.json({ ok: true, callback: 'salida_origen' });
      }
    }

    if (esCallbackIngresoManual(cq.data)) {
      const handledIngresoManual = await manejarCallbackIngresoManual(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledIngresoManual) {
        return NextResponse.json({ ok: true, callback: 'ingreso_manual' });
      }
    }

    if (esCallbackFacturaOk(cq.data)) {
      await manejarCallbackFacturaOkTelegram({ callbackId: cq.id });
      return NextResponse.json({ ok: true, callback: 'factura_ok' });
    }

    if (esCallbackMonedaFactura(cq.data)) {
      const handledMoneda = await manejarCallbackMonedaFacturaTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledMoneda) {
        return NextResponse.json({ ok: true, callback: 'factura_moneda' });
      }
    }

    if (esCallbackCondicionPagoFactura(cq.data)) {
      const handledPago = await manejarCallbackCondicionPagoFacturaTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledPago) {
        return NextResponse.json({ ok: true, callback: 'factura_condicion_pago' });
      }
    }

    if (esCallbackUbicacion(cq.data)) {
      const handledUb = await manejarCallbackUbicacionTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledUb) {
        return NextResponse.json({ ok: true, callback: 'ubicacion_compra' });
      }
    }

    if (esCallbackDepositarioRecepcion(cq.data)) {
      const handledRecepcion = await manejarCallbackDepositarioRecepcion(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
        telegramUserId: userId,
      });
      if (handledRecepcion) {
        return NextResponse.json({ ok: true, callback: 'depositario_recepcion' });
      }
    }

    if (esCallbackIngresoFactura(cq.data)) {
      const handledIngresoFactura = await manejarCallbackIngresoFacturaTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledIngresoFactura) {
        return NextResponse.json({ ok: true, callback: 'ingreso_factura' });
      }
    }

    if (esCallbackComprasObra(cq.data)) {
      const handledComprasObra = await manejarCallbackComprasObraTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledComprasObra) {
        return NextResponse.json({ ok: true, callback: 'compras_obra' });
      }
    }

    if (esCallbackComprasPeriodo(cq.data)) {
      const handledComprasPeriodo = await manejarCallbackComprasPeriodoTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledComprasPeriodo) {
        return NextResponse.json({ ok: true, callback: 'compras_periodo' });
      }
    }

    if (esCallbackLiberarCuarentena(cq.data)) {
      const handledLiberar = await manejarCallbackLiberarCuarentenaTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledLiberar) {
        return NextResponse.json({ ok: true, callback: 'liberar_cuarentena' });
      }
    }

    if (esCallbackAvanceCampo(cq.data)) {
      const handledAvance = await manejarCallbackAvanceCampo(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
        telegramUserId: userId,
      });
      if (handledAvance) {
        return NextResponse.json({ ok: true, callback: 'avance_campo' });
      }
    }

    if (esCallbackMemoriaObra(cq.data)) {
      const handledMemoria = await manejarCallbackMemoriaObra(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledMemoria) {
        return NextResponse.json({ ok: true, callback: 'memoria_obra' });
      }
    }

    const handledAgua = await manejarCallbackAguaTelegram(admin.client, {
      chatId,
      userId,
      callbackId: cq.id,
      data: cq.data,
    });
    if (handledAgua) {
      return NextResponse.json({ ok: true, callback: 'agua' });
    }

    const handledAsignar = await manejarCallbackAsignarObraTelegram(admin.client, {
      chatId,
      callbackId: cq.id,
      data: cq.data,
      messageId: cq.message?.message_id,
    });
    if (handledAsignar) {
      return NextResponse.json({ ok: true, callback: 'asignar_obra' });
    }

    const handled = await manejarCallbackProyectoTelegram(admin.client, {
      chatId,
      callbackId: cq.id,
      data: cq.data,
    });
    return NextResponse.json({ ok: true, callback: handled ? 'proyecto' : 'unknown' });
  } catch (err) {
    console.error('[telegram callback]', err);
    await avisoErrorTelegram(chatId, err);
    return NextResponse.json({ ok: true, error: 'callback_failed' });
  }
}

export async function handleTelegramWebhookPost(reqOrUpdate: Request | TelegramUpdate) {
  let chatIdParaError: string | null = null;

  try {
    if (!getTelegramBotToken()) {
      console.error('[telegram] TELEGRAM_BOT_TOKEN no configurado en el servidor');
      return NextResponse.json({ ok: true, error: 'TELEGRAM_BOT_TOKEN' });
    }

    const update =
      reqOrUpdate instanceof Request
        ? ((await reqOrUpdate.json()) as TelegramUpdate)
        : reqOrUpdate;
    const msg = update.message;
    if (!msg) {
      return NextResponse.json({ ok: true, skipped: 'no_message' });
    }

    const chatId = String(msg.chat.id);
    chatIdParaError = chatId;

    if (!(await isChatAllowedAsync(chatId))) {
      await sendTelegramMessage(
        chatId,
        '⛔ Chat no autorizado. Contacte al administrador.',
      );
      return NextResponse.json({ ok: true, denied: true });
    }

    const label = chatLabel(msg);
    const texto = msg.text?.trim() ?? '';

    const userId = String(msg.from?.id ?? msg.chat.id);

    const admin = telegramSupabaseAdmin();
    if (!admin.ok) {
      await sendTelegramMessage(
        chatId,
        '⚠️ Servidor sin credenciales Supabase (service role). Contacte al administrador.',
        { parse_mode: 'HTML' },
      );
      return NextResponse.json({ ok: true, error: 'supabase_admin' });
    }

    const supabase = admin.client;

    if (texto && CMD_FACTURAS.test(texto)) {
      await eliminarBotEstadoAgua(supabase, userId).catch(() => undefined);
      const r = await manejarComandoFacturasDirecto(chatId);
      return NextResponse.json({ ok: true, command: 'facturas', warn: r.warn });
    }

    if (texto?.toLowerCase().startsWith('/start')) {
      const vinculado = await manejarStartVinculoTelegram(
        supabase,
        chatId,
        texto,
        msg.from?.username,
      );
      if (vinculado) {
        return NextResponse.json({ ok: true, vinculo: true });
      }
    }

    if (texto && CMD_AVANCE.test(texto)) {
      await manejarComandoAvanceCampo(supabase, chatId);
      return NextResponse.json({ ok: true, command: 'avance' });
    }

    const estadoPrevio = await getTelegramEstado(supabase, chatId);
    if (texto && !texto.startsWith('/')) {
      const avanceTexto = await manejarTextoAvanceCampo(
        supabase,
        chatId,
        texto,
        estadoPrevio,
        userId,
      );
      if (avanceTexto) {
        return NextResponse.json({ ok: true, avance_campo: true });
      }
    }

    if (texto && esComandoAgua(texto)) {
      try {
        await manejarComandoAguaTelegram(supabase, chatId);
      } catch (err) {
        console.error('[telegram /agua]', err);
        await avisoErrorTelegram(chatId, err);
      }
      return NextResponse.json({ ok: true, command: 'agua' });
    }

    if (texto && !texto.startsWith('/')) {
      const recepcionFisica = await manejarTextoDepositarioRecepcion(supabase, chatId, texto);
      if (recepcionFisica.handled) {
        return NextResponse.json({ ok: true, depositario_recepcion: true });
      }

      const textoIngresoFactura = await manejarTextoIngresoFactura(supabase, chatId, texto);
      if (textoIngresoFactura) {
        return NextResponse.json({ ok: true, ingreso_factura_texto: true });
      }

      const textoIngresoManual = await manejarTextoIngresoManual(
        supabase,
        chatId,
        texto,
        userId,
        msg.from?.username ?? null,
      );
      if (textoIngresoManual) {
        return NextResponse.json({ ok: true, ingreso_manual_texto: true });
      }

      const nuevoCapSalida = await manejarTextoNuevoCapituloSalida({
        supabase,
        chatId,
        texto,
      });
      if (nuevoCapSalida) {
        return NextResponse.json({ ok: true, salida_capitulo_nuevo: true });
      }

      const textoSalidaObra = await manejarTextoSalidaObraTelegram(
        supabase,
        chatId,
        texto,
        userId,
        msg.from?.username ?? null,
      );
      if (textoSalidaObra) {
        return NextResponse.json({ ok: true, salida_obra_texto: true });
      }

      const textoSalidaEgreso = await manejarTextoSalidaEgreso(
        supabase,
        chatId,
        texto,
        userId,
        msg.from?.username ?? null,
      );
      if (textoSalidaEgreso) {
        return NextResponse.json({ ok: true, salida_egreso_texto: true });
      }

      const textoTraspaso = await manejarTextoTraspasoTelegram(supabase, chatId, texto);
      if (textoTraspaso) {
        return NextResponse.json({ ok: true, traspaso_texto: true });
      }

      const obsEntradaSalida = await manejarTextoObservacionEntradaSalida({
        supabase,
        chatId,
        texto,
      });
      if (obsEntradaSalida.handled) {
        return NextResponse.json({
          ok: true,
          entrada_salida: obsEntradaSalida.motivo ?? true,
        });
      }

      const litrosAgua = await manejarTextoLitrosAguaTelegram({
        supabase,
        chatId,
        userId,
        texto,
      });
      if (litrosAgua.handled) {
        return NextResponse.json({ ok: true, agua_litros: litrosAgua.motivo ?? true });
      }
    }

    if (texto) {
      const cmd = procesarComandoTelegram(texto);
      if (cmd.handled) {
        try {
          await aplicarComando(supabase, chatId, cmd, userId);
        } catch (err) {
          console.error('[telegram comando]', err);
          await avisoErrorTelegram(chatId, err);
        }
        return NextResponse.json({ ok: true, command: true });
      }

      if (texto.startsWith('/')) {
        await sendTelegramMessage(
          chatId,
          '❌ Comando no reconocido.\n<code>/ingresosinnota</code> · <code>/salida</code> · <code>/agua</code>\n<code>/ayuda</code>',
          { parse_mode: 'HTML' },
        );
        return NextResponse.json({ ok: true, unknown_command: true });
      }

      const estado = await getTelegramEstado(supabase, chatId);
      const intent = await interpretarTextoTelegramGemini(texto, estado.contexto);
      if (intent?.contexto) {
        await setTelegramContexto(supabase, chatId, {
          contexto: intent.contexto,
          ...(intent.proyecto_id !== undefined ? { proyecto_id: intent.proyecto_id } : {}),
        });
        const reply =
          intent.reply ??
          `Modo <b>${etiquetaContexto(intent.contexto)}</b> activado (Gemini).`;
        await sendTelegramMessage(chatId, reply, { parse_mode: 'HTML' });
        return NextResponse.json({ ok: true, gemini_intent: intent.contexto });
      }
    }

    if (msg.voice?.file_id) {
      const estado = await getTelegramEstado(supabase, chatId);
      if (estado.contexto === 'esperando_audio_bitacora') {
        await manejarVozBitacoraTelegram({
          supabase,
          chatId,
          estado,
          fileId: msg.voice.file_id,
          durationSec: msg.voice.duration,
        });
        return NextResponse.json({ ok: true, bitacora_voz: true });
      }
      await sendTelegramMessage(
        chatId,
        '🎙️ Para registrar una bitácora por voz, usa <code>/bitacora</code> ' +
          `y elige la obra en la lista. ${hintElegirProyecto()}`,
        { parse_mode: 'HTML' },
      );
      return NextResponse.json({ ok: true, hint: 'voice_wrong_context' });
    }

    if (msg.photo?.length) {
      const estadoFoto = await getTelegramEstado(supabase, chatId);
      if (estadoFoto.contexto === 'factura') {
        const fileIdFactura = msg.photo[msg.photo.length - 1]?.file_id;
        if (fileIdFactura) {
          const factura = await manejarFacturaTelegram({
            supabase,
            chatId,
            chatLabel: label,
            fileId: fileIdFactura,
            telegramMessageId: String(msg.message_id),
          });
          return NextResponse.json({
            ok: true,
            contexto: 'factura',
            duplicate: factura.duplicate,
            pendingId: factura.pendingId,
          });
        }
      }

      const fotoIngresoManual = await (async () => {
        const photos = msg.photo;
        if (!photos?.length) return false;
        const estadoIngreso = await getTelegramEstado(supabase, chatId);
        if (!esFlujoIngresoManual(estadoIngreso)) return false;
        const paso = (estadoIngreso.metadata as { paso?: string })?.paso;
        if (paso !== 'foto' && paso !== 'observacion') return false;
        const fileId = photos[photos.length - 1]?.file_id;
        if (!fileId) return false;
        try {
          const { downloadTelegramFile, mimeFromTelegramPath } = await import('@/lib/telegram/botApi');
          const { buffer, filePath } = await downloadTelegramFile(fileId);
          const ext = filePath.split('.').pop() ?? 'jpg';
          await manejarFotoIngresoManual({
            supabase,
            chatId,
            userId,
            username: msg.from?.username ?? null,
            buffer,
            mimeType: mimeFromTelegramPath(filePath),
            ext,
            caption: msg.caption,
          });
          return true;
        } catch (err) {
          console.error('[telegram ingreso manual foto]', err);
          await sendTelegramMessage(chatId, '❌ No se pudo guardar la foto.', { parse_mode: 'HTML' });
          return true;
        }
      })();
      if (fotoIngresoManual) {
        return NextResponse.json({ ok: true, ingreso_manual_foto: true });
      }

      const fotoIngresoFactura = await (async () => {
        const photos = msg.photo;
        if (!photos?.length) return false;
        const estadoFactura = await getTelegramEstado(supabase, chatId);
        if (!esFlujoIngresoFactura(estadoFactura)) return false;
        if ((estadoFactura.metadata as { paso?: string })?.paso !== 'foto') return false;
        const fileId = photos[photos.length - 1]?.file_id;
        if (!fileId) return false;
        try {
          const { downloadTelegramFile, mimeFromTelegramPath } = await import('@/lib/telegram/botApi');
          const { buffer, filePath } = await downloadTelegramFile(fileId);
          const ext = filePath.split('.').pop() ?? 'jpg';
          await manejarFotoIngresoFactura({
            supabase,
            chatId,
            userId,
            buffer,
            mimeType: mimeFromTelegramPath(filePath),
            ext,
          });
          return true;
        } catch (err) {
          console.error('[telegram ingreso factura foto]', err);
          await sendTelegramMessage(chatId, '❌ No se pudo guardar la foto.', { parse_mode: 'HTML' });
          return true;
        }
      })();
      if (fotoIngresoFactura) {
        return NextResponse.json({ ok: true, ingreso_factura_foto: true });
      }

      const fotoSalidaAlmacen = await (async () => {
        const photos = msg.photo;
        if (!photos?.length) return false;
        const estadoSa = await getTelegramEstado(supabase, chatId);
        if (!esFlujoSalidaObraTelegram(estadoSa)) return false;
        if ((estadoSa.metadata as { paso?: string })?.paso !== 'foto') return false;
        const fileId = photos[photos.length - 1]?.file_id;
        if (!fileId) return false;
        try {
          const { downloadTelegramFile, mimeFromTelegramPath } = await import('@/lib/telegram/botApi');
          const { buffer, filePath } = await downloadTelegramFile(fileId);
          const ext = filePath.split('.').pop() ?? 'jpg';
          await manejarFotoSalidaAlmacenTelegram({
            supabase,
            chatId,
            userId,
            username: msg.from?.username ?? null,
            buffer,
            mimeType: mimeFromTelegramPath(filePath),
            ext,
          });
          return true;
        } catch (err) {
          console.error('[telegram salida almacen foto]', err);
          await sendTelegramMessage(chatId, '❌ No se pudo guardar la foto.', { parse_mode: 'HTML' });
          return true;
        }
      })();
      if (fotoSalidaAlmacen) {
        return NextResponse.json({ ok: true, salida_almacen_foto: true });
      }

      const fotoSalidaEgreso = await (async () => {
        const photos = msg.photo;
        if (!photos?.length) return false;
        const estadoEgreso = await getTelegramEstado(supabase, chatId);
        if (!esFlujoEgresoV2(estadoEgreso)) return false;
        const paso = (estadoEgreso.metadata as { paso?: string })?.paso;
        if (paso !== 'foto' && paso !== 'observacion') return false;
        const fileId = photos[photos.length - 1]?.file_id;
        if (!fileId) return false;
        try {
          const { downloadTelegramFile, mimeFromTelegramPath } = await import('@/lib/telegram/botApi');
          const { buffer, filePath } = await downloadTelegramFile(fileId);
          const ext = filePath.split('.').pop() ?? 'jpg';
          await manejarFotoSalidaEgreso({
            supabase,
            chatId,
            userId,
            username: msg.from?.username ?? null,
            buffer,
            mimeType: mimeFromTelegramPath(filePath),
            ext,
            caption: msg.caption,
          });
          return true;
        } catch (err) {
          console.error('[telegram salida egreso foto]', err);
          await sendTelegramMessage(chatId, '❌ No se pudo guardar la foto.', { parse_mode: 'HTML' });
          return true;
        }
      })();
      if (fotoSalidaEgreso) {
        return NextResponse.json({ ok: true, salida_egreso_foto: true });
      }

      const fotoEntradaSalida = await manejarFotoEntradaSalidaTelegram({
        supabase,
        chatId,
        userId,
        username: msg.from?.username ?? null,
        photo: msg.photo,
        caption: msg.caption,
      });
      if (fotoEntradaSalida.handled) {
        return NextResponse.json({
          ok: true,
          entrada_salida: fotoEntradaSalida.motivo ?? true,
        });
      }

      const fotoAgua = await manejarFotoRegistroAguaTelegram({
        supabase,
        chatId,
        userId,
        photo: msg.photo,
      });
      if (fotoAgua.handled) {
        return NextResponse.json({ ok: true, agua: fotoAgua.motivo ?? true });
      }
    }

    const archivo = resolveArchivoTelegram(msg);
    if (!archivo) {
      const estado = await getTelegramEstado(supabase, chatId);
      await sendTelegramMessage(
        chatId,
        `📌 Estás en: <b>${etiquetaContexto(estado.contexto)}</b>\n` +
          (estado.contexto === 'esperando_audio_bitacora'
            ? 'Envía una <b>nota de voz</b> con el reporte de campo.'
            : 'Envía foto/video/documento, nota de voz (/bitacora) o usa /ayuda.'),
        { parse_mode: 'HTML' },
      );
      return NextResponse.json({ ok: true, hint: 'no_media' });
    }

    const estado = await getTelegramEstado(supabase, chatId);
    const caption = msg.caption?.trim();

    switch (estado.contexto) {
      case 'factura': {
        const factura = await manejarFacturaTelegram({
          supabase,
          chatId,
          chatLabel: label,
          fileId: archivo.fileId,
          telegramMessageId: String(msg.message_id),
        });
        return NextResponse.json({
          ok: true,
          contexto: 'factura',
          duplicate: factura.duplicate,
          pendingId: factura.pendingId,
        });
      }
      case 'obra':
        if (estado.proyecto_id) {
          await manejarFotoObraTelegram({
            supabase,
            chatId,
            estado,
            fileId: archivo.fileId,
            caption,
          });
        } else {
          await enviarPickerAsignarObraTelegram({
            supabase,
            chatId,
            fileId: archivo.fileId,
            tipo: archivo.tipo,
            caption,
            destino: 'obra',
          });
        }
        break;
      case 'gasto_obra':
        if (estado.proyecto_id) {
          await manejarGastoObraTelegram({
            supabase,
            chatId,
            estado,
            fileId: archivo.fileId,
            caption,
          });
        } else {
          await enviarPickerAsignarObraTelegram({
            supabase,
            chatId,
            fileId: archivo.fileId,
            tipo: archivo.tipo,
            caption,
            destino: 'gasto_obra',
          });
        }
        break;
      case 'memoria_obra_foto':
        if (archivo.tipo === 'photo') {
          await manejarFotoMemoriaObraTelegram({
            supabase,
            chatId,
            estado,
            fileId: archivo.fileId,
            caption,
          });
        } else {
          await sendTelegramMessage(
            chatId,
            '⚠️ En memoria descriptiva solo se aceptan <b>fotos</b> del avance físico.',
            { parse_mode: 'HTML' },
          );
        }
        break;
      case 'memoria_obra':
        await sendTelegramMessage(
          chatId,
          '📋 Elige primero la <b>partida</b> en los botones anteriores, o usa /memoria de nuevo.',
          { parse_mode: 'HTML' },
        );
        break;
      default:
        await enviarPickerAsignarObraTelegram({
          supabase,
          chatId,
          fileId: archivo.fileId,
          tipo: archivo.tipo,
          caption,
          destino: 'obra',
        });
    }

    return NextResponse.json({ ok: true, contexto: estado.contexto });
  } catch (err: unknown) {
    console.error('[telegram webhook]', err);
    if (chatIdParaError) {
      await avisoErrorTelegram(chatIdParaError, err);
    }
    return NextResponse.json({
      ok: true,
      error: err instanceof Error ? err.message : 'Error webhook',
    });
  }
}
