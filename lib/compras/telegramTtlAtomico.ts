import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isTelegramContexto,
  type TelegramEstado,
} from '@/lib/telegram/estados';

type FilaEstadoRpc = {
  chat_id: string;
  contexto: string;
  proyecto_id: string | null;
  pending_factura_id: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
};

function mapFilaEstadoRpc(row: FilaEstadoRpc): TelegramEstado {
  return {
    chat_id: String(row.chat_id),
    contexto: isTelegramContexto(row.contexto) ? row.contexto : 'menu',
    proyecto_id: row.proyecto_id ?? null,
    pending_factura_id: row.pending_factura_id ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    updated_at: row.updated_at,
  };
}

/**
 * Marca metadata.ttl_pendiente = true solo si aún no lo estaba (atómico en Postgres).
 * @returns marked true si esta petición ganó la carrera; false si otra concurrente ya marcó.
 */
export async function marcarTtlPendienteAtomico(
  supabase: SupabaseClient,
  chatId: string,
): Promise<{ marked: boolean; estado?: TelegramEstado; error?: string }> {
  const { data, error } = await supabase.rpc(
    'ci_telegram_marcar_ttl_pendiente' as 'ci_registrar_ingreso_manual_campo',
    { p_chat_id: chatId.trim() } as never,
  );

  if (error) {
    console.warn('[ttl] RPC ci_telegram_marcar_ttl_pendiente:', error.message);
    return { marked: false, error: error.message };
  }

  const filas = (data ?? []) as FilaEstadoRpc[];
  if (!filas.length) {
    return { marked: false };
  }

  return { marked: true, estado: mapFilaEstadoRpc(filas[0]) };
}
