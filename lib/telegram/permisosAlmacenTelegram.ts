import type { SupabaseClient } from '@supabase/supabase-js';
import { esChatComprador } from '@/lib/telegram/compradorRestricciones';
import { esChatDepositarioNomina } from '@/lib/telegram/menuDepositarioTelegram';

export const MENSAJE_EMERGENCIA_NO_COMPRADOR =
  '⛔ El comprador no registra ingresos de emergencia. Use /facturas o /nota.';

export const MENSAJE_CARGA_FACTURA_NO_DEPOSITARIO =
  '⛔ El depositario no carga facturas del comprador. Use /ingreso para contar lo que ya está precargado.';

export const MENSAJE_MERMA_SOLO_DEPOSITARIO =
  '⛔ Solo el depositario o un administrador pueden dar de baja material. Use /salida.';

const ACCIONES_CARGA_COMPRADOR = new Set(['factura_ia', 'factura_manual', 'nota']);

export function esCallbackCargaFacturaComprador(data: string): boolean {
  if (!data.startsWith('cg:')) return false;
  return ACCIONES_CARGA_COMPRADOR.has(data.slice(3));
}

const ACCIONES_INGRESO_DEPOSITARIO = new Set([
  'pendientes',
  'notas_pendientes',
  'ingreso_ia',
  'ingreso_manual',
  'nota_ingreso_ia',
  'nota_ingreso_manual',
  'ingreso_sin_nota',
]);

export function esCallbackMovimientoAlmacenTelegram(data: string): boolean {
  if (data.startsWith('cg:') && ACCIONES_INGRESO_DEPOSITARIO.has(data.slice(3))) return true;
  return (
    data.startsWith('ig:') ||
    data.startsWith('sg:') ||
    data.startsWith('im:') ||
    data.startsWith('ifp:') ||
    data.startsWith('se:') ||
    data.startsWith('sa:') ||
    data.startsWith('tso:') ||
    data.startsWith('tsd:') ||
    data.startsWith('tsop:') ||
    data.startsWith('tsdp:') ||
    data.startsWith('tsm:') ||
    data === 'tsok' ||
    data === 'tsc' ||
    data === 'tsfs' ||
    data === 'tsnn' ||
    data.startsWith('rq:') ||
    data.startsWith('mr:')
  );
}

export async function esChatAdministradorTelegram(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<boolean> {
  try {
    const chat = Number(String(chatId));
    if (!Number.isFinite(chat)) return false;
    const { data, error } = await supabase
      .from('ci_usuarios_sistema_telegram')
      .select('id')
      .eq('telegram_id', chat)
      .eq('rol', 'Administrador')
      .eq('activo', true)
      .limit(1);
    return !error && (data ?? []).length > 0;
  } catch {
    return false;
  }
}

export async function puedeRegistrarMermaTelegram(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<boolean> {
  if (await esChatDepositarioNomina(supabase, chatId)) return true;
  return esChatAdministradorTelegram(supabase, chatId);
}

export async function compradorNoPuedeMoverAlmacen(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<boolean> {
  return esChatComprador(supabase, chatId);
}
