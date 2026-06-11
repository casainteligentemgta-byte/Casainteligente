import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseTelegramIdNumerico,
} from '@/lib/compras/usuariosSistemaTelegram';
import {
  ROLES_APLICACION_PROYECTO,
  SLUGS_ROLES_APLICACION,
  definicionRolAplicacion,
  esRolComprasTelegramSlug,
  etiquetaRolAplicacion,
  slugDesdeLabelRol,
  type RolAplicacionProyectoDef,
} from '@/lib/proyectos/rolesAplicacionProyecto';
import {
  rolSistemaTelegramDesdeSlugApp,
  sincronizarUsuarioSistemaTelegramProyecto,
} from '@/lib/procuras/aprobadoresProcuraTelegram';
import {
  actualizarFilaNominaProyecto,
  crearFilaNominaProyecto,
  eliminarFilaNominaProyecto,
  listarNominaProyecto,
  type FilaNominaProyecto,
} from '@/lib/proyectos/proyectoNomina';

export type RolAplicacionProyectoSlot = {
  filaKey: string;
  slug: string;
  label: string;
  sincronizarComprasTelegram: boolean;
  nomina_id: string | null;
  nombre: string;
  telegram: string;
  /** Fila adicional (otro usuario o rol personalizado). */
  esExtra: boolean;
};

export type GuardarRolAplicacionInput = {
  filaKey?: string;
  slug: string;
  label?: string;
  nomina_id?: string | null;
  nombre?: string;
  telegram?: string;
  esExtra?: boolean;
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

function defParaSlug(slug: string, label?: string): RolAplicacionProyectoDef {
  const hit = definicionRolAplicacion(slug);
  if (hit) return hit;
  const lbl = label?.trim() || etiquetaRolAplicacion(slug);
  return {
    slug,
    label: lbl,
    sincronizarComprasTelegram: esRolComprasTelegramSlug(slug),
  };
}

async function sincronizarTelegramDesdeRolProyecto(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    rolSlug: string;
    nombre: string;
    chatId: number;
  },
): Promise<void> {
  if (!rolSistemaTelegramDesdeSlugApp(params.rolSlug)) return;
  await sincronizarUsuarioSistemaTelegramProyecto(supabase, {
    proyectoId: params.proyectoId,
    rolSlug: params.rolSlug,
    nombre: params.nombre,
    chatId: params.chatId,
  });
}

function filaTieneDatos(f: FilaNominaProyecto): boolean {
  return Boolean(
    f.nombre?.trim() ||
      f.nombre_display?.trim() ||
      f.telegram_chat_id != null ||
      f.telegram_telefono?.trim() ||
      f.empleado_telegram_chat_id != null,
  );
}

export async function listarRolesAplicacionProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<RolAplicacionProyectoSlot[]> {
  const filas = await listarNominaProyecto(supabase, proyectoId);
  const porRolCatalogo = new Map<string, FilaNominaProyecto>();
  const extras: FilaNominaProyecto[] = [];

  for (const f of filas) {
    if (f.categoria !== 'empleado') continue;
    if (SLUGS_ROLES_APLICACION.has(f.rol) && !porRolCatalogo.has(f.rol)) {
      porRolCatalogo.set(f.rol, f);
    } else if (filaTieneDatos(f)) {
      extras.push(f);
    }
  }

  const catalogo: RolAplicacionProyectoSlot[] = ROLES_APLICACION_PROYECTO.map((def) => {
    const fila = porRolCatalogo.get(def.slug);
    return {
      filaKey: `cat:${def.slug}`,
      slug: def.slug,
      label: def.label,
      sincronizarComprasTelegram: Boolean(def.sincronizarComprasTelegram),
      nomina_id: fila?.id ?? null,
      nombre: fila?.nombre?.trim() || fila?.nombre_display?.trim() || '',
      telegram: fila ? telegramContacto(fila) : '',
      esExtra: false,
    };
  });

  const extrasSlots: RolAplicacionProyectoSlot[] = extras.map((fila) => {
    const def = defParaSlug(fila.rol);
    return {
      filaKey: `ext:${fila.id}`,
      slug: fila.rol,
      label: def.label,
      sincronizarComprasTelegram: Boolean(def.sincronizarComprasTelegram),
      nomina_id: fila.id,
      nombre: fila.nombre?.trim() || fila.nombre_display?.trim() || '',
      telegram: telegramContacto(fila),
      esExtra: true,
    };
  });

  return [...catalogo, ...extrasSlots];
}

async function guardarUnRol(
  supabase: SupabaseClient,
  proyectoId: string,
  def: RolAplicacionProyectoDef,
  input: GuardarRolAplicacionInput,
  existente: FilaNominaProyecto | null,
): Promise<string | null> {
  const nombre = input.nombre?.trim() ?? '';
  const telegramRaw = input.telegram?.trim() ?? '';
  const vacio = !nombre && !telegramRaw;

  if (vacio) {
    if (existente) {
      await eliminarFilaNominaProyecto(supabase, proyectoId, existente.id);
    }
    return null;
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

  let filaId = existente?.id ?? input.nomina_id?.trim() ?? null;

  if (filaId) {
    await actualizarFilaNominaProyecto(supabase, proyectoId, filaId, payload);
  } else {
    const creada = await crearFilaNominaProyecto(supabase, proyectoId, payload);
    filaId = creada.id;
  }

  if (def.sincronizarComprasTelegram && chatId != null) {
    await sincronizarTelegramDesdeRolProyecto(supabase, {
      proyectoId,
      rolSlug: def.slug,
      nombre,
      chatId,
    });
  } else if (chatId != null && rolSistemaTelegramDesdeSlugApp(def.slug)) {
    await sincronizarTelegramDesdeRolProyecto(supabase, {
      proyectoId,
      rolSlug: def.slug,
      nombre,
      chatId,
    });
  }

  return filaId;
}

export async function guardarRolesAplicacionProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  roles: GuardarRolAplicacionInput[],
  eliminados: string[] = [],
): Promise<RolAplicacionProyectoSlot[]> {
  const pid = proyectoId.trim();
  const filas = await listarNominaProyecto(supabase, pid);
  const porRolCatalogo = new Map<string, FilaNominaProyecto>();
  for (const f of filas) {
    if (f.categoria !== 'empleado') continue;
    if (SLUGS_ROLES_APLICACION.has(f.rol) && !porRolCatalogo.has(f.rol)) {
      porRolCatalogo.set(f.rol, f);
    }
  }

  const porNominaId = new Map(filas.map((f) => [f.id, f]));

  for (const id of eliminados) {
    const nid = id.trim();
    if (!nid || !porNominaId.has(nid)) continue;
    await eliminarFilaNominaProyecto(supabase, pid, nid);
  }

  const catalogoInputs = roles.filter((r) => !r.esExtra);
  const extraInputs = roles.filter((r) => r.esExtra);

  const bySlug = new Map(catalogoInputs.map((r) => [r.slug.trim(), r]));

  for (const def of ROLES_APLICACION_PROYECTO) {
    const input = bySlug.get(def.slug) ?? { slug: def.slug, nombre: '', telegram: '' };
    const existente = porRolCatalogo.get(def.slug) ?? null;
    await guardarUnRol(supabase, pid, def, input, existente);
  }

  for (const input of extraInputs) {
    const nombre = input.nombre?.trim() ?? '';
    const telegramRaw = input.telegram?.trim() ?? '';
    const labelRaw = input.label?.trim() ?? '';
    if (!nombre && !telegramRaw && !labelRaw && !input.slug?.trim()) continue;

    const label = labelRaw || etiquetaRolAplicacion(input.slug);
    if (!input.slug?.trim() && !labelRaw && (nombre || telegramRaw)) {
      throw new Error('Indica el nombre del rol personalizado.');
    }
    const slug = input.slug?.trim() || slugDesdeLabelRol(label);
    const def = defParaSlug(slug, label);
    const nominaId = input.nomina_id?.trim() || null;
    const existente = nominaId ? (porNominaId.get(nominaId) ?? null) : null;
    await guardarUnRol(supabase, pid, def, { ...input, slug: def.slug, label: def.label }, existente);
  }

  return listarRolesAplicacionProyecto(supabase, pid);
}
