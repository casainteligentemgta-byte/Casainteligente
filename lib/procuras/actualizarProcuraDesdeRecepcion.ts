import type { SupabaseClient } from '@supabase/supabase-js';
import { notificarProcurasTelegram } from '@/lib/procuras/notificarProcuraTelegram';

type RpcProcuraRecepcionRow = {
  procura_id: string;
  ticket: string;
  material_txt: string;
  estado_anterior: string;
  estado_nuevo: string;
  cantidad_solicitada: number;
  cantidad_recibida: number;
  actualizado: boolean;
  telegram_id: string | null;
};

export type ResultadoProcuraRecepcion = {
  ok: boolean;
  actualizado: boolean;
  procuraId?: string;
  ticket?: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  cantidadSolicitada?: number;
  cantidadRecibida?: number;
  telegram?: { enviados: number; omitidos: number };
  error?: string;
};

/**
 * D-04: recalcula SUM(cantidad) de recepciones campo vinculadas y actualiza recibida/recibida_parcial.
 */
export async function actualizarProcuraDesdeRecepcionCampo(
  supabase: SupabaseClient,
  params: {
    recepcionId?: string | null;
    procuraId?: string | null;
    motivo?: string | null;
    notificar?: boolean;
  },
): Promise<ResultadoProcuraRecepcion> {
  const recepcionId = params.recepcionId?.trim() || null;
  const procuraId = params.procuraId?.trim() || null;

  if (!recepcionId && !procuraId) {
    return { ok: true, actualizado: false };
  }

  const { data, error } = await supabase.rpc(
    'ci_procura_actualizar_recepcion' as 'ci_registrar_ingreso_manual_campo',
    {
      p_recepcion_id: recepcionId,
      p_procura_id: procuraId,
      p_motivo: params.motivo?.trim() || null,
    } as never,
  );

  if (error) {
    const msg = error.message ?? 'Error al actualizar procura desde recepción';
    if (/ci_procura_actualizar_recepcion|procura_id|does not exist/i.test(msg)) {
      return {
        ok: false,
        actualizado: false,
        error: 'RPC ci_procura_actualizar_recepcion no disponible. Aplique migración 235.',
      };
    }
    return { ok: false, actualizado: false, error: msg };
  }

  const row = ((data ?? []) as RpcProcuraRecepcionRow[])[0];
  if (!row?.procura_id) {
    return { ok: true, actualizado: false };
  }

  const result: ResultadoProcuraRecepcion = {
    ok: true,
    actualizado: Boolean(row.actualizado),
    procuraId: String(row.procura_id),
    ticket: row.ticket,
    estadoAnterior: row.estado_anterior,
    estadoNuevo: row.estado_nuevo,
    cantidadSolicitada: Number(row.cantidad_solicitada),
    cantidadRecibida: Number(row.cantidad_recibida),
  };

  if (params.notificar !== false && row.actualizado && row.telegram_id) {
    result.telegram = await notificarProcurasTelegram(
      [
        {
          ticket: row.ticket,
          material_txt: row.material_txt,
          nuevo_est: row.estado_nuevo,
          telegram_id: row.telegram_id,
        },
      ],
      params.motivo?.trim() ||
        `Recibido ${row.cantidad_recibida} / ${row.cantidad_solicitada}`,
    );
  }

  return result;
}
