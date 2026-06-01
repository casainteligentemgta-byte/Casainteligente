import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getTelegramBotToken,
  isChatAllowed,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
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
import { mensajeModoFacturasActivado } from '@/lib/telegram/mensajesFactura';
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
  manejarComandoEntradaTelegram,
  manejarFotoNotaEntregaTelegram,
  manejarTextoProveedorNotaEntrega,
} from '@/lib/telegram/notaEntregaRegistro';
import {
  esCallbackEntradaCompra,
  manejarCallbackEntradaCompraTelegram,
  manejarComandoEntradaComprasTelegram,
} from '@/lib/telegram/entradaComprasPicker';
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

  if (cmd.comandoEntrada) {
    await manejarComandoEntradaTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoIngresoAlmacen) {
    await manejarComandoEntradaComprasTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoLiberarCuarentena) {
    await manejarComandoLiberarCuarentenaTelegram(supabase, chatId);
    return;
  }

  if (cmd.comandoSalida) {
    await manejarComandoSalidaEgresoTelegram(supabase, chatId);
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

/** /facturas y /factura: responde siempre por Telegram aunque falle Supabase. */
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
  if (!isChatAllowed(chatId)) {
    return NextResponse.json({ ok: true, denied: true });
  }

  const admin = telegramSupabaseAdmin();
  if (!admin.ok) {
    return NextResponse.json({ ok: true, error: 'supabase_admin' });
  }

  try {
    const userId = String(cq.from.id);

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

    if (esCallbackEntradaCompra(cq.data)) {
      const handledEntradaCompra = await manejarCallbackEntradaCompraTelegram(admin.client, {
        chatId,
        callbackId: cq.id,
        data: cq.data,
      });
      if (handledEntradaCompra) {
        return NextResponse.json({ ok: true, callback: 'entrada_compra' });
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

    if (!isChatAllowed(chatId)) {
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
      const notaProveedor = await manejarTextoProveedorNotaEntrega({
        supabase,
        chatId,
        texto,
      });
      if (notaProveedor.handled) {
        return NextResponse.json({
          ok: true,
          nota_entrega: notaProveedor.motivo ?? true,
        });
      }

      const nuevoCapSalida = await manejarTextoNuevoCapituloSalida({
        supabase,
        chatId,
        texto,
      });
      if (nuevoCapSalida) {
        return NextResponse.json({ ok: true, salida_capitulo_nuevo: true });
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
          '❌ Comando no reconocido.\n<code>/entrada</code> · <code>/salida</code> · <code>/agua</code>\n<code>/ayuda</code>',
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

      const fotoNotaEntrega = await manejarFotoNotaEntregaTelegram({
        supabase,
        chatId,
        chatLabel: label,
        photo: msg.photo,
        telegramMessageId: String(msg.message_id),
      });
      if (fotoNotaEntrega.handled) {
        return NextResponse.json({
          ok: true,
          nota_entrega: fotoNotaEntrega.motivo ?? true,
        });
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
