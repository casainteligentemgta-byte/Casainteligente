import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolverMontosCompraBimonetario } from './comprasBimonetario';

describe('resolverMontosCompraBimonetario', () => {
  it('con monto 0 no exige tasa BCV (provisional FRM)', async () => {
    const r = await resolverMontosCompraBimonetario({
      montoTotal: 0,
      moneda: 'VES',
      fecha: '2099-01-01',
    });
    assert.equal(r.montoVes, 0);
    assert.equal(r.montoUsd, 0);
    assert.equal(r.tasaApplied, 0);
  });

  it('usa la tasa digitada y no cae a 36.5', async () => {
    const r = await resolverMontosCompraBimonetario({
      montoTotal: 10,
      moneda: 'USD',
      fecha: '2026-01-01',
      tasaBcvDigitada: 50,
    });
    assert.equal(r.montoUsd, 10);
    assert.equal(r.montoVes, 500);
    assert.equal(r.tasaApplied, 50);
  });
});
