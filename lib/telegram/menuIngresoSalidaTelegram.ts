import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { manejarComandoIngresoFacturaTelegram } from '@/lib/telegram/ingresoFacturaTelegram';
import {
  manejarComandoIngresoSinNotaTelegram,
  manejarComandoNotaEntregaTelegram,
} from '@/lib/telegram/ingresoManualTelegram';
import { iniciarModoCargaFacturasTelegram } from '@/lib/telegram/mensajesFactura';
import { manejarComandoSalidaEgresoTelegram } from '@/lib/telegram/salidaEgresoFlujo';
import { manejarComandoSalidaObraTelegram } from '@/lib/telegram/salidaObraTelegram';
import { manejarComandoTraspasoTelegram } from '@/lib/telegram/traspasoFlujoTelegram';

const PREFIX_INGRESO = 'ig:';
const PREFIX_SALIDA = 'sg:';

/** Opciones del submenú /ingreso (4 flujos unificados). */
export type OpcionMenuIngreso = 'factura' | 'factauto' | 'nota' | 'sinnota';
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

export async function manejarComandoIngresoTelegram(chatId: string): Promise<void> {
  await enviarMenuIngresoTelegram(chatId);
}

export async function enviarMenuIngresoTelegram(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '📥 <b>Ingreso a almacén</b>\n\n' + 'Elige el tipo de ingreso:',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🧾 Ingreso manual de factura',
              callback_data: callbackMenuIngreso('factura'),
            },
          ],
          [
            {
              text: '🤖 Ingreso automático de factura',
              callback_data: callbackMenuIngreso('factauto'),
            },
          ],
          [
            {
              text: '📄 Ingreso con nota de entrega',
              callback_data: callbackMenuIngreso('nota'),
            },
          ],
          [{ text: '📝 Ingreso sin nota', callback_data: callbackMenuIngreso('sinnota') }],
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

function normalizarOpcionMenuIngreso(raw: string): OpcionMenuIngreso | null {
  if (raw === 'manual') return 'sinnota';
  if (raw === 'factura' || raw === 'factauto' || raw === 'nota' || raw === 'sinnota') {
    return raw;
  }
  return null;
}

async function iniciarIngresoPorOpcion(
  supabase: SupabaseClient,
  chatId: string,
  opcion: OpcionMenuIngreso,
): Promise<void> {
  switch (opcion) {
    case 'factura':
      await manejarComandoIngresoFacturaTelegram(supabase, chatId);
      break;
    case 'factauto':
      await iniciarModoCargaFacturasTelegram(supabase, chatId);
      break;
    case 'nota':
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
  factura: 'Ingreso manual de factura',
  factauto: 'Ingreso automático de factura',
  nota: 'Ingreso con nota de entrega',
  sinnota: 'Ingreso sin nota',
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
  const opcion = normalizarOpcionMenuIngreso(params.data.slice(PREFIX_INGRESO.length));
  if (!opcion) return false;

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
