import type { SupabaseClient } from '@supabase/supabase-js';
import { listarEmpleadosProyectoEgreso } from '@/lib/almacen/listarEmpleadosProyectoEgreso';
import {
  construirPayloadJornalesSemana,
  esMigracionJornalesPendiente,
  type AsistenciaRaw,
  type ColaboradorRoster,
} from '@/lib/proyectos/jornales/calcularJornalesSemana';
import { fechasDeSemana, lunesDeSemanaJornales } from '@/lib/proyectos/jornales/semanaJornales';
import type { JornalesSemanaPayload } from '@/types/jornales';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Honorarios pequeños se tratan como jornal diario; montos de contrato no. */
export function jornalDesdeHonorarios(honorariosUsd: number): number {
  if (!Number.isFinite(honorariosUsd) || honorariosUsd <= 0) return 0;
  if (honorariosUsd <= 200) return Math.round(honorariosUsd * 100) / 100;
  return 0;
}

export async function cargarJornalesSemana(
  supabase: SupabaseClient,
  proyectoId: string,
  semanaInicioRaw: string,
): Promise<JornalesSemanaPayload> {
  const semanaInicio = lunesDeSemanaJornales(semanaInicioRaw);
  const dias = fechasDeSemana(semanaInicio);

  const { data: proy, error: pErr } = await supabase
    .from('ci_proyectos')
    .select('id, nombre')
    .eq('id', proyectoId)
    .maybeSingle();
  if (pErr) {
    if (esMigracionJornalesPendiente(pErr.message)) {
      throw new Error('Aplique la migración 382_ci_jornales_obra_y_desviacion.sql en Supabase.');
    }
    throw new Error(pErr.message);
  }
  if (!proy) throw new Error('Proyecto no encontrado');

  const rosterOpts = await listarEmpleadosProyectoEgreso(supabase, proyectoId);

  const [{ data: tarifas, error: tErr }, { data: honorarios }, { data: asistencias, error: aErr }, { data: acum }] =
    await Promise.all([
      supabase
        .from('ci_jornales_obra_tarifas')
        .select('empleado_id, costo_jornal_usd')
        .eq('proyecto_id', proyectoId),
      supabase.from('ci_obra_empleados').select('empleado_id, honorarios_acordados_usd').eq('obra_id', proyectoId),
      supabase
        .from('ci_jornales_obra_asistencias')
        .select('empleado_id, fecha, costo_jornal')
        .eq('proyecto_id', proyectoId)
        .gte('fecha', dias[0])
        .lte('fecha', dias[6]),
      supabase
        .from('ci_jornales_obra_asistencias')
        .select('costo_jornal')
        .eq('proyecto_id', proyectoId)
        .eq('estado', 'presente'),
    ]);

  const err = tErr ?? aErr;
  if (err) {
    if (esMigracionJornalesPendiente(err.message)) {
      throw new Error('Aplique la migración 382_ci_jornales_obra_y_desviacion.sql en Supabase.');
    }
    throw new Error(err.message);
  }

  const tarifaPorEmp = new Map<string, number>();
  for (const r of tarifas ?? []) {
    tarifaPorEmp.set(String((r as { empleado_id: string }).empleado_id), num((r as { costo_jornal_usd: unknown }).costo_jornal_usd));
  }
  const honPorEmp = new Map<string, number>();
  for (const r of honorarios ?? []) {
    honPorEmp.set(
      String((r as { empleado_id: string }).empleado_id),
      jornalDesdeHonorarios(num((r as { honorarios_acordados_usd: unknown }).honorarios_acordados_usd)),
    );
  }

  const roster: ColaboradorRoster[] = rosterOpts.map((e) => ({
    empleado_id: e.id,
    nombre_completo: e.nombre_completo,
    cargo_nombre: e.oficio,
    jornal_diario_usd: tarifaPorEmp.get(e.id) || honPorEmp.get(e.id) || 0,
  }));

  const asistenciasSemana: AsistenciaRaw[] = (asistencias ?? []).map((r) => ({
    empleado_id: String((r as { empleado_id: string }).empleado_id),
    fecha: String((r as { fecha: string }).fecha).slice(0, 10),
    costo_jornal: num((r as { costo_jornal: unknown }).costo_jornal),
  }));

  const costoAcumulado = (acum ?? []).reduce((s, r) => s + num((r as { costo_jornal: unknown }).costo_jornal), 0);

  return construirPayloadJornalesSemana({
    proyectoId,
    proyectoNombre: String((proy as { nombre?: string }).nombre ?? 'Proyecto'),
    semanaInicio,
    roster,
    asistenciasSemana,
    costoAcumuladoProyectoUsd: costoAcumulado,
  });
}

export async function resolverCostoJornal(
  supabase: SupabaseClient,
  proyectoId: string,
  empleadoId: string,
  override?: number,
): Promise<number> {
  if (override != null && Number.isFinite(override) && override >= 0) return override;
  const { data: tarifa } = await supabase
    .from('ci_jornales_obra_tarifas')
    .select('costo_jornal_usd')
    .eq('proyecto_id', proyectoId)
    .eq('empleado_id', empleadoId)
    .maybeSingle();
  const t = num((tarifa as { costo_jornal_usd?: unknown } | null)?.costo_jornal_usd);
  if (t > 0) return t;
  const { data: hon } = await supabase
    .from('ci_obra_empleados')
    .select('honorarios_acordados_usd')
    .eq('obra_id', proyectoId)
    .eq('empleado_id', empleadoId)
    .maybeSingle();
  return jornalDesdeHonorarios(num((hon as { honorarios_acordados_usd?: unknown } | null)?.honorarios_acordados_usd));
}
