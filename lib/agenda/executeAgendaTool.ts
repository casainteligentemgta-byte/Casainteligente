import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgendaToolName } from '@/lib/gemini/agendaTools';
import {
  consultarFechasEspeciales,
  guardarFechaEspecial,
} from '@/lib/agenda/fechasEspecialesService';
import type {
  AgendaToolResult,
  CategoriaFechaEspecial,
  ConsultarFechasEspecialesInput,
  GuardarFechaEspecialInput,
} from '@/types/agenda';

type ToolArgs = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asCategoria(value: unknown): CategoriaFechaEspecial | undefined {
  const str = asString(value);
  if (!str) return undefined;
  if (['birthday', 'appointment', 'reminder', 'holiday'].includes(str)) {
    return str as CategoriaFechaEspecial;
  }
  return undefined;
}

function asMes(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

export async function executeAgendaTool(
  supabase: SupabaseClient,
  userId: string | null,
  toolName: AgendaToolName,
  args: ToolArgs,
): Promise<AgendaToolResult> {
  try {
    if (toolName === 'guardarFechaEspecial') {
      const titulo = asString(args.titulo);
      const categoria = asCategoria(args.categoria);
      const fecha = asString(args.fecha);

      if (!titulo || !categoria || !fecha) {
        return {
          success: false,
          message: 'Faltan campos obligatorios: titulo, categoria y fecha.',
        };
      }

      const input: GuardarFechaEspecialInput = {
        titulo,
        categoria,
        fecha,
        hora: asString(args.hora),
        notas: asString(args.notas),
      };

      const saved = await guardarFechaEspecial(supabase, userId, input);
      return {
        success: true,
        message: `Evento "${saved.titulo}" guardado para el ${saved.fecha}.`,
        data: saved,
      };
    }

    if (toolName === 'consultarFechasEspeciales') {
      const input: ConsultarFechasEspecialesInput = {
        categoria: asCategoria(args.categoria),
        mes: asMes(args.mes),
      };

      const rows = await consultarFechasEspeciales(supabase, userId, input);

      if (rows.length === 0) {
        return {
          success: true,
          message: 'No hay eventos que coincidan con la consulta.',
          data: [],
        };
      }

      return {
        success: true,
        message: `Se encontraron ${rows.length} evento(s).`,
        data: rows,
      };
    }

    return { success: false, message: `Herramienta desconocida: ${toolName}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al ejecutar la herramienta.';
    return { success: false, message };
  }
}
