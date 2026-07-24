import type { SupabaseClient } from '@supabase/supabase-js';
import { listarRolesEmpresaUsuario } from '@/lib/auth/ciUsuariosRolesDb';
import {
  type Permiso,
  permisoRequeridoParaEstadoProcura,
  permisosDeRolesEmpresa,
  permisosDeRolesObra,
} from '@/lib/auth/permisosCatalogo';

export type RolObraAsignado = {
  proyectoId: string;
  rol: string;
  nombre?: string | null;
};

export type ActorPermisos = {
  tipo: 'web' | 'telegram';
  userId?: string;
  email?: string;
  telegramChatId?: string;
  nombre?: string | null;
  rolesEmpresa: string[];
  rolesObra: RolObraAsignado[];
  permisos: Set<Permiso>;
};

export function permisosEnforcementActivo(): boolean {
  const v = process.env.PERMISOS_ENFORCED?.trim().toLowerCase();
  if (v === 'false' || v === '0') return false;
  if (v === 'true' || v === '1') return true;
  return process.env.NODE_ENV === 'production';
}

export function actorTienePermiso(
  actor: ActorPermisos,
  permiso: Permiso,
  ctx?: { proyectoId?: string | null; entidadId?: string | null },
): boolean {
  const permEmpresa = permisosDeRolesEmpresa(actor.rolesEmpresa);
  if (permEmpresa.has(permiso)) return true;

  if (!ctx?.proyectoId?.trim()) {
    const permObra = permisosDeRolesObra(actor.rolesObra.map((r) => r.rol));
    return permObra.has(permiso);
  }

  const pid = ctx.proyectoId.trim();
  const rolesEnProyecto = actor.rolesObra.filter((r) => r.proyectoId === pid).map((r) => r.rol);
  return permisosDeRolesObra(rolesEnProyecto).has(permiso);
}

function combinarPermisos(rolesEmpresa: string[], rolesObra: string[]): Set<Permiso> {
  const s = permisosDeRolesEmpresa(rolesEmpresa);
  permisosDeRolesObra(rolesObra).forEach((p) => s.add(p));
  return s;
}

export async function resolverActorWeb(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
): Promise<ActorPermisos> {
  let rolesRows = await listarRolesEmpresaUsuario(supabase, userId);
  // Si el cliente de sesión no ve filas (RLS/cookie), reintentar con service role
  if (rolesRows.length === 0) {
    try {
      const { createSupabaseAdminOnlyClient } = await import('@/lib/supabase/adminOnlyClient');
      const admin = createSupabaseAdminOnlyClient();
      if (admin) {
        rolesRows = await listarRolesEmpresaUsuario(admin, userId);
      }
    } catch {
      /* sin service role: se queda vacío */
    }
  }

  const nominaResult = email?.trim()
    ? await supabase
        .from('ci_proyecto_nomina')
        .select('proyecto_id, rol, nombre, email, activo')
        .eq('activo', true)
        .ilike('email', email.trim())
    : { data: [] as unknown[], error: null };
  const nominaRows = nominaResult.data;

  const rolesEmpresa = rolesRows.map((r) => String(r.rol));
  const rolesObra: RolObraAsignado[] = (nominaRows ?? []).map((r) => ({
    proyectoId: String((r as { proyecto_id: string }).proyecto_id),
    rol: String((r as { rol: string }).rol),
    nombre: (r as { nombre?: string }).nombre ?? null,
  }));

  const rolesObraSlugs = rolesObra.map((r) => r.rol);
  return {
    tipo: 'web',
    userId,
    email: email ?? undefined,
    rolesEmpresa,
    rolesObra,
    permisos: combinarPermisos(rolesEmpresa, rolesObraSlugs),
  };
}

export async function resolverActorTelegram(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<ActorPermisos> {
  const cid = Math.trunc(Number(chatId));
  const chatStr = String(chatId);

  const [{ data: nomina }, { data: empleados }, { data: whitelist }] = await Promise.all([
    supabase
      .from('ci_proyecto_nomina')
      .select('proyecto_id, rol, nombre, email, telegram_chat_id, activo')
      .eq('activo', true)
      .eq('telegram_chat_id', cid),
    supabase
      .from('ci_empleados')
      .select('id, nombre_completo, email, telegram_chat_id')
      .eq('telegram_chat_id', cid)
      .limit(3),
    supabase
      .from('ci_telegram_whitelist')
      .select('nombre, email, proyecto_id')
      .eq('chat_id', cid)
      .eq('activo', true)
      .maybeSingle(),
  ]);

  let rolesObra: RolObraAsignado[] = (nomina ?? []).map((r) => ({
    proyectoId: String((r as { proyecto_id: string }).proyecto_id),
    rol: String((r as { rol: string }).rol),
    nombre: (r as { nombre?: string }).nombre ?? null,
  }));

  if (!rolesObra.length && empleados?.length) {
    const empId = String((empleados[0] as { id: string }).id);
    const { data: nominaEmp } = await supabase
      .from('ci_proyecto_nomina')
      .select('proyecto_id, rol, nombre')
      .eq('activo', true)
      .eq('empleado_id', empId);
    rolesObra = (nominaEmp ?? []).map((r) => ({
      proyectoId: String((r as { proyecto_id: string }).proyecto_id),
      rol: String((r as { rol: string }).rol),
      nombre: (r as { nombre?: string }).nombre ?? null,
    }));
  }

  const email =
    (nomina?.[0] as { email?: string } | undefined)?.email?.trim() ||
    (empleados?.[0] as { email?: string } | undefined)?.email?.trim() ||
    (whitelist as { email?: string } | null)?.email?.trim() ||
    undefined;

  let rolesEmpresa: string[] = [];
  if (email) {
    const { buscarUsuarioIdPorEmail } = await import('@/lib/auth/buscarUsuarioIdPorEmail');
    const adminMod = await import('@/lib/talento/supabase-admin');
    const admin = adminMod.supabaseAdminForRoute();
    if (admin.ok) {
      const lookup = await buscarUsuarioIdPorEmail(admin.client, email);
      if (!('error' in lookup)) {
        const rolesRows = await listarRolesEmpresaUsuario(supabase, lookup.userId);
        rolesEmpresa = rolesRows.map((r) => String(r.rol));
      }
    }
  }

  const nombre =
    rolesObra[0]?.nombre ||
    (empleados?.[0] as { nombre_completo?: string } | undefined)?.nombre_completo ||
    (whitelist as { nombre?: string } | null)?.nombre ||
    chatStr;

  const rolesObraSlugs = rolesObra.map((r) => r.rol);
  return {
    tipo: 'telegram',
    telegramChatId: chatStr,
    nombre,
    email,
    rolesEmpresa,
    rolesObra,
    permisos: combinarPermisos(rolesEmpresa, rolesObraSlugs),
  };
}

export function puedeAprobarProcuraTelegram(actor: ActorPermisos, accion: 'aprobar' | 'almacen' | 'rechazar'): boolean {
  if (accion === 'almacen') {
    return actorTienePermiso(actor, 'procura.usar_almacen');
  }
  if (accion === 'aprobar') {
    return (
      actorTienePermiso(actor, 'procura.aprobar') ||
      actorTienePermiso(actor, 'procura.ejecutar_compra')
    );
  }
  return actorTienePermiso(actor, 'procura.aprobar');
}

export function puedeProcesarEstadoProcuraWeb(actor: ActorPermisos, nuevoEstado: string): boolean {
  const perm = permisoRequeridoParaEstadoProcura(nuevoEstado);
  return actorTienePermiso(actor, perm) || actorTienePermiso(actor, 'procura.aprobar');
}

export function permisosActorComoLista(actor: ActorPermisos): Permiso[] {
  return Array.from(actor.permisos);
}
