import type { SupabaseClient } from '@supabase/supabase-js';
import { getTelegramAllowedChatIds, getTelegramBotToken, sendTelegramMessage } from '@/lib/telegram/botApi';

/** Destino del aviso: TELEGRAM_RRHH_CHAT_ID → TELEGRAM_CHAT_ID → whitelist única → TELEGRAM_PRUEBAS_REDIRECT_CHAT_ID. */
export function resolverChatRrhhTelegram(): string | null {
  const rrhh = process.env.TELEGRAM_RRHH_CHAT_ID?.trim();
  if (rrhh) return rrhh;
  const ceo = process.env.TELEGRAM_CHAT_ID?.trim();
  if (ceo) return ceo;
  const allowed = Array.from(getTelegramAllowedChatIds());
  if (allowed.length === 1) return allowed[0]!;
  // Último recurso: el chat personal configurado para pruebas (el Telegram del administrador).
  return process.env.TELEGRAM_PRUEBAS_REDIRECT_CHAT_ID?.trim() || null;
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Avisa por Telegram que un obrero completó su registro (hoja de vida) en una obra.
 * Nunca lanza: el registro del trabajador no debe fallar por el aviso.
 */
export async function avisarRegistroObreroTelegram(
  admin: SupabaseClient,
  empleadoId: string,
  baseUrl?: string,
): Promise<{ enviado: boolean; motivo?: string }> {
  try {
    if (!getTelegramBotToken()) return { enviado: false, motivo: 'sin TELEGRAM_BOT_TOKEN' };
    const chatId = resolverChatRrhhTelegram();
    if (!chatId) return { enviado: false, motivo: 'sin chat destino' };

    const { data: emp } = await admin
      .from('ci_empleados')
      .select('id,nombre_completo,cedula,celular,telefono,cargo_codigo,cargo_nombre,proyecto_modulo_id')
      .eq('id', empleadoId)
      .maybeSingle();
    if (!emp) return { enviado: false, motivo: 'expediente no encontrado' };
    const e = emp as Record<string, unknown>;

    let obra = '';
    let registrados = 0;
    const proyectoId = String(e.proyecto_modulo_id ?? '').trim();
    if (proyectoId) {
      const { data: pr } = await admin.from('ci_proyectos').select('nombre').eq('id', proyectoId).maybeSingle();
      obra = String((pr as { nombre?: string } | null)?.nombre ?? '').trim();
      const { count } = await admin
        .from('ci_empleados')
        .select('id', { count: 'exact', head: true })
        .eq('proyecto_modulo_id', proyectoId);
      registrados = count ?? 0;
    }

    const oficio = [String(e.cargo_codigo ?? '').replace('.', ','), String(e.cargo_nombre ?? '')]
      .filter((x) => x.trim())
      .join(' ');
    const tel = String(e.celular ?? e.telefono ?? '').trim();
    const lineas = [
      '👷 <b>Nuevo obrero registrado</b>',
      `<b>${esc(e.nombre_completo)}</b>`,
      `Cédula: ${esc(e.cedula)}`,
      oficio ? `Oficio: ${esc(oficio)}` : 'Oficio: sin definir',
      obra ? `Obra: ${esc(obra)}` : '',
      tel ? `Teléfono: ${esc(tel)}` : '',
      registrados ? `Van ${registrados} en esta obra.` : '',
      baseUrl ? `Revisar: ${baseUrl}/rrhh/solicitud-personal` : '',
    ].filter(Boolean);

    await sendTelegramMessage(chatId, lineas.join('\n'));
    return { enviado: true };
  } catch (err) {
    console.warn('[aviso registro obrero]', err instanceof Error ? err.message : err);
    return { enviado: false, motivo: 'error al enviar' };
  }
}
