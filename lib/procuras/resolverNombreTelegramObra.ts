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

/** Prioriza nombre del módulo de proyectos (nómina / bot usuarios). */
export async function resolverNombreObraPorChatTelegram(
  supabase: SupabaseClient,
  chatId: number,
  proyectoId?: string | null,
): Promise<string | null> {
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

  const { data, error } = await supabase
    .from('ci_proyecto_nomina')
    .select(
      'nombre, telegram_chat_id, empleado_telegram_chat_id, ci_empleados(nombre_completo)',
    )
    .eq('activo', true)
    .limit(300);

  if (error?.code === '42P01') return null;
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const r = row as {
      nombre?: string | null;
      telegram_chat_id?: number | null;
      empleado_telegram_chat_id?: number | null;
      ci_empleados?: { nombre_completo?: string | null } | null;
    };
    const t1 = r.telegram_chat_id != null ? Number(r.telegram_chat_id) : null;
    const t2 =
      r.empleado_telegram_chat_id != null ? Number(r.empleado_telegram_chat_id) : null;
    if (t1 !== chatId && t2 !== chatId) continue;
    const n =
      r.nombre?.trim() ||
      r.ci_empleados?.nombre_completo?.trim() ||
      '';
    if (n) return corregirNombreDisplayTelegram(n);
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
