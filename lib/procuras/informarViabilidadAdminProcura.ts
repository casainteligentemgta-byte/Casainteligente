import type { SupabaseClient } from '@supabase/supabase-js';
import type { FundamentoDisponibilidad } from '@/lib/procuras/auditoriaSupervisorProcura';
import { etiquetaFundamento } from '@/lib/procuras/auditoriaSupervisorProcura';
import { transicionEstadoProcuraValida } from '@/lib/procuras/procuraEstados';
import { enviarAlertaPmTrasViabilidadAdmin } from '@/lib/procuras/viabilidadAdminProcuraTelegram';

export type InformarViabilidadAdminResult = {
  ok: boolean;
  ticket?: string;
  error?: string;
  pmsNotificados?: number;
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

/** Administrador informa viabilidad presupuestaria → pendiente_pm + alerta al PM. */
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

  const informadoPorRol = params.informadoPorRol ?? 'contador';

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

  return {
    ok: true,
    ticket: String(row.ticket ?? ''),
    pmsNotificados: alerta.enviados,
  };
}
