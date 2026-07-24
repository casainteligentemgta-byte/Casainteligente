import type { SupabaseClient } from '@supabase/supabase-js';
import type { IngenieroResidenteManualInput } from '@/types/campo';
import {
  crearTokenVinculoTelegramEmpleado,
  type IngenieroResidenteRow,
} from '@/lib/campo/ingenieroResidente';

export type DepositarioObraRow = IngenieroResidenteRow;

export type ProyectoTelegramAlmacenConfig = {
  proyectoId: string;
  proyectoNombre: string;
  depositarioAsignado: DepositarioObraRow | null;
  telegramGrupoAlmacenId: number | null;
};

const SELECT_EMPLEADO =
  'id, nombre_completo, nombres, primer_apellido, segundo_apellido, cedula, documento, celular, telefono, cargo_nombre, telegram_chat_id, telegram_username';

function mapEmpleado(row: Record<string, unknown>): DepositarioObraRow {
  const nombre =
    String(row.nombre_completo ?? '').trim() ||
    [row.nombres, row.primer_apellido, row.segundo_apellido]
      .filter(Boolean)
      .map(String)
      .join(' ')
      .trim() ||
    'Sin nombre';
  return {
    id: String(row.id),
    nombre,
    nombres: row.nombres != null ? String(row.nombres).trim() || null : null,
    primerApellido:
      row.primer_apellido != null ? String(row.primer_apellido).trim() || null : null,
    segundoApellido:
      row.segundo_apellido != null ? String(row.segundo_apellido).trim() || null : null,
    cargo: row.cargo_nombre != null ? String(row.cargo_nombre) : null,
    cedula: row.cedula != null ? String(row.cedula) : row.documento != null ? String(row.documento) : null,
    celular: row.celular != null ? String(row.celular) : row.telefono != null ? String(row.telefono) : null,
    telegram_chat_id:
      row.telegram_chat_id != null ? Number(row.telegram_chat_id) : null,
    telegram_username:
      row.telegram_username != null ? String(row.telegram_username) : null,
  };
}

export async function obtenerConfigTelegramAlmacenProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<ProyectoTelegramAlmacenConfig | null> {
  const { data: proy, error } = await supabase
    .from('ci_proyectos')
    .select('id, nombre, depositario_id, telegram_grupo_almacen_id')
    .eq('id', proyectoId)
    .maybeSingle();

  if (error?.code === '42P01' || /depositario_id|telegram_grupo/i.test(error?.message ?? '')) {
    return null;
  }
  if (error) throw new Error(error.message);
  if (!proy) return null;

  let depositarioAsignado: DepositarioObraRow | null = null;
  const depositarioId = proy.depositario_id ? String(proy.depositario_id) : null;
  if (depositarioId) {
    const { data: emp } = await supabase
      .from('ci_empleados')
      .select(SELECT_EMPLEADO)
      .eq('id', depositarioId)
      .maybeSingle();
    depositarioAsignado = emp ? mapEmpleado(emp as Record<string, unknown>) : null;
  }

  return {
    proyectoId: String(proy.id),
    proyectoNombre: String(proy.nombre ?? 'Proyecto'),
    depositarioAsignado,
    telegramGrupoAlmacenId:
      proy.telegram_grupo_almacen_id != null ? Number(proy.telegram_grupo_almacen_id) : null,
  };
}

function nombreCompletoDesdeManual(input: IngenieroResidenteManualInput): string {
  return [input.nombres, input.primerApellido, input.segundoApellido]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
}

function filaEmpleadoDepositario(
  proyectoId: string,
  input: IngenieroResidenteManualInput,
): Record<string, unknown> {
  const nombres = input.nombres.trim();
  const primerApellido = input.primerApellido.trim();
  const segundoApellido = input.segundoApellido?.trim() || null;
  const cedula = input.cedula.trim();
  return {
    nombre_completo: nombreCompletoDesdeManual(input),
    nombres,
    primer_apellido: primerApellido,
    segundo_apellido: segundoApellido,
    cedula,
    documento: cedula,
    cargo_nombre: 'Depositario',
    cargo: 'Depositario',
    rol_buscado: 'Depositario',
    proyecto_modulo_id: proyectoId,
    respuestas_personalidad: {},
    respuestas_logica: {},
    estado_proceso: 'pendiente_cv',
  };
}

export async function asignarDepositarioProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  empleadoId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('ci_proyectos')
    .update({
      depositario_id: empleadoId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proyectoId);
  if (error) throw new Error(error.message);
}

export async function guardarDepositarioObraManual(
  supabase: SupabaseClient,
  proyectoId: string,
  input: IngenieroResidenteManualInput | null,
): Promise<DepositarioObraRow | null> {
  if (!input) {
    await asignarDepositarioProyecto(supabase, proyectoId, null);
    return null;
  }

  const nombres = input.nombres.trim();
  const primerApellido = input.primerApellido.trim();
  const cedula = input.cedula.trim();
  if (!nombres || !primerApellido || !cedula) {
    throw new Error('Nombre, primer apellido y cédula son obligatorios.');
  }

  const config = await obtenerConfigTelegramAlmacenProyecto(supabase, proyectoId);
  const actual = config?.depositarioAsignado ?? null;
  const fila = filaEmpleadoDepositario(proyectoId, input);

  if (actual?.id) {
    const { error } = await supabase.from('ci_empleados').update(fila).eq('id', actual.id);
    if (error) throw new Error(error.message);
    const refreshed = await obtenerConfigTelegramAlmacenProyecto(supabase, proyectoId);
    return refreshed?.depositarioAsignado ?? null;
  }

  const { data, error } = await supabase
    .from('ci_empleados')
    .insert(fila)
    .select(SELECT_EMPLEADO)
    .single();
  if (error) throw new Error(error.message);

  await asignarDepositarioProyecto(supabase, proyectoId, String(data.id));
  return mapEmpleado(data as Record<string, unknown>);
}

export async function actualizarGrupoTelegramAlmacenProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  grupoId: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('ci_proyectos')
    .update({
      telegram_grupo_almacen_id: grupoId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proyectoId);
  if (error) throw new Error(error.message);
}

export { crearTokenVinculoTelegramEmpleado };
