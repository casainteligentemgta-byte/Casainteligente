import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverChatRrhhTelegram } from '@/lib/rrhh/avisoRegistroObreroTelegram';
import { getTelegramBotToken, sendTelegramMessage } from '@/lib/telegram/botApi';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function emojiSemaforo(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === 'verde') return '🟢 Verde';
  if (s === 'amarillo') return '🟡 Amarillo';
  if (s === 'rojo') return '🔴 Rojo';
  return raw.trim();
}

function baseUrlRrhh(explicit?: string): string {
  const trim = (u: string) => u.trim().replace(/\/$/, '');
  if (explicit && /^https?:\/\//i.test(explicit.trim())) return trim(explicit);
  const env = trim(process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
  return env && /^https?:\/\//i.test(env) ? env : '';
}

export type DatosAvisoEvaluacion = {
  nombre: string;
  cedula: string;
  oficio: string;
  obra: string;
  telefono: string;
  semaforo: string;
  perfilColor: string;
  baseUrl: string;
};

export function textoAvisoEvaluacionObrero(d: DatosAvisoEvaluacion): string {
  const semaforo = d.semaforo ? emojiSemaforo(d.semaforo) : '';
  return [
    '📋 <b>Evaluación completada</b>',
    `<b>${esc(d.nombre || 'Obrero')}</b>`,
    d.cedula ? `Cédula: ${esc(d.cedula)}` : '',
    d.oficio ? `Oficio: ${esc(d.oficio)}` : 'Oficio: sin definir',
    d.obra ? `Obra: ${esc(d.obra)}` : '',
    d.telefono ? `Teléfono: ${esc(d.telefono)}` : '',
    semaforo ? `Semáforo: ${esc(semaforo)}` : '',
    d.perfilColor ? `Color: ${esc(d.perfilColor)}` : '',
    d.baseUrl ? `Revisar: ${d.baseUrl}/rrhh/evaluaciones` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Avisa por Telegram que el obrero terminó la evaluación.
 * Nunca lanza: el cierre del examen no debe fallar por el aviso.
 */
export async function avisarEvaluacionObreroTelegram(
  admin: SupabaseClient,
  empleadoId: string,
  opts?: {
    baseUrl?: string;
    semaforo?: string | null;
    perfilColor?: string | null;
  },
): Promise<{ enviado: boolean; motivo?: string }> {
  try {
    if (!getTelegramBotToken()) return { enviado: false, motivo: 'sin TELEGRAM_BOT_TOKEN' };
    const chatId = resolverChatRrhhTelegram();
    if (!chatId) return { enviado: false, motivo: 'sin chat destino' };

    const { data: emp } = await admin
      .from('ci_empleados')
      .select(
        'id,nombre_completo,cedula,celular,telefono,cargo_codigo,cargo_nombre,proyecto_modulo_id,semaforo,semaforo_riesgo,perfil_color',
      )
      .eq('id', empleadoId)
      .maybeSingle();
    if (!emp) return { enviado: false, motivo: 'expediente no encontrado' };
    const e = emp as Record<string, unknown>;

    let obra = '';
    const proyectoId = String(e.proyecto_modulo_id ?? '').trim();
    if (proyectoId) {
      const { data: pr } = await admin.from('ci_proyectos').select('nombre').eq('id', proyectoId).maybeSingle();
      obra = String((pr as { nombre?: string } | null)?.nombre ?? '').trim();
    }

    const oficio = [String(e.cargo_codigo ?? '').replace('.', ','), String(e.cargo_nombre ?? '')]
      .filter((x) => x.trim())
      .join(' ');
    const semaforo =
      String(opts?.semaforo ?? '').trim() ||
      String(e.semaforo_riesgo ?? '').trim() ||
      String(e.semaforo ?? '').trim();
    const perfilColor = String(opts?.perfilColor ?? e.perfil_color ?? '').trim();

    const texto = textoAvisoEvaluacionObrero({
      nombre: String(e.nombre_completo ?? '').trim(),
      cedula: String(e.cedula ?? '').trim(),
      oficio,
      obra,
      telefono: String(e.celular ?? e.telefono ?? '').trim(),
      semaforo,
      perfilColor,
      baseUrl: baseUrlRrhh(opts?.baseUrl),
    });

    await sendTelegramMessage(chatId, texto, { parse_mode: 'HTML' });
    return { enviado: true };
  } catch (err) {
    console.warn('[aviso evaluación obrero]', err instanceof Error ? err.message : err);
    return { enviado: false, motivo: 'error al enviar' };
  }
}
