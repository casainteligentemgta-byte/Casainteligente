import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calcularPuntajeCliente, loyaltyTierFromScore } from './customerScore';

const AHORA = new Date('2026-10-11T12:00:00Z');
const HACE_UN_MES = '2026-09-11T12:00:00Z';
const HACE_DOS_ANOS = '2024-10-11T12:00:00Z';

const vacio = { clienteCreadoEn: AHORA.toISOString(), presupuestos: [], obras: [], ventas: [] };

describe('puntaje de fidelidad del cliente', () => {
  it('un cliente nuevo sin operaciones queda en cero', () => {
    const r = calcularPuntajeCliente('c', vacio, AHORA);
    assert.equal(r.score, 0);
    assert.equal(r.tier, 'Bronce');
    assert.equal(r.breakdown.ltvTotalUsd, 0);
  });

  it('cuenta los presupuestos pagados y por pagar (antes sumaban cero)', () => {
    const r = calcularPuntajeCliente(
      'c',
      {
        ...vacio,
        presupuestos: [
          { id: 'a', subtotal: 20000, status: 'pagado', created_at: HACE_UN_MES },
          { id: 'b', subtotal: 5000, status: 'cobrado', created_at: HACE_DOS_ANOS },
          { id: 'c', subtotal: 5000, status: 'parcialmente_pagado', created_at: HACE_DOS_ANOS },
        ],
      },
      AHORA,
    );
    assert.equal(r.breakdown.ltvTotalUsd, 30000);
    assert.equal(r.breakdown.presupuestosAprobadosContribuyentes, 3);
    assert.equal(r.breakdown.recurrencia12m, 1);
    assert.equal(r.breakdown.scoreVolumen, 30);
    // 30 × 0,5 + (1/12 × 100) × 0,3 = 15 + 2,5
    assert.equal(r.score, 18);
  });

  it('no cuenta los enviados ni los rechazados', () => {
    const r = calcularPuntajeCliente(
      'c',
      {
        ...vacio,
        presupuestos: [
          { id: 'a', subtotal: 90000, status: 'enviado', created_at: HACE_UN_MES },
          { id: 'b', subtotal: 90000, status: 'no_aprobado', created_at: HACE_UN_MES },
        ],
      },
      AHORA,
    );
    assert.equal(r.breakdown.ltvTotalUsd, 0);
    assert.equal(r.breakdown.presupuestosAprobadosContribuyentes, 0);
    assert.equal(r.score, 0);
  });

  it('un presupuesto que ya es la base de una obra con monto no se suma dos veces', () => {
    const r = calcularPuntajeCliente(
      'c',
      {
        ...vacio,
        presupuestos: [
          { id: 'p1', subtotal: 10000, status: 'pagado', created_at: HACE_UN_MES },
          { id: 'p2', subtotal: 2000, status: 'pagado', created_at: HACE_UN_MES },
          { id: 'p3', subtotal: 3000, status: 'pagado', created_at: HACE_UN_MES },
        ],
        obras: [
          { id: 'o1', obra_precio_venta_usd: 12000, created_at: HACE_UN_MES, budget_id: 'p1', budgets_adicionales: ['p2'] },
        ],
      },
      AHORA,
    );
    // 12.000 de la obra + 3.000 del presupuesto suelto.
    assert.equal(r.breakdown.ltvTotalUsd, 15000);
    // La obra y el presupuesto suelto: dos operaciones en el año.
    assert.equal(r.breakdown.recurrencia12m, 2);
    assert.equal(r.breakdown.presupuestosAprobadosContribuyentes, 3);
  });

  it('si la obra no tiene monto, su presupuesto sí cuenta', () => {
    const r = calcularPuntajeCliente(
      'c',
      {
        ...vacio,
        presupuestos: [{ id: 'p1', subtotal: 10000, status: 'pagado', created_at: HACE_UN_MES }],
        obras: [{ id: 'o1', created_at: HACE_UN_MES, budget_id: 'p1' }],
      },
      AHORA,
    );
    assert.equal(r.breakdown.ltvTotalUsd, 10000);
  });

  it('la antigüedad suma hasta 20 puntos a los cinco años', () => {
    const r = calcularPuntajeCliente('c', { ...vacio, clienteCreadoEn: '2020-01-01T00:00:00Z' }, AHORA);
    assert.equal(r.breakdown.scoreLealtad, 100);
    assert.equal(r.score, 20);
  });

  it('el puntaje nunca pasa de 100', () => {
    const r = calcularPuntajeCliente(
      'c',
      {
        clienteCreadoEn: '2015-01-01T00:00:00Z',
        presupuestos: Array.from({ length: 20 }, (_, i) => ({
          id: `p${i}`,
          subtotal: 50000,
          status: 'pagado',
          created_at: HACE_UN_MES,
        })),
        obras: [],
        ventas: [],
      },
      AHORA,
    );
    assert.equal(r.score, 100);
    assert.equal(r.tier, 'Platinum');
  });

  it('niveles por puntaje', () => {
    assert.equal(loyaltyTierFromScore(30), 'Bronce');
    assert.equal(loyaltyTierFromScore(31), 'Silver');
    assert.equal(loyaltyTierFromScore(71), 'Gold');
    assert.equal(loyaltyTierFromScore(91), 'Platinum');
  });
});
