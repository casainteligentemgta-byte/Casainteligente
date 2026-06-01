import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  getTelegramAllowedChatIds,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';

const PREFIX_VERIFICAR = 'verificar_factura:';
const PREFIX_CONFIRMAR = 'confirmar_ingreso:';
const META_SESION = 'depositario_recepcion';

export type LineaDepositarioRecepcion = {
  linea_id: string;
  material_id: string;
  material_nombre: string;
  material_codigo: string;
  cantidad_facturada: number;
  cantidad_real?: number;
};

type SesionDepositarioRecepcion = {
  facturaId: string;
  items: LineaDepositarioRecepcion[];
  indiceActual: number;
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseSesion(metadata: Record<string, unknown>): SesionDepositarioRecepcion | null {
  const raw = metadata[META_SESION];
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as SesionDepositarioRecepcion;
  if (!s.facturaId || !Array.isArray(s.items)) return null;
  return s;
}

async function guardarSesion(
  supabase: SupabaseClient,
  chatId: string,
  sesion: SesionDepositarioRecepcion | null,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: sesion ? 'depositario_recepcion' : 'menu',
    metadata: { [META_SESION]: sesion },
  });
}

async function obtenerSesion(
  supabase: SupabaseClient,
  chatId: string,
): Promise<SesionDepositarioRecepcion | null> {
  const estado = await getTelegramEstado(supabase, chatId);
  return parseSesion(estado.metadata);
}

/** Callback para botón inline desde la app web (cuadro de compras / calidad). */
export function callbackDataVerificarFactura(comprasFacturaId: string): string {
  return `${PREFIX_VERIFICAR}${comprasFacturaId}`;
}

export function callbackDataConfirmarIngreso(comprasFacturaId: string): string {
  return `${PREFIX_CONFIRMAR}${comprasFacturaId}`;
}

export function esCallbackDepositarioRecepcion(data: string): boolean {
  return data.startsWith(PREFIX_VERIFICAR) || data.startsWith(PREFIX_CONFIRMAR);
}

type LineaRpc = {
  linea_id: string;
  material_id: string;
  material_nombre: string;
  material_codigo: string;
  cantidad_facturada: number;
};

async function cargarLineasFactura(
  supabase: SupabaseClient,
  facturaId: string,
): Promise<LineaDepositarioRecepcion[]> {
  const { data: lineas, error } = await supabase.rpc('obtener_lineas_para_depositario', {
    p_factura_id: facturaId,
  });

  if (error) throw new Error(error.message);
  if (!lineas?.length) return [];

  return (lineas as LineaRpc[]).map((row) => ({
    linea_id: String(row.linea_id),
    material_id: String(row.material_id),
    material_nombre: String(row.material_nombre ?? 'Material'),
    material_codigo: String(row.material_codigo ?? ''),
    cantidad_facturada: Number(row.cantidad_facturada) || 0,
  }));
}

async function mensajeItem(
  chatId: string,
  item: LineaDepositarioRecepcion,
  indice: number,
  total: number,
): Promise<void> {
  const codigo = item.material_codigo ? `\nCódigo: <code>${escHtml(item.material_codigo)}</code>` : '';
  await sendTelegramMessage(
    chatId,
    `📦 <b>Ítem ${indice + 1} de ${total}</b>\n\n` +
      `🔹 <b>${escHtml(item.material_nombre)}</b>${codigo}\n` +
      `📋 Cantidad facturada: <b>${item.cantidad_facturada}</b>\n\n` +
      `✍️ Escribe la <b>cantidad física real</b> que ingresa al almacén:`,
    { parse_mode: 'HTML' },
  );
}

async function enviarResumenConConfirmacion(
  chatId: string,
  sesion: SesionDepositarioRecepcion,
): Promise<void> {
  let resumen =
    '📋 <b>Resumen de recepción física</b>\n' +
    'Revisa antes de confirmar el ingreso a stock:\n\n';

  for (const item of sesion.items) {
    const ok = item.cantidad_facturada === item.cantidad_real;
    const icono = ok ? '✅' : '⚠️ Diferencia';
    resumen +=
      `${icono} <b>${escHtml(item.material_nombre)}</b>\n` +
      `  Facturado: ${item.cantidad_facturada} · Recibido: ${item.cantidad_real ?? '—'}\n\n`;
  }

  await sendTelegramMessage(chatId, resumen, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Confirmar ingreso a stock',
            callback_data: callbackDataConfirmarIngreso(sesion.facturaId),
          },
        ],
      ],
    },
  });
}

async function canalAlertasDiscrepancia(): Promise<string | null> {
  const admin = process.env.TELEGRAM_ADMIN_CHANNEL_ID?.trim();
  if (admin) return admin;
  const almacen = process.env.TELEGRAM_ALMACEN_CHAT_IDS?.trim();
  if (almacen) {
    const first = almacen.split(/[,;\s]+/).map((s) => s.trim()).find(Boolean);
    if (first) return first;
  }
  const allowed = getTelegramAllowedChatIds();
  if (allowed.size === 1) return [...allowed][0] ?? null;
  return null;
}

async function alertarDiscrepancias(
  facturaId: string,
  chatIdDepositario: string,
  items: LineaDepositarioRecepcion[],
): Promise<void> {
  const canal = await canalAlertasDiscrepancia();
  if (!canal) return;

  let texto =
    '⚠️ <b>Alerta de discrepancia en almacén</b>\n\n' +
    `Factura: <code>${escHtml(facturaId)}</code>\n` +
    `Depositario (chat): <code>${escHtml(chatIdDepositario)}</code>\n\n` +
    '<b>Diferencias:</b>\n';

  for (const item of items) {
    if (item.cantidad_facturada !== item.cantidad_real) {
      texto +=
        `❌ <b>${escHtml(item.material_nombre)}</b>\n` +
        `   Facturado: ${item.cantidad_facturada} · Recibido: ${item.cantidad_real ?? 0}\n`;
    }
  }

  await sendTelegramMessage(canal, texto, { parse_mode: 'HTML' });
}

async function iniciarVerificacion(
  supabase: SupabaseClient,
  chatId: string,
  facturaId: string,
  callbackId?: string,
): Promise<boolean> {
  const lineas = await cargarLineasFactura(supabase, facturaId);
  if (!lineas.length) {
    await sendTelegramMessage(
      chatId,
      '❌ No hay ítems para esta factura o la migración 209 no está aplicada en Supabase.',
      { parse_mode: 'HTML' },
    );
    if (callbackId) await answerCallbackQuery(callbackId, 'Sin ítems', true);
    return true;
  }

  const sesion: SesionDepositarioRecepcion = {
    facturaId,
    items: lineas,
    indiceActual: 0,
  };
  await guardarSesion(supabase, chatId, sesion);

  if (callbackId) await answerCallbackQuery(callbackId, 'Iniciando verificación…');
  await mensajeItem(chatId, lineas[0]!, 0, lineas.length);
  return true;
}

async function confirmarIngreso(
  supabase: SupabaseClient,
  chatId: string,
  facturaId: string,
  callbackId: string,
  telegramUserId: string,
): Promise<boolean> {
  const sesion = await obtenerSesion(supabase, chatId);
  if (!sesion || sesion.facturaId !== facturaId) {
    await sendTelegramMessage(chatId, '❌ Sesión expirada. Vuelve a pulsar verificar desde la app.', {
      parse_mode: 'HTML',
    });
    await answerCallbackQuery(callbackId, 'Sesión inválida', true);
    return true;
  }

  const incompletos = sesion.items.some(
    (i) => i.cantidad_real == null || !Number.isFinite(i.cantidad_real),
  );
  if (incompletos) {
    await sendTelegramMessage(
      chatId,
      '⚠️ Faltan cantidades por registrar. Completa el conteo antes de confirmar.',
      { parse_mode: 'HTML' },
    );
    await answerCallbackQuery(callbackId, 'Conteo incompleto', true);
    return true;
  }

  const itemsPayload = sesion.items.map((item) => ({
    material_id: item.material_id,
    cantidad_real: item.cantidad_real,
  }));

  const { data: rpcOk, error: rpcError } = await supabase.rpc('ingresar_mercancia_almacen', {
    p_factura_id: facturaId,
    p_usuario_telegram_id: telegramUserId,
    p_items_recibidos: itemsPayload,
  });

  if (rpcError || rpcOk !== true) {
    console.error('[depositario recepcion]', rpcError);
    await sendTelegramMessage(
      chatId,
      `❌ Error al procesar inventario: ${escHtml(rpcError?.message ?? 'RPC falló')}`,
      { parse_mode: 'HTML' },
    );
    await answerCallbackQuery(callbackId, 'Error en base de datos', true);
    return true;
  }

  const huboDiscrepancia = sesion.items.some((i) => i.cantidad_facturada !== i.cantidad_real);

  await sendTelegramMessage(
    chatId,
    '✅ <b>Inventario procesado.</b> La mercancía quedó registrada en stock físico.',
    { parse_mode: 'HTML' },
  );

  if (huboDiscrepancia) {
    await alertarDiscrepancias(facturaId, chatId, sesion.items);
  }

  await guardarSesion(supabase, chatId, null);
  await answerCallbackQuery(callbackId, 'Ingreso confirmado');
  return true;
}

export async function manejarCallbackDepositarioRecepcion(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    callbackId: string;
    data: string;
    telegramUserId: string;
  },
): Promise<boolean> {
  const { chatId, callbackId, data, telegramUserId } = params;

  if (data.startsWith(PREFIX_VERIFICAR)) {
    const facturaId = data.slice(PREFIX_VERIFICAR.length).trim();
    if (!facturaId) {
      await answerCallbackQuery(callbackId, 'Factura inválida', true);
      return true;
    }
    try {
      await iniciarVerificacion(supabase, chatId, facturaId, callbackId);
    } catch (err) {
      console.error('[depositario verificar]', err);
      await sendTelegramMessage(
        chatId,
        `❌ ${escHtml(err instanceof Error ? err.message : 'Error al cargar factura')}`,
        { parse_mode: 'HTML' },
      );
      await answerCallbackQuery(callbackId, 'Error', true);
    }
    return true;
  }

  if (data.startsWith(PREFIX_CONFIRMAR)) {
    const facturaId = data.slice(PREFIX_CONFIRMAR.length).trim();
    if (!facturaId) {
      await answerCallbackQuery(callbackId, 'Factura inválida', true);
      return true;
    }
    try {
      await confirmarIngreso(supabase, chatId, facturaId, callbackId, telegramUserId);
    } catch (err) {
      console.error('[depositario confirmar]', err);
      await sendTelegramMessage(
        chatId,
        `❌ ${escHtml(err instanceof Error ? err.message : 'Error al confirmar')}`,
        { parse_mode: 'HTML' },
      );
      await answerCallbackQuery(callbackId, 'Error', true);
    }
    return true;
  }

  return false;
}

export async function manejarTextoDepositarioRecepcion(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<{ handled: boolean }> {
  const sesion = await obtenerSesion(supabase, chatId);
  if (!sesion) return { handled: false };

  const cantidad = parseFloat(texto.replace(',', '.'));
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    await sendTelegramMessage(
      chatId,
      '⚠️ Cantidad inválida. Escribe un número ≥ 0 (ej. <code>12</code> o <code>12.5</code>).',
      { parse_mode: 'HTML' },
    );
    return { handled: true };
  }

  const idx = sesion.indiceActual;
  sesion.items[idx]!.cantidad_real = cantidad;

  if (idx + 1 < sesion.items.length) {
    sesion.indiceActual = idx + 1;
    await guardarSesion(supabase, chatId, sesion);
    await mensajeItem(chatId, sesion.items[sesion.indiceActual]!, sesion.indiceActual, sesion.items.length);
    return { handled: true };
  }

  await guardarSesion(supabase, chatId, sesion);
  await enviarResumenConConfirmacion(chatId, sesion);
  return { handled: true };
}

/** Cancela conteo en curso (comando /cancelar durante recepción). */
export async function cancelarRecepcionDepositario(
  supabase: SupabaseClient,
  chatId: string,
): Promise<boolean> {
  const sesion = await obtenerSesion(supabase, chatId);
  if (!sesion) return false;
  await guardarSesion(supabase, chatId, null);
  await sendTelegramMessage(chatId, 'Recepción física cancelada.', { parse_mode: 'HTML' });
  return true;
}
