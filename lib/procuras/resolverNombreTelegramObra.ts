import type { SupabaseClient } from '@supabase/supabase-js';
import { listarNominaProyecto } from '@/lib/proyectos/proyectoNomina';

/** Corrige nombres legacy mal sincronizados en Telegram. */
export function corregirNombreDisplayTelegram(nombre: string): string {
  const t = nombre.trim();
  if (!t) return t;
  const key = t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (key === 'luis mata mata' || key === 'luis mata') return 'Luis Vicente Mata';
  return t;
}

function nombreDesdeFilaNomina(f: {
  nombre?: string | null;
  nombre_display?: string | null;
}): string {
  return (
    f.nombre?.trim() ||
    f.nombre_display?.trim() ||
    ''
  );
}

/** Columnas que existen de verdad en ci_proyecto_nomina y ci_empleados. */
export const SELECT_NOMBRE_POR_CHAT = 'nombre, telegram_chat_id, ci_empleados(nombre_completo, telegram_chat_id)';

/** Prioriza nombre del módulo de proyectos (nómina / bot usuarios). */
export async function resolverNombreObraPorChatTelegram(
  supabase: SupabaseClient,
  chatId: number,
  proyectoId?: string | null,
): Promise<string | null> {
  // El nombre es solo para mostrar: si no se puede resolver, quien llama usa el que ya
  // tiene. Un fallo aquí nunca debe tumbar un pedido, un retiro o un despacho.
  try {
    const pid = proyectoId?.trim();
    if (pid) {
      const nomina = await listarNominaProyecto(supabase, pid);
      for (const f of nomina) {
        const t1 = f.telegram_chat_id;
        const t2 = f.empleado_telegram_chat_id;
        if (t1 !== chatId && t2 !== chatId) continue;
        const n = nombreDesdeFilaNomina(f);
        if (n) return corregirNombreDisplayTelegram(n);
      }
    }

    // El chat del empleado vive en ci_empleados; en la nómina solo está el chat propio de
    // la fila. (Antes se pedía una columna «empleado_telegram_chat_id» que no existe: la
    // consulta fallaba y, para quien no estaba en la nómina de esa obra, el flujo se caía.)
    const { data, error } = await supabase
      .from('ci_proyecto_nomina')
      .select(SELECT_NOMBRE_POR_CHAT)
      .eq('activo', true)
      .limit(300);
    if (error) {
      console.warn('[nombre por chat] nómina:', error.message);
      return null;
    }

    for (const row of data ?? []) {
      const r = row as unknown as {
        nombre?: string | null;
        telegram_chat_id?: number | null;
        ci_empleados?: { nombre_completo?: string | null; telegram_chat_id?: number | null } | null;
      };
      const t1 = r.telegram_chat_id != null ? Number(r.telegram_chat_id) : null;
      const t2 = r.ci_empleados?.telegram_chat_id != null ? Number(r.ci_empleados.telegram_chat_id) : null;
      if (t1 !== chatId && t2 !== chatId) continue;
      const n = r.nombre?.trim() || r.ci_empleados?.nombre_completo?.trim() || '';
      if (n) return corregirNombreDisplayTelegram(n);
    }
  } catch (e) {
    console.warn('[nombre por chat]', e instanceof Error ? e.message : e);
  }

  return null;
}

export async function resolverNombreMostrarTelegram(
  supabase: SupabaseClient,
  chatId: number,
  nombreFallback: string,
  proyectoId?: string | null,
): Promise<string> {
  const desdeNomina = await resolverNombreObraPorChatTelegram(supabase, chatId, proyectoId);
  if (desdeNomina) return desdeNomina;
  return corregirNombreDisplayTelegram(nombreFallback);
}
