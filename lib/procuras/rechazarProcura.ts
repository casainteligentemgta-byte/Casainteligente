import type { SupabaseClient } from '@supabase/supabase-js';
import {
  metadatosAuditoriaSupervisor,
  motivoAuditoriaSupervisor,
  nombreActorSupervisorFormal,
  type ContextoAuditoriaSupervisor,
} from '@/lib/procuras/auditoriaSupervisorProcura';
import { rpcProcesarProcurasLote } from '@/lib/procuras/rpcProcesarProcurasLote';
import { actualizarTicketProcuraSolicitante } from '@/lib/procuras/ticketProcuraSolicitanteTelegram';

export const MIN_MOTIVO_RECHAZO_PROCURA = 3;

export type RechazarProcuraParams = {
  procuraId: string;
  motivo: string;
  aprobadorNombre: string;
  auditoriaSupervisor?: ContextoAuditoriaSupervisor | null;
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
          ? 'La procura espera revisión de fondos del Contador.'
          : 'La procura ya fue resuelta.',
    };
  }

  const motivoFinal =
    motivo.length > 2000 ? motivo.slice(0, 2000) : motivo;

  const motivoRpc = params.auditoriaSupervisor
    ? motivoAuditoriaSupervisor(motivoFinal, params.auditoriaSupervisor)
    : motivoFinal;

  let data: Awaited<ReturnType<typeof rpcProcesarProcurasLote>> | null = null;
  let error: Error | null = null;
  try {
    data = await rpcProcesarProcurasLote(supabase, {
      p_ids: [procuraId],
      p_nuevo_estado: 'rechazada',
      p_motivo: motivoRpc,
      ...(params.auditoriaSupervisor
        ? {
            p_metadatos: metadatosAuditoriaSupervisor(params.auditoriaSupervisor),
            p_usuario: nombreActorSupervisorFormal(params.auditoriaSupervisor.actorNombre),
          }
        : {}),
    });
  } catch (e) {
    error = e instanceof Error ? e : new Error('Error al rechazar procura');
  }

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

  const solicitanteNotificado = await actualizarTicketProcuraSolicitante(supabase, procuraId);

  return {
    ok: true,
    ticket: filas[0]?.ticket ?? row.ticket,
    estado: filas[0]?.nuevo_est ?? 'rechazada',
    solicitanteNotificado,
  };
}
