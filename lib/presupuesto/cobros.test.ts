import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fechaMasDias,
  repartirCuotas,
  saldoPresupuesto,
  statusDesdeCobro,
} from './cobros';

describe('cobros de presupuesto', () => {
  it('reparte cuotas y deja el residuo en la última', () => {
    assert.deepEqual(repartirCuotas(1000, 3), [333.33, 333.33, 333.34]);
    assert.deepEqual(repartirCuotas(100, 2), [50, 50]);
    assert.deepEqual(repartirCuotas(0, 3), []);
  });

  it('calcula saldo y status desde abonos', () => {
    assert.equal(saldoPresupuesto(1000, 250), 750);
    assert.equal(statusDesdeCobro({ subtotal: 1000, montoPagado: 0, statusActual: 'aprobado' }), 'aprobado');
    assert.equal(statusDesdeCobro({ subtotal: 1000, montoPagado: 200 }), 'parcialmente_pagado');
    assert.equal(statusDesdeCobro({ subtotal: 1000, montoPagado: 1000 }), 'pagado');
  });

  it('avanza fechas de cuota en días', () => {
    assert.equal(fechaMasDias('2026-09-01', 30), '2026-10-01');
  });
});
