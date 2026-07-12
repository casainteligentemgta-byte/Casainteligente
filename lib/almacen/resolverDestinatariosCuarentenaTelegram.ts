import type { SupabaseClient } from '@supabase/supabase-js';
import { getTelegramAlmacenChatIds } from '@/lib/almacen/notificarCuarentenaTelegram';

export type RutaDestinatarioCuarentena =
  | 'depositario_obra'
  | 'grupo_obra'
  | 'depositario_global'
  | 'env_fallback';

export type DestinatarioCuarentena = {
  chatId: string;
  ruta: RutaDestinatarioCuarentena;
  etiqueta?: string;
};

export type DestinatariosCuarentenaResueltos = {
  destinatarios: DestinatarioCuarentena[];
  proyectoId: string | null;
  proyectoNombre: string | null;
};

function agregarDestinatario(
  map: Map<string, DestinatarioCuarentena>,
  chatId: string | number | null | undefined,
  ruta: RutaDestinatarioCuarentena,
  etiqueta?: string,
): void {
  const id = String(chatId ?? '').trim();
  if (!id || id === '0') return;
  if (!map.has(id)) {
    map.set(id, { chatId: id, ruta, etiqueta });
  }
}

/** Resuelve chats Telegram según obra, ubicación, depositarios globales y env. */
export async function resolverDestinatariosCuarentenaTelegram(
  supabase: SupabaseClient,
  ctx: {
    proyectoId?: string | null;
    ubicacionDestinoId?: string | null;
  },
): Promise<DestinatariosCuarentenaResueltos> {
  const map = new Map<string, DestinatarioCuarentena>();

  let proyectoId = ctx.proyectoId?.trim() || null;
  let proyectoNombre: string | null = null;

  if (!proyectoId && ctx.ubicacionDestinoId?.trim()) {
    const { data: ub } = await supabase
      .from('inv_ubicaciones')
      .select('ci_proyecto_id')
      .eq('id', ctx.ubicacionDestinoId.trim())
      .maybeSingle();
    if (ub?.ci_proyecto_id) {
      proyectoId = String(ub.ci_proyecto_id);
    }
  }

  let enrutamientoObra = false;

  if (proyectoId) {
    const { data: proyRaw, error: proyErr } = await supabase
      .from('ci_proyectos')
      .select('id, nombre, depositario_id, telegram_grupo_almacen_id')
      .eq('id', proyectoId)
      .maybeSingle();

    if (!proyErr && proyRaw) {
      proyectoNombre = String(proyRaw.nombre ?? '').trim() || null;

      if (proyRaw.depositario_id) {
        const { data: dep } = await supabase
          .from('ci_empleados')
          .select('telegram_chat_id, nombre_completo, nombres, primer_apellido')
          .eq('id', String(proyRaw.depositario_id))
          .maybeSingle();

        const nombreDep =
          String(dep?.nombre_completo ?? '').trim() ||
          [dep?.nombres, dep?.primer_apellido].filter(Boolean).join(' ').trim() ||
          'Depositario';

        if (dep?.telegram_chat_id != null) {
          agregarDestinatario(
            map,
            dep.telegram_chat_id,
            'depositario_obra',
            nombreDep,
          );
          enrutamientoObra = true;
        }
      }

      if (proyRaw.telegram_grupo_almacen_id != null) {
        agregarDestinatario(
          map,
          proyRaw.telegram_grupo_almacen_id,
          'grupo_obra',
          proyectoNombre ? `Grupo ${proyectoNombre}` : 'Grupo obra',
        );
        enrutamientoObra = true;
      }
    }
  }

  if (!enrutamientoObra) {
    const { data: globales, error: gErr } = await supabase
      .from('ci_empleados')
      .select('telegram_chat_id, nombre_completo, nombres, primer_apellido')
      .eq('alertas_almacen_global', true)
      .not('telegram_chat_id', 'is', null);

    if (!gErr) {
      for (const row of globales ?? []) {
        const nombre =
          String(row.nombre_completo ?? '').trim() ||
          [row.nombres, row.primer_apellido].filter(Boolean).join(' ').trim() ||
          'Almacén central';
        agregarDestinatario(map, row.telegram_chat_id, 'depositario_global', nombre);
      }
    }

    for (const chatId of getTelegramAlmacenChatIds()) {
      agregarDestinatario(map, chatId, 'env_fallback', 'TELEGRAM_ALMACEN_CHAT_IDS');
    }
  }

  return {
    destinatarios: Array.from(map.values()),
    proyectoId,
    proyectoNombre,
  };
}

export function chatIdsDesdeDestinatarios(destinatarios: DestinatarioCuarentena[]): string[] {
  return destinatarios.map((d) => d.chatId);
}
