import type { SupabaseClient } from '@supabase/supabase-js';
import { connectPostgresFromEnv } from '@/lib/supabase/connectPostgresFromEnv';

const MSG_SIN_OCR =
  'OCR interrumpido (timeout). Reenvíe la foto con /facturas o confirme de nuevo en Telegram.';

export type LiberarFacturaCanalResult =
  | { ok: true; pendingId: string; detalle: string }
  | { ok: false; pendingId: string; reason: string };

async function notifyPgrstReloadSchema(): Promise<void> {
  let sql: Awaited<ReturnType<typeof connectPostgresFromEnv>> | null = null;
  try {
    sql = await connectPostgresFromEnv();
    await sql.unsafe(`notify pgrst, 'reload schema';`);
  } catch (e) {
    console.warn('[liberarFacturaCanalLogBot] notify pgrst:', e instanceof Error ? e.message : e);
  } finally {
    if (sql) await sql.end({ timeout: 3 });
  }
}

/**
 * Destraba factura canal: `procesando` → `recibido` (botón del bot de logs).
 */
export async function liberarFacturaCanalDesdeLogBot(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<LiberarFacturaCanalResult> {
  const id = String(pendingId ?? '').trim();
  if (!id) {
    return { ok: false, pendingId: id, reason: 'ID inválido' };
  }

  const { data: row, error: selErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id, estado, chat_label')
    .eq('id', id)
    .maybeSingle();

  if (selErr) {
    return { ok: false, pendingId: id, reason: selErr.message };
  }
  if (!row) {
    return { ok: false, pendingId: id, reason: 'Factura no encontrada' };
  }

  const estado = String(row.estado ?? '');
  if (estado !== 'procesando') {
    return {
      ok: false,
      pendingId: id,
      reason: `Estado actual: ${estado || '—'} (solo se destraba procesando)`,
    };
  }

  const { data: updated, error: updErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'recibido',
      mensaje_error: MSG_SIN_OCR,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('estado', 'procesando')
    .select('id')
    .maybeSingle();

  if (updErr) {
    return { ok: false, pendingId: id, reason: updErr.message };
  }
  if (!updated?.id) {
    return { ok: false, pendingId: id, reason: 'No se pudo actualizar (estado cambió)' };
  }

  await notifyPgrstReloadSchema();

  const detalle = `${row.chat_label ?? '—'} → recibido`;
  return { ok: true, pendingId: id, detalle };
}
