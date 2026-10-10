/**
 * A qué chat de Telegram van los avisos de administración (informe semanal, permisología)
 * cuando su variable propia no está configurada.
 *
 * Orden: TELEGRAM_CHAT_ID → canal de administración guardado en Configuración → Alertas
 * (el mismo que usa el auditor de contabilidad de obra) → chat personal del administrador
 * (TELEGRAM_PRUEBAS_REDIRECT_CHAT_ID, que ya usa el aviso de registro de trabajadores).
 *
 * Sin esto esas tareas terminaban en «sin chat destino» y no avisaban a nadie.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarAlertasConfig } from '@/lib/alertas/alertasConfig';

export type ChatAdministracion = { chatId: string | null; fuente: string | null };

const limpio = (v: string | null | undefined) => (v ?? '').trim();

/** Parte pura de la decisión, para poder probarla sin variables de entorno ni base. */
export function elegirChatAdministracion(candidatos: {
  chatCeo?: string | null;
  canalAdmin?: string | null;
  chatAdministrador?: string | null;
}): ChatAdministracion {
  if (limpio(candidatos.chatCeo)) return { chatId: limpio(candidatos.chatCeo), fuente: 'TELEGRAM_CHAT_ID' };
  if (limpio(candidatos.canalAdmin)) {
    return { chatId: limpio(candidatos.canalAdmin), fuente: 'canal de administración' };
  }
  if (limpio(candidatos.chatAdministrador)) {
    return { chatId: limpio(candidatos.chatAdministrador), fuente: 'chat del administrador' };
  }
  return { chatId: null, fuente: null };
}

export async function resolverChatAdministracion(supabase: SupabaseClient): Promise<ChatAdministracion> {
  let canalAdmin: string | null = null;
  try {
    canalAdmin = (await cargarAlertasConfig(supabase)).canalAdminEfectivo;
  } catch (e) {
    console.warn('[chat administración] sin configuración de alertas:', e instanceof Error ? e.message : e);
  }
  return elegirChatAdministracion({
    chatCeo: process.env.TELEGRAM_CHAT_ID,
    canalAdmin,
    chatAdministrador: process.env.TELEGRAM_PRUEBAS_REDIRECT_CHAT_ID,
  });
}
