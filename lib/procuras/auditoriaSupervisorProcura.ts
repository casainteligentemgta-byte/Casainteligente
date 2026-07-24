import type { SupabaseClient } from '@supabase/supabase-js';
import { rpcProcesarProcurasLote } from '@/lib/procuras/rpcProcesarProcurasLote';

/** Disponibilidad confirmada por el supervisor al desbloquear el flujo. */
export type FundamentoDisponibilidad = 'financiero' | 'fisico' | 'ambos';

export const ORIGEN_SUPERVISOR_LOG = 'telegram_log_supervisor';

/** Segundo paso: confirmación con fundamento (máx. 64 bytes en callback_data). */
export const CB_LOG_FND = 'log:fnd:';

export const FND_FIN = 'fin';
export const FND_FIS = 'fis';
export const FND_AMB = 'amb';

const FND_MAP: Record<string, FundamentoDisponibilidad> = {
  [FND_FIN]: 'financiero',
  [FND_FIS]: 'fisico',
  [FND_AMB]: 'ambos',
};

export type AccionFundamentoSupervisor =
  | 'via:si'
  | 'pm:apr'
  | 'dep:abas'
  | 'com:ord';

export type ConfirmacionFundamentoSupervisor = {
  accion: AccionFundamentoSupervisor;
  fundamento: FundamentoDisponibilidad;
  procuraId: string;
};

export function etiquetaFundamento(f: FundamentoDisponibilidad): string {
  switch (f) {
    case 'financiero':
      return 'disponibilidad financiera';
    case 'fisico':
      return 'disponibilidad física';
    case 'ambos':
      return 'disponibilidad financiera y física';
  }
}

export function parseFundamentoCodigo(codigo: string): FundamentoDisponibilidad | null {
  return FND_MAP[codigo.trim().toLowerCase()] ?? null;
}

export function codigoFundamento(f: FundamentoDisponibilidad): string {
  switch (f) {
    case 'financiero':
      return FND_FIN;
    case 'fisico':
      return FND_FIS;
    case 'ambos':
      return FND_AMB;
  }
}

export function callbackFundamentoSupervisor(
  accion: AccionFundamentoSupervisor,
  fundamento: FundamentoDisponibilidad,
  procuraId: string,
): string {
  return `${CB_LOG_FND}${accion}:${codigoFundamento(fundamento)}:${procuraId.trim()}`;
}

/** Parsea `log:fnd:{accion}:{fin|fis|amb}:{uuid}`. */
export function parseCallbackFundamentoSupervisor(data: string): ConfirmacionFundamentoSupervisor | null {
  if (!data.startsWith(CB_LOG_FND)) return null;
  const rest = data.slice(CB_LOG_FND.length);
  const sep = rest.lastIndexOf(':');
  if (sep <= 0) return null;
  const procuraId = rest.slice(sep + 1).trim();
  if (procuraId.length < 32) return null;

  const prefix = rest.slice(0, sep);
  const fndSep = prefix.lastIndexOf(':');
  if (fndSep <= 0) return null;
  const accion = prefix.slice(0, fndSep) as AccionFundamentoSupervisor;
  const fundamento = parseFundamentoCodigo(prefix.slice(fndSep + 1));
  if (!fundamento) return null;

  const accionesValidas: AccionFundamentoSupervisor[] = ['via:si', 'pm:apr', 'dep:abas', 'com:ord'];
  if (!accionesValidas.includes(accion)) return null;

  return { accion, fundamento, procuraId };
}

export function esCallbackFundamentoSupervisor(data: string): boolean {
  return data.startsWith(CB_LOG_FND);
}

export type ContextoAuditoriaSupervisor = {
  actorNombre: string;
  actorTelegramId?: number | null;
  fundamento?: FundamentoDisponibilidad | null;
  /** Rol formal que el supervisor está ejerciendo en este paso. */
  rolFacultado: 'contador' | 'pm' | 'depositario' | 'comprador';
  accion: string;
};

export function metadatosAuditoriaSupervisor(
  ctx: ContextoAuditoriaSupervisor,
): Record<string, string> {
  const payload: Record<string, string> = {
    auditoria_formal: 'true',
    origen: ORIGEN_SUPERVISOR_LOG,
    actor_rol: 'supervisor',
    accion_supervisor: ctx.accion,
    rol_facultado: ctx.rolFacultado,
  };
  if (ctx.fundamento) payload.fundamento = ctx.fundamento;
  if (ctx.actorTelegramId != null) {
    payload.telegram_user_id = String(Math.trunc(ctx.actorTelegramId));
  }
  return payload;
}

export function motivoAuditoriaSupervisor(
  descripcion: string,
  ctx: Pick<ContextoAuditoriaSupervisor, 'fundamento'>,
): string {
  const base = descripcion.trim();
  if (!ctx.fundamento) return base;
  return `${base} — ${etiquetaFundamento(ctx.fundamento)} confirmada (auditoría formal, canal log)`;
}

export function nombreActorSupervisorFormal(nombre: string): string {
  const n = nombre.trim();
  return n.startsWith('Supervisor') ? n : `Supervisor: ${n}`;
}

export async function ejecutarTransicionProcuraLote(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    nuevoEstado: string;
    motivo: string;
    usuario?: string | null;
    metadatos?: Record<string, string>;
  },
): Promise<void> {
  await rpcProcesarProcurasLote(supabase, {
    p_ids: [params.procuraId.trim()],
    p_nuevo_estado: params.nuevoEstado,
    p_motivo: params.motivo.slice(0, 500),
    p_metadatos: params.metadatos,
    p_usuario: params.usuario?.slice(0, 150) ?? null,
  });
}

/** Registro de auditoría sin cambio de estado (p. ej. reenvío de orden). */
export async function insertarAuditoriaProcuraSinTransicion(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    estado: string;
    motivo: string;
    usuario: string;
    metadatos: Record<string, string>;
  },
): Promise<string | null> {
  const { error } = await supabase.from('ci_procura_estados_historial').insert({
    procura_id: params.procuraId.trim(),
    estado_anterior: params.estado,
    estado_nuevo: params.estado,
    usuario: params.usuario.slice(0, 150),
    motivo: params.motivo.slice(0, 500),
    metadatos: params.metadatos,
  });
  return error?.message ?? null;
}
