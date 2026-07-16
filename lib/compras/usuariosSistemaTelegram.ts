import type { SupabaseClient } from '@supabase/supabase-js';

export type RolComprasTelegram =
  | 'Solicitante'
  | 'Aprobador'
  | 'Comprador'
  | 'Contador'
  | 'Administrador';

export type UsuarioSistemaTelegram = {
  id: string;
  nombre: string;
  telegram_id: number;
  rol: RolComprasTelegram;
  proyecto_id: string | null;
  activo: boolean;
};

export const ROLES_COMPRAS_TELEGRAM: RolComprasTelegram[] = [
  'Solicitante',
  'Aprobador',
  'Comprador',
  'Contador',
  'Administrador',
];

const ROLES = ROLES_COMPRAS_TELEGRAM;

export function parseRolComprasTelegram(v: string | null | undefined): RolComprasTelegram | null {
  const t = String(v ?? '').trim();
  return (ROLES as string[]).includes(t) ? (t as RolComprasTelegram) : null;
}

export function parseTelegramIdNumerico(v: string | number): number | null {
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/** Carga usuario activo por telegram_id. Falla si la tabla no existe (migr. 230). */
export async function obtenerUsuarioSistemaTelegram(
  supabase: SupabaseClient,
  telegramId: string | number,
): Promise<UsuarioSistemaTelegram | null> {
  const tid = parseTelegramIdNumerico(telegramId);
  if (tid == null) return null;

  const { data, error } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .select('id, nombre, telegram_id, rol, proyecto_id, activo')
    .eq('telegram_id', tid)
    .eq('activo', true)
    .maybeSingle();

  if (error?.code === '42P01') return null;
  if (error) throw new Error(error.message);
  if (!data) return null;

  const rol = parseRolComprasTelegram(String(data.rol));
  if (!rol) return null;

  return {
    id: String(data.id),
    nombre: String(data.nombre ?? '').trim() || 'Usuario',
    telegram_id: Number(data.telegram_id),
    rol,
    proyecto_id: data.proyecto_id ? String(data.proyecto_id) : null,
    activo: Boolean(data.activo),
  };
}

export function usuarioPuedeSolicitarProcura(u: UsuarioSistemaTelegram): boolean {
  return u.activo && ['Solicitante', 'Aprobador', 'Comprador', 'Contador', 'Administrador'].includes(u.rol);
}

export function usuarioPuedeAprobarProcura(u: UsuarioSistemaTelegram): boolean {
  return u.activo && ['Aprobador', 'Administrador'].includes(u.rol);
}

export function usuarioPuedeRechazarProcura(u: UsuarioSistemaTelegram): boolean {
  return usuarioPuedeAprobarProcura(u);
}

/** Legacy: rol «Administrador» en Telegram = alias histórico del contador. */
export function usuarioEsContadorProcura(u: UsuarioSistemaTelegram): boolean {
  return u.activo && (u.rol === 'Contador' || u.rol === 'Administrador');
}

/** Revisor de fondos: informa viabilidad presupuestaria antes del PM. */
export function usuarioPuedeInformarViabilidadProcura(u: UsuarioSistemaTelegram): boolean {
  return usuarioEsContadorProcura(u);
}

export function usuarioEsAdministradorProcura(u: UsuarioSistemaTelegram): boolean {
  return u.activo && u.rol === 'Administrador';
}

export function usuarioEsProjectManagerProcura(u: UsuarioSistemaTelegram): boolean {
  return u.activo && u.rol === 'Aprobador';
}

/** Compradores (y admin) que reciben órdenes de compra tras aprobación PM. */
export async function listarUsuariosOrdenCompraTelegram(
  supabase: SupabaseClient,
): Promise<UsuarioSistemaTelegram[]> {
  const { data, error } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .select('id, nombre, telegram_id, rol, proyecto_id, activo')
    .eq('activo', true)
    .in('rol', ['Comprador', 'Administrador'])
    .order('nombre');

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const rol = parseRolComprasTelegram(String(row.rol));
      const telegram_id = parseTelegramIdNumerico(row.telegram_id);
      if (!rol || telegram_id == null) return null;
      const u: UsuarioSistemaTelegram = {
        id: String(row.id),
        nombre: String(row.nombre ?? '').trim() || 'Usuario',
        telegram_id,
        rol,
        proyecto_id: row.proyecto_id ? String(row.proyecto_id) : null,
        activo: true,
      };
      return u;
    })
    .filter((u): u is UsuarioSistemaTelegram => u != null);
}

export async function exigirUsuarioSistemaTelegram(
  supabase: SupabaseClient,
  telegramId: string | number,
  opts?: { permitirRoles?: RolComprasTelegram[] },
): Promise<{ ok: true; usuario: UsuarioSistemaTelegram } | { ok: false; error: string }> {
  const usuario = await obtenerUsuarioSistemaTelegram(supabase, telegramId);
  if (!usuario) {
    return {
      ok: false,
      error:
        '⛔ Tu Telegram no está registrado en el departamento de compras. Pide al administrador que te agregue con tu ID numérico.',
    };
  }
  if (opts?.permitirRoles?.length && !opts.permitirRoles.includes(usuario.rol)) {
    return {
      ok: false,
      error: `⛔ Rol «${usuario.rol}» no autorizado para esta acción.`,
    };
  }
  return { ok: true, usuario };
}
