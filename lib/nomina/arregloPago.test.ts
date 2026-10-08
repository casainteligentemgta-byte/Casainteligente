import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ARREGLO_PAGO_MAX_USD,
  arregloPagoPorDefecto,
  montoArregloValido,
  resolverArregloPago,
} from '@/lib/nomina/arregloPago';
import { previewItemsNomina } from '@/lib/nomina/persistirSemanaObra';

describe('arregloPagoPorDefecto', () => {
  it('ayudante 90 y clasificado 115; el mensual es igual al semanal', () => {
    assert.deepEqual(arregloPagoPorDefecto('2.1', 'AYUDANTE'), { semanalUsd: 90, mensualUsd: 90 });
    assert.deepEqual(arregloPagoPorDefecto('5.1', 'ALBAÑIL DE 1ra.'), { semanalUsd: 115, mensualUsd: 115 });
    assert.deepEqual(arregloPagoPorDefecto(null, null), { semanalUsd: 115, mensualUsd: 115 });
  });
});

describe('montoArregloValido', () => {
  it('acepta número, texto y coma decimal', () => {
    assert.equal(montoArregloValido(115), 115);
    assert.equal(montoArregloValido('120'), 120);
    assert.equal(montoArregloValido(' 97,5 '), 97.5);
  });
  it('rechaza vacío, cero, negativos, texto y montos fuera del tope', () => {
    for (const v of [null, undefined, '', 0, -1, 'abc', ARREGLO_PAGO_MAX_USD + 1]) {
      assert.equal(montoArregloValido(v), null);
    }
  });
});

describe('resolverArregloPago', () => {
  it('sin montos pactados usa el monto por defecto del oficio', () => {
    assert.deepEqual(resolverArregloPago({ cargoCodigo: '2.1' }), { semanalUsd: 90, mensualUsd: 90 });
  });
  it('si solo se pacta el semanal, el mensual lo sigue', () => {
    assert.deepEqual(resolverArregloPago({ semanalUsd: 100, cargoCodigo: '2.1' }), { semanalUsd: 100, mensualUsd: 100 });
  });
  it('respeta un mensual distinto del semanal', () => {
    assert.deepEqual(resolverArregloPago({ semanalUsd: 115, mensualUsd: 80, cargoCodigo: '5.1' }), {
      semanalUsd: 115,
      mensualUsd: 80,
    });
  });
  it('un monto inválido no pisa el monto por defecto', () => {
    assert.deepEqual(resolverArregloPago({ semanalUsd: 'x', mensualUsd: 0, clase: 'ayudante' }), {
      semanalUsd: 90,
      mensualUsd: 90,
    });
  });
});

describe('previewItemsNomina con arreglo pactado', () => {
  it('cada 4 semanas se causa la SÉPTIMA pero no se paga en la nómina semanal', () => {
    const [p] = previewItemsNomina({
      items: [
        { empleado_id: 'e1', clase: 'clasificado', dias_laborados: 5, cargo_codigo: '5.1', sobre_usd: 120, mensual_usd: 60 },
      ],
      previasPorEmpleado: { e1: 3 },
      tasaBcvPago: 770,
      tasaAnclaCestaBcv: 770,
    });
    assert.equal(p!.toca_adelanto, true);
    assert.equal(p!.adelanto, null);
    assert.ok((p!.semanal.totalUsd ?? 0) > 0);
  });
  it('sin completar el ciclo de 4 semanas no se causa la SÉPTIMA', () => {
    const [p] = previewItemsNomina({
      items: [{ empleado_id: 'e1', clase: 'ayudante', dias_laborados: 5, sobre_usd: 95 }],
      previasPorEmpleado: { e1: 2 },
      tasaBcvPago: 770,
      tasaAnclaCestaBcv: 770,
    });
    assert.equal(p!.toca_adelanto, false);
    assert.equal(p!.adelanto, null);
  });
});
