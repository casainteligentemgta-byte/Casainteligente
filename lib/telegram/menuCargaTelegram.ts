import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { esChatComprador } from '@/lib/telegram/compradorRestricciones';
import { iniciarFacturaCompradorManualTelegram } from '@/lib/telegram/facturaCompradorManualTelegram';
import { manejarComandoIngresoFacturaTelegram } from '@/lib/telegram/ingresoFacturaTelegram';
import {
  manejarComandoIngresoFacturaManualTelegram,
  manejarComandoIngresoFacturaSinIaTelegram,
  manejarComandoNotaEntregaTelegram,
} from '@/lib/telegram/ingresoManualTelegram';
import { iniciarModoCargaFacturasTelegram } from '@/lib/telegram/mensajesFactura';

/** Menú único de carga (/facturas e /ingreso). Mismo menú para todos los roles; el destino cambia. */
export const PREFIX_CARGA = 'cg:';

export type RolCarga = 'comprador' | 'depositario';

/** Comprador, administrador general y project manager cargan con flujo de comprador (eligen destino). */
export async function rolDeCarga(supabase: SupabaseClient, chatId: string): Promise<RolCarga> {
  if (await esChatComprador(supabase, chatId)) return 'comprador';
  const { data } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .select('id')
    .eq('telegram_id', Number(chatId))
    .in('rol', ['Administrador', 'Project Manager'])
    .eq('activo', true)
    .limit(1);
  if (data?.length) return 'comprador';
  return 'depositario';
}

export async function enviarMenuCarga(supabase: SupabaseClient, chatId: string): Promise<void> {
  const rol = await rolDeCarga(supabase, chatId);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '📷 Factura con foto (IA)', callback_data: `${PREFIX_CARGA}factura_ia` }],
    [{ text: '✍️ Factura manual (sin IA)', callback_data: `${PREFIX_CARGA}factura_manual` }],
    [{ text: '📄 Nota de entrega', callback_data: `${PREFIX_CARGA}nota` }],
  ];
  if (rol === 'depositario') {
    rows.push([{ text: '📝 Sin nota ni factura', callback_data: `${PREFIX_CARGA}sin_nota` }]);
    rows.push([{ text: '📥 Pendientes de ingreso', callback_data: `${PREFIX_CARGA}pendientes` }]);
  }
  await sendTelegramMessage(
    chatId,
    '🧾 <b>Cargar</b>\n\nElija cómo cargar:\n' +
      '• <b>Con foto (IA):</b> la IA lee la factura y solo se piden los datos que falten.\n' +
      '• <b>Manual:</b> se escriben todos los datos.',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } },
  );
}

export function esCallbackCarga(data: string): boolean {
  return data.startsWith(PREFIX_CARGA);
}

export async function manejarCallbackCarga(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackCarga(params.data)) return false;
  const accion = params.data.slice(PREFIX_CARGA.length);
  const rol = await rolDeCarga(supabase, params.chatId);
  await answerCallbackQuery(params.callbackId);

  switch (accion) {
    case 'factura_ia':
      if (rol === 'comprador') await iniciarModoCargaFacturasTelegram(supabase, params.chatId);
      else await manejarComandoIngresoFacturaManualTelegram(supabase, params.chatId);
      return true;
    case 'factura_manual':
      if (rol === 'comprador') await iniciarFacturaCompradorManualTelegram(supabase, params.chatId);
      else await manejarComandoIngresoFacturaSinIaTelegram(supabase, params.chatId);
      return true;
    case 'nota':
      await manejarComandoNotaEntregaTelegram(supabase, params.chatId);
      return true;
    case 'sin_nota':
      if (rol === 'comprador') {
        await sendTelegramMessage(
          params.chatId,
          'La carga sin nota ni factura la registra el depositario en almacén.',
          { parse_mode: 'HTML' },
        );
        return true;
      }
      await manejarComandoIngresoFacturaTelegram(supabase, params.chatId);
      return true;
    case 'pendientes':
      await manejarComandoIngresoFacturaTelegram(supabase, params.chatId);
      return true;
    default:
      return false;
  }
}
