/**
 * Pruebas de conversión brecha CSV → devaluación V4.
 * npx tsx scripts/test-cco-devaluacion-v4.ts
 */
import {
  brechaCsvADevaluacionV4,
  normalizarDevaluacionConfig,
} from '../lib/contabilidad/cco/tasas';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function approx(a: number, b: number, eps = 0.001) {
  return Math.abs(a - b) <= eps;
}

{
  const d = brechaCsvADevaluacionV4(34.45);
  // -34.45/134.45*100 ≈ -25.62216
  assert(approx(d, -25.62216), `34.45 → ${d}`);
}

{
  const d = normalizarDevaluacionConfig(34.45);
  assert(approx(d, -25.62216), `normalize + ${d}`);
}

{
  const d = normalizarDevaluacionConfig(-25.62);
  assert(approx(d, -25.62), `keep negative ${d}`);
}

{
  assert(brechaCsvADevaluacionV4(0) === 0, 'zero');
}

console.log('OK test-cco-devaluacion-v4');
