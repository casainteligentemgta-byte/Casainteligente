import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseRolComprasTelegram,
  parseTelegramIdNumerico,
} from '@/lib/compras/usuariosSistemaTelegram';
import {
  ROLES_APLICACION_PROYECTO,
  SLUGS_ROLES_APLICACION,
  type RolAplicacionProyectoDef,
} from '@/lib/proyectos/rolesAplicacionProyecto';
import {
  actualizarFilaNominaProyecto,
  crearFilaNominaProyecto,
  eliminarFilaNominaProyecto,
  listarNominaProyecto,
  type FilaNominaProyecto,
} from '@/lib/proyectos/proyectoNomina';

export type RolAplicacionProyectoSlot = {
  slug: string;
  label: string;
  sincronizarComprasTelegram: boolean;
  nomina_id: string | null;
  nombre: string;
  telegram: string;
};

export type GuardarRolAplicacionInput = {
  slug: string;
  nombre?: string;
  telegram?: string;
};

function telegramContacto(fila: FilaNominaProyecto): string {
  if (fila.telegram_chat_id != null) return String(fila.telegram_chat_id);
  if (fila.telegram_telefono) return fila.telegram_telefono;
  if (fila.empleado_telegram_chat_id != null) return String(fila.empleado_telegram_chat_id);
  if (fila.empleado_celular) return fila.empleado_celular;
  return '';
}

function parseTelegramInput(raw: string): { chatId: number | null; telefono: string | null } {
  const t = raw.trim();
  if (!t) return { chatId: null, telefono: null };
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 8 && !t.includes('@')) {
    const chatId = parseTelegramIdNumerico(digits);
    if (chatId != null) return { chatId, telefono: null };
  }
  return { chatId: null, telefono: t.slice(0, 32) };
}

async function sincronizarComprasTelegram(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    rolSlug: string;
    nombre: string;
    chatId: number;
    activo: boolean;
  },
): Promise<void> {
  const rol = parseRolComprasTelegram(params.rolSlug);
  if (!rol) return;

  const row = {
    nombre: params.nombre.slice(0, 150),
    telegram_id: params.chatId,
    rol,
    proyecto_id: params.proyectoId,
    activo: params.activo,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .upsert(row as never, { onConflict: 'telegram_id' });

  if (error?.code === '42P01') return;
  if (error) throw new Error(error.message);
}

export async function listarRolesAplicacionProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<RolAplicacionProyectoSlot[]> {
  const filas = await listarNominaProyecto(supabase, proyectoId);
  const porRol = new Map<string, FilaNominaProyecto>();

  for (const f of filas) {
    if (!SLUGS_ROLES_APLICACION.has(f.rol)) continue;
    if (!porRol.has(f.rol)) porRol.set(f.rol, f);
  }

  return ROLES_APLICACION_PROYECTO.map((def) => {
    const fila = porRol.get(def.slug);
    return {
      slug: def.slug,
      label: def.label,
      sincronizarComprasTelegram: Boolean(def.sincronizarComprasTelegram),
      nomina_id: fila?.id ?? null,
      nombre: fila?.nombre?.trim() || fila?.nombre_display?.trim() || '',
      telegram: fila ? telegramContacto(fila) : '',
    };
  });
}

async function guardarUnRol(
  supabase: SupabaseClient,
  proyectoId: string,
  def: RolAplicacionProyectoDef,
  input: GuardarRolAplicacionInput,
  existente: FilaNominaProyecto | null,
): Promise<void> {
  const nombre = input.nombre?.trim() ?? '';
  const telegramRaw = input.telegram?.trim() ?? '';
  const vacio = !nombre && !telegramRaw;

  if (vacio) {
    if (existente) {
      await eliminarFilaNominaProyecto(supabase, proyectoId, existente.id);
    }
    return;
  }

  if (!nombre) {
    throw new Error(`Indica el nombre para el rol «${def.label}».`);
  }

  const { chatId, telefono } = parseTelegramInput(telegramRaw);
  const payload = {
    categoria: 'empleado' as const,
    rol: def.slug,
    nombre,
    telegram_chat_id: chatId,
    telegram_telefono: telefono,
    activo: true,
  };

  if (existente) {
    await actualizarFilaNominaProyecto(supabase, proyectoId, existente.id, payload);
  } else {
    await crearFilaNominaProyecto(supabase, proyectoId, payload);
  }

  if (def.sincronizarComprasTelegram && chatId != null) {
    await sincronizarComprasTelegram(supabase, {
      proyectoId,
      rolSlug: def.slug,
      nombre,
      chatId,
      activo: true,
    });
  }
}

export async function guardarRolesAplicacionProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  roles: GuardarRolAplicacionInput[],
): Promise<RolAplicacionProyectoSlot[]> {
  const pid = proyectoId.trim();
  const filas = await listarNominaProyecto(supabase, pid);
  const porRol = new Map<string, FilaNominaProyecto>();
  for (const f of filas) {
    if (!SLUGS_ROLES_APLICACION.has(f.rol)) continue;
    if (!porRol.has(f.rol)) porRol.set(f.rol, f);
  }

  const bySlug = new Map(roles.map((r) => [r.slug.trim(), r]));

  for (const def of ROLES_APLICACION_PROYECTO) {
    const input = bySlug.get(def.slug) ?? { slug: def.slug, nombre: '', telegram: '' };
    await guardarUnRol(supabase, pid, def, input, porRol.get(def.slug) ?? null);
  }

  return listarRolesAplicacionProyecto(supabase, pid);
}
