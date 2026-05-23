import type { SupabaseClient } from '@supabase/supabase-js';

export type TelegramContexto =
  | 'menu'
  | 'factura'
  | 'obra'
  | 'gasto_obra'
  | 'esperando_audio_bitacora';

export type TelegramEstado = {
  chat_id: string;
  contexto: TelegramContexto;
  proyecto_id: string | null;
  pending_factura_id: string | null;
  metadata: Record<string, unknown>;
  updated_at?: string;
};

const CONTEXTOS: TelegramContexto[] = ['menu', 'factura', 'obra', 'gasto_obra'];

export function isTelegramContexto(v: string): v is TelegramContexto {
  return (CONTEXTOS as string[]).includes(v);
}

export async function getTelegramEstado(
  supabase: SupabaseClient,
  chatId: string,
): Promise<TelegramEstado> {
  const { data, error } = await supabase
    .from('ci_telegram_estados')
    .select('chat_id, contexto, proyecto_id, pending_factura_id, metadata, updated_at')
    .eq('chat_id', chatId)
    .maybeSingle();

  if (error?.message?.includes('does not exist') || error?.code === '42P01') {
    throw new Error(
      'Tabla ci_telegram_estados no existe. Ejecuta npm run db:apply-lulo-telegram (migración 160).',
    );
  }
  if (error) throw new Error(error.message);

  if (data) {
    return {
      chat_id: data.chat_id,
      contexto: isTelegramContexto(data.contexto) ? data.contexto : 'menu',
      proyecto_id: data.proyecto_id ?? null,
      pending_factura_id: data.pending_factura_id ?? null,
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      updated_at: data.updated_at ?? undefined,
    };
  }

  const nuevo: TelegramEstado = {
    chat_id: chatId,
    contexto: 'menu',
    proyecto_id: null,
    pending_factura_id: null,
    metadata: {},
  };
  await upsertTelegramEstado(supabase, nuevo);
  return nuevo;
}

export async function upsertTelegramEstado(
  supabase: SupabaseClient,
  estado: TelegramEstado,
): Promise<void> {
  const { error } = await supabase.from('ci_telegram_estados').upsert(
    {
      chat_id: estado.chat_id,
      contexto: estado.contexto,
      proyecto_id: estado.proyecto_id,
      pending_factura_id: estado.pending_factura_id,
      metadata: estado.metadata,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chat_id' },
  );
  if (error) throw new Error(error.message);
}

export async function setTelegramContexto(
  supabase: SupabaseClient,
  chatId: string,
  patch: Partial<
    Pick<TelegramEstado, 'contexto' | 'proyecto_id' | 'pending_factura_id' | 'metadata'>
  >,
): Promise<TelegramEstado> {
  const actual = await getTelegramEstado(supabase, chatId);
  const next: TelegramEstado = {
    ...actual,
    ...patch,
    metadata: patch.metadata ? { ...actual.metadata, ...patch.metadata } : actual.metadata,
  };
  await upsertTelegramEstado(supabase, next);
  return next;
}

export function etiquetaContexto(ctx: TelegramContexto): string {
  switch (ctx) {
    case 'factura':
      return 'Factura de compra';
    case 'obra':
      return 'Fotos / evidencia de obra';
    case 'gasto_obra':
      return 'Gasto de obra (comprobante)';
    case 'esperando_audio_bitacora':
      return 'Bitácora de obra (nota de voz)';
    default:
      return 'Menú principal';
  }
}
