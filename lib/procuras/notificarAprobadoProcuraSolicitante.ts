import type { SupabaseClient } from '@supabase/supabase-js';
import { actualizarTicketProcuraSolicitante } from '@/lib/procuras/ticketProcuraSolicitanteTelegram';

export type ProcuraAprobadaNotificacion = {
  ticket: string;
  material_txt: string;
  solicitante_telegram_chat_id?: number | string | null;
  solicitante_nombre?: string | null;
  procuraId?: string;
};

/** @deprecated Usar actualizarTicketProcuraSolicitante con procuraId. */
export async function notificarAprobadoProcuraSolicitante(
  procura: ProcuraAprobadaNotificacion,
  supabase?: SupabaseClient,
): Promise<boolean> {
  if (supabase && procura.procuraId?.trim()) {
    return actualizarTicketProcuraSolicitante(supabase, procura.procuraId.trim(), {
      pmAprobadorNombre: procura.solicitante_nombre ?? undefined,
    });
  }
  return false;
}
