import type { SupabaseClient } from '@supabase/supabase-js';
import {
  esCategoriaNominaValida,
  type CategoriaNominaProyecto,
} from '@/lib/proyectos/rolesProyectoNomina';
import { sincronizarWhitelistDesdeNomina } from '@/lib/telegram/chatWhitelist';
import { simulacionBotActiva } from '@/lib/telegram/simulacion/contexto';

/** Rol de la nómina → rol del bot de compras (/procura). Otros roles no necesitan usuario del bot. */
const ROL_BOT_DESDE_NOMINA: Record<string, string> = {
  ingeniero_residente: 'Solicitante',
  comprador: 'Comprador',
  pm_obra: 'Aprobador',
  admin: 'Administrador',
  contador: 'Contador',
};

export function rolBotDesdeNomina(rol: string): string | null {
  return ROL_BOT_DESDE_NOMINA[rol.trim()] ?? null;
}

/**
 * Quien entra a la nómina con un rol que usa /procura (ingeniero, comprador, PM…) y ya
 * tiene Telegram recibe su usuario del bot. Solo se crea si no existe: nunca se cambia
 * el rol de un usuario ya registrado (un administrador no baja a solicitante).
 */
async function asegurarUsuarioBotDesdeNomina(supabase: SupabaseClient, fila: FilaNominaProyecto): Promise<void> {
  const rolBot = rolBotDesdeNomina(fila.rol);
  const chatId = fila.telegram_chat_id ?? fila.empleado_telegram_chat_id;
  if (!rolBot || chatId == null || fila.activo === false || simulacionBotActiva()) return;
  try {
    const { data } = await supabase
      .from('ci_usuarios_sistema_telegram')
      .select('id')
      .eq('telegram_id', chatId)
      .maybeSingle();
    if (data) return;
    const { error } = await supabase.from('ci_usuarios_sistema_telegram').insert({
      nombre: fila.nombre_display.slice(0, 150),
      telegram_id: chatId,
      rol: rolBot,
      proyecto_id: fila.proyecto_id,
      activo: true,
      updated_at: new Date().toISOString(),
    } as never);
    if (error && error.code !== '42P01') console.warn('[nomina] usuario bot', error.message);
  } catch (e) {
    console.warn('[nomina] usuario bot', e);
  }
}

export type FilaNominaProyecto = {
  id: string;
  proyecto_id: string;
  empleado_id: string | null;
  categoria: CategoriaNominaProyecto;
  rol: string;
  email: string | null;
  telegram_chat_id: number | null;
  telegram_telefono: string | null;
  nombre: string | null;
  cedula: string | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
  nombre_display: string;
  cargo_nombre: string | null;
  empleado_email: string | null;
  empleado_celular: string | null;
  empleado_telegram_chat_id: number | null;
};

type RowDb = {
  id: string;
  proyecto_id: string;
  empleado_id: string | null;
  categoria: string;
  rol: string;
  email: string | null;
  telegram_chat_id: number | null;
  telegram_telefono: string | null;
  nombre: string | null;
  cedula: string | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
  ci_empleados?: {
    nombre_completo?: string | null;
    cargo_nombre?: string | null;
    email?: string | null;
    celular?: string | null;
    telefono?: string | null;
    telegram_chat_id?: number | null;
    cedula?: string | null;
    documento?: string | null;
  } | null;
};

function mapFila(row: RowDb): FilaNominaProyecto {
  const emp = row.ci_empleados;
  const nombreEmp = emp?.nombre_completo?.trim() || null;
  const nombreManual = row.nombre?.trim() || null;
  const categoria = row.categoria as CategoriaNominaProyecto;

  return {
    id: row.id,
    proyecto_id: row.proyecto_id,
    empleado_id: row.empleado_id,
    categoria,
    rol: row.rol.trim(),
    email: row.email?.trim() || null,
    telegram_chat_id:
      row.telegram_chat_id != null ? Number(row.telegram_chat_id) : null,
    telegram_telefono: row.telegram_telefono?.trim() || null,
    nombre: nombreManual,
    cedula: row.cedula?.trim() || emp?.cedula?.trim() || emp?.documento?.trim() || null,
    activo: row.activo,
    notas: row.notas?.trim() || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    nombre_display: nombreEmp || nombreManual || 'Sin nombre',
    cargo_nombre: emp?.cargo_nombre?.trim() || null,
    empleado_email: emp?.email?.trim() || null,
    empleado_celular: emp?.celular?.trim() || emp?.telefono?.trim() || null,
    empleado_telegram_chat_id:
      emp?.telegram_chat_id != null ? Number(emp.telegram_chat_id) : null,
  };
}

const SELECT_NOMINA =
  'id,proyecto_id,empleado_id,categoria,rol,email,telegram_chat_id,telegram_telefono,nombre,cedula,activo,notas,created_at,updated_at,ci_empleados(nombre_completo,cargo_nombre,email,celular,telefono,telegram_chat_id,cedula,documento)';

export async function listarNominaProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  opts?: { categoria?: CategoriaNominaProyecto; soloActivos?: boolean },
): Promise<FilaNominaProyecto[]> {
  const pid = proyectoId.trim();
  if (!pid) return [];

  let q = supabase
    .from('ci_proyecto_nomina')
    .select(SELECT_NOMINA)
    .eq('proyecto_id', pid)
    .order('categoria')
    .order('rol')
    .order('nombre');

  if (opts?.categoria) q = q.eq('categoria', opts.categoria);
  if (opts?.soloActivos !== false) q = q.eq('activo', true);

  const { data, error } = await q;
  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => mapFila(r as RowDb));
}

export type CrearNominaProyectoInput = {
  categoria: CategoriaNominaProyecto;
  rol: string;
  empleado_id?: string | null;
  nombre?: string | null;
  cedula?: string | null;
  email?: string | null;
  telegram_chat_id?: number | string | null;
  telegram_telefono?: string | null;
  notas?: string | null;
};

export type ActualizarNominaProyectoInput = Partial<CrearNominaProyectoInput> & {
  activo?: boolean;
};

function parseTelegramChatId(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function validarInputNomina(
  input: CrearNominaProyectoInput,
  modo: 'crear' | 'actualizar',
): string | null {
  if (modo === 'crear') {
    if (!esCategoriaNominaValida(input.categoria)) {
      return 'categoria debe ser obrero o empleado';
    }
    if (!input.rol?.trim()) return 'rol requerido';
    if (!input.empleado_id?.trim() && !input.nombre?.trim()) {
      return 'Indica nombre o vincula un empleado de RRHH';
    }
  }
  if (input.rol !== undefined && !input.rol.trim()) return 'rol no puede estar vacío';
  return null;
}

export async function crearFilaNominaProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  input: CrearNominaProyectoInput,
): Promise<FilaNominaProyecto> {
  const err = validarInputNomina(input, 'crear');
  if (err) throw new Error(err);

  const row = {
    proyecto_id: proyectoId.trim(),
    empleado_id: input.empleado_id?.trim() || null,
    categoria: input.categoria,
    rol: input.rol.trim(),
    nombre: input.nombre?.trim() || null,
    cedula: input.cedula?.trim() || null,
    email: input.email?.trim() || null,
    telegram_chat_id: parseTelegramChatId(input.telegram_chat_id),
    telegram_telefono: input.telegram_telefono?.trim() || null,
    notas: input.notas?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ci_proyecto_nomina')
    .insert(row)
    .select(SELECT_NOMINA)
    .single();

  if (error) throw new Error(error.message);
  const fila = mapFila(data as RowDb);
  await sincronizarWhitelistDesdeNomina(supabase, {
    nominaId: fila.id,
    proyectoId: fila.proyecto_id,
    empleadoId: fila.empleado_id,
    nombre: fila.nombre_display,
    email: fila.email ?? fila.empleado_email,
    telegramChatId: fila.telegram_chat_id ?? fila.empleado_telegram_chat_id,
    activo: fila.activo,
  });
  await asegurarUsuarioBotDesdeNomina(supabase, fila);
  return fila;
}

export async function actualizarFilaNominaProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  nominaId: string,
  input: ActualizarNominaProyectoInput,
): Promise<FilaNominaProyecto> {
  const err = validarInputNomina(input as CrearNominaProyectoInput, 'actualizar');
  if (err) throw new Error(err);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.categoria !== undefined) {
    if (!esCategoriaNominaValida(input.categoria)) throw new Error('categoria inválida');
    patch.categoria = input.categoria;
  }
  if (input.rol !== undefined) patch.rol = input.rol.trim();
  if (input.empleado_id !== undefined) patch.empleado_id = input.empleado_id?.trim() || null;
  if (input.nombre !== undefined) patch.nombre = input.nombre?.trim() || null;
  if (input.cedula !== undefined) patch.cedula = input.cedula?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.telegram_telefono !== undefined) {
    patch.telegram_telefono = input.telegram_telefono?.trim() || null;
  }
  if (input.telegram_chat_id !== undefined) {
    patch.telegram_chat_id = parseTelegramChatId(input.telegram_chat_id);
  }
  if (input.notas !== undefined) patch.notas = input.notas?.trim() || null;
  if (input.activo !== undefined) patch.activo = input.activo;

  const { data, error } = await supabase
    .from('ci_proyecto_nomina')
    .update(patch)
    .eq('id', nominaId.trim())
    .eq('proyecto_id', proyectoId.trim())
    .select(SELECT_NOMINA)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Registro de nómina no encontrado');
  const fila = mapFila(data as RowDb);
  await sincronizarWhitelistDesdeNomina(supabase, {
    nominaId: fila.id,
    proyectoId: fila.proyecto_id,
    empleadoId: fila.empleado_id,
    nombre: fila.nombre_display,
    email: fila.email ?? fila.empleado_email,
    telegramChatId: fila.telegram_chat_id ?? fila.empleado_telegram_chat_id,
    activo: fila.activo,
  });
  await asegurarUsuarioBotDesdeNomina(supabase, fila);
  return fila;
}

export async function eliminarFilaNominaProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  nominaId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ci_proyecto_nomina')
    .delete()
    .eq('id', nominaId.trim())
    .eq('proyecto_id', proyectoId.trim());

  if (error) throw new Error(error.message);
  await sincronizarWhitelistDesdeNomina(supabase, {
    nominaId: nominaId.trim(),
    proyectoId: proyectoId.trim(),
    empleadoId: null,
    nombre: '—',
    email: null,
    telegramChatId: null,
    activo: false,
  });
}

export type EmpleadoNominaOpcion = {
  id: string;
  nombre_completo: string;
  cargo_nombre: string | null;
  cedula: string | null;
  email: string | null;
  celular: string | null;
  telegram_chat_id: number | null;
  categoria_sugerida: CategoriaNominaProyecto;
};

/** Empleados RRHH vinculados al proyecto (cuadrilla + módulo). */
export async function listarEmpleadosDisponiblesNomina(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<EmpleadoNominaOpcion[]> {
  const pid = proyectoId.trim();
  if (!pid) return [];

  const [{ data: links }, { data: modEmps }] = await Promise.all([
    supabase.from('ci_obra_empleados').select('empleado_id').eq('obra_id', pid),
    supabase
      .from('ci_empleados')
      .select(
        'id,nombre_completo,cargo_nombre,cedula,documento,email,celular,telefono,telegram_chat_id,tipo_vacante,rol_examen',
      )
      .eq('proyecto_modulo_id', pid)
      .order('nombre_completo'),
  ]);

  const ids = new Set<string>();
  for (const r of modEmps ?? []) ids.add(String((r as { id: string }).id));
  for (const r of links ?? []) {
    const eid = String((r as { empleado_id?: string }).empleado_id ?? '').trim();
    if (eid) ids.add(eid);
  }

  if (!ids.size) return [];

  const { data: empleados, error } = await supabase
    .from('ci_empleados')
    .select(
      'id,nombre_completo,cargo_nombre,cedula,documento,email,celular,telefono,telegram_chat_id,tipo_vacante,rol_examen',
    )
    .in('id', Array.from(ids).slice(0, 300))
    .order('nombre_completo');

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  return (empleados ?? []).map((e) => {
    const tipo = String((e as { tipo_vacante?: string }).tipo_vacante ?? '').trim();
    const rolEx = String((e as { rol_examen?: string }).rol_examen ?? '').trim();
    const categoria_sugerida: CategoriaNominaProyecto =
      tipo === 'empleado' || rolEx === 'programador' || rolEx === 'tecnico'
        ? 'empleado'
        : 'obrero';

    return {
      id: String(e.id),
      nombre_completo: String(e.nombre_completo ?? 'Sin nombre').trim() || 'Sin nombre',
      cargo_nombre:
        e.cargo_nombre != null ? String(e.cargo_nombre).trim() || null : null,
      cedula:
        (e.cedula != null ? String(e.cedula).trim() : null) ||
        (e.documento != null ? String(e.documento).trim() : null) ||
        null,
      email: e.email != null ? String(e.email).trim() || null : null,
      celular:
        (e.celular != null ? String(e.celular).trim() : null) ||
        (e.telefono != null ? String(e.telefono).trim() : null) ||
        null,
      telegram_chat_id:
        e.telegram_chat_id != null ? Number(e.telegram_chat_id) : null,
      categoria_sugerida,
    };
  });
}
