import type { SupabaseClient } from '@supabase/supabase-js';
import { notificarRechazoProcuraSolicitante } from '@/lib/procuras/notificarRechazoProcura';

export const MIN_MOTIVO_RECHAZO_PROCURA = 3;

export type RechazarProcuraParams = {
  procuraId: string;
  motivo: string;
  aprobadorNombre: string;
};

export type RechazarProcuraResult = {
  ok: boolean;
  ticket?: string;
  estado?: string;
  solicitanteNotificado?: boolean;
  error?: string;
};

export async function rechazarProcuraConMotivo(
  supabase: SupabaseClient,
  params: RechazarProcuraParams,
): Promise<RechazarProcuraResult> {
  const procuraId = params.procuraId.trim();
  const motivo = params.motivo.trim();
  const aprobadorNombre = params.aprobadorNombre.trim() || 'Project Manager';

  if (!procuraId) {
    return { ok: false, error: 'Id de procura inválido.' };
  }
  if (motivo.length < MIN_MOTIVO_RECHAZO_PROCURA) {
    return {
      ok: false,
      error: `Indique el motivo del rechazo (mínimo ${MIN_MOTIVO_RECHAZO_PROCURA} caracteres).`,
    };
  }

  const { data: procura, error: loadErr } = await supabase
    .from('ci_procuras')
    .select(
      'id,ticket,estado,material_txt,cantidad,unidad,solicitante_telegram_chat_id',
    )
    .eq('id', procuraId)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: loadErr.message };
  }
  if (!procura) {
    return { ok: false, error: 'Procura no encontrada.' };
  }

  const estadoActual = String((procura as { estado?: string }).estado ?? '').toLowerCase();
  if (estadoActual !== 'pendiente_pm') {
    return {
      ok: false,
      error:
        estadoActual === 'solicitada'
          ? 'La procura espera validación del Administrador.'
          : 'La procura ya fue resuelta.',
    };
  }

  const motivoFinal =
    motivo.length > 2000 ? motivo.slice(0, 2000) : motivo;

  const { data, error } = await supabase.rpc(
    'procesar_procuras_lote' as 'ci_registrar_ingreso_manual_campo',
    {
      p_ids: [procuraId],
      p_nuevo_estado: 'rechazada',
      p_motivo: motivoFinal,
    } as never,
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase
    .from('ci_procuras')
    .update({ motivo_rechazo: motivoFinal } as never)
    .eq('id', procuraId);

  const filas = (data ?? []) as Array<{ ticket: string; nuevo_est: string }>;
  const row = procura as {
    ticket: string;
    material_txt: string;
    cantidad: number;
    unidad: string;
    solicitante_telegram_chat_id: number | null;
  };

  const solicitanteNotificado = await notificarRechazoProcuraSolicitante(
    row,
    motivoFinal,
    aprobadorNombre,
  );

  return {
    ok: true,
    ticket: filas[0]?.ticket ?? row.ticket,
    estado: filas[0]?.nuevo_est ?? 'rechazada',
    solicitanteNotificado,
  };
}
