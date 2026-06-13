import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseRolComprasTelegram,
  parseTelegramIdNumerico,
  type RolComprasTelegram,
} from '@/lib/compras/usuariosSistemaTelegram';
import { listarNominaProyecto } from '@/lib/proyectos/proyectoNomina';
import {
  corregirNombreDisplayTelegram,
  resolverNombreMostrarTelegram,
} from '@/lib/procuras/resolverNombreTelegramObra';

/** Slugs de rol de app → rol en ci_usuarios_sistema_telegram (bot /procura). */
export function rolSistemaTelegramDesdeSlugApp(slug: string): RolComprasTelegram | null {
  const direct = parseRolComprasTelegram(slug);
  if (direct) return direct;
  const map: Record<string, RolComprasTelegram> = {
    pm_obra: 'Aprobador',
    admin: 'Administrador',
    comprador: 'Comprador',
  };
  return map[slug.trim()] ?? null;
}

export const ROLES_NOMINA_APROBADOR = new Set(['pm_obra', 'coordinador', 'admin']);

export type AprobadorProcuraTelegram = {
  chatId: number;
  nombre: string;
  origen: 'sistema' | 'nomina';
  rol: 'Aprobador' | 'Administrador';
};

/** Upsert en ci_usuarios_sistema_telegram (permite aprobar /procura). */
export async function sincronizarUsuarioSistemaTelegramProyecto(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    rolSlug: string;
    nombre: string;
    chatId: number;
    activo?: boolean;
  },
): Promise<void> {
  const rol = rolSistemaTelegramDesdeSlugApp(params.rolSlug);
  if (!rol) return;

  const row = {
    nombre: params.nombre.slice(0, 150),
    telegram_id: params.chatId,
    rol,
    proyecto_id: params.proyectoId,
    activo: params.activo !== false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .upsert(row as never, { onConflict: 'telegram_id' });

  if (error?.code === '42P01') return;
  if (error) throw new Error(error.message);
}

/** PM / aprobadores con Telegram para una procura (canal + DM). */
export async function listarAprobadoresProcuraTelegram(
  supabase: SupabaseClient,
  proyectoId: string | null,
): Promise<AprobadorProcuraTelegram[]> {
  const out = new Map<number, AprobadorProcuraTelegram>();

  const { data: sistema, error: errSis } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .select('nombre, telegram_id, rol, proyecto_id')
    .eq('activo', true)
    .in('rol', ['Aprobador', 'Administrador']);

  if (errSis?.code === '42P01') {
    /* tabla ausente */
  } else if (errSis) {
    throw new Error(errSis.message);
  } else {
    for (const row of sistema ?? []) {
      const chatId = parseTelegramIdNumerico(row.telegram_id);
      if (chatId == null) continue;
      const rol = String(row.rol ?? '').trim();
      const pid = row.proyecto_id ? String(row.proyecto_id) : null;
      const nombreRaw = String(row.nombre ?? '').trim() || (rol === 'Administrador' ? 'Administrador' : 'Aprobador');
      const nombre = corregirNombreDisplayTelegram(
        await resolverNombreMostrarTelegram(supabase, chatId, nombreRaw, proyectoId),
      );

      // Administradores globales siempre reciben alertas de procura pendiente.
      if (rol === 'Administrador') {
        out.set(chatId, { chatId, nombre, origen: 'sistema', rol: 'Administrador' });
        continue;
      }

      if (rol === 'Aprobador') {
        if (pid && proyectoId && pid !== proyectoId) continue;
        out.set(chatId, { chatId, nombre, origen: 'sistema', rol: 'Aprobador' });
      }
    }
  }

  if (proyectoId) {
    const nomina = await listarNominaProyecto(supabase, proyectoId);
    for (const f of nomina) {
      if (!ROLES_NOMINA_APROBADOR.has(f.rol)) continue;
      const chatId =
        f.telegram_chat_id != null
          ? Number(f.telegram_chat_id)
          : f.empleado_telegram_chat_id != null
            ? Number(f.empleado_telegram_chat_id)
            : null;
      if (chatId == null || !Number.isFinite(chatId)) continue;

      const rolSlug = f.rol === 'admin' ? 'admin' : 'pm_obra';
      const nombreNomina = corregirNombreDisplayTelegram(
        f.nombre?.trim() || f.nombre_display?.trim() || 'Project manager',
      );
      if (rolSistemaTelegramDesdeSlugApp(rolSlug)) {
        try {
          await sincronizarUsuarioSistemaTelegramProyecto(supabase, {
            proyectoId,
            rolSlug,
            nombre: nombreNomina,
            chatId,
          });
        } catch (e) {
          console.warn('[aprobadoresProcura] sync sistema', chatId, e);
        }
      }

      if (!out.has(chatId)) {
        out.set(chatId, {
          chatId,
          nombre: nombreNomina,
          origen: 'nomina',
          rol: f.rol === 'admin' ? 'Administrador' : 'Aprobador',
        });
      }
    }
  }

  return Array.from(out.values());
}

/** ¿Puede aprobar vía bot aunque no esté en ci_usuarios_sistema_telegram? */
export async function esAprobadorNominaProyecto(
  supabase: SupabaseClient,
  telegramId: string | number,
  proyectoId: string | null,
): Promise<{ ok: true; nombre: string } | { ok: false }> {
  const tid = parseTelegramIdNumerico(telegramId);
  if (tid == null || !proyectoId) return { ok: false };

  const nomina = await listarNominaProyecto(supabase, proyectoId);
  for (const f of nomina) {
    if (!ROLES_NOMINA_APROBADOR.has(f.rol)) continue;
    const chatId =
      f.telegram_chat_id != null
        ? Number(f.telegram_chat_id)
        : f.empleado_telegram_chat_id != null
          ? Number(f.empleado_telegram_chat_id)
          : null;
    if (chatId !== tid) continue;
    return {
      ok: true,
      nombre: corregirNombreDisplayTelegram(
        f.nombre?.trim() || f.nombre_display?.trim() || 'Project manager',
      ),
    };
  }
  return { ok: false };
}
