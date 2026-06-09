import type { SupabaseClient } from '@supabase/supabase-js';

export type TelegramContexto =
  | 'menu'
  | 'factura'
  | 'obra'
  | 'gasto_obra'
  | 'esperando_audio_bitacora'
  | 'entrada_obra'
  | 'salida_obra'
  | 'avance_campo'
  | 'avance_campo_cantidad'
  | 'memoria_obra'
  | 'memoria_obra_foto'
  | 'depositario_recepcion'
  | 'traspaso_inventario'
  | 'consulta_stock'
  | 'procura_solicitud';

export type TelegramEstado = {
  chat_id: string;
  contexto: TelegramContexto;
  proyecto_id: string | null;
  pending_factura_id: string | null;
  metadata: Record<string, unknown>;
  updated_at?: string;
};

const CONTEXTOS: TelegramContexto[] = [
  'menu',
  'factura',
  'obra',
  'gasto_obra',
  'esperando_audio_bitacora',
  'entrada_obra',
  'salida_obra',
  'avance_campo',
  'avance_campo_cantidad',
  'memoria_obra',
  'memoria_obra_foto',
  'depositario_recepcion',
  'traspaso_inventario',
  'consulta_stock',
  'procura_solicitud',
];

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
  > & { reemplazarMetadata?: boolean },
): Promise<TelegramEstado> {
  const actual = await getTelegramEstado(supabase, chatId);
  const { reemplazarMetadata, ...restPatch } = patch;
  let metadata = actual.metadata;
  if (restPatch.metadata !== undefined) {
    if (reemplazarMetadata) {
      metadata = restPatch.metadata;
    } else if (Object.keys(restPatch.metadata).length === 0) {
      metadata = {};
    } else {
      metadata = { ...actual.metadata, ...restPatch.metadata };
    }
  }
  const next: TelegramEstado = {
    ...actual,
    ...restPatch,
    metadata,
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
    case 'entrada_obra':
      return 'Ingreso manual a almacén';
    case 'salida_obra':
      return 'Salida de material de obra';
    case 'avance_campo':
      return 'Avance diario de campo';
    case 'avance_campo_cantidad':
      return 'Cantidad ejecutada (avance)';
    case 'memoria_obra':
      return 'Memoria descriptiva (elegir partida)';
    case 'memoria_obra_foto':
      return 'Memoria descriptiva (foto de avance)';
    case 'depositario_recepcion':
      return 'Recepción física (conteo depositario)';
    case 'traspaso_inventario':
      return 'Traspaso / préstamo entre almacenes';
    case 'consulta_stock':
      return 'Consulta de stock por almacén';
    case 'procura_solicitud':
      return 'Solicitud de procura (abastecimiento)';
    default:
      return 'Menú principal';
  }
}
