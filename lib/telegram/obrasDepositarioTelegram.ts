/**
 * Alcance de obras del depositario de nómina (ci_proyecto_nomina.rol = 'depositario').
 * Los administradores no se restringen. Compradores y demás roles no pasan por este filtro.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { esChatAdministradorTelegram } from '@/lib/telegram/permisosAlmacenTelegram';

export const MENSAJE_OBRA_NO_ASIGNADA_DEPOSITARIO =
  '⛔ Solo puedes operar en tu obra asignada.';

export const MENSAJE_SIN_OBRA_DEPOSITARIO =
  '⚠️ Tu obra asignada no está disponible. Contacta al administrador.';

/** null = no es depositario (no restringir). 'todas' = administrador. Set = obras de nómina. */
export type AlcanceObrasDepositario = 'todas' | Set<string> | null;

const MODOS_PICKER_DEPOSITARIO = new Set([
  'entrada_obra',
  'ingreso_manual',
  'ingreso_factura_manual',
  'nota_entrega',
  'emergencia',
  'salida_obra',
  'salida_almacen',
  'salida_obra_despacho',
]);

export function modoPickerAplicaRestriccionDepositario(modo: string): boolean {
  return MODOS_PICKER_DEPOSITARIO.has(modo);
}

function chatTelegramNomina(chatId: string | number): string {
  return String(chatId).trim();
}

/** Obras donde el chat es depositario activo (solo rol depositario). */
export async function obrasDondeEsDepositarioNomina(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<Set<string>> {
  const obras = new Set<string>();
  const chat = chatTelegramNomina(chatId);
  if (!chat) return obras;

  try {
    const { data, error } = await supabase
      .from('ci_proyecto_nomina')
      .select('proyecto_id')
      .eq('telegram_chat_id', chat)
      .eq('rol', 'depositario')
      .eq('activo', true);
    if (error) return obras;
    for (const f of (data ?? []) as Array<{ proyecto_id?: string | null }>) {
      const id = String(f.proyecto_id ?? '').trim();
      if (id) obras.add(id);
    }
  } catch {
    return obras;
  }
  return obras;
}

/**
 * Alcance para /ingreso, /salida, /stock, /factura y /agua.
 * Administrador → todas. Depositario de nómina → sus obras. Cualquier otro rol → null.
 */
export async function alcanceObrasDepositarioParaChat(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<AlcanceObrasDepositario> {
  if (await esChatAdministradorTelegram(supabase, chatId)) return 'todas';
  const obras = await obrasDondeEsDepositarioNomina(supabase, chatId);
  if (obras.size === 0) return null;
  return obras;
}

export function obraPermitidaSegunAlcanceDepositario(
  proyectoId: string | null | undefined,
  alcance: AlcanceObrasDepositario,
): boolean {
  if (alcance === null || alcance === 'todas') return true;
  const id = String(proyectoId ?? '').trim();
  return Boolean(id && alcance.has(id));
}

export function filtrarProyectosPorAlcanceDepositario<T extends { id: string }>(
  proyectos: T[],
  alcance: AlcanceObrasDepositario,
): T[] {
  if (alcance === null || alcance === 'todas') return proyectos;
  return proyectos.filter((p) => alcance.has(p.id));
}

export function proyectoIdDeUbicacion(ubicacion: {
  obra_id?: string | null;
  ci_proyecto_id?: string | null;
} | null | undefined): string | null {
  if (!ubicacion) return null;
  const id = String(ubicacion.obra_id ?? ubicacion.ci_proyecto_id ?? '').trim();
  return id || null;
}

export function filtrarUbicacionesPorAlcanceDepositario<
  T extends { obra_id?: string | null; ci_proyecto_id?: string | null },
>(ubicaciones: T[], alcance: AlcanceObrasDepositario): T[] {
  if (alcance === null || alcance === 'todas') return ubicaciones;
  return ubicaciones.filter((u) => {
    const id = proyectoIdDeUbicacion(u);
    return Boolean(id && alcance.has(id));
  });
}

export function ubicacionPermitidaSegunAlcanceDepositario(
  ubicacionProyectoId: string | null | undefined,
  alcance: AlcanceObrasDepositario,
): boolean {
  return obraPermitidaSegunAlcanceDepositario(ubicacionProyectoId, alcance);
}

export async function exigirObraPermitidaDepositario(
  supabase: SupabaseClient,
  chatId: string | number,
  proyectoId: string | null | undefined,
  callbackId?: string,
): Promise<boolean> {
  const alcance = await alcanceObrasDepositarioParaChat(supabase, chatId);
  if (obraPermitidaSegunAlcanceDepositario(proyectoId, alcance)) return true;
  await rechazarAccionObraAjenaDepositario(chatId, callbackId);
  return false;
}

export async function rechazarAccionObraAjenaDepositario(
  chatId: string | number,
  callbackId?: string,
): Promise<void> {
  if (callbackId) {
    await answerCallbackQuery(callbackId, MENSAJE_OBRA_NO_ASIGNADA_DEPOSITARIO, true);
    return;
  }
  await sendTelegramMessage(chatId, MENSAJE_OBRA_NO_ASIGNADA_DEPOSITARIO, {
    parse_mode: 'HTML',
  });
}

export async function proyectoIdDeUbicacionId(
  supabase: SupabaseClient,
  ubicacionId: string,
): Promise<string | null> {
  const id = String(ubicacionId ?? '').trim();
  if (!id) return null;
  const { data } = await supabase
    .from('inv_ubicaciones')
    .select('ci_proyecto_id')
    .eq('id', id)
    .maybeSingle();
  const pid = String((data as { ci_proyecto_id?: string | null } | null)?.ci_proyecto_id ?? '').trim();
  return pid || null;
}
