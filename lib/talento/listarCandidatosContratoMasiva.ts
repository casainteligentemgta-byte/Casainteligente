import type { SupabaseClient } from '@supabase/supabase-js';
import { candidatoDesdeEmpleadoRow, type CandidatoContratoMasiva } from '@/lib/talento/candidatosContratoMasiva';
import { normCedulaToken } from '@/lib/talento/cedulaAuth';
import { esContratoExpressAdministracionDelegada } from '@/lib/talento/filtrarContratosExpressObrero';

const COLS_FULL =
  'id,nombre_completo,nombres,primer_nombre,segundo_nombre,primer_apellido,segundo_apellido,cedula,documento,estado_civil,domicilio_declarado,direccion_domicilio,direccion_habitacion,cargo_nombre,cargo_codigo,rol_buscado,estado_proceso,estado,semaforo,status_evaluacion,examen_completado_at,puntaje_total,hoja_vida_obrero,proyecto_modulo_id,recruitment_need_id';

const COLS_MIN =
  'id,nombre_completo,cedula,documento,cargo_nombre,estado_proceso,estado,semaforo,hoja_vida_obrero,proyecto_modulo_id,recruitment_need_id';

function s(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

async function selectEmpleados(
  db: SupabaseClient,
  filtro: { col: string; values: string[] },
): Promise<Record<string, unknown>[]> {
  if (filtro.values.length === 0) return [];
  const full = await db.from('ci_empleados').select(COLS_FULL).in(filtro.col, filtro.values).limit(800);
  if (!full.error && full.data) return full.data as Record<string, unknown>[];
  const min = await db.from('ci_empleados').select(COLS_MIN).in(filtro.col, filtro.values).limit(800);
  if (min.error) return [];
  return (min.data ?? []) as Record<string, unknown>[];
}

export async function listarCandidatosContratoMasiva(
  db: SupabaseClient,
  proyectoId: string,
): Promise<{ candidatos: CandidatoContratoMasiva[]; error: string | null }> {
  const pid = proyectoId.trim();
  if (!pid) return { candidatos: [], error: 'Falta proyecto_id' };

  const porObra = await selectEmpleados(db, { col: 'proyecto_modulo_id', values: [pid] });
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of porObra) {
    const id = s(r.id);
    if (id) byId.set(id, r);
  }

  const needsA = await db
    .from('recruitment_needs')
    .select('id')
    .eq('proyecto_modulo_id', pid)
    .limit(400);
  let needIds = ((needsA.data ?? []) as { id?: string }[]).map((n) => s(n.id)).filter(Boolean);
  if (needIds.length === 0) {
    const needsB = await db.from('recruitment_needs').select('id').eq('proyecto_id', pid).limit(400);
    if (!needsB.error) {
      needIds = ((needsB.data ?? []) as { id?: string }[]).map((n) => s(n.id)).filter(Boolean);
    }
  }
  if (needIds.length) {
    for (const r of await selectEmpleados(db, { col: 'recruitment_need_id', values: needIds })) {
      const id = s(r.id);
      if (id) byId.set(id, r);
    }
  }

  const obraEmp = await db.from('ci_obra_empleados').select('empleado_id').eq('obra_id', pid).limit(800);
  if (!obraEmp.error && obraEmp.data?.length) {
    const ids = (obraEmp.data as { empleado_id?: string }[]).map((x) => s(x.empleado_id)).filter(Boolean);
    for (const r of await selectEmpleados(db, { col: 'id', values: ids })) {
      const id = s(r.id);
      if (id) byId.set(id, r);
    }
  }

  const express = await db
    .from('ci_contratos_express')
    .select('obrero_cedula,obrero_nombre,tipo_contrato')
    .eq('proyecto_id', pid)
    .limit(800);
  let expressRows = (!express.error ? express.data : null) as
    | { obrero_cedula?: string | null; obrero_nombre?: string | null; tipo_contrato?: string | null }[]
    | null;
  if (express.error && /tipo_contrato|42703|schema cache|column/i.test(express.error.message ?? '')) {
    const lite = await db
      .from('ci_contratos_express')
      .select('obrero_cedula,obrero_nombre')
      .eq('proyecto_id', pid)
      .limit(800);
    expressRows = (!lite.error ? lite.data : null) as typeof expressRows;
  }
  const cedulasContratadas = new Set(
    (expressRows ?? [])
      .filter((r) => !esContratoExpressAdministracionDelegada(r))
      .map((r) => normCedulaToken(r.obrero_cedula ?? ''))
      .filter(Boolean),
  );

  const candidatos = Array.from(byId.values())
    .map((row) => candidatoDesdeEmpleadoRow(row, { yaContratado: false }))
    .map((c) => {
      const ya = cedulasContratadas.has(c.cedula);
      if (!ya) return c;
      return { ...c, yaContratado: true, listo: false };
    })
    .filter((c) => c.empleadoId && c.tieneHv);

  candidatos.sort((a, b) => {
    if (a.yaContratado !== b.yaContratado) return a.yaContratado ? 1 : -1;
    if (a.listo !== b.listo) return a.listo ? -1 : 1;
    return a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' });
  });

  return { candidatos, error: null };
}
