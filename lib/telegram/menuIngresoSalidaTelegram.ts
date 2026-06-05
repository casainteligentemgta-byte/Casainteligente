import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { manejarComandoIngresoFacturaTelegram } from '@/lib/telegram/ingresoFacturaTelegram';
import {
  manejarComandoIngresoManualTelegram,
  manejarComandoIngresoSinNotaTelegram,
  manejarComandoNotaEntregaTelegram,
} from '@/lib/telegram/ingresoManualTelegram';
import { manejarComandoSalidaEgresoTelegram } from '@/lib/telegram/salidaEgresoFlujo';
import { manejarComandoSalidaObraTelegram } from '@/lib/telegram/salidaObraTelegram';
import { manejarComandoTraspasoTelegram } from '@/lib/telegram/traspasoFlujoTelegram';

const PREFIX_INGRESO = 'ig:';
const PREFIX_SALIDA = 'sg:';

export type OpcionMenuIngreso = 'manual' | 'factura' | 'notas' | 'sinnota';
export type OpcionMenuSalida = 'obra' | 'almacen' | 'prestamo';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function esCallbackMenuIngresoTelegram(data: string): boolean {
  return data.startsWith(PREFIX_INGRESO);
}

export function esCallbackMenuSalidaTelegram(data: string): boolean {
  return data.startsWith(PREFIX_SALIDA);
}

export function callbackMenuIngreso(opcion: OpcionMenuIngreso): string {
  return `${PREFIX_INGRESO}${opcion}`;
}

export function callbackMenuSalida(opcion: OpcionMenuSalida): string {
  return `${PREFIX_SALIDA}${opcion}`;
}

export async function enviarMenuIngresoTelegram(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '📥 <b>Ingreso a almacén</b>\n\n' + 'Elige el tipo de ingreso:',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Ingreso manual', callback_data: callbackMenuIngreso('manual') }],
          [{ text: '🧾 Ingreso facturas', callback_data: callbackMenuIngreso('factura') }],
          [{ text: '📄 Ingreso notas', callback_data: callbackMenuIngreso('notas') }],
          [{ text: '📝 Ingreso sin notas', callback_data: callbackMenuIngreso('sinnota') }],
        ],
      },
    },
  );
}

export async function enviarMenuSalidaTelegram(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '📤 <b>Salida de material</b>\n\n' + 'Elige el tipo de salida:',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏗 Salida a obra', callback_data: callbackMenuSalida('obra') }],
          [{ text: '🏭 Salida a almacén', callback_data: callbackMenuSalida('almacen') }],
          [{ text: '🔄 Préstamo / traspaso', callback_data: callbackMenuSalida('prestamo') }],
        ],
      },
    },
  );
}

async function iniciarIngresoPorOpcion(
  supabase: SupabaseClient,
  chatId: string,
  opcion: OpcionMenuIngreso,
): Promise<void> {
  switch (opcion) {
    case 'manual':
      await manejarComandoIngresoManualTelegram(supabase, chatId);
      break;
    case 'factura':
      await manejarComandoIngresoFacturaTelegram(supabase, chatId);
      break;
    case 'notas':
      await manejarComandoNotaEntregaTelegram(supabase, chatId);
      break;
    case 'sinnota':
      await manejarComandoIngresoSinNotaTelegram(supabase, chatId);
      break;
    default:
      await sendTelegramMessage(chatId, '⚠️ Opción no válida. Use <code>/ingreso</code>.', {
        parse_mode: 'HTML',
      });
  }
}

async function iniciarSalidaPorOpcion(
  supabase: SupabaseClient,
  chatId: string,
  opcion: OpcionMenuSalida,
): Promise<void> {
  switch (opcion) {
    case 'obra':
      await manejarComandoSalidaEgresoTelegram(supabase, chatId);
      break;
    case 'almacen':
      await manejarComandoSalidaObraTelegram(supabase, chatId);
      break;
    case 'prestamo':
      await manejarComandoTraspasoTelegram(supabase, chatId);
      break;
    default:
      await sendTelegramMessage(chatId, '⚠️ Opción no válida. Use <code>/salida</code>.', {
        parse_mode: 'HTML',
      });
  }
}

const ETIQUETA_INGRESO: Record<OpcionMenuIngreso, string> = {
  manual: 'Ingreso manual',
  factura: 'Ingreso facturas',
  notas: 'Ingreso notas',
  sinnota: 'Ingreso sin notas',
};

const ETIQUETA_SALIDA: Record<OpcionMenuSalida, string> = {
  obra: 'Salida a obra',
  almacen: 'Salida a almacén',
  prestamo: 'Préstamo',
};

export async function manejarCallbackMenuIngresoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackMenuIngresoTelegram(params.data)) return false;
  const opcion = params.data.slice(PREFIX_INGRESO.length) as OpcionMenuIngreso;
  if (!(opcion in ETIQUETA_INGRESO)) return false;

  await answerCallbackQuery(params.callbackId, ETIQUETA_INGRESO[opcion].slice(0, 40));
  try {
    await iniciarIngresoPorOpcion(supabase, params.chatId, opcion);
  } catch (e) {
    console.error('[telegram menu ingreso]', opcion, e);
    await sendTelegramMessage(
      params.chatId,
      `❌ No se pudo iniciar <b>${escapeHtml(ETIQUETA_INGRESO[opcion])}</b>.`,
      { parse_mode: 'HTML' },
    );
  }
  return true;
}

export async function manejarCallbackMenuSalidaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackMenuSalidaTelegram(params.data)) return false;
  const opcion = params.data.slice(PREFIX_SALIDA.length) as OpcionMenuSalida;
  if (!(opcion in ETIQUETA_SALIDA)) return false;

  await answerCallbackQuery(params.callbackId, ETIQUETA_SALIDA[opcion].slice(0, 40));
  try {
    await iniciarSalidaPorOpcion(supabase, params.chatId, opcion);
  } catch (e) {
    console.error('[telegram menu salida]', opcion, e);
    await sendTelegramMessage(
      params.chatId,
      `❌ No se pudo iniciar <b>${escapeHtml(ETIQUETA_SALIDA[opcion])}</b>.`,
      { parse_mode: 'HTML' },
    );
  }
  return true;
}
