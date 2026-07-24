#!/usr/bin/env node
/**
 * Casos dorados Art. 142 LOTTT — verificación sin dependencias del monorepo.
 * Ejecutar: node scripts/legal/verificar_prestacion_antiguedad.mjs
 */

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseDateOnly(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`fecha inválida: ${value}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function relativedeltaYmd(inicio, fin) {
  if (fin < inicio) throw new Error('fecha_fin < fecha_inicio');
  let years = fin.getFullYear() - inicio.getFullYear();
  let months = fin.getMonth() - inicio.getMonth();
  let days = fin.getDate() - inicio.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(fin.getFullYear(), fin.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function aniosServicioComputables(diff) {
  const fraccion = diff.months > 6 || (diff.months === 6 && diff.days > 0);
  return { anios: diff.years + (fraccion ? 1 : 0), fraccion };
}

function calcular(salario, util = 30, bono = 15, inicio = null, fin = null) {
  const diario = salario / 30;
  const alicuotaU = (diario * util) / 360;
  const alicuotaB = (diario * bono) / 360;
  const integral = diario + alicuotaU + alicuotaB;
  const garantia = integral * 15;
  let retro = 0;
  let anios = 0;
  let fraccion = false;
  if (inicio && fin) {
    const diff = relativedeltaYmd(parseDateOnly(inicio), parseDateOnly(fin));
    ({ anios, fraccion } = aniosServicioComputables(diff));
    retro = integral * 60 * anios;
  }
  return {
    integral: round2(integral),
    garantia: round2(garantia),
    retro: round2(retro),
    anios,
    fraccion,
    provision: round2(Math.max(garantia, retro)),
  };
}

function assertEq(label, got, expected, tol = 0.011) {
  if (Math.abs(got - expected) > tol) {
    throw new Error(`${label}: esperado ${expected}, obtenido ${got}`);
  }
}

function assert(label, cond) {
  if (!cond) throw new Error(label);
}

// Caso 1: salario 500, defaults — integral = 500/30 * (1 + 30/360 + 15/360)
{
  const r = calcular(500);
  const expectedIntegral = round2((500 / 30) * (1 + 45 / 360));
  assertEq('caso1 integral', r.integral, expectedIntegral);
  assertEq('caso1 garantia', r.garantia, round2(expectedIntegral * 15));
  assertEq('caso1 provision=garantia', r.provision, r.garantia);
}

// Caso 2: 6 años exactos (2020-01-15 → 2026-01-15) → 6 años, sin fracción
{
  const r = calcular(500, 30, 15, '2020-01-15', '2026-01-15');
  assert('caso2 anios=6', r.anios === 6);
  assert('caso2 sin fraccion', r.fraccion === false);
  assertEq('caso2 retro', r.retro, round2(r.integral * 60 * 6));
}

// Caso 3: 6 años + 6 meses exactos → NO cuenta fracción (no es superior a 6 meses)
{
  const r = calcular(500, 30, 15, '2020-01-15', '2026-07-15');
  assert('caso3 anios=6', r.anios === 6);
  assert('caso3 sin fraccion exacta 6m', r.fraccion === false);
}

// Caso 4: 6 años + 6 meses + 1 día → SÍ fracción superior a seis meses → 7 años
{
  const r = calcular(500, 30, 15, '2020-01-15', '2026-07-16');
  assert('caso4 anios=7', r.anios === 7);
  assert('caso4 fraccion', r.fraccion === true);
  assertEq('caso4 retro', r.retro, round2(r.integral * 60 * 7));
  assert('caso4 provision=retro', r.provision === r.retro);
}

// Caso 5: fechas inválidas / orden
{
  let threw = false;
  try {
    calcular(500, 30, 15, '2026-01-01', '2020-01-01');
  } catch {
    threw = true;
  }
  assert('caso5 orden fechas', threw);
}

console.log('OK — verificar_prestacion_antiguedad: 5 casos dorados Art. 142');
