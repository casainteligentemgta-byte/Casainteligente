import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanalFactura } from '@/lib/canal/processInvoiceFromCanal';

export type ReservaFacturaCanalResult =
  | { ok: true; duplicate: false; pendingId: string }
  | { ok: true; duplicate: true; pendingId: string }
  | { ok: false; error: string };

function esUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    String((err as { code?: string }).code) === '23505'
  );
}

/** Pre-registro idempotente antes de OCR/Gemini (corta reintentos de Telegram). */
export async function reservarFacturaCanalTelegram(
  supabase: SupabaseClient,
  params: {
    canal: CanalFactura;
    chatId: string;
    chatLabel: string;
    telegramMessageId?: string | null;
  },
): Promise<ReservaFacturaCanalResult> {
  const messageId = String(params.telegramMessageId ?? '').trim() || null;

  const { data, error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .insert({
      canal: params.canal,
      chat_id: params.chatId,
      chat_label: params.chatLabel,
      estado: 'recibido',
      telegram_message_id: messageId,
    })
    .select('id')
    .single();

  if (!error && data?.id) {
    return { ok: true, duplicate: false, pendingId: String(data.id) };
  }

  if (esUniqueViolation(error) && messageId) {
    const { data: existente } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('id')
      .eq('telegram_message_id', messageId)
      .maybeSingle();
    if (existente?.id) {
      return { ok: true, duplicate: true, pendingId: String(existente.id) };
    }
  }

  return {
    ok: false,
    error: error instanceof Error ? error.message : 'No se pudo reservar la factura',
  };
}

export type ReclamoProcesamientoFactura = 'claimed' | 'already_processing' | 'already_done' | 'not_found';

/** Bloqueo optimista: un solo worker procesa OCR por pendingId. */
export async function reclamarProcesamientoFacturaCanal(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<ReclamoProcesamientoFactura> {
  const { data: row, error: selErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('estado')
    .eq('id', pendingId)
    .maybeSingle();

  if (selErr || !row) return 'not_found';
  const estado = String(row.estado ?? '');
  if (estado === 'extraido' || estado === 'confirmado') return 'already_done';
  if (estado === 'procesando') return 'already_processing';

  const { data: claimed, error: updErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'procesando',
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId)
    .in('estado', ['recibido', 'pendiente'])
    .select('id')
    .maybeSingle();

  if (updErr) return 'already_processing';
  return claimed?.id ? 'claimed' : 'already_processing';
}
