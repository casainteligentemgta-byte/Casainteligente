import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * El comprador carga facturas y notas de entrega. No registra ingresos ni salidas de
 * mercancía en depósitos o almacenes: eso es del depositario y de logística.
 */
export const MENSAJE_NO_DISPONIBLE_COMPRADOR =
  '⛔ El comprador no registra ingresos ni salidas de almacén. Use /facturas o /nota para cargar facturas y notas de entrega.';

/** Fotos / evidencia de obra: el comprador no las registra (eso es de obra y de administración). */
export const MENSAJE_EVIDENCIA_OBRA_NO_COMPRADOR =
  '⛔ El comprador no registra fotos ni evidencia de obra. Use /facturas o /nota para cargar facturas y notas de entrega.';

/** Comandos de movimiento de almacén que el comprador no puede usar. */
export const COMANDOS_SOLO_NO_COMPRADOR = [
  'comandoIngresoManual',
  'comandoMenuIngreso',
  'comandoIngresoFactura',
  'comandoMenuSalida',
  'comandoSalida',
] as const;

/**
 * Un chat es de comprador cuando está activo como Comprador en los usuarios de compras
 * de Telegram, o cuando está en la nómina de una obra con rol «comprador».
 */
export async function esChatComprador(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<boolean> {
  try {
    const chat = String(chatId);
    const { data: usuario, error: errUsuario } = await supabase
      .from('ci_usuarios_sistema_telegram')
      .select('id')
      .eq('telegram_id', Number(chat))
      .eq('rol', 'Comprador')
      .eq('activo', true)
      .limit(1);
    if (!errUsuario && (usuario ?? []).length > 0) return true;

    const { data: nomina, error: errNomina } = await supabase
      .from('ci_proyecto_nomina')
      .select('id')
      .eq('telegram_chat_id', chat)
      .eq('rol', 'comprador')
      .eq('activo', true)
      .limit(1);
    return !errNomina && (nomina ?? []).length > 0;
  } catch {
    return false;
  }
}

/**
 * Quien carga facturas y notas con flujo de comprador (eligen obra y destino):
 * comprador, administrador o project manager. No bloquea movimientos de almacén.
 */
export async function esChatCargaComprador(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<boolean> {
  if (await esChatComprador(supabase, chatId)) return true;
  try {
    const chat = Number(String(chatId));
    const { data, error } = await supabase
      .from('ci_usuarios_sistema_telegram')
      .select('id, rol, es_project_manager')
      .eq('telegram_id', chat)
      .eq('activo', true)
      .limit(1);
    if (error || !data?.length) return false;
    const u = data[0] as { rol?: string | null; es_project_manager?: boolean | null };
    return u.rol === 'Administrador' || u.es_project_manager === true;
  } catch {
    return false;
  }
}
