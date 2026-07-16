import type { SupabaseClient } from '@supabase/supabase-js';
import { parseTelegramIdNumerico } from '@/lib/compras/usuariosSistemaTelegram';
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
import {
  definicionRolAplicacion,
  etiquetaRolAplicacion,
  slugDesdeLabelRol,
} from '@/lib/proyectos/rolesAplicacionProyecto';

export type UsuarioBotProyectoRow = {
  id: string;
  rol: string;
  rol_label: string;
  nombre: string;
  id_chat: string;
  activo: boolean;
};

export type CrearUsuarioBotInput = {
  rol: string;
  nombre: string;
  id_chat: string;
  activo?: boolean;
};

export type ActualizarUsuarioBotInput = {
  rol?: string;
  nombre?: string;
  id_chat?: string;
  activo?: boolean;
};

function idChatDesdeFila(fila: FilaNominaProyecto): string {
  if (fila.telegram_chat_id != null) return String(fila.telegram_chat_id);
  if (fila.empleado_telegram_chat_id != null) return String(fila.empleado_telegram_chat_id);
  if (fila.telegram_telefono) return fila.telegram_telefono;
  return '';
}

function filaEsUsuarioBot(fila: FilaNominaProyecto): boolean {
  if (fila.categoria !== 'empleado') return false;
  return Boolean(
    fila.nombre?.trim() ||
      fila.nombre_display?.trim() ||
      fila.telegram_chat_id != null ||
      fila.telegram_telefono?.trim() ||
      fila.empleado_telegram_chat_id != null,
  );
}

function mapFilaBot(fila: FilaNominaProyecto): UsuarioBotProyectoRow {
  const rol = fila.rol.trim();
  return {
    id: fila.id,
    rol,
    rol_label: etiquetaRolAplicacion(rol),
    nombre: fila.nombre?.trim() || fila.nombre_display?.trim() || '',
    id_chat: idChatDesdeFila(fila),
    activo: fila.activo,
  };
}

function parseIdChatInput(raw: string): { chatId: number | null; telefono: string | null } {
  const t = raw.trim();
  if (!t) return { chatId: null, telefono: null };
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 8 && !t.includes('@')) {
    const chatId = parseTelegramIdNumerico(digits);
    if (chatId != null) return { chatId, telefono: null };
  }
  return { chatId: null, telefono: t.slice(0, 32) };
}

function normalizarRolSlug(rol: string): string {
  const t = rol.trim();
  if (!t) throw new Error('El rol es obligatorio.');
  if (definicionRolAplicacion(t)) return t;
  return slugDesdeLabelRol(t);
}

async function desactivarTelegramSistema(
  supabase: SupabaseClient,
  chatId: number,
): Promise<void> {
  const { error } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('telegram_id', chatId);
  if (error?.code === '42P01') return;
  if (error) throw new Error(error.message);
}

async function sincronizarTelegramDesdeUsuarioBot(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    rolSlug: string;
    nombre: string;
    chatId: number | null;
    activo: boolean;
  },
): Promise<void> {
  if (!rolSistemaTelegramDesdeSlugApp(params.rolSlug)) return;
  if (params.chatId == null) return;

  if (params.activo) {
    await sincronizarUsuarioSistemaTelegramProyecto(supabase, {
      proyectoId: params.proyectoId,
      rolSlug: params.rolSlug,
      nombre: params.nombre,
      chatId: params.chatId,
      activo: true,
    });
  } else {
    await desactivarTelegramSistema(supabase, params.chatId);
  }
}

export async function listarUsuariosBotProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<UsuarioBotProyectoRow[]> {
  const filas = await listarNominaProyecto(supabase, proyectoId, {
    categoria: 'empleado',
    soloActivos: false,
  });
  return filas.filter(filaEsUsuarioBot).map(mapFilaBot);
}

export async function crearUsuarioBotProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  input: CrearUsuarioBotInput,
): Promise<UsuarioBotProyectoRow> {
  const pid = proyectoId.trim();
  const nombre = input.nombre?.trim() ?? '';
  const rol = normalizarRolSlug(input.rol);
  const { chatId, telefono } = parseIdChatInput(input.id_chat ?? '');

  if (!nombre) throw new Error('Indica el nombre del usuario.');
  if (!chatId && !telefono) {
    throw new Error('Indica el ID de chat de Telegram (número) o un contacto.');
  }

  const activo = input.activo !== false;
  const creada = await crearFilaNominaProyecto(supabase, pid, {
    categoria: 'empleado',
    rol,
    nombre,
    telegram_chat_id: chatId,
    telegram_telefono: telefono,
  });

  let fila = creada;
  if (!activo) {
    fila = await actualizarFilaNominaProyecto(supabase, pid, creada.id, { activo: false });
  }

  await sincronizarTelegramDesdeUsuarioBot(supabase, {
    proyectoId: pid,
    rolSlug: rol,
    nombre,
    chatId,
    activo,
  });

  return mapFilaBot(fila);
}

export async function actualizarUsuarioBotProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  usuarioId: string,
  input: ActualizarUsuarioBotInput,
): Promise<UsuarioBotProyectoRow> {
  const pid = proyectoId.trim();
  const uid = usuarioId.trim();
  const patch: Parameters<typeof actualizarFilaNominaProyecto>[3] = {};

  if (input.rol !== undefined) patch.rol = normalizarRolSlug(input.rol);
  if (input.nombre !== undefined) {
    const nombre = input.nombre.trim();
    if (!nombre) throw new Error('El nombre no puede estar vacío.');
    patch.nombre = nombre;
  }
  if (input.id_chat !== undefined) {
    const { chatId, telefono } = parseIdChatInput(input.id_chat);
    if (!chatId && !telefono) throw new Error('Indica un ID de chat válido.');
    patch.telegram_chat_id = chatId;
    patch.telegram_telefono = telefono;
  }
  if (input.activo !== undefined) patch.activo = input.activo;

  const fila = await actualizarFilaNominaProyecto(supabase, pid, uid, patch);
  const nombre = fila.nombre?.trim() || fila.nombre_display?.trim() || '';
  const chatId =
    fila.telegram_chat_id != null
      ? Number(fila.telegram_chat_id)
      : fila.empleado_telegram_chat_id != null
        ? Number(fila.empleado_telegram_chat_id)
        : null;

  await sincronizarTelegramDesdeUsuarioBot(supabase, {
    proyectoId: pid,
    rolSlug: fila.rol,
    nombre,
    chatId: chatId != null && Number.isFinite(chatId) ? chatId : null,
    activo: fila.activo,
  });

  return mapFilaBot(fila);
}

export async function eliminarUsuarioBotProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  usuarioId: string,
): Promise<void> {
  const pid = proyectoId.trim();
  const uid = usuarioId.trim();

  const filas = await listarNominaProyecto(supabase, pid, {
    categoria: 'empleado',
    soloActivos: false,
  });
  const fila = filas.find((f) => f.id === uid);
  if (!fila) throw new Error('Usuario no encontrado en esta obra.');

  const chatId =
    fila.telegram_chat_id != null
      ? Number(fila.telegram_chat_id)
      : fila.empleado_telegram_chat_id != null
        ? Number(fila.empleado_telegram_chat_id)
        : null;

  await eliminarFilaNominaProyecto(supabase, pid, uid);

  if (chatId != null && Number.isFinite(chatId) && rolSistemaTelegramDesdeSlugApp(fila.rol)) {
    await desactivarTelegramSistema(supabase, chatId);
  }
}
