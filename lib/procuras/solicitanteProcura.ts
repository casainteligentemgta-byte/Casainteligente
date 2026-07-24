import type { SupabaseClient } from '@supabase/supabase-js';
import { empleadoPorTelegramChatId } from '@/lib/campo/ingenieroResidente';

export type SolicitanteProcura = {
  empleado_id: string | null;
  telegram_chat_id: number | null;
  nombre: string;
};

export type RelEmpleadoSolicitante =
  | { nombre_completo?: string | null }
  | { nombre_completo?: string | null }[]
  | null;

function nombreDesdeEmpleadoRow(row: {
  nombre_completo?: string | null;
  nombres?: string | null;
  primer_apellido?: string | null;
} | null): string | null {
  if (!row) return null;
  const nc = row.nombre_completo?.trim();
  if (nc) return nc;
  const comp = [row.nombres, row.primer_apellido].filter(Boolean).join(' ').trim();
  return comp || null;
}

export function relNombreSolicitante(v: RelEmpleadoSolicitante): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.nombre_completo?.trim() || null;
  return v.nombre_completo?.trim() || null;
}

export function etiquetaSolicitanteProcura(p: {
  solicitante_nombre?: string | null;
  solicitante_empleado?: RelEmpleadoSolicitante;
}): string {
  const snap = p.solicitante_nombre?.trim();
  if (snap) return snap;
  const emp = relNombreSolicitante(p.solicitante_empleado ?? null);
  if (emp) return emp;
  return '—';
}

export async function resolverSolicitanteDesdeTelegram(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<SolicitanteProcura> {
  const chatNum = Math.trunc(Number(chatId));
  if (!Number.isFinite(chatNum) || chatNum <= 0) {
    return { empleado_id: null, telegram_chat_id: null, nombre: 'Telegram' };
  }

  const { data: wl } = await supabase
    .from('ci_telegram_whitelist')
    .select('nombre, empleado_id')
    .eq('chat_id', chatNum)
    .eq('activo', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (wl?.empleado_id) {
    const { data: emp } = await supabase
      .from('ci_empleados')
      .select('id, nombre_completo, nombres, primer_apellido')
      .eq('id', wl.empleado_id)
      .maybeSingle();
    const nombre =
      nombreDesdeEmpleadoRow(emp) ?? wl.nombre?.trim() ?? 'Usuario Telegram';
    return {
      empleado_id: String(wl.empleado_id),
      telegram_chat_id: chatNum,
      nombre,
    };
  }

  const empTelegram = await empleadoPorTelegramChatId(supabase, chatNum);
  if (empTelegram) {
    return {
      empleado_id: empTelegram.id,
      telegram_chat_id: chatNum,
      nombre: empTelegram.nombre,
    };
  }

  const nombreWl = wl?.nombre?.trim();
  if (nombreWl) {
    return { empleado_id: null, telegram_chat_id: chatNum, nombre: nombreWl };
  }

  return { empleado_id: null, telegram_chat_id: chatNum, nombre: `Chat ${chatNum}` };
}

export async function resolverSolicitanteDesdeWeb(
  supabase: SupabaseClient,
  input: {
    solicitante_empleado_id?: string | null;
    solicitante_nombre?: string | null;
    solicitante_telegram_chat_id?: number | null;
  },
): Promise<SolicitanteProcura> {
  const empleadoId = input.solicitante_empleado_id?.trim() || null;
  const nombreManual = input.solicitante_nombre?.trim() || null;
  const chat = input.solicitante_telegram_chat_id ?? null;

  if (empleadoId) {
    const { data: emp } = await supabase
      .from('ci_empleados')
      .select('id, nombre_completo, nombres, primer_apellido')
      .eq('id', empleadoId)
      .maybeSingle();
    const nombre = nombreDesdeEmpleadoRow(emp) ?? nombreManual;
    if (!nombre) {
      throw new Error('Indique quién realiza la procura.');
    }
    return {
      empleado_id: empleadoId,
      telegram_chat_id: chat,
      nombre,
    };
  }

  if (chat && chat > 0) {
    return resolverSolicitanteDesdeTelegram(supabase, chat);
  }

  if (!nombreManual) {
    throw new Error('Indique quién realiza la procura.');
  }

  return {
    empleado_id: null,
    telegram_chat_id: chat,
    nombre: nombreManual.slice(0, 200),
  };
}

export function aplicarSolicitanteEnRow(
  row: Record<string, unknown>,
  solicitante: SolicitanteProcura,
): void {
  row.solicitante_nombre = solicitante.nombre.slice(0, 200);
  if (solicitante.empleado_id) row.solicitante_empleado_id = solicitante.empleado_id;
  if (solicitante.telegram_chat_id && solicitante.telegram_chat_id > 0) {
    row.solicitante_telegram_chat_id = solicitante.telegram_chat_id;
  }
}

export const SELECT_PROCURA_SOLICITANTE =
  'solicitante_empleado_id,solicitante_telegram_chat_id,solicitante_nombre,solicitante:ci_empleados!ci_procuras_solicitante_empleado_id_fkey(nombre_completo)';
