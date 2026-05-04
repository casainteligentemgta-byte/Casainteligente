import { cumpleReglaParadojaCritica } from '@/lib/alerts/reglaParadojaCandidatoCritico';

export type FilaEmpleadoParadoja = {
  id: string;
  nombre_completo?: string | null;
  cargo?: string | null;
  rol_buscado?: string | null;
  anos_experiencia?: number | null;
  semaforo_riesgo?: string | null;
  puntuacion_logica?: number | null;
  perfil_color?: string | null;
  motivo_semaforo_riesgo?: string | null;
};

function baseUrlApp(): string {
  const u = (process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/$/, '');
  return u || '';
}

export function construirMensajeTelegramParadojaCeo(row: FilaEmpleadoParadoja): string {
  const nombre = (row.nombre_completo ?? 'Sin nombre').trim();
  const cargo = (row.rol_buscado ?? row.cargo ?? '—').trim() || '—';
  const años = row.anos_experiencia ?? '—';
  const motivoBase =
    (row.motivo_semaforo_riesgo ?? '').trim() ||
    `Puntuación lógica ${row.puntuacion_logica ?? '—'}% · Perfil ${row.perfil_color ?? '—'}`;
  const base = baseUrlApp();
  const accion = base
    ? `${base}/reclutamiento/dashboard?empleado_id=${encodeURIComponent(row.id)}`
    : '(Configure NEXT_PUBLIC_BASE_URL para enlace directo)';

  return (
    `🚨 <b>ALERTA DE EXCEPCIÓN — CASA INTELIGENTE</b>\n\n` +
    `👷 <b>Candidato:</b> ${escapeHtml(nombre)}\n` +
    `🛠 <b>Cargo solicitado:</b> ${escapeHtml(cargo)}\n` +
    `📊 <b>Experiencia:</b> ${años} años\n` +
    `⚠️ <b>Riesgo:</b> ALTO (semáforo de riesgo <code>rojo</code>)\n` +
    `📋 <b>Motivo:</b> ${escapeHtml(motivoBase)}\n\n` +
    `🔗 <b>Acción:</b> revisión manual en el dashboard:\n${escapeHtml(accion)}\n\n` +
    `<i>Regla de Paradoja: experiencia ≥ 10 años + riesgo rojo.</i>`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function enviarTelegramHtml(text: string): Promise<{ ok: boolean; status: number; body: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    return { ok: false, status: 503, body: 'TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados' };
  }
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

/** Evalúa paradoja y, si aplica, envía Telegram. */
export async function evaluarYEnviarParadojaSiCorresponde(
  row: FilaEmpleadoParadoja,
): Promise<{ enviado: boolean; razon: string }> {
  if (
    !cumpleReglaParadojaCritica({
      semaforo_riesgo: row.semaforo_riesgo,
      anos_experiencia: row.anos_experiencia,
    })
  ) {
    return { enviado: false, razon: 'no_cumple_regla_paradoja' };
  }
  const text = construirMensajeTelegramParadojaCeo(row);
  const r = await enviarTelegramHtml(text);
  if (!r.ok) {
    return { enviado: false, razon: `telegram_error_${r.status}: ${r.body.slice(0, 200)}` };
  }
  return { enviado: true, razon: 'telegram_ok' };
}
