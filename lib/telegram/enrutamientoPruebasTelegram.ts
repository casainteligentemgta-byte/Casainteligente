import type { TelegramMessageExtra } from '@/lib/telegram/botApi';
import {
  corregirNombreDisplayTelegram,
  resolverNombreObraPorChatTelegram,
} from '@/lib/procuras/resolverNombreTelegramObra';

const ROL_CACHE = new Map<string, string>();

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Chat de pruebas (tu Telegram). Si está definido, los DM se reenvían aquí. */
export function chatIdPruebasTelegram(): string | null {
  const v =
    process.env.TELEGRAM_PRUEBAS_REDIRECT_CHAT_ID?.trim() ||
    process.env.TELEGRAM_CHAT_ID?.trim();
  return v || null;
}

/** Solo activo con TELEGRAM_PRUEBAS_REDIRECT=true|1 (evita redirigir prod por tener solo CHAT_ID). */
export function modoPruebasTelegramActivo(): boolean {
  const flag = process.env.TELEGRAM_PRUEBAS_REDIRECT?.trim().toLowerCase();
  if (flag === 'false' || flag === '0') return false;
  if (flag !== 'true' && flag !== '1') return false;
  return Boolean(chatIdPruebasTelegram());
}

/** Chats privados: id positivo (grupos/canales suelen ser negativos). */
export function esMensajePersonalTelegram(chatId: string | number): boolean {
  const n = Number(chatId);
  return Number.isFinite(n) && n > 0;
}

const ETIQUETA_ROL_SISTEMA: Record<string, string> = {
  Solicitante: 'Solicitante',
  Aprobador: 'Project Manager',
  Comprador: 'Comprador',
  Contador: 'Contador',
  Administrador: 'Contador',
};

const ETIQUETA_ROL_NOMINA: Record<string, string> = {
  pm_obra: 'Project Manager',
  coordinador: 'Coordinador',
  admin: 'Administrador',
  depositario: 'Depositario',
  ingeniero_residente: 'Ingeniero residente',
  comprador: 'Comprador',
  logistica: 'Logística',
  supervisor: 'Supervisor',
  maestro_obra: 'Maestro de obra',
};

function etiquetaRolNomina(rol: string): string {
  const k = rol.trim().toLowerCase();
  return ETIQUETA_ROL_NOMINA[k] ?? rol.replace(/_/g, ' ');
}

export async function resolverEtiquetaRolDestinatario(chatId: string | number): Promise<string> {
  const key = String(Math.trunc(Number(chatId)));
  const cached = ROL_CACHE.get(key);
  if (cached) return cached;

  try {
    const { supabaseAdminForRoute } = await import('@/lib/talento/supabase-admin');
    const admin = supabaseAdminForRoute();
    if (!admin.ok) {
      const fb = `Usuario Telegram ${key}`;
      ROL_CACHE.set(key, fb);
      return fb;
    }

    const supabase = admin.client;
    const tid = Number(key);

    const { obtenerUsuarioSistemaTelegram } = await import('@/lib/compras/usuariosSistemaTelegram');
    const u = await obtenerUsuarioSistemaTelegram(supabase, tid);
    if (u) {
      const rol = ETIQUETA_ROL_SISTEMA[u.rol] ?? u.rol;
      const nombreNomina = await resolverNombreObraPorChatTelegram(supabase, tid);
      const nombre = corregirNombreDisplayTelegram(nombreNomina || u.nombre);
      const label = `${rol} · ${nombre}`;
      ROL_CACHE.set(key, label);
      return label;
    }

    const { data: nominaRows } = await supabase
      .from('ci_proyecto_nomina')
      .select('rol, nombre, telegram_chat_id, empleado_telegram_chat_id, ci_empleados(nombre_completo)')
      .eq('activo', true)
      .limit(50);

    type NominaRow = {
      rol?: string | null;
      nombre?: string | null;
      telegram_chat_id?: number | null;
      empleado_telegram_chat_id?: number | null;
      ci_empleados?: { nombre_completo?: string | null } | null;
    };

    for (const row of (nominaRows ?? []) as NominaRow[]) {
      const t1 = row.telegram_chat_id != null ? Number(row.telegram_chat_id) : null;
      const t2 =
        row.empleado_telegram_chat_id != null ? Number(row.empleado_telegram_chat_id) : null;
      if (t1 !== tid && t2 !== tid) continue;
      const nombre = corregirNombreDisplayTelegram(
        String(row.nombre ?? row.ci_empleados?.nombre_completo ?? '').trim() ||
          'Personal de obra',
      );
      const label = `${etiquetaRolNomina(String(row.rol ?? ''))} · ${nombre}`;
      ROL_CACHE.set(key, label);
      return label;
    }

    const { data: emp } = await supabase
      .from('ci_empleados')
      .select('nombre_completo, oficio, telegram_chat_id')
      .eq('telegram_chat_id', tid)
      .maybeSingle();

    if (emp) {
      const e = emp as { nombre_completo?: string | null; oficio?: string | null };
      const nombre = corregirNombreDisplayTelegram(
        String(e.nombre_completo ?? '').trim() || 'Empleado',
      );
      const oficio = String(e.oficio ?? '').trim();
      const label = oficio ? `${oficio} · ${nombre}` : nombre;
      ROL_CACHE.set(key, label);
      return label;
    }
  } catch (e) {
    console.warn('[enrutamientoPruebasTelegram] lookup rol', chatId, e);
  }

  const fallback = `Usuario Telegram ${key}`;
  ROL_CACHE.set(key, fallback);
  return fallback;
}

/** Reenvía DMs al chat de pruebas con cabecera «Recibe: …». */
export async function prepararEnvioPruebasTelegram(
  chatId: string | number,
  text: string,
  extra?: TelegramMessageExtra,
): Promise<{ chatId: string | number; text: string }> {
  if (!modoPruebasTelegramActivo()) {
    return { chatId, text };
  }

  const destino = chatIdPruebasTelegram();
  if (!destino || !esMensajePersonalTelegram(chatId)) {
    return { chatId, text };
  }

  if (String(chatId) === String(destino)) {
    return { chatId, text };
  }

  const rol =
    extra?.rolDestinatario?.trim() ||
    (await resolverEtiquetaRolDestinatario(chatId));
  const origen = String(Math.trunc(Number(chatId)));

  const cabecera =
    `📬 <b>Recibe: ${escHtml(rol)}</b>\n` +
    `<i>Prueba — destino original chat ${escHtml(origen)}</i>\n\n`;

  return {
    chatId: destino,
    text: cabecera + text,
  };
}
