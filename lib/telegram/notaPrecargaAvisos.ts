import type { SupabaseClient } from '@supabase/supabase-js';
import {
  chatIdsDesdeDestinatarios,
  resolverDestinatariosCuarentenaTelegram,
} from '@/lib/almacen/resolverDestinatariosCuarentenaTelegram';
import { sendTelegramMessage } from '@/lib/telegram/botApi';

/** Aviso a los depositarios de la obra (no al almacén general). Nunca lanza. */
export async function avisarDepositariosNotaPrecargada(
  supabase: SupabaseClient,
  proyectoId: string,
  chatIdEmisor: string,
  texto: string,
): Promise<void> {
  const res = await resolverDestinatariosCuarentenaTelegram(supabase, { proyectoId });
  for (const chatId of chatIdsDesdeDestinatarios(res.destinatarios)) {
    if (chatId === chatIdEmisor) continue;
    try {
      await sendTelegramMessage(chatId, texto, { parse_mode: 'HTML' });
    } catch (err) {
      console.warn('[nota precargada] aviso depositario', chatId, err);
    }
  }
}
