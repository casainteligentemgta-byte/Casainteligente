import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getTelegramAllowedChatIds, sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  extraerVencimientosEntidad,
  textoDiasRestantes,
  type PermisologiaVencimientoItem,
} from '@/lib/legal/permisologiaVencimientos';

export type PermisologiaNotifyResult = {
  revisadas: number;
  alertas: number;
  enviadas: number;
  omitidas: number;
  chatId: string | null;
  errors: string[];
};

/** Destino: TELEGRAM_LEGAL_CHAT_ID → TELEGRAM_CHAT_ID → whitelist única. */
export function resolverChatLegalTelegram(): { chatId: string | null; fuente: string | null } {
  const legal = process.env.TELEGRAM_LEGAL_CHAT_ID?.trim();
  if (legal) return { chatId: legal, fuente: 'TELEGRAM_LEGAL_CHAT_ID' };
  const ceo = process.env.TELEGRAM_CHAT_ID?.trim();
  if (ceo) return { chatId: ceo, fuente: 'TELEGRAM_CHAT_ID' };
  const allowed = Array.from(getTelegramAllowedChatIds());
  if (allowed.length === 1) {
    return { chatId: allowed[0]!, fuente: 'TELEGRAM_ALLOWED_CHAT_IDS' };
  }
  return { chatId: null, fuente: null };
}

function hoyCaracasIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatAlertaHtml(item: PermisologiaVencimientoItem): string {
  const rif = item.entidad_rif?.trim() ? ` · ${item.entidad_rif.trim()}` : '';
  const urgencia =
    item.estado === 'vencido'
      ? '🔴'
      : item.estado === 'hoy'
        ? '🟠'
        : '🟡';
  return (
    `${urgencia} <b>${item.etiqueta}</b> — ${textoDiasRestantes(item.dias_restantes)}\n` +
    `Patrono: <b>${escapeHtml(item.entidad_nombre)}</b>${escapeHtml(rif)}\n` +
    `Fecha: <code>${item.fecha_vence}</code>`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Revisa `ci_entidades.permisologia` y notifica por Telegram al Departamento Legal
 * los vencimientos en ventana ≤ 30 días (dedupe diario por campo / umbral).
 */
export async function notificarPermisologiaTelegram(): Promise<PermisologiaNotifyResult> {
  const result: PermisologiaNotifyResult = {
    revisadas: 0,
    alertas: 0,
    enviadas: 0,
    omitidas: 0,
    chatId: null,
    errors: [],
  };

  const { chatId, fuente } = resolverChatLegalTelegram();
  result.chatId = chatId;
  if (!chatId) {
    result.errors.push(
      'Sin chat destino: configure TELEGRAM_LEGAL_CHAT_ID o TELEGRAM_CHAT_ID',
    );
    return result;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ci_entidades')
    .select('id,nombre,rif,permisologia')
    .not('permisologia', 'is', null);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const filas = data ?? [];
  result.revisadas = filas.length;

  const pendientes: PermisologiaVencimientoItem[] = [];
  for (const row of filas) {
    const items = extraerVencimientosEntidad({
      id: String(row.id),
      nombre: String(row.nombre ?? 'Entidad'),
      rif: row.rif == null ? null : String(row.rif),
      permisologia: row.permisologia,
    });
    pendientes.push(...items);
  }
  result.alertas = pendientes.length;
  if (pendientes.length === 0) return result;

  const hoy = hoyCaracasIso();
  const aEnviar: PermisologiaVencimientoItem[] = [];
  const idsLog: string[] = [];

  for (const item of pendientes) {
    const { data: logRow, error: insErr } = await supabase
      .from('ci_permisologia_alertas_log')
      .insert({
        entidad_id: item.entidad_id,
        campo: item.campo,
        alert_days: item.alert_days,
        sent_on: hoy,
        canal: 'telegram',
        mensaje: `${item.etiqueta}: ${textoDiasRestantes(item.dias_restantes)} (${item.fecha_vence})`,
      })
      .select('id')
      .maybeSingle();

    if (insErr) {
      // unique violation → ya notificado hoy
      if (insErr.code === '23505' || /duplicate|unique/i.test(insErr.message ?? '')) {
        result.omitidas += 1;
        continue;
      }
      result.errors.push(insErr.message);
      continue;
    }
    aEnviar.push(item);
    if (logRow?.id) idsLog.push(String(logRow.id));
  }

  if (aEnviar.length === 0) return result;

  const cuerpo = aEnviar.map(formatAlertaHtml).join('\n\n');
  const texto =
    `⚖️ <b>Departamento Legal — Permisología</b>\n` +
    `<i>Canal: ${escapeHtml(fuente ?? 'telegram')}</i>\n\n` +
    `${cuerpo}\n\n` +
    `<i>Revisa en Casa Inteligente → Legal → Cumplimiento</i>`;

  try {
    await sendTelegramMessage(chatId, texto, { parse_mode: 'HTML' });
    result.enviadas = aEnviar.length;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    if (idsLog.length) {
      await supabase.from('ci_permisologia_alertas_log').delete().in('id', idsLog);
    }
  }

  return result;
}
