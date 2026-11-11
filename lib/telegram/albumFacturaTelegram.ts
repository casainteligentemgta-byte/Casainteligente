import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParteDocumentoCanal } from '@/lib/canal/documentPartsPendiente';
import { parseDocumentParts } from '@/lib/canal/documentPartsPendiente';

export const ALBUM_DEBOUNCE_MS = 3500;

function esUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    String((err as { code?: string }).code) === '23505'
  );
}

export type ReservaAlbumFactura =
  | { ok: true; pendingId: string; nPartes: number; nueva: boolean }
  | { ok: false; error: string };

export async function reservarParteAlbumFactura(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    chatLabel: string;
    mediaGroupId: string;
    parte: ParteDocumentoCanal;
    telegramMessageId?: string | null;
  },
): Promise<ReservaAlbumFactura> {
  const gid = params.mediaGroupId.trim();
  if (!gid) return { ok: false, error: 'Álbum sin media_group_id' };

  const parte: ParteDocumentoCanal = {
    ...params.parte,
    telegram_message_id:
      params.parte.telegram_message_id || String(params.telegramMessageId ?? '').trim() || undefined,
  };

  const existente = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id, document_parts, estado')
    .eq('telegram_media_group_id', gid)
    .maybeSingle();

  if (existente.data?.id) {
    return appendParteAlbum(supabase, {
      pendingId: String(existente.data.id),
      mediaGroupId: gid,
      parte,
      partesPrevias: existente.data.document_parts,
    });
  }

  const insert = await supabase
    .from('ci_facturas_canal_pendientes')
    .insert({
      canal: 'telegram',
      chat_id: params.chatId,
      chat_label: params.chatLabel,
      estado: 'recibido',
      telegram_message_id: String(params.telegramMessageId ?? '').trim() || null,
      telegram_media_group_id: gid,
      document_parts: [parte],
      document_storage_path: parte.storage_path,
      document_file_name: parte.file_name,
      document_mime_type: parte.mime_type,
      album_last_part_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (!insert.error && insert.data?.id) {
    return { ok: true, pendingId: String(insert.data.id), nPartes: 1, nueva: true };
  }

  if (esUniqueViolation(insert.error)) {
    const row = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('id, document_parts')
      .eq('telegram_media_group_id', gid)
      .maybeSingle();
    if (row.data?.id) {
      return appendParteAlbum(supabase, {
        pendingId: String(row.data.id),
        mediaGroupId: gid,
        parte,
        partesPrevias: row.data.document_parts,
      });
    }
  }

  return {
    ok: false,
    error: insert.error?.message ?? 'No se pudo reservar el álbum de la factura',
  };
}

async function appendParteAlbum(
  supabase: SupabaseClient,
  params: {
    pendingId: string;
    mediaGroupId: string;
    parte: ParteDocumentoCanal;
    partesPrevias: unknown;
  },
): Promise<ReservaAlbumFactura> {
  const rpc = await supabase.rpc('ci_agregar_parte_album_factura', {
    p_media_group_id: params.mediaGroupId,
    p_parte: params.parte,
  });

  if (!rpc.error && rpc.data) {
    const { data: row } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('id, document_parts')
      .eq('id', String(rpc.data))
      .maybeSingle();
    const n = parseDocumentParts(row?.document_parts).length;
    return { ok: true, pendingId: String(rpc.data), nPartes: n || 1, nueva: false };
  }

  const prev = parseDocumentParts(params.partesPrevias);
  const dup = prev.some(
    (p) =>
      (params.parte.file_id && p.file_id === params.parte.file_id) ||
      (params.parte.telegram_message_id &&
        p.telegram_message_id === params.parte.telegram_message_id),
  );
  const next = dup ? prev : [...prev, params.parte];
  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      document_parts: next,
      album_last_part_at: new Date().toISOString(),
      document_storage_path: next[0]?.storage_path ?? params.parte.storage_path,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.pendingId)
    .in('estado', ['recibido', 'pendiente', 'error']);

  if (error) return { ok: false, error: error.message };
  return { ok: true, pendingId: params.pendingId, nPartes: next.length, nueva: false };
}

export type ReclamoAlbum = 'claimed' | 'too_soon' | 'busy' | 'not_found';

export async function esperarYReclamarAlbumFactura(params: {
  supabase: SupabaseClient;
  pendingId: string;
  debounceMs?: number;
  dormir?: (ms: number) => Promise<void>;
  ahora?: () => number;
}): Promise<ReclamoAlbum> {
  const espera = params.debounceMs ?? ALBUM_DEBOUNCE_MS;
  const dormir =
    params.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const ahora = params.ahora ?? Date.now;

  await dormir(espera);

  const { data: row, error } = await params.supabase
    .from('ci_facturas_canal_pendientes')
    .select('id, estado, album_last_part_at')
    .eq('id', params.pendingId)
    .maybeSingle();

  if (error || !row) return 'not_found';
  const estado = String(row.estado ?? '');
  if (estado === 'procesando' || estado === 'extraido' || estado === 'confirmado') return 'busy';
  if (!['recibido', 'pendiente', 'error'].includes(estado)) return 'busy';

  const last = Date.parse(String(row.album_last_part_at ?? ''));
  if (Number.isFinite(last) && ahora() - last < espera) return 'too_soon';

  const { data: claimed } = await params.supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'procesando',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.pendingId)
    .in('estado', ['recibido', 'pendiente', 'error'])
    .select('id')
    .maybeSingle();

  return claimed?.id ? 'claimed' : 'busy';
}
