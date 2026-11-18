/**
 * Facturas por recibir que le corresponden a quien usa el bot: las de sus obras.
 * Antes cualquier depositario veía las facturas pendientes de todas las obras.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  filtrarFacturasPorObras,
  listarFacturasPendientesIngreso,
  type FacturaPendienteIngreso,
  type ObrasVisiblesAlmacen,
} from '@/lib/almacen/listarFacturasPendientesIngreso';
import { obtenerUsuarioSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import { simulacionBotActiva } from '@/lib/telegram/simulacion/contexto';
import { obrasDondeEsDepositarioNomina } from '@/lib/telegram/obrasDepositarioTelegram';

function chatNumerico(chatId: string | number): number | null {
  const n = Number(chatId);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Obras de una persona según su chat: «todas» para los administradores del sistema y para
 * el personal de almacén central; para los demás, las obras donde está en la nómina o es
 * el depositario asignado.
 */
export async function obrasVisiblesParaChat(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<ObrasVisiblesAlmacen> {
  const chat = chatNumerico(chatId);
  const obras = new Set<string>();
  if (chat == null) return obras;

  try {
    const usuario = await obtenerUsuarioSistemaTelegram(supabase, chat);
    if (usuario?.rol === 'Administrador') return 'todas';
  } catch {
    /* tabla de usuarios no disponible: se decide por la nómina */
  }

  // Depositario de nómina: solo las obras donde tiene ese rol (no otras filas de nómina).
  const obrasDepositario = await obrasDondeEsDepositarioNomina(supabase, chatId);
  if (obrasDepositario.size > 0) return obrasDepositario;

  const { data: nomina } = await supabase
    .from('ci_proyecto_nomina')
    .select('proyecto_id')
    .eq('telegram_chat_id', chat)
    .eq('activo', true);
  for (const f of (nomina ?? []) as Array<{ proyecto_id?: string | null }>) {
    const id = String(f.proyecto_id ?? '').trim();
    if (id) obras.add(id);
  }

  // En un ensayo las personas solo existen en la nómina de la obra de ensayo.
  if (simulacionBotActiva()) return obras;

  const { data: empleados } = await supabase
    .from('ci_empleados')
    .select('id,alertas_almacen_global')
    .eq('telegram_chat_id', chat);
  const filasEmpleado = (empleados ?? []) as Array<{ id: string; alertas_almacen_global?: boolean | null }>;
  if (filasEmpleado.some((e) => e.alertas_almacen_global === true)) return 'todas';

  const empleadoIds = filasEmpleado.map((e) => String(e.id)).filter(Boolean);
  if (empleadoIds.length) {
    const [{ data: porEmpleado }, { data: comoDepositario }] = await Promise.all([
      supabase.from('ci_proyecto_nomina').select('proyecto_id').in('empleado_id', empleadoIds).eq('activo', true),
      supabase.from('ci_proyectos').select('id').in('depositario_id', empleadoIds),
    ]);
    for (const f of (porEmpleado ?? []) as Array<{ proyecto_id?: string | null }>) {
      const id = String(f.proyecto_id ?? '').trim();
      if (id) obras.add(id);
    }
    for (const p of (comoDepositario ?? []) as Array<{ id?: string | null }>) {
      const id = String(p.id ?? '').trim();
      if (id) obras.add(id);
    }
  }
  return obras;
}

/** Facturas por recibir o confirmar, limitadas a las obras de quien pregunta. */
export async function listarFacturasPendientesDeMisObras(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<FacturaPendienteIngreso[]> {
  const [todas, visibles] = await Promise.all([
    listarFacturasPendientesIngreso(supabase),
    obrasVisiblesParaChat(supabase, chatId),
  ]);
  return filtrarFacturasPorObras(todas, visibles, chatId);
}

/**
 * DIAGNÓSTICO TEMPORAL (quitar después de revisar el listado vacío).
 * Cuenta cuántas facturas descarta cada filtro para este chat.
 */
export async function diagnosticoListadoFacturasComprador(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<string> {
  try {
    const todas = await listarFacturasPendientesIngreso(supabase);
    const visibles = await obrasVisiblesParaChat(supabase, chatId);
    const tras = filtrarFacturasPorObras(todas, visibles, chatId);
    const visTxt = visibles === 'todas' ? 'todas' : `${visibles.size} obra(s)`;
    const conObra = todas.filter((f) => f.proyecto_id?.trim()).length;
    return [
      '🔎 Diagnóstico (temporal):',
      `• Pendientes en total: ${todas.length}`,
      `• Con obra asignada: ${conObra}`,
      `• Obras visibles para tu chat: ${visTxt}`,
      `• Tras el filtro por obra: ${tras.length}`,
      `• Chat: ${String(chatId)}`,
    ].join('\n');
  } catch (e) {
    return `🔎 Diagnóstico (temporal): error ${e instanceof Error ? e.message : String(e)}`;
  }
}
