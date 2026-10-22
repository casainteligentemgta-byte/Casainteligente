import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverAccesoMovimientosTelegram } from '@/lib/telegram/movimientosDepositarioMiniApp';

function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

/**
 * Botón que abre la Mini App de movimientos. Solo se ofrece a depositarios y administradores;
 * a los demás no se les muestra (y el servidor igual los rechaza).
 */
export async function tecladoVerMovimientosDepositario(
  supabase: SupabaseClient,
  chatId: string,
): Promise<{ inline_keyboard: Array<Array<{ text: string; web_app: { url: string } }>> } | null> {
  try {
    const acceso = await resolverAccesoMovimientosTelegram(supabase, chatId);
    if (!acceso.ok) return null;
    return {
      inline_keyboard: [[{ text: '📋 Ver movimientos', web_app: { url: `${baseUrlApp()}/movimientos-deposito` } }]],
    };
  } catch {
    return null;
  }
}
