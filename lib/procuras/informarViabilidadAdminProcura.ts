import type { SupabaseClient } from '@supabase/supabase-js';
import type { FundamentoDisponibilidad } from '@/lib/procuras/auditoriaSupervisorProcura';
import {
  etiquetaFundamento,
  insertarAuditoriaProcuraSinTransicion,
  metadatosAuditoriaSupervisor,
  motivoAuditoriaSupervisor,
  nombreActorSupervisorFormal,
  ORIGEN_SUPERVISOR_LOG,
  type ContextoAuditoriaSupervisor,
} from '@/lib/procuras/auditoriaSupervisorProcura';
import { procesarAbastecimientoProcuraAprobada } from '@/lib/procuras/abastecimientoProcuraAprobada';
import { transicionEstadoProcuraValida } from '@/lib/procuras/procuraEstados';
import { actualizarTicketProcuraSolicitante } from '@/lib/procuras/ticketProcuraSolicitanteTelegram';
import { enviarAlertaPmTrasViabilidadAdmin } from '@/lib/procuras/viabilidadAdminProcuraTelegram';

export type InformarViabilidadAdminResult = {
  ok: boolean;
  ticket?: string;
  error?: string;
  pmsNotificados?: number;
  /** Supervisor con viabilidad sí: misma función que PM (orden de compra). */
  aprobacionDirectaSupervisor?: boolean;
  compraEmitida?: boolean;
};

export type InformadoPorRolViabilidad = 'contador' | 'supervisor';

export type InformarViabilidadAdminParams = {
  procuraId: string;
  viabilidad: 'si' | 'no';
  adminNombre: string;
  adminTelegramId?: number | null;
  /** UUID auth (web) o identificador del administrador. */
  adminUsuarioId?: string | null;
  observaciones?: string | null;
  origen?: string;
  /** Supervisor vía log bot: auditoría formal con mismo efecto que contador. */
  informadoPorRol?: InformadoPorRolViabilidad;
  /** Fundamento declarado por supervisor (financiera / física / ambas). */
  fundamento?: FundamentoDisponibilidad | null;
};

/** Metadatos estructurados de viabilidad en historial (migración 257). */
export function metadatosHistorialViabilidadAdmin(params: {
  viabilidad: 'si' | 'no';
  origen: string;
  adminUsuarioId?: string | null;
  observaciones?: string | null;
  informadoPorRol?: InformadoPorRolViabilidad;
  fundamento?: FundamentoDisponibilidad | null;
}): Record<string, string> {
  const payload: Record<string, string> = {
    viabilidad_presupuestaria: params.viabilidad,
    origen: params.origen,
  };
  if (params.informadoPorRol === 'supervisor') {
    payload.auditoria_formal = 'true';
    payload.rol_facultado = 'contador';
  }
  if (params.informadoPorRol) {
    payload.informado_por_rol = params.informadoPorRol;
  }
  if (params.fundamento) {
    payload.fundamento = params.fundamento;
  }
  if (params.adminUsuarioId?.trim()) {
    payload.admin_usuario_id = params.adminUsuarioId.trim();
  }
  const obs = params.observaciones?.trim();
  if (obs) payload.observaciones_admin = obs.slice(0, 500);
  return payload;
}

/** Texto legible en columna motivo (auditoría humana). */
export function motivoHistorialViabilidadAdmin(
  viabilidad: 'si' | 'no',
  rol: InformadoPorRolViabilidad = 'contador',
  fundamento?: FundamentoDisponibilidad | null,
): string {
  if (rol === 'supervisor') {
    if (viabilidad === 'si') {
      const fnd = fundamento ? etiquetaFundamento(fundamento) : 'disponibilidad presupuestaria';
      return `Viabilidad confirmada por supervisor (auditoría formal) — ${fnd}`;
    }
    return 'Sin viabilidad presupuestaria — supervisor (auditoría formal, canal log)';
  }
  return viabilidad === 'si'
    ? 'Viabilidad presupuestaria confirmada por contador'
    : 'Sin viabilidad presupuestaria (contador)';
}

async function insertarHistorialViabilidadAdmin(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    adminNombre: string;
    viabilidad: 'si' | 'no';
    origen: string;
    adminUsuarioId?: string | null;
    observaciones?: string | null;
    informadoPorRol?: InformadoPorRolViabilidad;
    fundamento?: FundamentoDisponibilidad | null;
  },
): Promise<string | null> {
  const rol = params.informadoPorRol ?? 'contador';
  const { error: histError } = await supabase.from('ci_procura_estados_historial').insert({
    procura_id: params.procuraId,
    estado_anterior: 'solicitada',
    estado_nuevo: 'pendiente_pm',
    usuario: params.adminNombre.slice(0, 150),
    motivo: motivoHistorialViabilidadAdmin(params.viabilidad, rol, params.fundamento),
    metadatos: metadatosHistorialViabilidadAdmin({
      viabilidad: params.viabilidad,
      origen: params.origen,
      adminUsuarioId: params.adminUsuarioId,
      observaciones: params.observaciones,
      informadoPorRol: rol,
      fundamento: params.fundamento,
    }),
  });

  return histError?.message ?? null;
}

function contextoAuditoriaDesdeViabilidadSupervisor(
  params: InformarViabilidadAdminParams,
): ContextoAuditoriaSupervisor {
  return {
    actorNombre: params.adminNombre,
    actorTelegramId: params.adminTelegramId,
    fundamento: params.fundamento ?? 'financiero',
    rolFacultado: 'pm',
    accion: 'via:si_aprobacion_directa',
  };
}

/** Supervisor + viabilidad sí: salta PM y ejecuta aprobación + orden de compra. */
async function informarViabilidadSupervisorConAprobacion(
  supabase: SupabaseClient,
  params: InformarViabilidadAdminParams,
  ticket: string,
): Promise<InformarViabilidadAdminResult> {
  const procuraId = params.procuraId.trim();
  const ahora = new Date().toISOString();
  const origen = params.origen?.trim() || ORIGEN_SUPERVISOR_LOG;
  const auditoria = contextoAuditoriaDesdeViabilidadSupervisor(params);
  const actorFormal = nombreActorSupervisorFormal(params.adminNombre);

  const { data: updated, error: updErr } = await supabase
    .from('ci_procuras')
    .update({
      viabilidad_presupuestaria: 'si',
      viabilidad_informada_por: params.adminNombre.slice(0, 150),
      viabilidad_informada_telegram_id: params.adminTelegramId ?? null,
      viabilidad_informada_at: ahora,
      updated_at: ahora,
    } as never)
    .eq('id', procuraId)
    .eq('estado', 'solicitada')
    .select('id')
    .maybeSingle();

  if (updErr) return { ok: false, error: updErr.message };
  if (!updated) {
    return {
      ok: false,
      error: 'La procura ya no está en estado solicitada (concurrencia o transición previa).',
    };
  }

  const histVia = await insertarAuditoriaProcuraSinTransicion(supabase, {
    procuraId,
    estado: 'solicitada',
    motivo: motivoAuditoriaSupervisor(
      motivoHistorialViabilidadAdmin('si', 'supervisor', params.fundamento),
      auditoria,
    ),
    usuario: actorFormal.slice(0, 150),
    metadatos: {
      ...metadatosHistorialViabilidadAdmin({
        viabilidad: 'si',
        origen,
        adminUsuarioId: params.adminUsuarioId,
        observaciones: params.observaciones,
        informadoPorRol: 'supervisor',
        fundamento: params.fundamento,
      }),
      ...metadatosAuditoriaSupervisor(auditoria),
    },
  });
  if (histVia) {
    console.error('[informarViabilidadSupervisorConAprobacion] historial viabilidad:', histVia);
  }

  const abas = await procesarAbastecimientoProcuraAprobada(supabase, {
    procuraId,
    autorNombre: actorFormal,
    auditoriaSupervisor: auditoria,
    aprobarDesdeViabilidadSupervisor: true,
  });

  if (!abas.ok) {
    return { ok: false, error: abas.error ?? 'No se pudo aprobar ni emitir orden de compra.' };
  }

  await actualizarTicketProcuraSolicitante(supabase, procuraId, {
    pmAprobadorNombre: actorFormal,
    ordenCompraEmitida: Boolean(abas.compraEmitida),
    despachoCodigo: abas.despachoCodigo ?? null,
  });

  return {
    ok: true,
    ticket,
    pmsNotificados: 0,
    aprobacionDirectaSupervisor: true,
    compraEmitida: abas.compraEmitida,
  };
}

/** Administrador informa viabilidad presupuestaria → pendiente_pm + alerta al PM (contador). */
export async function informarViabilidadAdminProcura(
  supabase: SupabaseClient,
  params: InformarViabilidadAdminParams,
): Promise<InformarViabilidadAdminResult> {
  const procuraId = params.procuraId.trim();
  if (!procuraId) return { ok: false, error: 'Id de procura inválido.' };

  const { data: row, error: loadErr } = await supabase
    .from('ci_procuras')
    .select('id,ticket,estado')
    .eq('id', procuraId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!row) return { ok: false, error: 'Procura no encontrada.' };

  const estado = String(row.estado ?? '').toLowerCase();
  if (estado !== 'solicitada') {
    return {
      ok: false,
      error:
        estado === 'pendiente_pm'
          ? 'La procura ya fue enviada al Project Manager.'
          : 'La procura ya fue resuelta.',
    };
  }

  const informadoPorRol = params.informadoPorRol ?? 'contador';

  if (informadoPorRol === 'supervisor' && params.viabilidad === 'si') {
    return informarViabilidadSupervisorConAprobacion(
      supabase,
      params,
      String(row.ticket ?? ''),
    );
  }

  if (!transicionEstadoProcuraValida('solicitada', 'pendiente_pm')) {
    return { ok: false, error: 'Transición de estado no permitida.' };
  }

  const ahora = new Date().toISOString();
  const origen = params.origen?.trim() || 'informar_viabilidad_admin';

  const { data: updated, error: updErr } = await supabase
    .from('ci_procuras')
    .update({
      estado: 'pendiente_pm',
      viabilidad_presupuestaria: params.viabilidad,
      viabilidad_informada_por: params.adminNombre.slice(0, 150),
      viabilidad_informada_telegram_id: params.adminTelegramId ?? null,
      viabilidad_informada_at: ahora,
      updated_at: ahora,
    } as never)
    .eq('id', procuraId)
    .eq('estado', 'solicitada')
    .select('id')
    .maybeSingle();

  if (updErr) return { ok: false, error: updErr.message };
  if (!updated) {
    return {
      ok: false,
      error: 'La procura ya no está en estado solicitada (concurrencia o transición previa).',
    };
  }

  const histErr = await insertarHistorialViabilidadAdmin(supabase, {
    procuraId,
    adminNombre: params.adminNombre,
    viabilidad: params.viabilidad,
    origen,
    adminUsuarioId: params.adminUsuarioId,
    observaciones: params.observaciones,
    informadoPorRol,
    fundamento: params.fundamento,
  });
  if (histErr) {
    console.error('[informarViabilidadAdminProcura] historial:', histErr);
    return {
      ok: false,
      error: `Estado actualizado pero falló auditoría en historial: ${histErr}`,
    };
  }

  const alerta = await enviarAlertaPmTrasViabilidadAdmin(supabase, procuraId, {
    informadoPorRol,
  });

  if (params.viabilidad === 'si' || params.viabilidad === 'no') {
    await actualizarTicketProcuraSolicitante(supabase, procuraId);
  }

  return {
    ok: true,
    ticket: String(row.ticket ?? ''),
    pmsNotificados: alerta.enviados,
  };
}
