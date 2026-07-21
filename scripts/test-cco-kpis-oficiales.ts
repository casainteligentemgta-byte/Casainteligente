/**
 * Prueba rápida de KPIs CCO vs fórmulas V4.
 * npx tsx scripts/test-cco-kpis-oficiales.ts
 */
import {
  calcularKpisOficiales,
  honorariosDeFila,
  resolverMontoBaseUsdKpi,
} from '../lib/contabilidad/cco/kpisOficiales';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function approx(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

// Caso 1: honorarios por fila (no global * gastos)
{
  const k = calcularKpisOficiales({
    ingresosUsd: [1000, 500],
    honorariosPctGlobal: 15,
    gastos: [
      { monto_usd: 200, honorarios_usd: 10, cco_estado: 'PAGADO' }, // 5%
      { monto_usd: 100, honorarios_usd: 0, cco_estado: 'PAGADO' }, // 0%
      { monto_usd: 50, honorarios_usd: 7.5, cco_estado: 'ANULADO' }, // ignorado
    ],
  });
  assert(approx(k.ingresos, 1500), `ingresos ${k.ingresos}`);
  assert(approx(k.gastosNetos, 300), `gastos ${k.gastosNetos}`);
  assert(approx(k.adminDelegada, 10), `admin ${k.adminDelegada} (no 45)`);
  assert(approx(k.costoTotal, 310), `costo ${k.costoTotal}`);
  assert(approx(k.saldoCaja, 1190), `saldo ${k.saldoCaja}`);
  assert(k.countGastos === 2, `countGastos ${k.countGastos}`);
}

// Caso 2: sin honorarios persistidos → usa % global
{
  const h = honorariosDeFila(200, { honorarios_usd: null, admin_pct_override: null }, 15);
  assert(approx(h, 30), `calc honorarios ${h}`);
}

// Caso 3: deriva USD desde VES+tasa
{
  const base = resolverMontoBaseUsdKpi({
    monto_usd: 0,
    monto_ves: 3600,
    tasa_bcv_ves_por_usd: 36,
  });
  assert(approx(base, 100), `base ves ${base}`);
}

// Caso 4: devaluación V4 desde brechas CSV (+35% → ≈ −25,93%)
{
  const k = calcularKpisOficiales({
    ingresosUsd: [100],
    honorariosPctGlobal: 15,
    gastos: [
      { monto_usd: 100, honorarios_usd: 15, porcentaje_brecha_real: 30 },
      { monto_usd: 100, honorarios_usd: 15, porcentaje_brecha_real: 40 },
    ],
  });
  // avg brecha 35 → -35/135*100 ≈ -25.92593
  assert(approx(k.devaluacionPromedioBrechas, -25.92593, 0.001), `brecha ${k.devaluacionPromedioBrechas}`);
}

console.log('OK test-cco-kpis-oficiales');
