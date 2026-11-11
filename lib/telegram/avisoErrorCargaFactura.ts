import type { SupabaseClient } from '@supabase/supabase-js';

export type TipoAvisoErrorCarga = 'general' | 'ilegible' | 'falta_parte';

export const AVISO_FACTURA_NO_CARGADA = '⚠️ Factura no cargada. Reenvía la foto.';

export const AVISO_FOTO_ILEGIBLE =
  '⚠️ Foto ilegible. Tómala de nuevo completa y reenvíala.\n' +
  'Si es una tira larga, envíala como Archivo o en varias fotos juntas.';

export const AVISO_FALTA_PARTE = '⚠️ Falta una parte. Reenvía la foto del final.';

export function textoAvisoErrorCarga(tipo: TipoAvisoErrorCarga): string {
  if (tipo === 'ilegible') return AVISO_FOTO_ILEGIBLE;
  if (tipo === 'falta_parte') return AVISO_FALTA_PARTE;
  return AVISO_FACTURA_NO_CARGADA;
}

const ILEGIBLE_RE =
  /no devolvió datos|no se pudieron leer datos|formato no válido|foto más nítida|ilegible|sin texto|documento\.|pdf con texto/i;

export function clasificarErrorCargaFactura(err: unknown): TipoAvisoErrorCarga {
  const raw =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : String(err ?? '');
  if (/falta una parte|totales no cuadran|sin total|album incompleto|álbum incompleto/i.test(raw)) {
    return 'falta_parte';
  }
  if (ILEGIBLE_RE.test(raw)) return 'ilegible';
  return 'general';
}

export function esErrorValidacionSinAvisoCargador(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  return /seleccione |propietario|fecha anómal|fecha anomal|fecha de factura no permitida|duplicad|aún no está confirmada|confirmación cancelada/i.test(
    raw,
  );
}

async function marcarAvisoErrorEnviado(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({ aviso_error_enviado_at: new Date().toISOString() })
    .eq('id', pendingId)
    .is('aviso_error_enviado_at', null)
    .select('id')
    .maybeSingle();
  if (error && /aviso_error_enviado_at|PGRST204|schema cache/i.test(error.message)) {
    return true;
  }
  if (error) {
    console.warn('[avisarErrorCargaFacturaCanal] marcar', error.message);
    return true;
  }
  return Boolean(data?.id);
}

export async function resetearAvisoErrorCargaFactura(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({ aviso_error_enviado_at: null, updated_at: new Date().toISOString() })
    .eq('id', pendingId);
  if (error && !/aviso_error_enviado_at|PGRST204|schema cache/i.test(error.message)) {
    console.warn('[avisarErrorCargaFacturaCanal] reset', error.message);
  }
}

/**
 * Aviso corto SOLO al chat que cargó la factura. Nunca lanza: un fallo de Telegram
 * no debe romper el flujo ni tapar el error original. Dedup por pendingId.
 */
export async function avisarErrorCargaFacturaCanal(params: {
  pendingId?: string | null;
  chatId?: string | number | null;
  tipo?: TipoAvisoErrorCarga;
  errorOriginal?: unknown;
  supabase?: SupabaseClient;
  /** El progreso de Telegram ya mostró el aviso; solo se marca para no duplicar. */
  yaMostrado?: boolean;
}): Promise<void> {
  try {
    const tipo =
      params.tipo ??
      (params.errorOriginal != null
        ? clasificarErrorCargaFactura(params.errorOriginal)
        : 'general');
    const texto = textoAvisoErrorCarga(tipo);

    let chatId = params.chatId != null ? String(params.chatId).trim() : '';
    let supabase = params.supabase ?? null;

    if (!supabase && params.pendingId) {
      const { telegramSupabaseAdmin } = await import('@/lib/telegram/supabaseAdmin');
      const admin = telegramSupabaseAdmin();
      if (admin.ok) supabase = admin.client;
    }

    if (supabase && params.pendingId) {
      const sel = await supabase
        .from('ci_facturas_canal_pendientes')
        .select('chat_id, canal, aviso_error_enviado_at')
        .eq('id', params.pendingId)
        .maybeSingle();
      const row = (!sel.error ? sel.data : null) as {
        chat_id?: string | null;
        canal?: string | null;
        aviso_error_enviado_at?: string | null;
      } | null;
      if (sel.error && !/aviso_error_enviado_at|PGRST204|schema cache/i.test(sel.error.message)) {
        console.warn('[avisarErrorCargaFacturaCanal] lookup', sel.error.message);
      }
      const canal = String(row?.canal ?? 'telegram').toLowerCase();
      if (canal && canal !== 'telegram') return;
      if (!chatId) chatId = String(row?.chat_id ?? '').trim();
      if (row?.aviso_error_enviado_at) return;
      const claimed = await marcarAvisoErrorEnviado(supabase, params.pendingId);
      if (!claimed) return;
    }

    if (params.yaMostrado) return;
    if (!chatId) return;

    const { sendTelegramMessage } = await import('@/lib/telegram/botApi');
    await sendTelegramMessage(chatId, texto, { parse_mode: 'HTML' });
  } catch (e) {
    console.warn(
      '[avisarErrorCargaFacturaCanal]',
      e instanceof Error ? e.message : e,
    );
  }
}

export function avisarErrorCargaFacturaCanalAsync(
  params: Parameters<typeof avisarErrorCargaFacturaCanal>[0],
): void {
  void avisarErrorCargaFacturaCanal(params).catch((e) => {
    console.warn('[avisarErrorCargaFacturaCanal]', e instanceof Error ? e.message : e);
  });
}
