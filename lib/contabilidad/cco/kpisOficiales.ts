/**
 * KPIs oficiales CCO alineados al programa madre V4.
 *
 * TOTAL INGRESOS  = Σ inyecciones.monto_usd
 * GASTOS NETOS    = Σ monto_base_usd de GASTOS (excl. ANULADO)
 * ADMIN DELEGADA  = Σ honorarios por fila (persistidos o calculados)
 * COSTO TOTAL     = GASTOS NETOS + ADMIN DELEGADA
 * SALDO EN CAJA   = TOTAL INGRESOS − COSTO TOTAL
 */

import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';

export type CcoGastoKpiInput = {
  monto_usd?: number | null;
  monto_ves?: number | null;
  tasa_bcv_ves_por_usd?: number | null;
  tasa_binance?: number | null;
  moneda_original?: string | null;
  honorarios_usd?: number | null;
  admin_pct_override?: number | null;
  cco_estado?: string | null;
  porcentaje_brecha_real?: number | null;
};

export type CcoKpisOficiales = {
  ingresos: number;
  gastosNetos: number;
  adminDelegada: number;
  costoTotal: number;
  saldoCaja: number;
  countIngresos: number;
  countGastos: number;
  /** % efectivo = admin / gastos (puede diferir del % global de config). */
  honorariosPctEfectivo: number;
  /** Promedio simple de porcentaje_brecha_real en gastos válidos. */
  devaluacionPromedioBrechas: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Deriva USD si monto_usd falta pero hay VES + tasa (CSV / import mal tipado). */
export function resolverMontoBaseUsdKpi(
  row: Pick<
    CcoGastoKpiInput,
    'monto_usd' | 'monto_ves' | 'tasa_bcv_ves_por_usd' | 'tasa_binance' | 'moneda_original'
  >,
): number {
  const montoUsd = num(row.monto_usd);
  if (montoUsd > 0) return montoUsd;
  const montoVes = num(row.monto_ves);
  const tasaBcv = num(row.tasa_bcv_ves_por_usd);
  const tasaBin = num(row.tasa_binance);
  const tasa = tasaBcv > 0 ? tasaBcv : tasaBin > 0 ? tasaBin : 0;
  if (montoVes > 0 && tasa > 0) return montoVes / tasa;
  return 0;
}

export function esGastoAnulado(estado: string | null | undefined): boolean {
  return /^ANULADO$/i.test(String(estado ?? '').trim());
}

/**
 * Honorarios de una fila: usa honorarios_usd persistido (V4) si viene informado;
 * si no, calcula con % fila o % global (misma regla que el libro maestro).
 */
export function honorariosDeFila(
  baseUsd: number,
  row: Pick<CcoGastoKpiInput, 'honorarios_usd' | 'admin_pct_override'>,
  pctGlobal: number,
): number {
  if (row.honorarios_usd != null) {
    const h = num(row.honorarios_usd);
    if (Number.isFinite(h)) return h;
  }
  return aplicarHonorariosABase(baseUsd, row.admin_pct_override, pctGlobal).honorariosUsd;
}

export function calcularKpisOficiales(opts: {
  ingresosUsd: number[];
  gastos: CcoGastoKpiInput[];
  honorariosPctGlobal: number;
}): CcoKpisOficiales {
  const pctGlobal = Number(opts.honorariosPctGlobal) || 15;

  let ingresos = 0;
  let countIngresos = 0;
  for (const u of opts.ingresosUsd) {
    const n = num(u);
    ingresos += n;
    countIngresos += 1;
  }

  let gastosNetos = 0;
  let adminDelegada = 0;
  let countGastos = 0;
  let sumaBrecha = 0;
  let nBrecha = 0;

  for (const row of opts.gastos) {
    if (esGastoAnulado(row.cco_estado)) continue;
    const base = resolverMontoBaseUsdKpi(row);
    if (base <= 0) continue;
    const honorarios = honorariosDeFila(base, row, pctGlobal);
    gastosNetos += base;
    adminDelegada += honorarios;
    countGastos += 1;
    if (row.porcentaje_brecha_real != null) {
      const b = num(row.porcentaje_brecha_real);
      if (Number.isFinite(b)) {
        sumaBrecha += b;
        nBrecha += 1;
      }
    }
  }

  const costoTotal = gastosNetos + adminDelegada;
  const saldoCaja = ingresos - costoTotal;
  const honorariosPctEfectivo =
    gastosNetos > 0 ? Math.round((adminDelegada / gastosNetos) * 100000) / 1000 : pctGlobal;
  const devaluacionPromedioBrechas =
    nBrecha > 0 ? Math.round((sumaBrecha / nBrecha) * 100000) / 100000 : 0;

  return {
    ingresos,
    gastosNetos,
    adminDelegada,
    costoTotal,
    saldoCaja,
    countIngresos,
    countGastos,
    honorariosPctEfectivo,
    devaluacionPromedioBrechas,
  };
}
