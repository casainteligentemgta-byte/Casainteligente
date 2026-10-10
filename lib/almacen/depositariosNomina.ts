import type { SupabaseClient } from '@supabase/supabase-js';
import { listarAdministradoresSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import { listarNominaProyecto } from '@/lib/proyectos/proyectoNomina';

/** Roles de la nómina de la obra (Proyecto → Nómina) que atienden el almacén. */
export const ROLES_NOMINA_ALMACEN = new Set(['depositario', 'almacenista', 'almacen']);

export type PersonaNominaTelegram = { chatId: string; nombre: string | null; rol: string };

/**
 * Personas de la nómina de la obra con alguno de estos roles y Telegram vinculado.
 * Si la nómina no se puede leer devuelve lista vacía: quien llama decide el respaldo.
 */
export async function personasNominaConRol(
  supabase: SupabaseClient,
  proyectoId: string,
  roles: Set<string>,
): Promise<PersonaNominaTelegram[]> {
  let nomina: Awaited<ReturnType<typeof listarNominaProyecto>> = [];
  try {
    nomina = await listarNominaProyecto(supabase, proyectoId);
  } catch (e) {
    console.warn('[nómina obra] no disponible:', e);
    return [];
  }
  const personas = new Map<string, PersonaNominaTelegram>();
  for (const f of nomina) {
    const rol = String(f.rol ?? '').trim().toLowerCase();
    if (!roles.has(rol)) continue;
    const chat = f.telegram_chat_id ?? f.empleado_telegram_chat_id;
    if (chat == null || !Number.isFinite(Number(chat))) continue;
    personas.set(String(chat), {
      chatId: String(chat),
      nombre: f.nombre?.trim() || f.nombre_display?.trim() || null,
      rol,
    });
  }
  return Array.from(personas.values());
}

/** Depositarios de la obra según su nómina. */
export function depositariosNomina(supabase: SupabaseClient, proyectoId: string): Promise<PersonaNominaTelegram[]> {
  return personasNominaConRol(supabase, proyectoId, ROLES_NOMINA_ALMACEN);
}

/** Quien administra la obra según su nómina. */
const ROLES_NOMINA_ADMIN = new Set(['admin', 'administrador']);

export const ROL_DEPOSITARIO_VIRTUAL = 'Depositario virtual';

export const NOTA_DEPOSITARIO_VIRTUAL =
  'ℹ️ <i>Esta obra todavía no tiene depositario asignado: usted atiende su almacén por ahora.</i>';

/**
 * Depositario virtual: mientras una obra no tenga a nadie de almacén, lo atiende quien la
 * administra (rol Administrador en su nómina) y, si tampoco hay, los administradores del
 * sistema. Deja de aplicar solo, en cuanto se asigna un depositario a la obra.
 */
export async function depositarioVirtualObra(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<PersonaNominaTelegram[]> {
  const deLaObra = await personasNominaConRol(supabase, proyectoId, ROLES_NOMINA_ADMIN);
  if (deLaObra.length) return deLaObra;
  const delSistema = await listarAdministradoresSistemaTelegram(supabase);
  return delSistema.map((a) => ({ chatId: a.chatId, nombre: a.nombre, rol: 'administrador' }));
}

/**
 * Quién atiende el almacén de la obra: sus depositarios de nómina o, si no hay,
 * el depositario virtual.
 */
export async function encargadosAlmacenObra(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<{ personas: PersonaNominaTelegram[]; virtual: boolean }> {
  const reales = await depositariosNomina(supabase, proyectoId);
  if (reales.length) return { personas: reales, virtual: false };
  return { personas: await depositarioVirtualObra(supabase, proyectoId), virtual: true };
}
