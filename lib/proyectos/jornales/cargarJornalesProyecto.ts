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

function idsDeFilas(rows: Array<{ empleado_id?: unknown } | null> | null | undefined): string[] {
  return (rows ?? [])
    .map((r) => String(r?.empleado_id ?? '').trim())
    .filter(Boolean);
}

/** Unión de IDs de cuadrilla, tarifas y asistencias (sin depender de obra_id = proyecto_id). */
export function unirIdsRosterJornales(
  ...grupos: Array<readonly string[] | null | undefined>
): string[] {
  const ids = new Set<string>();
  for (const g of grupos) {
    if (!g) continue;
    for (const raw of g) {
      const id = String(raw ?? '').trim();
      if (id) ids.add(id);
    }
  }
  return Array.from(ids);
}

/** Honorarios pequeños se tratan como jornal diario; montos de contrato no. */
export function jornalDesdeHonorarios(honorariosUsd: number): number {
  if (!Number.isFinite(honorariosUsd) || honorariosUsd <= 0) return 0;
  if (honorariosUsd <= 200) return Math.round(honorariosUsd * 100) / 100;
  return 0;
}

type ProyectoJornales = {
  id: string;
  nombre: string;
  legacyObraId: string | null;
};

async function cargarProyectoJornales(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<ProyectoJornales> {
  const withLegacy = await supabase
    .from('ci_proyectos')
    .select('id, nombre, legacy_obra_id')
    .eq('id', proyectoId)
    .maybeSingle();

  let row = withLegacy.data as { id?: string; nombre?: string; legacy_obra_id?: string | null } | null;
  let err = withLegacy.error;

  if (err && /legacy_obra_id/i.test(err.message ?? '')) {
    const fallback = await supabase
      .from('ci_proyectos')
      .select('id, nombre')
      .eq('id', proyectoId)
      .maybeSingle();
    row = fallback.data as { id?: string; nombre?: string } | null;
    err = fallback.error;
  }

  if (err) {
    if (esMigracionJornalesPendiente(err.message)) {
      throw new Error('Aplique la migración 382_ci_jornales_obra_y_desviacion.sql en Supabase.');
    }
    throw new Error(err.message);
  }
  if (!row) throw new Error('Proyecto no encontrado');

  const legacy = String(row.legacy_obra_id ?? '').trim();
  return {
    id: String(row.id ?? proyectoId),
    nombre: String(row.nombre ?? 'Proyecto'),
    legacyObraId: legacy || null,
  };
}

function idsObraCuadrilla(proyectoId: string, legacyObraId: string | null): string[] {
  return unirIdsRosterJornales([proyectoId, legacyObraId ?? '']);
}

/**
 * En producción `ci_obra_empleados.obra_id` referencia `ci_obras`, no `ci_proyectos`.
 * Se consulta por proyecto_id (no-op si no hay match) y por `legacy_obra_id` si existe.
 */
async function honorariosCuadrilla(
  supabase: SupabaseClient,
  obraIds: string[],
): Promise<Array<{ empleado_id: string; honorarios_acordados_usd: unknown }>> {
  if (!obraIds.length) return [];
  const { data } = await supabase
    .from('ci_obra_empleados')
    .select('empleado_id, honorarios_acordados_usd')
    .in('obra_id', obraIds);
  return (data ?? []) as Array<{ empleado_id: string; honorarios_acordados_usd: unknown }>;
}

export async function listarRosterJornalesProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<ColaboradorRoster[]> {
  const proy = await cargarProyectoJornales(supabase, proyectoId);
  const obraIds = idsObraCuadrilla(proyectoId, proy.legacyObraId);
  const rosterOpts = await listarEmpleadosProyectoEgreso(supabase, proyectoId);

  const [{ data: tarifas, error: tErr }, honorarios, { data: asisIds, error: aErr }] = await Promise.all([
    supabase
      .from('ci_jornales_obra_tarifas')
      .select('empleado_id, costo_jornal_usd')
      .eq('proyecto_id', proyectoId),
    honorariosCuadrilla(supabase, obraIds),
    supabase
      .from('ci_jornales_obra_asistencias')
      .select('empleado_id')
      .eq('proyecto_id', proyectoId),
  ]);

  const err = tErr ?? aErr;
  if (err) {
    if (esMigracionJornalesPendiente(err.message)) {
      throw new Error('Aplique la migración 382_ci_jornales_obra_y_desviacion.sql en Supabase.');
    }
    throw new Error(err.message);
  }

  return armarRosterJornales({
    supabase,
    rosterOpts,
    tarifas: tarifas ?? [],
    honorarios,
    extraEmpleadoIds: idsDeFilas(asisIds),
  });
}

async function armarRosterJornales(args: {
  supabase: SupabaseClient;
  rosterOpts: Array<{ id: string; nombre_completo: string; oficio: string | null }>;
  tarifas: Array<{ empleado_id?: unknown; costo_jornal_usd?: unknown }>;
  honorarios: Array<{ empleado_id?: unknown; honorarios_acordados_usd?: unknown }>;
  extraEmpleadoIds: string[];
}): Promise<ColaboradorRoster[]> {
  const tarifaPorEmp = new Map<string, number>();
  for (const r of args.tarifas) {
    tarifaPorEmp.set(String(r.empleado_id ?? '').trim(), num(r.costo_jornal_usd));
  }
  const honPorEmp = new Map<string, number>();
  for (const r of args.honorarios) {
    const id = String(r.empleado_id ?? '').trim();
    if (!id) continue;
    honPorEmp.set(id, jornalDesdeHonorarios(num(r.honorarios_acordados_usd)));
  }

  const baseById = new Map(args.rosterOpts.map((e) => [e.id, e]));
  const needed = unirIdsRosterJornales(
    args.rosterOpts.map((e) => e.id),
    idsDeFilas(args.tarifas),
    idsDeFilas(args.honorarios),
    args.extraEmpleadoIds,
  );

  const missing = needed.filter((id) => !baseById.has(id));
  if (missing.length) {
    const { data: extra } = await args.supabase
      .from('ci_empleados')
      .select('id, nombre_completo, cargo_nombre')
      .in('id', missing.slice(0, 200))
      .order('nombre_completo');
    for (const e of extra ?? []) {
      const id = String((e as { id: string }).id);
      baseById.set(id, {
        id,
        nombre_completo: String((e as { nombre_completo?: string }).nombre_completo ?? 'Sin nombre').trim() || 'Sin nombre',
        oficio:
          (e as { cargo_nombre?: string | null }).cargo_nombre != null
            ? String((e as { cargo_nombre?: string | null }).cargo_nombre).trim() || null
            : null,
      });
    }
  }

  return needed
    .map((id) => {
      const e = baseById.get(id);
      return {
        empleado_id: id,
        nombre_completo: e?.nombre_completo ?? 'Colaborador',
        cargo_nombre: e?.oficio ?? null,
        jornal_diario_usd: tarifaPorEmp.get(id) || honPorEmp.get(id) || 0,
      };
    })
    .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
}

export async function cargarJornalesSemana(
  supabase: SupabaseClient,
  proyectoId: string,
  semanaInicioRaw: string,
): Promise<JornalesSemanaPayload> {
  const semanaInicio = lunesDeSemanaJornales(semanaInicioRaw);
  const dias = fechasDeSemana(semanaInicio);
  const proy = await cargarProyectoJornales(supabase, proyectoId);
  const obraIds = idsObraCuadrilla(proyectoId, proy.legacyObraId);
  const rosterOpts = await listarEmpleadosProyectoEgreso(supabase, proyectoId);

  const [{ data: tarifas, error: tErr }, honorarios, { data: asistencias, error: aErr }, { data: acum }] =
    await Promise.all([
      supabase
        .from('ci_jornales_obra_tarifas')
        .select('empleado_id, costo_jornal_usd')
        .eq('proyecto_id', proyectoId),
      honorariosCuadrilla(supabase, obraIds),
      supabase
        .from('ci_jornales_obra_asistencias')
        .select('empleado_id, fecha, costo_jornal')
        .eq('proyecto_id', proyectoId)
        .gte('fecha', dias[0])
        .lte('fecha', dias[6]),
      supabase
        .from('ci_jornales_obra_asistencias')
        .select('empleado_id, costo_jornal')
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

  const roster = await armarRosterJornales({
    supabase,
    rosterOpts,
    tarifas: tarifas ?? [],
    honorarios,
    extraEmpleadoIds: unirIdsRosterJornales(idsDeFilas(asistencias), idsDeFilas(acum)),
  });

  const asistenciasSemana: AsistenciaRaw[] = (asistencias ?? []).map((r) => ({
    empleado_id: String((r as { empleado_id: string }).empleado_id),
    fecha: String((r as { fecha: string }).fecha).slice(0, 10),
    costo_jornal: num((r as { costo_jornal: unknown }).costo_jornal),
  }));

  const costoAcumulado = (acum ?? []).reduce((s, r) => s + num((r as { costo_jornal: unknown }).costo_jornal), 0);

  return construirPayloadJornalesSemana({
    proyectoId,
    proyectoNombre: proy.nombre,
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

  const proy = await cargarProyectoJornales(supabase, proyectoId).catch(() => null);
  const obraIds = idsObraCuadrilla(proyectoId, proy?.legacyObraId ?? null);
  const { data: hon } = await supabase
    .from('ci_obra_empleados')
    .select('honorarios_acordados_usd')
    .in('obra_id', obraIds)
    .eq('empleado_id', empleadoId)
    .limit(1)
    .maybeSingle();
  return jornalDesdeHonorarios(num((hon as { honorarios_acordados_usd?: unknown } | null)?.honorarios_acordados_usd));
}
