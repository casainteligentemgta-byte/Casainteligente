/**
 * Ejecutar: npx tsx --test lib/nomina/calcularSemanaObra.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularSemanaObra } from './calcularSemanaObra';
import {
  diasPagadosClausula8,
  inferirClasePagoObra,
  oficioReciboLegal,
  tocaAdelantoTrasSemana,
  cestaSemanalUsdAnclada,
  SOBRE_AYUDANTE_USD,
  COMPLEMENTO_ALIMENTACION_SEMANAL_USD,
} from './reglasPagoObra';

describe('diasPagadosClausula8', () => {
  it('paga 2 descansos si hay 3 o más jornadas', () => {
    assert.equal(diasPagadosClausula8(5), 7);
    assert.equal(diasPagadosClausula8(3), 5);
    assert.equal(diasPagadosClausula8(4), 6);
  });
  it('no paga descansos con menos de 3 jornadas', () => {
    assert.equal(diasPagadosClausula8(2), 2);
    assert.equal(diasPagadosClausula8(1), 1);
    assert.equal(diasPagadosClausula8(0), 0);
  });
});

describe('inferirClasePagoObra', () => {
  it('marca ayudante por oficio o nombre', () => {
    assert.equal(inferirClasePagoObra('2.1', null), 'ayudante');
    assert.equal(inferirClasePagoObra('1.2', 'Vigilante'), 'ayudante');
    assert.equal(inferirClasePagoObra(null, 'Ayudante de obra'), 'ayudante');
  });
  it('marca clasificado al resto', () => {
    assert.equal(inferirClasePagoObra('5.3', 'CABILLERO DE 1ra.'), 'clasificado');
    assert.equal(inferirClasePagoObra('9.1', null), 'clasificado');
  });
});

describe('oficioReciboLegal', () => {
  it('ayudante siempre es 2.1', () => {
    const o = oficioReciboLegal('ayudante', '5.1', 'ALBAÑIL');
    assert.equal(o.codigo, '2.1');
    assert.equal(o.nivel, 2);
  });
  it('clasificado de 1ra usa el oficio real si es nivel 5+', () => {
    const o = oficioReciboLegal('clasificado', '5.3', null);
    assert.equal(o.codigo, '5.3');
    assert.equal(o.nivel, 5);
    assert.equal(o.diarioVes, 2771.26);
  });
  it('clasificado sin oficio cae en albañil de 1ra', () => {
    const o = oficioReciboLegal('clasificado', null, null);
    assert.equal(o.codigo, '5.1');
    assert.equal(o.denominacion, 'ALBAÑIL DE 1ra.');
  });
});

describe('tocaAdelantoTrasSemana', () => {
  it('la cuarta semana trabajada dispara la quinta', () => {
    assert.equal(tocaAdelantoTrasSemana(3, true), true);
    assert.equal(tocaAdelantoTrasSemana(2, true), false);
    assert.equal(tocaAdelantoTrasSemana(3, false), false);
    assert.equal(tocaAdelantoTrasSemana(7, true), true);
  });
});

describe('calcularSemanaObra', () => {
  /** Tasa tipo homologación: la cesta en USD cabe dentro de 90 / 117. */
  const ancla = 770;
  const tasa = 770;

  it('ayudante 5 días: salario + cesta + complemento fijo de 33 USD', () => {
    const r = calcularSemanaObra({
      clase: 'ayudante',
      tipo: 'semanal',
      diasLaborados: 5,
      tasaBcvPago: tasa,
      tasaAnclaCestaBcv: ancla,
    });
    assert.equal(r.diasPagados, 7);
    assert.equal(r.oficio.codigo, '2.1');
    assert.ok(r.cestaUsdAnclada > 0);
    assert.ok(r.salarioBasicoVes > 0);
    const suma = r.lineasLegal.reduce((a, l) => a + l.usd, 0);
    assert.ok(Math.abs(suma - r.totalUsd) < 0.02);
    assert.equal(r.complementoUsd, COMPLEMENTO_ALIMENTACION_SEMANAL_USD);
    assert.equal(
      r.totalUsd,
      Math.round((r.salarioBasicoUsd + r.cestaUsdAnclada + COMPLEMENTO_ALIMENTACION_SEMANAL_USD) * 100) / 100,
    );
    assert.ok(r.lineasLegal.some((l) => l.codigo === 'CESTA' && !l.salarial));
    assert.ok(r.lineasLegal.some((l) => l.codigo === 'COMP' && /Complemento del beneficio de alimentación/i.test(l.concepto)));
  });

  it('clasificado 5 días: mismo complemento de 33 USD y oficio de 1ra', () => {
    const r = calcularSemanaObra({
      clase: 'clasificado',
      tipo: 'semanal',
      diasLaborados: 5,
      tasaBcvPago: tasa,
      tasaAnclaCestaBcv: ancla,
      cargoCodigo: '5.1',
    });
    assert.equal(r.complementoUsd, COMPLEMENTO_ALIMENTACION_SEMANAL_USD);
    assert.equal(r.oficio.codigo, '5.1');
    assert.match(r.oficio.denominacion, /1ra/i);
    assert.equal(
      r.totalUsd,
      Math.round((r.salarioBasicoUsd + r.cestaUsdAnclada + COMPLEMENTO_ALIMENTACION_SEMANAL_USD) * 100) / 100,
    );
  });

  it('adelanto no duplica cesta y desglosa prestaciones', () => {
    const r = calcularSemanaObra({
      clase: 'ayudante',
      tipo: 'adelanto_prestaciones',
      diasLaborados: 5,
      tasaBcvPago: tasa,
      tasaAnclaCestaBcv: ancla,
    });
    assert.equal(r.cestaUsdAnclada, 0);
    assert.equal(r.diasPagados, 0);
    assert.equal(r.totalUsd, SOBRE_AYUDANTE_USD);
    assert.ok(r.lineasLegal.some((l) => l.codigo === 'PREST'));
    assert.ok(!r.lineasLegal.some((l) => l.codigo === 'CESTA'));
  });

  it('sin jornadas no hay básico ni descansos', () => {
    const r = calcularSemanaObra({
      clase: 'ayudante',
      tipo: 'semanal',
      diasLaborados: 0,
      tasaBcvPago: tasa,
      tasaAnclaCestaBcv: ancla,
    });
    assert.equal(r.diasPagados, 0);
    assert.equal(r.salarioBasicoVes, 0);
  });

  it('el arreglo semanal no altera el complemento fijo de la Cl. SEXTA', () => {
    const r = calcularSemanaObra({
      clase: 'clasificado',
      tipo: 'semanal',
      diasLaborados: 5,
      tasaBcvPago: tasa,
      tasaAnclaCestaBcv: ancla,
      cargoCodigo: '5.1',
      sobreUsd: 130,
    });
    assert.equal(r.complementoUsd, COMPLEMENTO_ALIMENTACION_SEMANAL_USD);
    const suma = r.lineasLegal.reduce((a, l) => a + l.usd, 0);
    assert.ok(Math.abs(suma - r.totalUsd) < 0.02);
  });

  it('un monto pactado inválido en la SÉPTIMA cae al monto por defecto de la clase', () => {
    for (const sobreUsd of [0, -5, Number.NaN, null]) {
      const r = calcularSemanaObra({
        clase: 'ayudante',
        tipo: 'adelanto_prestaciones',
        diasLaborados: 5,
        tasaBcvPago: tasa,
        tasaAnclaCestaBcv: ancla,
        sobreUsd,
      });
      assert.equal(r.sobreUsdPactado, SOBRE_AYUDANTE_USD);
      assert.equal(r.totalUsd, SOBRE_AYUDANTE_USD);
    }
  });

  it('la quinta semana paga el arreglo mensual pactado', () => {
    const r = calcularSemanaObra({
      clase: 'ayudante',
      tipo: 'adelanto_prestaciones',
      diasLaborados: 5,
      tasaBcvPago: tasa,
      tasaAnclaCestaBcv: ancla,
      sobreUsd: 100,
    });
    assert.equal(r.totalUsd, 100);
  });

  it('con una falta sigue el complemento: salario de los días + cesta + 33 USD', () => {
    const r = calcularSemanaObra({
      clase: 'clasificado',
      tipo: 'semanal',
      diasLaborados: 4,
      tasaBcvPago: tasa,
      tasaAnclaCestaBcv: ancla,
      cargoCodigo: '5.1',
      sobreUsd: 115,
    });
    assert.equal(r.diasPagados, 6);
    assert.equal(r.complementoUsd, COMPLEMENTO_ALIMENTACION_SEMANAL_USD);
    assert.ok(r.lineasLegal.some((l) => l.codigo === 'COMP'));
    assert.equal(r.cestaUsdAnclada, cestaSemanalUsdAnclada(ancla));
    const esperado =
      Math.round((r.salarioBasicoUsd + cestaSemanalUsdAnclada(ancla) + COMPLEMENTO_ALIMENTACION_SEMANAL_USD) * 100) /
      100;
    assert.equal(r.totalUsd, esperado);
    assert.equal(r.aplicaPisoLegal, false);
  });

  it('semana completa: salario + cesta + complemento fijo', () => {
    const r = calcularSemanaObra({
      clase: 'clasificado',
      tipo: 'semanal',
      diasLaborados: 5,
      tasaBcvPago: tasa,
      tasaAnclaCestaBcv: ancla,
      cargoCodigo: '5.1',
      sobreUsd: 115,
    });
    assert.equal(r.complementoUsd, COMPLEMENTO_ALIMENTACION_SEMANAL_USD);
    assert.ok(r.lineasLegal.some((l) => l.codigo === 'COMP' && /Complemento del beneficio de alimentación/i.test(l.concepto)));
  });

  it('la compensación de la SÉPTIMA se reparte: 75% de prestaciones, utilidades y el resto alimentación', () => {
    const r = calcularSemanaObra({
      clase: 'clasificado',
      tipo: 'adelanto_prestaciones',
      diasLaborados: 5,
      tasaBcvPago: tasa,
      tasaAnclaCestaBcv: ancla,
      cargoCodigo: '5.1',
      sobreUsd: 115,
    });
    const prest = r.lineasLegal.find((l) => l.codigo === 'PREST')!;
    const util = r.lineasLegal.find((l) => l.codigo === 'UTIL')!;
    const alim = r.lineasLegal.find((l) => l.codigo === 'ALIM')!;
    assert.ok(prest && util && alim);
    assert.ok(Math.abs(r.anticipoPrestacionesVes - r.montoGarantiaPrestacionesVes * 0.75) < 0.05);
    assert.ok(r.lineasLegal.every((l) => !l.salarial));
    const suma = r.lineasLegal.reduce((a, l) => a + l.usd, 0);
    assert.ok(Math.abs(suma - 115) < 0.03);
  });

  it('el complemento es potestativo: sin otorgarlo, salario y cesta aunque la semana esté completa', () => {
    const r = calcularSemanaObra({
      clase: 'clasificado',
      tipo: 'semanal',
      diasLaborados: 5,
      tasaBcvPago: tasa,
      tasaAnclaCestaBcv: ancla,
      cargoCodigo: '5.1',
      sobreUsd: 115,
      otorgarBono: false,
    });
    assert.equal(r.bonoOtorgado, false);
    assert.ok(!r.lineasLegal.some((l) => l.codigo === 'COMP'));
    assert.equal(r.totalUsd, Math.round((r.salarioBasicoUsd + cestaSemanalUsdAnclada(ancla)) * 100) / 100);
  });

  it('cesta anclada baja si sube la tasa de homologación', () => {
    const a = cestaSemanalUsdAnclada(100);
    const b = cestaSemanalUsdAnclada(200);
    assert.ok(a > b);
  });
});
