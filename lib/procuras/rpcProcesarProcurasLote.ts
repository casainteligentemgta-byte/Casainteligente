import type { SupabaseClient } from '@supabase/supabase-js';

export type RpcProcesarProcurasLoteFila = {
  procura_id: string;
  ticket: string;
  material_txt: string;
  nuevo_est: string;
  telegram_id: string | null;
};

export type RpcProcesarProcurasLoteParams = {
  p_ids: string[];
  p_nuevo_estado: string;
  p_motivo: string;
  p_metadatos?: Record<string, unknown>;
  p_usuario?: string | null;
};

const RPC_NAME = 'procesar_procuras_lote' as 'ci_registrar_ingreso_manual_campo';

function esErrorFirmaRpcProcura(msg: string): boolean {
  return /could not find the function.*procesar_procuras_lote|schema cache|PGRST202/i.test(
    msg,
  );
}

async function enriquecerUltimoHistorialProcura(
  supabase: SupabaseClient,
  procuraId: string,
  nuevoEstado: string,
  patch: { metadatos?: Record<string, unknown>; usuario?: string | null },
): Promise<void> {
  const { data } = await supabase
    .from('ci_procura_estados_historial')
    .select('id')
    .eq('procura_id', procuraId.trim())
    .eq('estado_nuevo', nuevoEstado)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.id) return;

  const update: Record<string, unknown> = {};
  if (patch.metadatos && Object.keys(patch.metadatos).length > 0) {
    update.metadatos = patch.metadatos;
  }
  if (patch.usuario?.trim()) {
    update.usuario = patch.usuario.trim().slice(0, 150);
  }
  if (!Object.keys(update).length) return;

  const { error } = await supabase
    .from('ci_procura_estados_historial')
    .update(update as never)
    .eq('id', data.id);

  if (error && !/metadatos|usuario|column|42P01|schema cache/i.test(error.message)) {
    console.warn('[rpcProcesarProcurasLote] patch historial', error.message);
  }
}

/**
 * RPC procesar_procuras_lote con compatibilidad:
 * - Prod con migración 259: firma (uuid[], text, text, jsonb, text)
 * - Prod legado: firma (uuid[], text, text) — sin p_metadatos/p_usuario en la llamada
 */
export async function rpcProcesarProcurasLote(
  supabase: SupabaseClient,
  params: RpcProcesarProcurasLoteParams,
): Promise<RpcProcesarProcurasLoteFila[]> {
  const base = {
    p_ids: params.p_ids,
    p_nuevo_estado: params.p_nuevo_estado,
    p_motivo: params.p_motivo,
  };

  const tieneMetadatos =
    params.p_metadatos != null && Object.keys(params.p_metadatos).length > 0;
  const tieneUsuario = Boolean(params.p_usuario?.trim());

  if (tieneMetadatos || tieneUsuario) {
    const { data, error } = await supabase.rpc(RPC_NAME, {
      ...base,
      p_metadatos: params.p_metadatos ?? {},
      p_usuario: params.p_usuario?.trim() || null,
    } as never);

    if (!error) return (data ?? []) as RpcProcesarProcurasLoteFila[];
    if (!esErrorFirmaRpcProcura(error.message)) throw new Error(error.message);

    const { data: dataLegacy, error: errorLegacy } = await supabase.rpc(
      RPC_NAME,
      base as never,
    );
    if (errorLegacy) throw new Error(errorLegacy.message);

    for (const id of params.p_ids) {
      await enriquecerUltimoHistorialProcura(supabase, id, params.p_nuevo_estado, {
        metadatos: params.p_metadatos,
        usuario: params.p_usuario,
      });
    }

    return (dataLegacy ?? []) as RpcProcesarProcurasLoteFila[];
  }

  const { data, error } = await supabase.rpc(RPC_NAME, base as never);
  if (error) throw new Error(error.message);
  return (data ?? []) as RpcProcesarProcurasLoteFila[];
}
