import type { SupabaseClient } from '@supabase/supabase-js';
import { calcularCostoHoraTotal, normCargo } from '@/lib/finanzas/costoHoraNomina';

const HORAS_DEFAULT_MES = 160;

export type NominaConfigRow = {
  id: string;
  cargo_nombre: string;
  cargo_codigo: string | null;
  salario_base_mensual: number;
  factor_prestacional: number;
  cestaticket_mensual: number;
  costo_hora_total: number;
};

export type LaborCostLine = {
  empleado_id: string;
  nombre_completo: string;
  cargo_nombre: string | null;
  fuente: 'obra_cuadrilla' | 'proyecto_modulo';
  horas_mes: number;
  costo_hora_aplicado: number;
  costo_mes: number;
};

export type CalculateLaborCostResult = {
  proyecto_id: string;
  totalCostoPersonal: number;
  moneda: 'VES';
  lineas: LaborCostLine[];
  sinConfigMatch: Array<{ empleado_id: string; cargo_nombre: string | null }>;
};

function mapConfig(rows: NominaConfigRow[]): Map<string, NominaConfigRow> {
  const m = new Map<string, NominaConfigRow>();
  for (const r of rows) {
    m.set(normCargo(r.cargo_nombre), r);
    if (r.cargo_codigo) m.set(normCargo(r.cargo_codigo), r);
  }
  return m;
}

function matchConfig(cfg: Map<string, NominaConfigRow>, cargoNombre: string | null, cargoCodigo: string | null) {
  if (cargoCodigo) {
    const byCode = cfg.get(normCargo(cargoCodigo));
    if (byCode) return byCode;
  }
  if (cargoNombre) {
    const byName = cfg.get(normCargo(cargoNombre));
    if (byName) return byName;
  }
  return null;
}

/**
 * Cruza obreros del proyecto (cuadrilla `ci_obra_empleados` + asignación `ci_empleados.proyecto_modulo_id`),
 * aplica `ci_config_nomina` y devuelve gasto de personal estimado (VES) según horas mensuales.
 */
export async function calculateLaborCost(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CalculateLaborCostResult> {
  const pid = proyectoId.trim();
  const { data: cfgRaw, error: e0 } = await supabase.from('ci_config_nomina').select('*');
  if (e0) throw new Error(e0.message);
  const configs = (cfgRaw ?? []) as NominaConfigRow[];
  const cfgMap = mapConfig(configs);

  const [{ data: links }, { data: modEmps }] = await Promise.all([
    supabase.from('ci_obra_empleados').select('empleado_id, horas_costeo_mes').eq('obra_id', pid),
    supabase.from('ci_empleados').select('id,nombre_completo,cargo_nombre,cargo_codigo').eq('proyecto_modulo_id', pid),
  ]);

  const linkIds = Array.from(
    new Set((links ?? []).map((r) => String((r as { empleado_id?: string }).empleado_id ?? '').trim()).filter(Boolean)),
  );
  const empById = new Map<string, { nombre_completo: string; cargo_nombre: string | null; cargo_codigo: string | null }>();
  if (linkIds.length) {
    const { data: emRows } = await supabase
      .from('ci_empleados')
      .select('id,nombre_completo,cargo_nombre,cargo_codigo')
      .in('id', linkIds);
    for (const e of emRows ?? []) {
      const id = String((e as { id: string }).id);
      empById.set(id, {
        nombre_completo: String((e as { nombre_completo?: string }).nombre_completo ?? '—'),
        cargo_nombre: (e as { cargo_nombre?: string | null }).cargo_nombre ?? null,
        cargo_codigo: (e as { cargo_codigo?: string | null }).cargo_codigo ?? null,
      });
    }
  }

  const lineas: LaborCostLine[] = [];
  const sinMatch: CalculateLaborCostResult['sinConfigMatch'] = [];
  const seen = new Set<string>();

  for (const row of links ?? []) {
    const empleadoId = String((row as { empleado_id?: string }).empleado_id ?? '');
    if (!empleadoId || seen.has(empleadoId)) continue;
    seen.add(empleadoId);
    const emb = empById.get(empleadoId);
    const nombre = emb?.nombre_completo ?? '—';
    const cargoNombre = emb?.cargo_nombre ?? null;
    const cargoCodigo = emb?.cargo_codigo ?? null;
    const horas = Number((row as { horas_costeo_mes?: unknown }).horas_costeo_mes);
    const horasMes = Number.isFinite(horas) && horas > 0 ? horas : HORAS_DEFAULT_MES;
    const c = matchConfig(cfgMap, cargoNombre, cargoCodigo);
    if (!c) {
      sinMatch.push({ empleado_id: empleadoId, cargo_nombre: cargoNombre });
      continue;
    }
    const costoHora =
      typeof c.costo_hora_total === 'number' && Number.isFinite(c.costo_hora_total)
        ? c.costo_hora_total
        : calcularCostoHoraTotal(c.salario_base_mensual, c.factor_prestacional, c.cestaticket_mensual);
    const costoMes = costoHora * horasMes;
    lineas.push({
      empleado_id: empleadoId,
      nombre_completo: nombre,
      cargo_nombre: cargoNombre,
      fuente: 'obra_cuadrilla',
      horas_mes: horasMes,
      costo_hora_aplicado: costoHora,
      costo_mes: costoMes,
    });
  }

  for (const emp of modEmps ?? []) {
    const empleadoId = String((emp as { id?: string }).id ?? '');
    if (!empleadoId || seen.has(empleadoId)) continue;
    seen.add(empleadoId);
    const nombre = String((emp as { nombre_completo?: string }).nombre_completo ?? '—');
    const cargoNombre = (emp as { cargo_nombre?: string | null }).cargo_nombre ?? null;
    const cargoCodigo = (emp as { cargo_codigo?: string | null }).cargo_codigo ?? null;
    const horasMes = HORAS_DEFAULT_MES;
    const c = matchConfig(cfgMap, cargoNombre, cargoCodigo);
    if (!c) {
      sinMatch.push({ empleado_id: empleadoId, cargo_nombre: cargoNombre });
      continue;
    }
    const costoHora =
      typeof c.costo_hora_total === 'number' && Number.isFinite(c.costo_hora_total)
        ? c.costo_hora_total
        : calcularCostoHoraTotal(c.salario_base_mensual, c.factor_prestacional, c.cestaticket_mensual);
    const costoMes = costoHora * horasMes;
    lineas.push({
      empleado_id: empleadoId,
      nombre_completo: nombre,
      cargo_nombre: cargoNombre,
      fuente: 'proyecto_modulo',
      horas_mes: horasMes,
      costo_hora_aplicado: costoHora,
      costo_mes: costoMes,
    });
  }

  const totalCostoPersonal = lineas.reduce((s, l) => s + l.costo_mes, 0);

  return {
    proyecto_id: pid,
    totalCostoPersonal,
    moneda: 'VES',
    lineas,
    sinConfigMatch: sinMatch,
  };
}
