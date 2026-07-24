import type { SupabaseClient } from '@supabase/supabase-js';
import {
  beneficiosEstimadosUsd,
  burnRateTalentoUsd,
  fechaReferenciaFinObra,
  ingresosContratoUsd,
  margenBrutoPct,
  proyectarUtilidadFinObraUsd,
  seriePresupuestoVsGasto,
  type ProyectoFinSnapshot,
} from '@/lib/finanzas/consolidarDashboardUtilidadReal';

export type DashboardUtilidadRealModel = {
  proyecto: ProyectoFinSnapshot;
  /** Ingresos = contrato / presupuesto referencial (USD). */
  ingresosTotalesUsd: number;
  costosMaterialesUsd: number;
  costosNominaUsd: number;
  costosReclutamientoUsd: number;
  costosBeneficiosUsd: number;
  costosOperacionesEppUsd: number;
  costosIntegralOtrosUsd: number;
  gastoRealAcumuladoUsd: number;
  margenBrutoUsd: number;
  margenBrutoPct: number | null;
  burnRateTalentoSemanalUsd: number;
  proyeccionUtilidadFinalUsd: number;
  serieComparativa: ReturnType<typeof seriePresupuestoVsGasto>;
  partidas: Array<{ id: string; categoria: string; montoUsd: number; detalle: string }>;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Carga y consolida métricas financieras para `ci_proyectos.id` (integral o talento).
 */
export async function fetchDashboardUtilidadRealData(
  supabase: SupabaseClient,
  proyectoId: string,
  opts?: {
    tasaBcvUsdPorVes?: number;
    costePorVacanteReclutamientoUsd?: number;
    tasaBeneficiosSobreNomina?: number;
    costeEppPorUnidadEquipoUsd?: number;
  },
): Promise<DashboardUtilidadRealModel> {
  const id = proyectoId.trim();
  const tasaBcv =
    opts?.tasaBcvUsdPorVes ?? (Number(process.env.NEXT_PUBLIC_TASA_BCV_USD_POR_VES ?? 0) || 36.5);
  const costeVacante =
    opts?.costePorVacanteReclutamientoUsd ?? (Number(process.env.NEXT_PUBLIC_RECRUITMENT_COST_USD ?? 0) || 0);
  const tasaBen = opts?.tasaBeneficiosSobreNomina ?? 0.12;
  const eppUnit = opts?.costeEppPorUnidadEquipoUsd ?? 42;

  const [pRes, matRes, nomRes, needRes, eqRes] = await Promise.all([
    /** `*` evita error si falta `tipo_proyecto` u otras columnas Talento (migración 086 no aplicada). */
    supabase.from('ci_proyectos').select('*').eq('id', id).maybeSingle(),
    supabase.from('ci_materiales_obra').select('costo_usd').eq('obra_id', id),
    supabase.from('ci_obra_empleados').select('honorarios_acordados_usd').eq('obra_id', id),
    supabase
      .from('recruitment_needs')
      .select('id', { count: 'exact', head: true })
      .or(`proyecto_modulo_id.eq.${id},proyecto_id.eq.${id}`),
    supabase.from('ci_proyecto_equipos').select('cantidad').eq('proyecto_id', id),
  ]);

  let proyecto: ProyectoFinSnapshot | null = null;
  if (!pRes.error && pRes.data) {
    const raw = pRes.data as Record<string, unknown>;
    const tipo = String(raw.tipo_proyecto ?? 'integral').trim() || 'integral';
    const base = pRes.data as ProyectoFinSnapshot;
    proyecto = { ...base, tipo_proyecto: tipo };
  } else {
    throw new Error(pRes.error?.message ?? 'Proyecto no encontrado.');
  }
  const ingresosTotalesUsd = ingresosContratoUsd(proyecto, tasaBcv);

  const costosMaterialesUsd = matRes.error
    ? 0
    : (matRes.data ?? []).reduce((s, r) => s + num((r as { costo_usd?: unknown }).costo_usd), 0);
  const costosNominaUsd = nomRes.error
    ? 0
    : (nomRes.data ?? []).reduce((s, r) => s + num((r as { honorarios_acordados_usd?: unknown }).honorarios_acordados_usd), 0);

  const nVacantes = needRes.error ? 0 : (needRes.count ?? 0);
  const costosReclutamientoUsd = nVacantes * costeVacante;

  const costosBeneficiosUsd = beneficiosEstimadosUsd(costosNominaUsd, tasaBen);

  const unidadesEquipo = eqRes.error
    ? 0
    : (eqRes.data ?? []).reduce((s, r) => s + num((r as { cantidad?: unknown }).cantidad), 0);
  const costosOperacionesEppUsd = unidadesEquipo * eppUnit;

  const costosIntegralOtrosUsd = 0;

  const gastoRealAcumuladoUsd =
    costosMaterialesUsd + costosNominaUsd + costosReclutamientoUsd + costosBeneficiosUsd + costosOperacionesEppUsd + costosIntegralOtrosUsd;

  const margenBrutoUsd = ingresosTotalesUsd - gastoRealAcumuladoUsd;
  const margenPct = margenBrutoPct(ingresosTotalesUsd, gastoRealAcumuladoUsd);

  const inicio = proyecto.created_at ? new Date(proyecto.created_at) : new Date();
  const ahora = new Date();
  const finObra = fechaReferenciaFinObra(proyecto);

  const burnRateTalentoSemanalUsd = burnRateTalentoUsd(costosNominaUsd, inicio, ahora);
  const proyeccionUtilidadFinalUsd = proyectarUtilidadFinObraUsd({
    ingresosUsd: ingresosTotalesUsd,
    gastoAcumUsd: gastoRealAcumuladoUsd,
    inicio,
    finObra,
    ahora,
  });

  const serieComparativa = seriePresupuestoVsGasto({
    ingresosUsd: ingresosTotalesUsd,
    gastoRealAcumuladoUsd: gastoRealAcumuladoUsd,
    inicio,
    finObra,
    ahora,
    puntos: 12,
  });

  const partidas: DashboardUtilidadRealModel['partidas'] = [
    {
      id: 'nomina',
      categoria: 'Mano de obra (nómina)',
      montoUsd: costosNominaUsd,
      detalle: 'Suma honorarios_acordados_usd en ci_obra_empleados.',
    },
    {
      id: 'materiales',
      categoria: 'Materiales (obra / integral vía obra_id)',
      montoUsd: costosMaterialesUsd,
      detalle: 'Suma costo_usd en ci_materiales_obra.',
    },
    {
      id: 'operaciones',
      categoria: 'Operaciones (dotación / EPP)',
      montoUsd: costosOperacionesEppUsd,
      detalle: `Heurística: ${unidadesEquipo.toFixed(2)} u. inventario × ${eppUnit} USD.`,
    },
    {
      id: 'reclutamiento',
      categoria: 'Reclutamiento',
      montoUsd: costosReclutamientoUsd,
      detalle: `${nVacantes} vacante(s) × ${costeVacante} USD (NEXT_PUBLIC_RECRUITMENT_COST_USD).`,
    },
    {
      id: 'beneficios',
      categoria: 'Beneficios (IVSS / Cestaticket est.)',
      montoUsd: costosBeneficiosUsd,
      detalle: `${(tasaBen * 100).toFixed(0)}% sobre nómina declarada.`,
    },
  ];

  return {
    proyecto,
    ingresosTotalesUsd,
    costosMaterialesUsd,
    costosNominaUsd,
    costosReclutamientoUsd,
    costosBeneficiosUsd,
    costosOperacionesEppUsd,
    costosIntegralOtrosUsd,
    gastoRealAcumuladoUsd,
    margenBrutoUsd,
    margenBrutoPct: margenPct,
    burnRateTalentoSemanalUsd,
    proyeccionUtilidadFinalUsd,
    serieComparativa,
    partidas,
  };
}
